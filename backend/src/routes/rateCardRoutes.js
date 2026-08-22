const express = require("express");
const router = express.Router();
const {
  createRateCard,
  getRateCards,
  getRateCardById,
  lookupRateCard,
  updateRateCard,
  deleteRateCard,
} = require("../controllers/rateCardController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All rate card routes are admin-only
router.use(protect, authorize("admin"));

// Static route must come before /:id to avoid being swallowed by the param route
router.get("/lookup", lookupRateCard);

router.route("/")
  .post(createRateCard)
  .get(getRateCards);

router.route("/:id")
  .get(getRateCardById)
  .put(updateRateCard)
  .delete(deleteRateCard);

module.exports = router;
