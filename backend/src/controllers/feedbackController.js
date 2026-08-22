const Order = require("../models/Order");
const Feedback = require("../models/Feedback");

// @desc    Customer submits (or updates) feedback for a delivered order.
//          Only the order's own customer can do this, and only once the
//          order has actually reached "Delivered" — you can't rate a
//          delivery that hasn't happened yet.
// @route   POST /api/orders/:id/feedback
// @access  Private/Customer
exports.submitFeedback = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5 || !Number.isInteger(ratingNum)) {
      return res.status(400).json({ success: false, message: "rating must be a whole number from 1 to 5" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "You can only leave feedback on your own orders" });
    }
    if (order.status !== "Delivered") {
      return res.status(409).json({ success: false, message: "Feedback can only be left after the order is delivered" });
    }
    if (!order.assignedAgent) {
      return res.status(409).json({ success: false, message: "This order has no delivery agent on record" });
    }

    // upsert: allows the customer to edit their rating/comment later rather
    // than erroring out on a second submit.
    const feedback = await Feedback.findOneAndUpdate(
      { order: order._id },
      {
        order: order._id,
        customer: req.user._id,
        agent: order.assignedAgent,
        rating: ratingNum,
        comment: (comment || "").trim(),
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get the feedback (if any) left for a specific order — lets the
//          customer's UI show "already rated" vs a blank form.
// @route   GET /api/orders/:id/feedback
// @access  Private/Customer (own order) or Admin
exports.getFeedbackForOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (req.user.role === "customer" && order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to view this order's feedback" });
    }

    const feedback = await Feedback.findOne({ order: order._id });
    return res.status(200).json({ success: true, data: feedback || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin: rating summary (average + count + recent comments) for one agent.
// @route   GET /api/agents/:id/feedback
// @access  Private/Admin
exports.getAgentFeedbackSummary = async (req, res) => {
  try {
    const agentId = req.params.id;

    const [summary] = await Feedback.aggregate([
      { $match: { agent: new (require("mongoose").Types.ObjectId)(agentId) } },
      {
        $group: {
          _id: "$agent",
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
        },
      },
    ]);

    const recent = await Feedback.find({ agent: agentId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("customer", "name")
      .populate("order", "orderType createdAt");

    return res.status(200).json({
      success: true,
      data: {
        averageRating: summary ? Number(summary.averageRating.toFixed(2)) : null,
        totalRatings: summary ? summary.totalRatings : 0,
        recent,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
