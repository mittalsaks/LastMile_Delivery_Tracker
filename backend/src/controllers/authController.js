const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { sendEmail } = require("../config/mailer");
const { buildAgentApprovalRequestEmail } = require("../templates/agentApprovalEmailTemplate");
const { buildResetPasswordEmail } = require("../templates/resetPasswordEmailTemplate");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Notifies every admin account that a new agent needs document review.
// Never throws — a failed email must never block registration itself.
async function notifyAdminsOfPendingAgent(agent) {
  try {
    const admins = await User.find({ role: "admin", isActive: true }).select("email");
    if (!admins.length) return;

    const { subject, html } = buildAgentApprovalRequestEmail({
      agentName: agent.name,
      agentEmail: agent.email,
      agentPhone: agent.phone,
    });

    await Promise.all(
      admins.map((admin) =>
        sendEmail({ to: admin.email, subject, html }).catch((err) =>
          console.error(`[authController] Failed to email admin ${admin.email}:`, err.message)
        )
      )
    );
  } catch (err) {
    console.error("[authController] notifyAdminsOfPendingAgent failed:", err.message);
  }
}

// @desc    Register a new user (customer / agent / admin)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, role, address } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Only allow customer/agent self-registration.
    // Admin accounts are created only via the one-time /setup-first-admin
    // bootstrap, or afterwards via /create-admin by an existing admin.
    const allowedRoles = ["customer", "agent"];
    const finalRole = allowedRoles.includes(role) ? role : "customer";

    let identityDocuments;
    if (finalRole === "agent") {
      // Agents must submit Aadhaar + Driving License (number + scanned doc).
      // PAN is optional. req.files is populated by the handleAgentDocuments
      // multer middleware mounted on this route (see authRoutes.js).
      const { aadhaarNumber, panNumber, drivingLicenseNumber } = req.body;
      const files = req.files || {};
      const aadhaarDoc = files.aadhaarDoc?.[0];
      const drivingLicenseDoc = files.drivingLicenseDoc?.[0];
      const panDoc = files.panDoc?.[0];

      if (!aadhaarNumber || !drivingLicenseNumber || !aadhaarDoc || !drivingLicenseDoc) {
        return res.status(400).json({
          message:
            "Agents must provide their Aadhaar number, Driving License number, and scanned copies of both documents.",
        });
      }

      identityDocuments = {
        aadhaarNumber,
        panNumber: panNumber || null,
        drivingLicenseNumber,
        aadhaarDocPath: aadhaarDoc.filename,
        drivingLicenseDocPath: drivingLicenseDoc.filename,
        panDocPath: panDoc ? panDoc.filename : null,
      };
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      address,
      role: finalRole,
      // Self-registered agents start pending — they cannot log in until an
      // admin approves them. Customers are unaffected (schema default: approved).
      agentStatus: finalRole === "agent" ? "pending" : "approved",
      ...(identityDocuments ? { identityDocuments } : {}),
    });

    // Agents don't get a token yet — they aren't allowed to log in until approved.
    if (finalRole === "agent") {
      notifyAdminsOfPendingAgent(user); // fire-and-forget, never blocks the response

      return res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        agentStatus: user.agentStatus,
        message: "Registration received. An admin will review your documents before you can log in.",
      });
    }

    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // This is the shared customer/agent login — admins must use /auth/admin-login.
    if (user.role === "admin") {
      return res.status(403).json({ message: "Admins must log in from the admin login page" });
    }

    if (user.role === "agent" && user.agentStatus !== "approved") {
      const msg =
        user.agentStatus === "pending"
          ? "Your agent account is still pending admin approval."
          : `Your agent application was rejected${user.agentRejectionReason ? `: ${user.agentRejectionReason}` : "."}`;
      return res.status(403).json({ message: msg, agentStatus: user.agentStatus });
    }

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Admin-only login — separate route so admin credentials never flow
//          through the shared customer/agent login form.
// @route   POST /api/auth/admin-login
// @access  Public
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || user.role !== "admin") {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get logged-in user's profile
// @route   GET /api/auth/me
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Create a new admin account (staff-only — cannot be self-registered)
// @route   POST /api/auth/create-admin
// @access  Private (admin only — enforced by authorize("admin") in the route)
const createAdminByAdmin = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Role is hard-coded to "admin" here — this endpoint is only reachable by an
    // already-authenticated admin (see authorize("admin") in authRoutes.js).
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: "admin",
    });

    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    One-time, web-based bootstrap: create the very first admin account.
//          Works ONLY when zero admin accounts exist in the database. Once the
//          first admin is created, this endpoint permanently refuses to run
//          again (checked fresh on every call) — so it can never be used to
//          create a second admin, and can never be abused after go-live.
// @route   POST /api/auth/setup-first-admin
// @access  Public, but self-locking (see above) — safe to leave deployed
const setupFirstAdmin = async (req, res) => {
  try {
    const adminAlreadyExists = await User.exists({ role: "admin" });
    if (adminAlreadyExists) {
      return res.status(403).json({
        message:
          "Setup already completed. An admin account already exists — use the Admin Dashboard's 'Add admin' page instead.",
      });
    }

    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    const user = await User.create({ name, email, password, phone, role: "admin" });

    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Tells the frontend whether first-admin setup is still available,
//          i.e. whether zero admin accounts exist yet. Landing page uses this
//          to decide whether to show the "Set up first admin" banner/link.
// @route   GET /api/auth/setup-first-admin/status
// @access  Public
const checkFirstAdminSetup = async (req, res) => {
  try {
    const adminExists = await User.exists({ role: "admin" });
    return res.status(200).json({ setupAvailable: !adminExists });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Sign in / sign up with Google. Frontend uses Google Identity
//          Services (GSI) to get an ID token from the user's Google account,
//          and sends just that token here — the client secret is never
//          needed for this flow, only GOOGLE_CLIENT_ID (public) to verify it.
// @route   POST /api/auth/google
// @access  Public
// @body    { credential: <Google ID token JWT> }
const googleAuth = async (req, res) => {
  try {
    const { credential, intent } = req.body;
    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: "Google Sign-In is not configured on the server (GOOGLE_CLIENT_ID missing)" });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      return res.status(401).json({ message: "Invalid or expired Google credential" });
    }

    const { sub: googleId, email, name, email_verified: emailVerified } = payload;
    if (!email || !emailVerified) {
      return res.status(401).json({ message: "Google account email is not verified" });
    }

    // Find by googleId first (returning user), then by email (existing
    // password-based account signing in with Google for the first time —
    // link the accounts instead of creating a duplicate).
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    // Admin login page: never create a new account here, and never sign
    // someone into a non-admin account from this page. Admins are always
    // provisioned first via setup-first-admin / an existing admin — Google
    // Sign-In on /admin/login can only ever be an *alternate credential*
    // for an admin account that already exists with this exact email.
    if (intent === "admin") {
      if (!user || user.role !== "admin") {
        return res.status(403).json({
          message: "No admin account is registered with this Google account's email.",
        });
      }
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
      if (user.isActive === false) {
        return res.status(403).json({ message: "This admin account has been deactivated." });
      }
      return res.status(200).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id, user.role),
      });
    }

    // Normal (customer/agent) flow — link an existing account by email, or
    // create a brand-new customer account if this Google email is unseen.
    if (user && !user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    if (!user) {
      // New account — Google Sign-In only ever creates customer accounts.
      // Agents still go through the document-verification registration
      // flow, and admins are never self-service.
      user = await User.create({
        name: name || email.split("@")[0],
        email: email.toLowerCase(),
        googleId,
        role: "customer",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: "This account has been deactivated. Contact support." });
    }
    if (user.role === "agent" && user.agentStatus !== "approved") {
      return res.status(403).json({
        message:
          user.agentStatus === "pending"
            ? "Your agent account is awaiting admin approval."
            : "Your agent application was rejected.",
      });
    }

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Request a password reset — emails a one-time link if the account
//          exists. Always returns a generic success message either way, so
//          this endpoint can't be used to enumerate which emails are
//          registered.
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  const genericResponse = {
    message: "If an account with that email exists, a password reset link has been sent.",
  };

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    // Skip only for accounts with NO local password at all (pure Google
    // signups that never set one) — NOT just because googleId is also set.
    // An account can have both (password-based account that later linked
    // Google as an alternate credential) and should still be resettable.
    if (!user || !user.password) {
      return res.status(200).json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await user.save();

    const baseUrl = process.env.CLIENT_ORIGIN || "http://localhost:5173";
    const resetUrl = `${baseUrl}/reset-password/${rawToken}`;
    const { subject, html } = buildResetPasswordEmail({ name: user.name, resetUrl, expiresInMinutes: 30 });

    try {
      await sendEmail({ to: user.email, subject, html });
    } catch (emailErr) {
      // Don't leak email-send failures to the client — log server-side only.
      console.error("[authController] forgotPassword email send failed:", emailErr.message);
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Complete a password reset using the token emailed by forgotPassword.
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({ message: "Reset link is invalid or has expired. Please request a new one." });
    }

    user.password = password; // pre('save') hook hashes this
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({ message: "Password has been reset. You can now log in with your new password." });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    List customers, for the admin "create order on behalf of a
//          customer" flow (search by name/email, admin picks one, then
//          POST /orders with { customerId }).
// @route   GET /api/auth/customers?search=
// @access  Private/Admin
const getCustomersForAdmin = async (req, res) => {
  try {
    const filter = { role: "customer" };
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const customers = await User.find(filter)
      .select("name email phone createdAt")
      .sort({ name: 1 })
      .limit(100);

    return res.status(200).json({ success: true, count: customers.length, data: customers });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  loginAdmin,
  getProfile,
  createAdminByAdmin,
  setupFirstAdmin,
  checkFirstAdminSetup,
  googleAuth,
  forgotPassword,
  resetPassword,
  getCustomersForAdmin,
};