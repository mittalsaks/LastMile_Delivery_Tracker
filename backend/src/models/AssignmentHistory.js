const mongoose = require("mongoose");

// Append-only log of every agent assignment action on an order — mirrors
// TrackingHistory's pattern. Order.assignedAgent always reflects the
// *current* assignee; this collection is the full assignment timeline
// (useful once reassignment-on-reschedule is added in Part 6).
const assignmentHistorySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order reference is required"],
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Agent reference is required"],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "assignedBy (the admin who triggered this) is required"],
    },
    assignmentType: {
      type: String,
      enum: ["manual", "auto"],
      required: [true, "assignmentType is required"],
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

assignmentHistorySchema.index({ order: 1, createdAt: 1 });
assignmentHistorySchema.index({ agent: 1, createdAt: 1 });

assignmentHistorySchema.pre(["updateOne", "findOneAndUpdate", "updateMany"], function (next) {
  next(new Error("AssignmentHistory is append-only and cannot be updated"));
});
assignmentHistorySchema.pre(["deleteOne", "findOneAndDelete", "deleteMany"], function (next) {
  next(new Error("AssignmentHistory is append-only and cannot be deleted"));
});

module.exports = mongoose.model("AssignmentHistory", assignmentHistorySchema);
