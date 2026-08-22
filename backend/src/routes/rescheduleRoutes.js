// routes/rescheduleRoutes.js
// Part 6 — mount under /api/orders in app.js (see PART6_INTEGRATION.md)

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware'); // adjust path/name to match your Part 1 middleware
const {
  requestReschedule,
  reassignForReschedule,
} = require('../controllers/rescheduleController');

// Customer submits reschedule request on a Failed order
router.patch('/:id/reschedule', protect, authorize('customer'), requestReschedule);

// Admin (manual or auto) reassigns an agent for a Rescheduled order
router.patch('/:id/reschedule/reassign', protect, authorize('admin'), reassignForReschedule);

module.exports = router;
