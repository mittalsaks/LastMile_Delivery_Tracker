// One-time migration: run this ONCE, right after deploying the email-OTP
// verification feature.
//
// Why it's needed: the new `isEmailVerified` field on User defaults to
// `false`. Without this script, every account that existed BEFORE this
// feature shipped would suddenly be unable to log in (loginUser now refuses
// unverified accounts) even though they never went through — and never
// needed to go through — an OTP step.
//
// This script marks every account that has no OTP fields set (i.e. was
// never enrolled in the new flow) as verified, so only NEW self-registrations
// going forward are required to complete OTP verification.
//
// Run:
//   cd backend && node scripts/migrateVerifyExistingUsers.js

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const result = await User.updateMany(
    { isEmailVerified: { $ne: true }, emailOtp: { $exists: false } },
    { $set: { isEmailVerified: true } }
  );

  console.log(`Grandfathered ${result.modifiedCount} pre-existing user(s) as email-verified.`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});