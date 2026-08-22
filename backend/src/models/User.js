const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        // Not required for accounts created via Google Sign-In — they
        // authenticate with Google, never with a local password, unless
        // they later set one via "forgot password" / a future "set password" flow.
        return !this.googleId;
      },
      minlength: 6,
      select: false,
    },
    // Set only for accounts created/linked via "Sign in with Google".
    // Presence of this field is what makes `password` optional above.
    googleId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    // ---- Forgot / reset password ----
    // Both are select: false so a normal `find`/`findById` never leaks them;
    // controllers that need them use `.select('+resetPasswordToken +resetPasswordExpires')`.
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["customer", "agent", "admin"],
      default: "customer",
    },
    address: {
      type: String,
      trim: true,
    },
        // Only meaningful when role === 'agent'. Every other role is implicitly
    // "approved" since they never go through this gate.
    agentStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    agentRejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    // ---- KYC / identity documents submitted at agent registration ----
    // Only meaningful when role === 'agent'. Populated by the multipart
    // /auth/register call (see uploadMiddleware.js + authController.js).
    // File paths are server-relative; actual files live under backend/uploads/agent-docs
    // and are only ever served back out through the admin-only, authenticated
    // download route in agentRoutes.js — never as a public static folder.
    identityDocuments: {
      aadhaarNumber: { type: String, trim: true, default: null },
      panNumber: { type: String, trim: true, default: null },
      drivingLicenseNumber: { type: String, trim: true, default: null },
      aadhaarDocPath: { type: String, default: null },
      panDocPath: { type: String, default: null },
      drivingLicenseDocPath: { type: String, default: null },
    },
    // ---- Agent-specific fields (only relevant when role === 'agent') ----
    agentDetails: {
      currentZone: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Zone",
      },
      isAvailable: {
        type: Boolean,
        default: true,
      },
      currentLocation: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
      },
      // Bumped on every assignment (manual or auto) — used by agentAssigner.js
      // as a fairness tiebreaker (least-recently-assigned agent wins ties).
      lastAssignedAt: {
        type: Date,
        default: null,
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);