const express = require("express");
const router = express.Router();
const {
  registerUser,
  verifyEmailOtp,
  resendOtp,
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
} = require("../controllers/authController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { handleAgentDocuments } = require("../middleware/uploadMiddleware");

// Multipart-aware: customer registrations send plain JSON (multer passes
// those straight through as if it weren't there), while agent
// registrations send multipart/form-data with Aadhaar/DL file uploads —
// without this middleware, Express's JSON parser can't read multipart
// bodies at all and req.body ends up empty for agent signups.
router.post("/register", handleAgentDocuments, registerUser);

// Step 2 of registration: confirm the emailed OTP (or ask for a new one).
router.post("/verify-otp", verifyEmailOtp);
router.post("/resend-otp", resendOtp);

router.post("/login", loginUser);
router.post("/admin-login", loginAdmin);
router.get("/me", protect, getProfile);

// Google Sign-In (customers only — see controller docblock)
router.post("/google", googleAuth);

// Forgot / reset password (local-password accounts only)
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Staff-only: an existing admin creates another admin account.
router.post("/create-admin", protect, authorize("admin"), createAdminByAdmin);

// Staff-only: list customers, used by the "create order on behalf of a
// customer" flow on the admin orders screen.
router.get("/customers", protect, authorize("admin"), getCustomersForAdmin);

// One-time, web-based first-admin bootstrap. Public, but self-locking:
// works only while zero admins exist anywhere in the database.
router.post("/setup-first-admin", setupFirstAdmin);
router.get("/setup-first-admin/status", checkFirstAdminSetup);

module.exports = router;