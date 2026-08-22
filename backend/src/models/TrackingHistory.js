const mongoose = require("mongoose");

// Append-only log: every status change on an Order gets one immutable entry here.
// Nothing in this app should ever update or delete a TrackingHistory document —
// only create new ones. Order.status reflects the *current* state; this
// collection is the full timeline.
const trackingHistorySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order reference is required"],
    },
    status: {
      type: String,
      enum: ["Created", "Picked Up", "In Transit", "Out for Delivery", "Delivered", "Failed", "Rescheduled"],
      required: [true, "Status is required"],
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "changedBy (actor) is required"],
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

trackingHistorySchema.index({ order: 1, createdAt: 1 });

// Defense in depth: block updates/deletes at the query level so the log
// stays append-only even if a future controller tries to mutate it by mistake.
trackingHistorySchema.pre(["updateOne", "findOneAndUpdate", "updateMany"], function (next) {
  next(new Error("TrackingHistory is append-only and cannot be updated"));
});
trackingHistorySchema.pre(["deleteOne", "findOneAndDelete", "deleteMany"], function (next) {
  next(new Error("TrackingHistory is append-only and cannot be deleted"));
});

module.exports = mongoose.model("TrackingHistory", trackingHistorySchema);
