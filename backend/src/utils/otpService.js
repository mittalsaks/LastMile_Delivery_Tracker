// utils/otpService.js
// Small helpers for the email-verification OTP flow. The OTP itself is
// never stored in plaintext — only its SHA-256 hash — same pattern as the
// forgot-password reset token in authController.js.

const crypto = require("crypto");

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

// Generates a numeric OTP, e.g. "042817". Uses crypto.randomInt so it's not
// predictable the way Math.random() would be.
function generateOtp() {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH - 1;
  return String(crypto.randomInt(min, max + 1));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function otpExpiryDate() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

module.exports = {
  generateOtp,
  hashOtp,
  otpExpiryDate,
  OTP_EXPIRY_MINUTES,
  MAX_OTP_ATTEMPTS,
};