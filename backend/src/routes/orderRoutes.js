const express = require("express");
const router = express.Router();
const {
  calculateCharge,
  createOrder,
  getOrderById,
  getMyOrders,
  getOrders,
} = require("../controllers/orderController");
const { manualAssign, autoAssign } = require("../controllers/assignmentController");
const { updateOrderStatus, getOrderTracking, overrideOrderStatus } = require("../controllers/trackingController");
const { submitFeedback, getFeedbackForOrder } = require("../controllers/feedbackController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All order routes require login; role checks are handled per-route below
// (and inside controllers for "own order" / "assigned agent" ownership checks).
router.use(protect);

// --- Part 3: creation + rate preview ---
router.post("/calculate-charge", authorize("customer", "admin"), calculateCharge);
router.post("/", authorize("customer", "admin"), createOrder);
router.get("/my", authorize("customer"), getMyOrders);
router.get("/", authorize("admin"), getOrders);

// --- Part 4: agent assignment (admin-only) ---
router.patch("/:id/assign", authorize("admin"), manualAssign);
router.patch("/:id/auto-assign", authorize("admin"), autoAssign);

// --- Part 5: status lifecycle + tracking ---
// Ownership (assigned agent vs admin) is enforced inside the controller,
// since "agent" alone isn't enough — it has to be *their* order.
router.patch("/:id/status", authorize("agent", "admin"), updateOrderStatus);
// Admin-only override — bypasses forward-only transition rules (see controller docblock)
router.patch("/:id/override-status", authorize("admin"), overrideOrderStatus);
// Tracking view: ownership (customer/agent/admin) also enforced inside the
// controller, so all three roles are allowed to hit the route itself.
router.get("/:id/tracking", authorize("customer", "agent", "admin"), getOrderTracking);

// --- Feedback (customer, post-delivery) ---
router.post("/:id/feedback", authorize("customer"), submitFeedback);
router.get("/:id/feedback", authorize("customer", "admin"), getFeedbackForOrder);

// Single order — ownership/role check happens inside the controller
router.get("/:id", getOrderById);

module.exports = router;
