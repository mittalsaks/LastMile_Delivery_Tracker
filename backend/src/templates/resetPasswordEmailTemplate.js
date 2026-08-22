// templates/resetPasswordEmailTemplate.js
// Email sent when a user requests a password reset. Same inline-HTML style
// as statusEmailTemplate.js / agentApprovalEmailTemplate.js.

function buildResetPasswordEmail({ name, resetUrl, expiresInMinutes = 30 }) {
  const subject = "Reset your Last-Mile Tracker password";

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color: #1a1a1a; margin-bottom: 4px;">Reset your password</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.5;">
      Hi ${name || "there"}, we received a request to reset the password on your
      Last-Mile Tracker account. Click the button below to choose a new password.
      This link expires in ${expiresInMinutes} minutes.
    </p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}"
         style="background:#2563eb; color:#fff; text-decoration:none; padding:12px 24px; border-radius:6px; font-size:15px; display:inline-block;">
        Reset Password
      </a>
    </p>
    <p style="color: #777; font-size: 13px; line-height: 1.5;">
      If you didn't request this, you can safely ignore this email — your
      password will not be changed. If the button above doesn't work, copy
      and paste this link into your browser:<br/>
      <span style="word-break: break-all;">${resetUrl}</span>
    </p>
  </div>`;

  return { subject, html };
}

module.exports = { buildResetPasswordEmail };
