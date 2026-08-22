// utils/notificationService.js
// Part 7 — single source of truth for notifications.
//
// Both trackingController.js (status updates) and rescheduleController.js
// (reschedule + failed) call notifyOrderStatus() instead of writing their own
// Notification.create() + email logic. Keeps send logic in ONE place.

const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendEmail } = require('../config/mailer');
const { buildStatusEmail } = require('../templates/statusEmailTemplate');
const { sendSms } = require('./smsService'); // stub, see smsService.js

/**
 * Create a Notification record AND attempt to send the email, updating the
 * record's status/sentAt/error/attempts based on the outcome.
 *
 * Never throws — a failed notification should never fail the order status
 * update that triggered it. Callers can inspect the returned doc if they
 * want to know whether the send succeeded.
 *
 * @param {Object} opts
 * @param {string} opts.orderId
 * @param {string} opts.recipientId    User._id of the customer
 * @param {string} opts.status         order status this notification is about
 * @param {string} [opts.channel]      'email' | 'sms' | 'system' (default 'email')
 * @param {string} [opts.trackingUrl]  optional override for the tracking link
 * @returns {Promise<Object>} the Notification document
 */
async function notifyOrderStatus({ orderId, recipientId, status, channel = 'email', trackingUrl }) {
  const { subject, html } = buildStatusEmail({ orderId, status, trackingUrl });

  // 1. Create the Notification record first (status: pending)
  let notification;
  try {
    notification = await Notification.create({
      order: orderId,
      recipient: recipientId,
      channel,
      event: status,
      message: `${subject}`,
      status: 'pending',
      attempts: 0,
    });
  } catch (err) {
    // If we can't even write the DB record, log and bail — nothing more to do.
    console.error('[notificationService] Failed to create Notification record:', err.message);
    return null;
  }

  // 2. Attempt delivery based on channel
  try {
    if (channel === 'sms') {
      await sendSms({ orderId, message: notification.message });
    } else if (channel === 'system') {
      // In-app/system notifications don't need external delivery —
      // the DB record itself IS the notification.
      notification.status = 'sent';
      notification.sentAt = new Date();
      notification.attempts = 1;
      await notification.save();
      return notification;
    } else {
      // default: email
      const recipient = await User.findById(recipientId).select('email name');
      if (!recipient || !recipient.email) {
        throw new Error('Recipient has no email on file');
      }

      await sendEmail({
        to: recipient.email,
        subject,
        html,
      });
    }

    notification.status = 'sent';
    notification.sentAt = new Date();
    notification.attempts += 1;
    await notification.save();
  } catch (err) {
    notification.status = 'failed';
    notification.error = String(err.message || err).slice(0, 500);
    notification.attempts += 1;
    await notification.save();
    console.error(`[notificationService] Send failed for order ${orderId} (${status}):`, err.message);
  }

  return notification;
}

module.exports = { notifyOrderStatus };