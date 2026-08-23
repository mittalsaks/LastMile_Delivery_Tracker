// controllers/rescheduleController.js
// Part 6 — Failed Delivery + Reschedule Flow

const Order = require('../models/Order');
const TrackingHistory = require('../models/TrackingHistory');
const AssignmentHistory = require('../models/AssignmentHistory');
const { isValidTransition } = require('../utils/statusTransitions');
const { findBestAgent, AssignmentError } = require('../utils/agentAssigner'); // from Part 4
const { applyAssignment } = require('./assignmentController');
const { notifyOrderStatus } = require('../utils/notificationService'); // Part 7

/**
 * STEP 1 — Customer submits a reschedule request on a Failed order.
 * PATCH /api/orders/:id/reschedule
 * Access: customer (must own the order)
 * Body: { newDate: ISODate, reason?: string }
 *
 * Effects:
 *  - order.status: Failed -> Rescheduled
 *  - order.reschedule populated (isRescheduled, newDate, reason, rescheduledAt, previousAgent)
 *  - order.assignedAgent cleared (pending reassignment via reassignForReschedule)
 *  - TrackingHistory entry written for the Rescheduled status
 *  - Notification record created for the customer
 */
exports.requestReschedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDate, reason } = req.body;

    if (!newDate) {
      return res.status(400).json({ success: false, message: 'newDate is required' });
    }

    const parsedDate = new Date(newDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'newDate is not a valid date' });
    }
    if (parsedDate <= new Date()) {
      return res.status(400).json({ success: false, message: 'newDate must be in the future' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Only the order's own customer can submit the reschedule request
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reschedule this order',
      });
    }

    if (!isValidTransition(order.status, 'Rescheduled')) {
      return res.status(400).json({
        success: false,
        message: `Cannot reschedule an order with status "${order.status}". Order must be "Failed".`,
      });
    }

    // Capture previousAgent BEFORE clearing assignedAgent, as required
    const previousAgent = order.assignedAgent || null;

    order.reschedule = {
      isRescheduled: true,
      newDate: parsedDate,
      reason: reason || '',
      rescheduledAt: new Date(),
      previousAgent,
    };

    const fromStatus = order.status;
    order.status = 'Rescheduled';
    // Clear current assignment — a fresh assignment happens in reassignForReschedule
    order.assignedAgent = null;

    await order.save();

    // Immutable tracking history entry
    await TrackingHistory.create({
      order: order._id,
      status: 'Rescheduled',
      changedBy: req.user._id,
      timestamp: new Date(),
      note: `Rescheduled from "${fromStatus}" by customer. New attempt date: ${parsedDate.toISOString()}`,
    });

    // --- Auto-reassign on reschedule ---
    // Best-effort, same pattern as auto-assign-on-creation in orderController:
    // try to find and assign the best available agent right away instead of
    // making the customer wait for an admin to click "reassign" manually.
    // This must NEVER fail the reschedule request — if no agent is available
    // right now, the order simply stays "Rescheduled"/unassigned and an
    // admin can still trigger manual/auto reassignment later.
    let reassignMeta = { autoReassigned: false, reason: null };
    try {
      const excludeAgentId = previousAgent ? previousAgent.toString() : undefined;
      // Redelivery starts from the drop zone, not the original pickup zone.
      const { agent, usedZoneFallback } = await findBestAgent(order.dropZone, { excludeAgentId });
      await applyAssignment({
        order,
        agent,
        assignedBy: req.user._id,
        assignmentType: 'auto-reschedule',
        notes: usedZoneFallback
          ? 'Auto-reassigned on reschedule — no agent available in drop zone, assigned from all available agents'
          : 'Auto-reassigned on reschedule — nearest available agent by drop zone',
      });
      reassignMeta = { autoReassigned: true, usedZoneFallback };
    } catch (assignErr) {
      reassignMeta = {
        autoReassigned: false,
        reason: assignErr instanceof AssignmentError ? assignErr.message : 'Auto-reassignment failed unexpectedly',
      };
      console.error(`[requestReschedule] Auto-reassign skipped for order ${order._id}:`, assignErr.message);
    }

    // Part 7: central notification service — creates the Notification record
    // AND attempts the email send in one call.
    await notifyOrderStatus({
      orderId: order._id,
      recipientId: req.user._id,
      status: 'Rescheduled',
      channel: 'email',
    });

    return res.status(200).json({
      success: true,
      message: reassignMeta.autoReassigned
        ? 'Reschedule request recorded and a new agent was auto-assigned.'
        : 'Reschedule request recorded. No agent could be auto-assigned — an admin can assign one manually.',
      data: order,
      meta: reassignMeta,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * STEP 2 — Reassign a delivery agent for a Rescheduled order.
 * PATCH /api/orders/:id/reschedule/reassign
 * Access: admin (manual or auto) OR system-triggered auto flow
 * Body: { mode: 'auto' | 'manual', agentId?: ObjectId }  (mode defaults to 'auto')
 *
 * Reuses Part 4's findBestAgent() for auto mode. Does NOT change order.status —
 * order stays "Rescheduled" until the agent (or admin) moves it to "Picked Up",
 * which is now a valid transition per the extended statusTransitions map.
 */
exports.reassignForReschedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { mode = 'auto', agentId } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Rescheduled') {
      return res.status(400).json({
        success: false,
        message: `Order must be in "Rescheduled" status to reassign. Current status: "${order.status}".`,
      });
    }

    let newAgent;

    if (mode === 'manual') {
      if (!agentId) {
        return res.status(400).json({ success: false, message: 'agentId is required for manual reassignment' });
      }
      newAgent = agentId;
    } else {
      // auto mode — reuse Part 4 logic, excluding the previous agent where possible.
      // Redelivery attempt starts from the drop zone (that's where the parcel
      // currently is / needs to go), so we rank agents around dropZone here —
      // NOT pickupZone, which only applies to the original pickup leg.
      const excludeAgentId = order.reschedule?.previousAgent?.toString();

      let bestAgentResult;
      try {
        bestAgentResult = await findBestAgent(order.dropZone, { excludeAgentId });
      } catch (err) {
        return res.status(err.statusCode || 409).json({
          success: false,
          message: err.message || 'No available agent found for reassignment. Try again later or assign manually.',
        });
      }
      newAgent = bestAgentResult.agent._id;
    }

    order.assignedAgent = newAgent;
    await order.save();

    // Log in AssignmentHistory (append-only, same model as Part 4)
    await AssignmentHistory.create({
      order: order._id,
      agent: newAgent,
      assignedBy: req.user._id,
      assignmentType: mode === 'manual' ? 'manual-reschedule' : 'auto-reschedule',
      timestamp: new Date(),
    });

    // Bump lastAssignedAt on the agent, consistent with Part 4 ranking logic
    const User = require('../models/User');
    await User.findByIdAndUpdate(newAgent, {
      'agentDetails.lastAssignedAt': new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Agent reassigned for rescheduled delivery. Order remains "Rescheduled" until pickup is confirmed.',
      data: order,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};