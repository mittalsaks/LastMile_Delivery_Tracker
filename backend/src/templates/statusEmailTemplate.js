// templates/statusEmailTemplate.js
// Simple inline HTML email template — no external template engine needed.

const { renderEmailShell, COLORS } = require('./emailLayout');

const STATUS_COPY = {
  Created: {
    subject: 'Order Received',
    heading: 'We\u2019ve received your order',
    body: 'Your order has been created and is being processed.',
    badgeColor: COLORS.brand,
  },
  'Picked Up': {
    subject: 'Order Picked Up',
    heading: 'Your package is on the move',
    body: 'Your order has been picked up by our delivery agent.',
    badgeColor: COLORS.brand,
  },
  'In Transit': {
    subject: 'Order In Transit',
    heading: 'Your package is in transit',
    body: 'Your order is on its way to the destination hub.',
    badgeColor: '#a78bfa',
  },
  'Out for Delivery': {
    subject: 'Out for Delivery',
    heading: 'Arriving soon',
    body: 'Your order is out for delivery and should arrive shortly.',
    badgeColor: '#fbbf24',
  },
  Delivered: {
    subject: 'Order Delivered',
    heading: 'Delivered!',
    body: 'Your order has been delivered successfully. Thank you for choosing us.',
    badgeColor: COLORS.success,
  },
  Failed: {
    subject: 'Delivery Attempt Failed',
    heading: 'We couldn\u2019t deliver your order',
    body: 'Our agent was unable to complete delivery. You can request a reschedule from your dashboard.',
    badgeColor: COLORS.danger,
  },
  Rescheduled: {
    subject: 'Delivery Rescheduled',
    heading: 'Your delivery has been rescheduled',
    body: 'A new delivery attempt has been scheduled. We\u2019ll notify you as it progresses.',
    badgeColor: '#a78bfa',
  },
};

/**
 * @param {Object} opts
 * @param {string} opts.orderId
 * @param {string} opts.status         one of STATUS_COPY keys
 * @param {string} [opts.trackingUrl]  placeholder link, frontend route not built yet
 * @returns {{ subject: string, html: string }}
 */
function buildStatusEmail({ orderId, status, trackingUrl }) {
  const copy = STATUS_COPY[status] || {
    subject: 'Order Update',
    heading: 'Your order status has changed',
    body: `Your order status is now "${status}".`,
    badgeColor: COLORS.brand,
  };

  // Strip any trailing slash(es) from CLIENT_ORIGIN. If the env var on
  // Render/Vercel was set with a trailing "/" (e.g. "https://app.com/"
  // instead of "https://app.com"), concatenating "/customer/..." on top
  // produces a double slash ("https://app.com//customer/...") whose path
  // becomes "//customer/orders/.../tracking" — React Router's
  // "/customer/orders/:orderId/tracking" route does NOT match that (extra
  // empty leading segment), so it falls through to the "*" catch-all route,
  // which then bounces a logged-in customer to /customer/place-order
  // instead of the tracking page. Stripping the trailing slash here makes
  // the link correct regardless of how CLIENT_ORIGIN is configured.
  const baseUrl = (process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/+$/, "");
  const link = trackingUrl || `${baseUrl}/customer/orders/${orderId}/tracking`;

  const bodyHtml = `
    <span style="display:inline-block; background-color:${copy.badgeColor}22; color:${copy.badgeColor}; border:1px solid ${copy.badgeColor}55; border-radius:999px; padding:4px 12px; font-size:11px; font-weight:700; letter-spacing:0.03em; text-transform:uppercase; margin-bottom:14px;">
      ${status}
    </span>
    <h2 style="color:#ffffff; font-size:20px; margin:0 0 6px; font-family:Arial, Helvetica, sans-serif;">${copy.heading}</h2>
    <p style="color:${COLORS.textMuted}; font-size:13px; margin:0 0 14px;">Order ID: <strong style="color:${COLORS.text};">${orderId}</strong></p>
    <p style="color:${COLORS.text}; font-size:14px; line-height:1.6; margin:0 0 22px;">${copy.body}</p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-radius:8px; background:linear-gradient(135deg, ${COLORS.brand}, ${COLORS.brandDark});">
          <a href="${link}" style="display:inline-block; padding:11px 20px; color:#ffffff; text-decoration:none; font-size:14px; font-weight:700; font-family:Arial, Helvetica, sans-serif;">
            Track your order
          </a>
        </td>
      </tr>
    </table>`;

  const html = renderEmailShell({
    bodyHtml,
    accent: `linear-gradient(90deg, ${COLORS.brand}, ${copy.badgeColor})`,
  });

  return { subject: `${copy.subject} — Order ${orderId}`, html };
}

module.exports = { buildStatusEmail, STATUS_COPY };