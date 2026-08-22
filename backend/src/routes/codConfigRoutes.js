const express = require("express");
const router = express.Router();
const {
  createCODConfig,
  getCODConfigs,
  getCODConfigById,
  getCODConfigByOrderType,
  updateCODConfig,
  deleteCODConfig,
} = require("../controllers/codConfigController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All COD config routes are admin-only
router.use(protect, authorize("admin"));

// Static route must come before /:id
router.get("/lookup/:orderType", getCODConfigByOrderType);

router.route("/")
  .post(createCODConfig)
  .get(getCODConfigs);

router.route("/:id")
  .get(getCODConfigById)
  .put(updateCODConfig)
  .delete(deleteCODConfig);

module.exports = router;
