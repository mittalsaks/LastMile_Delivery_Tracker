const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    addressLine: { type: String, required: [true, "Address line is required"], trim: true },
    area: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, required: [true, "Pincode is required"], trim: true },
  },
  { _id: false }
);

const chargeSchema = new mongoose.Schema(
  {
    baseRate: { type: Number, required: true, min: 0 },
    ratePerKg: { type: Number, required: true, min: 0 },
    weightCharge: { type: Number, required: true, min: 0 }, // baseRate + chargeableWeight*ratePerKg
    codSurcharge: { type: Number, required: true, min: 0, default: 0 },
    totalCharge: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const rescheduleSchema = new mongoose.Schema(
  {
    isRescheduled: { type: Boolean, default: false },
    newDate: { type: Date, default: null },
    reason: { type: String, default: null },
    rescheduledAt: { type: Date, default: null },
    previousAgent: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer is required"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy is required"],
    },
    orderType: {
      type: String,
      enum: ["B2B", "B2C"],
      required: [true, "Order type is required"],
    },
    paymentType: {
      type: String,
      enum: ["Prepaid", "COD"],
      required: [true, "Payment type is required"],
    },

    // Delivery contact number — collected per-order (not from the customer's
    // account) so the SMS goes to whoever is actually receiving the parcel,
    // which may not be the account holder (e.g. gifting, B2B recipient).
    receiverPhone: {
      type: String,
      required: [true, "Receiver's phone number is required"],
      trim: true,
    },

    pickupAddress: { type: addressSchema, required: true },
    dropAddress: { type: addressSchema, required: true },

    pickupZone: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
    dropZone: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },

    package: {
      length: { type: Number, required: true, min: 0 },
      breadth: { type: Number, required: true, min: 0 },
      height: { type: Number, required: true, min: 0 },
      actualWeight: { type: Number, required: true, min: 0 },
    },

    volumetricWeight: { type: Number, required: true, min: 0 },
    chargeableWeight: { type: Number, required: true, min: 0 },

    rateCardUsed: { type: mongoose.Schema.Types.ObjectId, ref: "RateCard", required: true },
    charge: { type: chargeSchema, required: true },

    status: {
      type: String,
      enum: ["Created", "Picked Up", "In Transit", "Out for Delivery", "Delivered", "Failed", "Rescheduled"],
      default: "Created",
    },

    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    reschedule: { type: rescheduleSchema, default: () => ({}) },
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, status: 1 });
orderSchema.index({ assignedAgent: 1, status: 1 });
orderSchema.index({ pickupZone: 1, dropZone: 1 });

module.exports = mongoose.model("Order", orderSchema);