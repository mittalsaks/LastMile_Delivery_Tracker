// templates/statusEmailTemplate.js
// Simple inline HTML email template — no external template engine needed.

const STATUS_COPY = {
  Created: {
    subject: 'Order Received',
    heading: 'We\u2019ve received your order',
    body: 'Your order has been created and is being processed.',
  },
  'Picked Up': {
    subject: 'Order Picked Up',
    heading: 'Your package is on the move',
    body: 'Your order has been picked up by our delivery agent.',
  },
  'In Transit': {
    subject: 'Order In Transit',
    heading: 'Your package is in transit',
    body: 'Your order is on its way to the destination hub.',
  },
  'Out for Delivery': {
    subject: 'Out for Delivery',
    heading: 'Arriving soon',
    body: 'Your order is out for delivery and should arrive shortly.',
  },
  Delivered: {
    subject: 'Order Delivered',
    heading: 'Delivered!',
    body: 'Your order has been delivered successfully. Thank you for choosing us.',
  },
  Failed: {
    subject: 'Delivery Attempt Failed',
    heading: 'We couldn\u2019t deliver your order',
    body: 'Our agent was unable to complete delivery. You can request a reschedule from your dashboard.',
  },
  Rescheduled: {
    subject: 'Delivery Rescheduled',
    heading: 'Your delivery has been rescheduled',
    body: 'A new delivery attempt has been scheduled. We\u2019ll notify you as it progresses.',
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

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color: #1a1a1a; margin-bottom: 4px;">${copy.heading}</h2>
    <p style="color: #555; font-size: 14px; margin-top: 0;">Order ID: <strong>${orderId}</strong></p>
    <p style="color: #333; font-size: 15px; line-height: 1.5;">${copy.body}</p>
    <p style="margin-top: 24px;">
      <a href="${link}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;">
        Track your order
      </a>
    </p>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">
      Last-Mile Delivery Tracker — automated notification, please do not reply.
    </p>
  </div>`;

  return { subject: `${copy.subject} — Order ${orderId}`, html };
}

module.exports = { buildStatusEmail, STATUS_COPY };