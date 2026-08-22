const express = require("express");
const router = express.Router();
const {
  createZone,
  getZones,
  getZoneById,
  updateZone,
  assignToZone,
  deleteZone,
} = require("../controllers/zoneController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All zone routes are admin-only
// Reads: any logged-in user (agents need this to pick their own zone).
// Writes: admin-only.
router.use(protect);

router.route("/")
  .post(authorize("admin"), createZone)
  .get(getZones);

router.route("/:id")
  .get(getZoneById)
  .put(authorize("admin"), updateZone)
  .delete(authorize("admin"), deleteZone);

router.patch("/:id/assign", authorize("admin"), assignToZone);

module.exports = router;
