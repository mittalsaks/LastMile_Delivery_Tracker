const mongoose = require("mongoose");

// One feedback entry per delivered order. Kept as its own collection
// (rather than fields on Order) so an agent's average rating can be
// computed with a simple aggregate query without touching Order documents.
const feedbackSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order reference is required"],
      unique: true, // one feedback per order — resubmission updates this doc instead of duplicating
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer reference is required"],
    },
    // Denormalized at creation time (the agent assigned to the order when
    // it was delivered) so rating aggregates survive any future
    // reassignment of the order document itself.
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Agent reference is required"],
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  { timestamps: true }
);

feedbackSchema.index({ agent: 1, rating: 1 });

module.exports = mongoose.model("Feedback", feedbackSchema);
