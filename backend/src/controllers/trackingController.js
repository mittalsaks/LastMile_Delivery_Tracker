const Order = require("../models/Order");
const TrackingHistory = require("../models/TrackingHistory"); // reused from Part 3, not recreated
const { isValidTransition, ALL_STATUSES, isTerminalStatus } = require("../utils/statusTransitions");
const { notifyOrderStatus } = require("../utils/notificationService"); // Part 7

// Statuses worth an SMS too (customer likely to be away from email at these points).
const SMS_NOTIFY_STATUSES = ["Out for Delivery", "Delivered", "Failed"];

// @desc    Update an order's status (agent moves it through the delivery flow)
// @route   PATCH /api/orders/:id/status
// @access  Private/Agent (must be the order's assignedAgent), Admin
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "status is required" });
    }
    if (!ALL_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${ALL_STATUSES.join(", ")}` });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Ownership check: an agent can only move orders that are assigned to them.
    // Admins can update any order's status.
    if (req.user.role === "agent") {
      if (!order.assignedAgent || String(order.assignedAgent) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you" });
      }
    } else if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only the assigned agent or an admin can update order status" });
    }

    if (isTerminalStatus(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order is already in a terminal status (${order.status}) and cannot be moved further here`,
      });
    }

    if (!isValidTransition(order.status, status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition: cannot move from "${order.status}" to "${status}". Statuses must move forward in order and cannot be skipped.`,
      });
    }

    order.status = status;
    await order.save();

    await TrackingHistory.create({
      order: order._id,
      status,
      changedBy: req.user._id,
      notes: notes || null,
    });

    // Part 7: central notification service — fires an email (and can fire SMS)
    // on every status change. Never throws, so it can't block this response.
    await notifyOrderStatus({
      orderId: order._id,
      recipientId: order.customer,
      status,
      channel: "email",
    });
    if (SMS_NOTIFY_STATUSES.includes(status)) {
      await notifyOrderStatus({
        orderId: order._id,
        recipientId: order.customer,
        status,
        channel: "sms",
      });
    }

    const updatedOrder = await Order.findById(order._id)
      .populate("customer", "name email")
      .populate("pickupZone", "name")
      .populate("dropZone", "name")
      .populate("assignedAgent", "name email");

    return res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin-only: force-set an order's status, bypassing the normal
//          forward-only transition rules (e.g. to correct a mistake, or to
//          manually resolve an edge case the agent flow can't reach).
//          Still writes an immutable TrackingHistory entry and still fires
//          the customer notification, so the audit trail and communication
//          stay consistent with the normal update path.
// @route   PATCH /api/orders/:id/override-status
// @access  Private/Admin only
exports.overrideOrderStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "status is required" });
    }
    if (!ALL_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${ALL_STATUSES.join(", ")}` });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const fromStatus = order.status;
    order.status = status;
    await order.save();

    await TrackingHistory.create({
      order: order._id,
      status,
      changedBy: req.user._id,
      notes: notes
        ? `[ADMIN OVERRIDE] ${notes} (was "${fromStatus}")`
        : `[ADMIN OVERRIDE] Status force-set by admin (was "${fromStatus}")`,
    });

    await notifyOrderStatus({
      orderId: order._id,
      recipientId: order.customer,
      status,
      channel: "email",
    });
    if (SMS_NOTIFY_STATUSES.includes(status)) {
      await notifyOrderStatus({
        orderId: order._id,
        recipientId: order.customer,
        status,
        channel: "sms",
      });
    }

    const updatedOrder = await Order.findById(order._id)
      .populate("customer", "name email")
      .populate("pickupZone", "name")
      .populate("dropZone", "name")
      .populate("assignedAgent", "name email");

    return res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get the full tracking timeline for an order
// @route   GET /api/orders/:id/tracking
// @access  Private (order's customer, its assignedAgent, or admin)
exports.getOrderTracking = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isOwner = String(order.customer) === String(req.user._id);
    const isAssignedAgent =
      req.user.role === "agent" && order.assignedAgent && String(order.assignedAgent) === String(req.user._id);
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAssignedAgent && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to view this order's tracking" });
    }

        const timeline = await TrackingHistory.find({ order: order._id })
      .populate("changedBy", "name role")
      .sort({ createdAt: 1 });

    const populatedOrder = await Order.findById(order._id)
      .populate("customer", "name email")
      .populate("pickupZone", "name")
      .populate("dropZone", "name")
      .populate("assignedAgent", "name email");

    return res.status(200).json({
      success: true,
      data: {
        order: populatedOrder,
        history: timeline,
      },
    });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};