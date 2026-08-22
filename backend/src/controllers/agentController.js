const path = require("path");
const User = require("../models/User");
const Order = require("../models/Order");
const Zone = require("../models/Zone");
const Feedback = require("../models/Feedback");
const { countActiveOrdersForAgent, findBestAgent, AssignmentError } = require("../utils/agentAssigner");
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");
const { sendEmail } = require("../config/mailer");
const { buildAgentDecisionEmail } = require("../templates/agentApprovalEmailTemplate");

const { applyAssignment, sweepUnassignedOrders } = require("./assignmentController");

// Fire-and-forget — an email failure must never block an approve/reject action.
function notifyAgentOfDecision(agent, decision, reason) {
  const { subject, html } = buildAgentDecisionEmail({ decision, reason });
  sendEmail({ to: agent.email, subject, html }).catch((err) =>
    console.error(`[agentController] Failed to email agent ${agent.email}:`, err.message)
  );
}

// Maps the three allowed document types to the field they're stored under
// on User.identityDocuments — used by downloadAgentDocument below.
const DOC_FIELD_MAP = {
  aadhaar: "aadhaarDocPath",
  pan: "panDocPath",
  drivingLicense: "drivingLicenseDocPath",
};

// @desc    Toggle the logged-in agent's own availability / zone / location
// @route   PATCH /api/agents/me/availability
// @access  Private/Agent
exports.toggleAvailability = async (req, res) => {
  try {
    const { isAvailable, currentZone, currentLocation } = req.body;

    if (isAvailable === undefined && currentZone === undefined && currentLocation === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one of isAvailable, currentZone, currentLocation to update",
      });
    }

    if (currentZone) {
      const zone = await Zone.findById(currentZone);
      if (!zone) {
        return res.status(404).json({ success: false, message: "currentZone does not match a valid zone" });
      }
    }

    if (currentLocation) {
      const { latitude, longitude } = currentLocation;
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return res.status(400).json({ success: false, message: "currentLocation requires numeric latitude and longitude" });
      }
    }

    const agent = await User.findById(req.user._id);
    agent.agentDetails = agent.agentDetails || {};

    if (isAvailable !== undefined) agent.agentDetails.isAvailable = isAvailable;
    if (currentZone !== undefined) agent.agentDetails.currentZone = currentZone;
    if (currentLocation !== undefined) agent.agentDetails.currentLocation = currentLocation;

    await agent.save();

    const sanitized = await User.findById(agent._id).select("-password").populate("agentDetails.currentZone", "name");

    // Going "available" might unlock capacity for orders that were placed
    // while no one was free to take them (createOrder's own auto-assign
    // attempt found nobody). Sweep now so those get picked up immediately
    // instead of sitting there until an admin manually intervenes.
    let autoAssignedCount = 0;
    if (isAvailable === true) {
      try {
        const swept = await sweepUnassignedOrders({ assignedBy: agent._id });
        autoAssignedCount = swept.length;
      } catch (sweepErr) {
        console.error("[toggleAvailability] Unassigned-order sweep failed:", sweepErr.message);
      }
    }

    return res.status(200).json({ success: true, data: sanitized, meta: { autoAssignedCount } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get orders currently/previously assigned to the logged-in agent
// @route   GET /api/agents/me/orders
// @access  Private/Agent
exports.getMyAssignedOrders = async (req, res) => {
  try {
    const filter = { assignedAgent: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const orders = await Order.find(filter)
      .populate("customer", "name email")
      .populate("pickupZone", "name")
      .populate("dropZone", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    List agents awaiting admin approval
// @route   GET /api/agents/pending
// @access  Private/Admin
exports.getPendingAgents = async (req, res) => {
  try {
    const agents = await User.find({ role: "agent", agentStatus: "pending" })
      .select("-password")
      .sort({ createdAt: 1 });

    return res.status(200).json({ success: true, count: agents.length, data: agents });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve a pending agent — this is the only way an agent account
//          becomes able to log in. Always a manual admin decision; any
//          automated document/AI check is advisory only and never calls this.
// @route   PATCH /api/agents/:id/approve
// @access  Private/Admin
exports.approveAgent = async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: "agent" });
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    agent.agentStatus = "approved";
    agent.agentRejectionReason = null;
    await agent.save();
    notifyAgentOfDecision(agent, "approved");

    return res.status(200).json({ success: true, data: agent });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reject a pending agent, with an optional reason shown to them on
//          their next login attempt.
// @route   PATCH /api/agents/:id/reject
// @access  Private/Admin
exports.rejectAgent = async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: "agent" });
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    agent.agentStatus = "rejected";
    agent.agentRejectionReason = req.body.reason || null;
    await agent.save();
    notifyAgentOfDecision(agent, "rejected", agent.agentRejectionReason);

    return res.status(200).json({ success: true, data: agent });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Stream one of a pending/approved agent's uploaded identity
//          documents. Deliberately NOT a static file route — documents are
//          personal ID scans, so every fetch is authenticated + authorized
//          the same way any other admin-only endpoint is, and we validate
//          that the requested file actually belongs to this agent's record
//          before touching the filesystem.
// @route   GET /api/agents/:id/documents/:docType
// @access  Private/Admin
exports.downloadAgentDocument = async (req, res) => {
  try {
    const { id, docType } = req.params;
    const field = DOC_FIELD_MAP[docType];
    if (!field) {
      return res.status(400).json({ success: false, message: "Unknown document type" });
    }

    const agent = await User.findOne({ _id: id, role: "agent" });
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    const filename = agent.identityDocuments?.[field];
    if (!filename) {
      return res.status(404).json({ success: false, message: "Document not submitted" });
    }

    // filename is a multer-generated name (see uploadMiddleware.js) — never
    // user-controlled path input — but we still resolve + verify it stays
    // inside UPLOAD_DIR before sending, as defense in depth.
    const filePath = path.join(UPLOAD_DIR, path.basename(filename));
    if (!filePath.startsWith(UPLOAD_DIR)) {
      return res.status(400).json({ success: false, message: "Invalid document path" });
    }

    return res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ success: false, message: "Document file not found on server" });
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    List delivery agents (for admin to pick from when manually assigning)
// @route   GET /api/agents?available=true&zone=<zoneId>
// @access  Private/Admin
exports.getAgents = async (req, res) => {
  try {
    const filter = { role: "agent", agentStatus: "approved" };
    if (req.query.available !== undefined) {
      filter["agentDetails.isAvailable"] = req.query.available === "true";
    }
    if (req.query.zone) {
      filter["agentDetails.currentZone"] = req.query.zone;
    }

    const agents = await User.find(filter)
      .select("-password")
      .populate("agentDetails.currentZone", "name")
      .sort({ name: 1 });

    const withLoad = await Promise.all(
      agents.map(async (agent) => ({
        ...agent.toObject(),
        activeOrderCount: await countActiveOrdersForAgent(agent._id),
      }))
    );

    return res.status(200).json({ success: true, count: withLoad.length, data: withLoad });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Orders that still need someone to physically handle them — anything short
// of a terminal state. Used by deactivateAgent to know what to reassign.
const IN_FLIGHT_STATUSES = ["Created", "Picked Up", "In Transit", "Out for Delivery", "Rescheduled"];

// Best-effort zone to search around when reassigning an in-flight order away
// from a deactivated agent: once a parcel is out for delivery / being
// redelivered, "nearest" should be judged from the drop side, not pickup.
const zoneForReassignment = (order) =>
  ["Out for Delivery", "Rescheduled"].includes(order.status) ? order.dropZone : order.pickupZone;

// @desc    Full agent roster for the admin dashboard — every agent
//          regardless of approval/active status, each with their live
//          active-order count and rating summary, so admin can see who's
//          overloaded, idle, or under-performing at a glance.
// @route   GET /api/agents/all?status=approved&active=true
// @access  Private/Admin
exports.getAllAgentsForAdmin = async (req, res) => {
  try {
    const filter = { role: "agent" };
    if (req.query.status) filter.agentStatus = req.query.status; // pending | approved | rejected
    if (req.query.active !== undefined) filter.isActive = req.query.active === "true";

    const agents = await User.find(filter)
      .select("-password")
      .populate("agentDetails.currentZone", "name")
      .sort({ createdAt: -1 });

    const enriched = await Promise.all(
      agents.map(async (agent) => {
        const [activeOrderCount, ratingAgg] = await Promise.all([
          countActiveOrdersForAgent(agent._id),
          Feedback.aggregate([
            { $match: { agent: agent._id } },
            { $group: { _id: "$agent", averageRating: { $avg: "$rating" }, totalRatings: { $sum: 1 } } },
          ]),
        ]);
        const rating = ratingAgg[0];
        return {
          ...agent.toObject(),
          activeOrderCount,
          averageRating: rating ? Number(rating.averageRating.toFixed(2)) : null,
          totalRatings: rating ? rating.totalRatings : 0,
        };
      })
    );

    return res.status(200).json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Deactivate ("remove") an underperforming/problem agent. This is a
//          soft delete, not a hard document delete — we need to keep the
//          agent's history (past orders, tracking entries, feedback) intact
//          for the immutable audit trail, and a deactivated account can
//          always be reactivated later if it was a mistake.
//          Any order still in-flight and assigned to this agent is
//          best-effort auto-reassigned to another available agent so
//          nothing silently stalls; orders that can't be reassigned right
//          now (no agent free) are simply left unassigned for an admin to
//          handle manually — deactivation itself is never blocked by that.
// @route   PATCH /api/agents/:id/deactivate
// @access  Private/Admin
exports.deactivateAgent = async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: "agent" });
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    if (!agent.isActive) {
      return res.status(400).json({ success: false, message: "Agent is already deactivated" });
    }

    agent.isActive = false;
    agent.agentDetails = agent.agentDetails || {};
    agent.agentDetails.isAvailable = false;
    await agent.save();

    const inFlightOrders = await Order.find({
      assignedAgent: agent._id,
      status: { $in: IN_FLIGHT_STATUSES },
    });

    const reassignmentResults = [];
    for (const order of inFlightOrders) {
      try {
        const zoneId = zoneForReassignment(order);
        const { agent: newAgent, usedZoneFallback } = await findBestAgent(zoneId, { excludeAgentId: agent._id });
        await applyAssignment({
          order,
          agent: newAgent,
          assignedBy: req.user._id,
          assignmentType: "auto",
          notes: `Reassigned — previous agent (${agent.name}) was deactivated${usedZoneFallback ? " (zone fallback used)" : ""}`,
        });
        reassignmentResults.push({ orderId: order._id, reassignedTo: newAgent._id });
      } catch (err) {
        // No agent available right now — unassign and let an admin handle
        // it manually rather than leaving a phantom agent on the order.
        order.assignedAgent = null;
        await order.save();
        reassignmentResults.push({
          orderId: order._id,
          reassignedTo: null,
          reason: err instanceof AssignmentError ? err.message : "Reassignment failed unexpectedly",
        });
      }
    }

    const sanitized = await User.findById(agent._id).select("-password");
    return res.status(200).json({
      success: true,
      data: sanitized,
      meta: { reassignedOrders: reassignmentResults },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reactivate a previously deactivated agent. They stay unavailable
//          (agentDetails.isAvailable = false) until they themselves toggle
//          back on from their dashboard — reactivating doesn't silently
//          start routing new orders to someone who may not be on shift.
// @route   PATCH /api/agents/:id/reactivate
// @access  Private/Admin
exports.reactivateAgent = async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: "agent" });
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    if (agent.isActive) {
      return res.status(400).json({ success: false, message: "Agent is already active" });
    }

    agent.isActive = true;
    await agent.save();

    const sanitized = await User.findById(agent._id).select("-password");
    return res.status(200).json({ success: true, data: sanitized });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};