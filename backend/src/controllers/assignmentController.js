const Order = require("../models/Order");
const User = require("../models/User");
const AssignmentHistory = require("../models/AssignmentHistory");
const { findBestAgent, AssignmentError } = require("../utils/agentAssigner");

// Shared: writes assignedAgent onto the order, bumps the agent's
// lastAssignedAt (for round-robin fairness), and logs an AssignmentHistory
// entry. Used by both manual and auto assignment (and the auto-trigger on
// order creation in orderController.js) so behavior stays in sync.
// Exported below so other controllers can reuse it without duplicating logic.
const applyAssignment = async ({ order, agent, assignedBy, assignmentType, notes = null }) => {
  order.assignedAgent = agent._id;
  await order.save();

  agent.agentDetails = agent.agentDetails || {};
  agent.agentDetails.lastAssignedAt = new Date();
  await agent.save();

  await AssignmentHistory.create({
    order: order._id,
    agent: agent._id,
    assignedBy,
    assignmentType,
    notes,
  });

  return Order.findById(order._id)
    .populate("customer", "name email")
    .populate("pickupZone", "name")
    .populate("dropZone", "name")
    .populate("assignedAgent", "name email agentDetails");
};

// @desc    Manually assign a specific agent to an order
// @route   PATCH /api/orders/:id/assign
// @access  Private/Admin
exports.manualAssign = async (req, res) => {
  try {
    const { agentId } = req.body;
    if (!agentId) {
      return res.status(400).json({ success: false, message: "agentId is required" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (["Delivered", "Failed"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign an agent to an order that is already ${order.status}`,
      });
    }

    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "agent") {
      return res.status(404).json({ success: false, message: "agentId does not match a valid delivery agent account" });
    }

    const updatedOrder = await applyAssignment({
      order,
      agent,
      assignedBy: req.user._id,
      assignmentType: "manual",
      notes: `Manually assigned by admin ${req.user.name || req.user._id}`,
    });

    return res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Auto-assign the best available agent to an order
// @route   PATCH /api/orders/:id/auto-assign
// @access  Private/Admin
exports.autoAssign = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (["Delivered", "Failed"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign an agent to an order that is already ${order.status}`,
      });
    }

    const { agent, usedZoneFallback, activeOrders } = await findBestAgent(order.pickupZone);

    const updatedOrder = await applyAssignment({
      order,
      agent,
      assignedBy: req.user._id,
      assignmentType: "auto",
      notes: usedZoneFallback
        ? "No available agent found in the pickup zone — assigned from all available agents"
        : "Assigned nearest available agent by pickup zone",
    });

    return res.status(200).json({
      success: true,
      data: updatedOrder,
      meta: {
        usedZoneFallback,
        assignedAgentPriorLoad: activeOrders,
      },
    });
  } catch (error) {
    if (error instanceof AssignmentError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Internal helper (not a route) — best-effort auto-assign every
//          currently-unassigned, still-in-flight order. Called after an
//          event that might have freed up capacity, e.g. an agent flips
//          themselves "available". This is what makes assignment fully
//          hands-off for the admin: they no longer have to remember to
//          click "Auto-assign" — the moment a suitable agent exists, the
//          next sweep (or the original on-create attempt) picks it up.
//          Oldest orders are swept first so nothing waits longer than it
//          has to. Orders for which no agent is available yet are simply
//          left as-is for the next trigger.
exports.sweepUnassignedOrders = async ({ assignedBy } = {}) => {
  const unassigned = await Order.find({
    assignedAgent: null,
    status: { $nin: ["Delivered", "Failed"] },
  }).sort({ createdAt: 1 });

  const assigned = [];
  for (const order of unassigned) {
    try {
      const { agent, usedZoneFallback } = await findBestAgent(order.pickupZone);
      await applyAssignment({
        order,
        agent,
        assignedBy: assignedBy || agent._id,
        assignmentType: "auto",
        notes: usedZoneFallback
          ? "Auto-assigned by availability sweep — no agent in pickup zone, assigned from all available agents"
          : "Auto-assigned by availability sweep — nearest available agent by pickup zone",
      });
      assigned.push({ orderId: order._id, agentId: agent._id });
    } catch (err) {
      // Still nobody available for this one — leave it unassigned, the
      // next sweep (next agent going available, or next order created)
      // will try again.
    }
  }
  return assigned;
};

exports.applyAssignment = applyAssignment;