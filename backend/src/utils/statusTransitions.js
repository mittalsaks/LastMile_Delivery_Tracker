// utils/statusTransitions.js
// Order status state machine.
// Part 5 introduced: Created -> Picked Up -> In Transit -> Out for Delivery -> {Delivered | Failed}
// Part 6 extends: Failed -> Rescheduled -> Picked Up (re-enters the normal flow)
//
// IMPORTANT: This is the SAME map from Part 5 with two new edges added
// (Failed -> Rescheduled, Rescheduled -> Picked Up). Do not recreate the file,
// just replace VALID_TRANSITIONS with this version if you already have one.

const VALID_TRANSITIONS = {
  Created: ['Picked Up'],
  'Picked Up': ['In Transit'],
  'In Transit': ['Out for Delivery'],
  'Out for Delivery': ['Delivered', 'Failed'],
  Delivered: [], // terminal
  Failed: ['Rescheduled'], // NEW (Part 6) — was terminal in Part 5, now the reschedule flow can move it forward
  Rescheduled: ['Picked Up'], // NEW (Part 6) — after reassignment, order re-enters normal flow
};

/**
 * @param {string} from current status
 * @param {string} to   target status
 * @returns {boolean}
 */
function isValidTransition(from, to) {
  if (!VALID_TRANSITIONS[from]) return false;
  return VALID_TRANSITIONS[from].includes(to);
}

function isTerminal(status) {
  return Array.isArray(VALID_TRANSITIONS[status]) && VALID_TRANSITIONS[status].length === 0;
}

const ALL_STATUSES = Object.keys(VALID_TRANSITIONS);

module.exports = {
  VALID_TRANSITIONS,
  ALL_STATUSES,
  isValidTransition,
  isTerminal,
  isTerminalStatus: isTerminal, // alias — trackingController.js imports it under this name
};