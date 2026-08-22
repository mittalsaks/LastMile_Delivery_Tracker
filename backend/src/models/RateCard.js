const mongoose = require("mongoose");

const rateCardSchema = new mongoose.Schema(
  {
    orderType: {
      type: String,
      enum: ["B2B", "B2C"],
      required: [true, "Order type is required"],
    },
    rateType: {
      type: String,
      enum: ["intra", "inter"],
      required: [true, "Rate type is required"],
    },
    fromZone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      required: [true, "From zone is required"],
    },
    toZone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      required: [true, "To zone is required"],
    },
    baseRate: {
      type: Number,
      required: [true, "Base rate is required"],
      min: 0,
    },
    ratePerKg: {
      type: Number,
      required: [true, "Rate per kg is required"],
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate rate card for same orderType+rateType+fromZone+toZone
rateCardSchema.index(
  { orderType: 1, rateType: 1, fromZone: 1, toZone: 1 },
  { unique: true }
);

// Extra guard: for intra-zone rates fromZone must equal toZone
rateCardSchema.pre("validate", function (next) {
  if (this.rateType === "intra" && String(this.fromZone) !== String(this.toZone)) {
    return next(new Error("For intra-zone rate cards, fromZone and toZone must be the same"));
  }
  if (this.rateType === "inter" && String(this.fromZone) === String(this.toZone)) {
    return next(new Error("For inter-zone rate cards, fromZone and toZone must differ"));
  }
  next();
});

module.exports = mongoose.model("RateCard", rateCardSchema);
