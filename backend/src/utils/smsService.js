// utils/smsService.js
// Part 7 — SMS via TextBee (https://textbee.dev). TextBee relays messages
// through an Android phone running the TextBee app (that phone's own SIM
// sends the SMS), so no third-party SMS-provider account/pricing is needed.
//
// Required env vars (see .env.example):
//   TEXTBEE_API_KEY     - from the TextBee dashboard
//   TEXTBEE_DEVICE_ID   - the device ID of the linked Android phone
//   TEXTBEE_API_BASE    - optional override, defaults to the public API

const Order = require('../models/Order');

const TEXTBEE_API_BASE = process.env.TEXTBEE_API_BASE || 'https://api.textbee.dev/api/v1';

/**
 * Normalize a phone number to E.164-ish form expected by TextBee/carriers.
 * Adjust the default country code if your users aren't primarily +91.
 */
function normalizePhone(raw) {
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+91${digits}`; // bare 10-digit Indian mobile number
  return `+${digits}`;
}

/**
 * @param {Object} opts
 * @param {string} opts.orderId  Order._id — SMS goes to the order's
 *                                receiverPhone (the delivery contact), not
 *                                the account holder's own number, since
 *                                they may not be the same person.
 * @param {string} opts.message
 */
async function sendSms({ orderId, message }) {
  const { TEXTBEE_API_KEY, TEXTBEE_DEVICE_ID } = process.env;
  if (!TEXTBEE_API_KEY || !TEXTBEE_DEVICE_ID) {
    throw new Error('TEXTBEE_API_KEY / TEXTBEE_DEVICE_ID are not set — cannot send SMS');
  }

  const order = await Order.findById(orderId).select('receiverPhone');
  if (!order || !order.receiverPhone) {
    throw new Error('Order has no receiverPhone on file');
  }

  const to = normalizePhone(order.receiverPhone);

  const res = await fetch(`${TEXTBEE_API_BASE}/gateway/devices/${TEXTBEE_DEVICE_ID}/send-sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': TEXTBEE_API_KEY,
    },
    body: JSON.stringify({
      recipients: [to],
      message,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TextBee send failed (${res.status}): ${body.slice(0, 300)}`);
  }

  return res.json();
}

module.exports = { sendSms };