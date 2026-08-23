// templates/emailLayout.js
// Shared dark-themed HTML shell used by statusEmailTemplate.js (order
// status-change notifications). Other templates in this folder
// (otpEmailTemplate.js, resetPasswordEmailTemplate.js,
// agentApprovalEmailTemplate.js) are self-contained and don't use this —
// this one exists specifically because statusEmailTemplate.js's badge/body
// markup assumes a dark card shell (white text, colored status badge) around
// it, rather than building its own header/footer chrome.

const COLORS = {
  brand: '#3b82f6', // matches the app's primary blue (buttons, links)
  brandDark: '#1d4ed8',
  success: '#22c55e',
  danger: '#ef4444',
  text: '#f8fafc', // near-white body text on the dark card
  textMuted: '#94a3b8',
  background: '#05070d', // outer email background
  card: '#0f172a', // inner card background
  border: 'rgba(255,255,255,0.08)',
};

/**
 * Wraps a status-email's inner body markup (badge + heading + CTA button,
 * built by the caller) in the shared dark card shell: outer table for email
 * client compatibility, a colored accent bar/gradient at the top of the
 * card, the LastMile Tracker wordmark, the given bodyHtml, and a muted
 * footer.
 *
 * @param {Object} opts
 * @param {string} opts.bodyHtml  Inner HTML already built by the caller.
 * @param {string} [opts.accent]  CSS background (solid color or gradient)
 *                                 for the thin bar across the top of the card.
 * @returns {string} Full HTML document string, ready to send as email HTML.
 */
function renderEmailShell({ bodyHtml, accent = COLORS.brand }) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LastMile Tracker</title>
  </head>
  <body style="margin:0; padding:0; background-color:${COLORS.background}; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.background}; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background-color:${COLORS.card}; border:1px solid ${COLORS.border}; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="height:4px; background:${accent}; font-size:0; line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="color:${COLORS.brand}; font-size:13px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; margin:0 0 20px;">
                  LastMile Tracker
                </p>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 28px; border-top:1px solid ${COLORS.border}; margin-top:12px;">
                <p style="color:${COLORS.textMuted}; font-size:12px; line-height:1.5; margin:16px 0 0;">
                  You're receiving this email because of an order placed on LastMile Tracker.
                  If you weren't expecting this, you can safely ignore it.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

module.exports = { renderEmailShell, COLORS };