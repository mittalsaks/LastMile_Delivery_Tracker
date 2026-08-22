require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

// No hardcoded defaults — all three MUST be set via env vars (or CLI flags
// below) so no predictable/shared admin credentials ever ship in the code.
async function run() {
  const name = process.env.FIRST_ADMIN_NAME;
  const email = process.env.FIRST_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.FIRST_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error(
      "Missing FIRST_ADMIN_NAME / FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD.\n" +
      "Run it like:\n" +
      '  FIRST_ADMIN_NAME="Your Name" FIRST_ADMIN_EMAIL="you@example.com" FIRST_ADMIN_PASSWORD="StrongPass123" node scripts/seedFirstAdmin.js\n' +
      "(Or better — just use the /setup page in the browser instead of this script.)"
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("FIRST_ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === "admin") {
      console.log(`Nothing to do — "${email}" already exists and is already an admin.`);
    } else {
      existing.role = "admin";
      await existing.save();
      console.log(`Existing user "${email}" was promoted to admin.`);
    }
  } else {
    await User.create({ name, email, password, role: "admin" });
    console.log(`First admin created: ${email}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});