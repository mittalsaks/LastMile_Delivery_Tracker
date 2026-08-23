// templates/otpEmailTemplate.js
// Email sent on registration (and resend) carrying the 6-digit email
// verification OTP. Same inline-HTML style as the other templates in this
// folder (resetPasswordEmailTemplate.js, statusEmailTemplate.js, ...).

function buildOtpEmail({ name, otp, expiresInMinutes = 10 }) {
  const subject = "Verify your email — Last-Mile Tracker";

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color: #1a1a1a; margin-bottom: 4px;">Verify your email</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.5;">
      Hi ${name || "there"}, use the code below to verify your email and finish
      creating your Last-Mile Tracker account. This code expires in
      ${expiresInMinutes} minutes.
    </p>
    <p style="text-align: center; margin: 28px 0;">
      <span style="background:#2563eb; color:#fff; letter-spacing: 6px; font-weight: bold; padding:14px 24px; border-radius:6px; font-size:26px; display:inline-block;">
        ${otp}
      </span>
    </p>
    <p style="color: #777; font-size: 13px; line-height: 1.5;">
      If you didn't try to create an account, you can safely ignore this
      email — no account will be activated without this code.
    </p>
  </div>`;

  return { subject, html };
}

module.exports = { buildOtpEmail };