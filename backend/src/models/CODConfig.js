const mongoose = require("mongoose");

const codConfigSchema = new mongoose.Schema(
  {
    orderType: {
      type: String,
      enum: ["B2B", "B2C"],
      required: [true, "Order type is required"],
      unique: true, // one COD config per order type
    },
    surchargeType: {
      type: String,
      enum: ["flat", "percentage"],
      required: [true, "Surcharge type is required"],
    },
    value: {
      type: Number,
      required: [true, "Surcharge value is required"],
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CODConfig", codConfigSchema);
