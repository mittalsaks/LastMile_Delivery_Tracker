// models/Notification.js
// Part 7 — extends the Part 1 Notification model with delivery tracking fields.
// REPLACE your existing models/Notification.js with this version (fields from
// Part 1 — order, recipient, channel, message, status — are all still here,
// just with extra tracking fields added).

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    channel: {
      type: String,
      enum: ['email', 'sms', 'system'],
      default: 'email',
    },
    message: {
      type: String,
      required: true,
    },
    // NEW (Part 7): what event this notification was about, useful for
    // filtering/debugging without parsing the message string.
    event: {
      type: String,
      enum: [
        'Created',
        'Picked Up',
        'In Transit',
        'Out for Delivery',
        'Delivered',
        'Failed',
        'Rescheduled',
      ],
      required: false,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    // NEW (Part 7): when the send actually succeeded
    sentAt: {
      type: Date,
      default: null,
    },
    // NEW (Part 7): last error message if the send failed (kept short)
    error: {
      type: String,
      default: null,
    },
    // NEW (Part 7): how many send attempts have been made (for retry visibility)
    attempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
