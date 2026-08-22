const User = require("../models/User");
const Order = require("../models/Order");

class AssignmentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AssignmentError";
    this.statusCode = statusCode;
  }
}

// An order counts as "active" for an agent's workload if it isn't in a
// terminal delivered state. Failed/Rescheduled still count as active load
// since the agent (or a reassigned agent) still owes a delivery attempt.
const countActiveOrdersForAgent = async (agentId) => {
  return Order.countDocuments({
    assignedAgent: agentId,
    status: { $nin: ["Delivered"] },
  });
};

const findAvailableAgentsInZone = async (zoneId, excludeAgentId) => {
  const filter = {
    role: "agent",
    "agentDetails.isAvailable": true,
    "agentDetails.currentZone": zoneId,
  };
  if (excludeAgentId) filter._id = { $ne: excludeAgentId };
  return User.find(filter);
};

const findAnyAvailableAgent = async (excludeAgentId) => {
  const filter = {
    role: "agent",
    "agentDetails.isAvailable": true,
  };
  if (excludeAgentId) filter._id = { $ne: excludeAgentId };
  return User.find(filter);
};

/**
 * Picks the best agent for a given zone.
 *
 * Strategy:
 *  1. Prefer agents whose agentDetails.currentZone matches the given zone
 *     (zone-based "nearest" — see note below on geo).
 *  2. If none are available in that zone, fall back to any available agent
 *     (excluding excludeAgentId if given, e.g. the agent who just failed
 *     a delivery attempt during a reschedule).
 *  3. Among candidates, rank by current active-order load (ascending),
 *     then by lastAssignedAt (ascending — least-recently-assigned first)
 *     as a fairness tiebreaker so load doesn't pile onto one agent.
 *
 * NOTE ON GEO: agentDetails.currentLocation (lat/lng) is captured so a real
 * distance-based ranking can be dropped in later, but Zone/Order addresses
 * don't carry coordinates yet in this project, so true nearest-by-distance
 * isn't computable — zone match is used as the proxy for "nearest" today.
 *
 * @param {ObjectId|string} zoneId        zone to search around (pickupZone
 *                                         for a fresh order, dropZone for a
 *                                         reschedule redelivery attempt)
 * @param {Object}  [options]
 * @param {ObjectId|string} [options.excludeAgentId]  agent to exclude from
 *                                         candidates (e.g. previous agent
 *                                         on a reschedule)
 */
const findBestAgent = async (zoneId, options = {}) => {
  const { excludeAgentId } = options;

  if (!zoneId) {
    throw new AssignmentError("No zone provided — cannot auto-assign");
  }

  let candidates = await findAvailableAgentsInZone(zoneId, excludeAgentId);
  let usedZoneFallback = false;

  if (candidates.length === 0) {
    candidates = await findAnyAvailableAgent(excludeAgentId);
    usedZoneFallback = true;
  }

  if (candidates.length === 0) {
    throw new AssignmentError("No available delivery agents found", 404);
  }

  const scored = await Promise.all(
    candidates.map(async (agent) => ({
      agent,
      activeOrders: await countActiveOrdersForAgent(agent._id),
      lastAssignedAt: agent.agentDetails?.lastAssignedAt || new Date(0),
    }))
  );

  scored.sort((a, b) => {
    if (a.activeOrders !== b.activeOrders) return a.activeOrders - b.activeOrders;
    return new Date(a.lastAssignedAt) - new Date(b.lastAssignedAt);
  });

  return { agent: scored[0].agent, usedZoneFallback, activeOrders: scored[0].activeOrders };
};

module.exports = {
  AssignmentError,
  findBestAgent,
  countActiveOrdersForAgent,
};
