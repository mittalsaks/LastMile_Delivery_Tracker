const express = require("express");
const router = express.Router();
const {
  toggleAvailability,
  getMyAssignedOrders,
  getAgents,
  getAllAgentsForAdmin,
  deactivateAgent,
  reactivateAgent,
  getPendingAgents,
  approveAgent,
  rejectAgent,
  downloadAgentDocument,
} = require("../controllers/agentController");
const { getAgentFeedbackSummary } = require("../controllers/feedbackController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.use(protect);

// Agent self-service
router.patch("/me/availability", authorize("agent"), toggleAvailability);
router.get("/me/orders", authorize("agent"), getMyAssignedOrders);

// Admin: agent approval pipeline
router.get("/pending", authorize("admin"), getPendingAgents);
router.patch("/:id/approve", authorize("admin"), approveAgent);
router.patch("/:id/reject", authorize("admin"), rejectAgent);
router.get("/:id/documents/:docType", authorize("admin"), downloadAgentDocument);

// Admin: full roster + performance management
router.get("/all", authorize("admin"), getAllAgentsForAdmin);
router.patch("/:id/deactivate", authorize("admin"), deactivateAgent);
router.patch("/:id/reactivate", authorize("admin"), reactivateAgent);
router.get("/:id/feedback", authorize("admin"), getAgentFeedbackSummary);

// Admin: browse agents (e.g. to populate a manual-assignment dropdown)
router.get("/", authorize("admin"), getAgents);

module.exports = router;