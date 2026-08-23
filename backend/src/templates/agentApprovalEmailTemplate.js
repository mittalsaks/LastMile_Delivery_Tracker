// templates/agentApprovalEmailTemplate.js
// Email sent to admins when a new delivery agent self-registers and needs
// document verification. Same inline-HTML style as statusEmailTemplate.js.

function buildAgentApprovalRequestEmail({ agentName, agentEmail, agentPhone }) {
  const baseUrl = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  // Must match the actual route in frontend/src/App.jsx — it's
  // "/admin/agents/pending" (AdminAgentApprovals), not "/admin/agent-approvals".
  const approvalsUrl = `${baseUrl}/admin/agents/pending`;

  const subject = `New agent approval request — ${agentName}`;

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color: #1a1a1a; margin-bottom: 4px;">New delivery agent awaiting approval</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.5;">
      <strong>${agentName}</strong> just registered as a delivery agent and submitted their
      identity documents (Aadhaar / PAN / Driving License). Their account is locked out of
      login until an admin verifies the documents and approves the application.
    </p>
    <table style="width:100%; font-size: 14px; color:#333; margin-top: 12px;">
      <tr><td style="padding:4px 0; color:#777;">Email</td><td>${agentEmail}</td></tr>
      <tr><td style="padding:4px 0; color:#777;">Phone</td><td>${agentPhone || "—"}</td></tr>
    </table>
    <p style="margin-top: 24px;">
      <a href="${approvalsUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;">
        Review &amp; approve
      </a>
    </p>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">
      Last-Mile Delivery Tracker — automated notification, please do not reply.
    </p>
  </div>`;

  return { subject, html };
}

// Sent back to the agent once an admin makes a decision.
function buildAgentDecisionEmail({ decision, reason }) {
  const baseUrl = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  const isApproved = decision === "approved";

  const subject = isApproved ? "Your agent account has been approved" : "Your agent application was rejected";
  const heading = isApproved ? "You're approved!" : "Application not approved";
  const body = isApproved
    ? "Your identity documents have been verified. You can now log in and start accepting deliveries."
    : `Your submitted documents could not be verified.${reason ? ` Reason: ${reason}` : ""} You're welcome to register again with corrected documents.`;

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color: #1a1a1a; margin-bottom: 4px;">${heading}</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.5;">${body}</p>
    ${
      isApproved
        ? `<p style="margin-top: 24px;">
             <a href="${baseUrl}/login" style="background:#16a34a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;">
               Log in
             </a>
           </p>`
        : ""
    }
    <p style="color: #999; font-size: 12px; margin-top: 32px;">
      Last-Mile Delivery Tracker — automated notification, please do not reply.
    </p>
  </div>`;

  return { subject, html };
}

module.exports = { buildAgentApprovalRequestEmail, buildAgentDecisionEmail };