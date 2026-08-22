const RateCard = require("../models/RateCard");
const Zone = require("../models/Zone");

const validOrderTypes = ["B2B", "B2C"];
const validRateTypes = ["intra", "inter"];

const validateZonesExist = async (fromZone, toZone) => {
  const [fromZoneDoc, toZoneDoc] = await Promise.all([
    Zone.findById(fromZone),
    Zone.findById(toZone),
  ]);
  if (!fromZoneDoc) return "fromZone does not exist";
  if (!toZoneDoc) return "toZone does not exist";
  return null;
};

// @desc    Create a new rate card
// @route   POST /api/ratecards
// @access  Private/Admin
exports.createRateCard = async (req, res) => {
  try {
    const { orderType, rateType, fromZone, toZone, baseRate, ratePerKg } = req.body;

    if (!orderType || !rateType || !fromZone || !toZone || baseRate === undefined || ratePerKg === undefined) {
      return res.status(400).json({
        success: false,
        message: "orderType, rateType, fromZone, toZone, baseRate and ratePerKg are all required",
      });
    }

    if (!validOrderTypes.includes(orderType)) {
      return res.status(400).json({ success: false, message: "orderType must be B2B or B2C" });
    }
    if (!validRateTypes.includes(rateType)) {
      return res.status(400).json({ success: false, message: "rateType must be intra or inter" });
    }
    if (rateType === "intra" && fromZone !== toZone) {
      return res.status(400).json({ success: false, message: "For intra-zone rate cards, fromZone and toZone must be the same" });
    }
    if (rateType === "inter" && fromZone === toZone) {
      return res.status(400).json({ success: false, message: "For inter-zone rate cards, fromZone and toZone must differ" });
    }
    if (baseRate < 0 || ratePerKg < 0) {
      return res.status(400).json({ success: false, message: "baseRate and ratePerKg cannot be negative" });
    }

    const zoneError = await validateZonesExist(fromZone, toZone);
    if (zoneError) {
      return res.status(404).json({ success: false, message: zoneError });
    }

    const existing = await RateCard.findOne({ orderType, rateType, fromZone, toZone });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A rate card already exists for this orderType/rateType/fromZone/toZone combination. Update it instead.",
      });
    }

    const rateCard = await RateCard.create({ orderType, rateType, fromZone, toZone, baseRate, ratePerKg });
    const populated = await rateCard.populate(["fromZone", "toZone"]);

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate rate card for this combination" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all rate cards (filter by ?orderType=&rateType=&fromZone=&toZone=&active=)
// @route   GET /api/ratecards
// @access  Private/Admin
exports.getRateCards = async (req, res) => {
  try {
    const filter = {};
    const { orderType, rateType, fromZone, toZone, active } = req.query;

    if (orderType) filter.orderType = orderType;
    if (rateType) filter.rateType = rateType;
    if (fromZone) filter.fromZone = fromZone;
    if (toZone) filter.toZone = toZone;
    if (active !== undefined) filter.isActive = active === "true";

    const rateCards = await RateCard.find(filter)
      .populate("fromZone", "name")
      .populate("toZone", "name")
      .sort({ orderType: 1, rateType: 1 });

    return res.status(200).json({ success: true, count: rateCards.length, data: rateCards });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single rate card by id
// @route   GET /api/ratecards/:id
// @access  Private/Admin
exports.getRateCardById = async (req, res) => {
  try {
    const rateCard = await RateCard.findById(req.params.id)
      .populate("fromZone", "name")
      .populate("toZone", "name");

    if (!rateCard) {
      return res.status(404).json({ success: false, message: "Rate card not found" });
    }
    return res.status(200).json({ success: true, data: rateCard });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(400).json({ success: false, message: "Invalid rate card id" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Lookup the applicable rate card for a given orderType + zones
//          (used internally by the rate calculation engine in Part 3)
// @route   GET /api/ratecards/lookup?orderType=&fromZone=&toZone=
// @access  Private/Admin
exports.lookupRateCard = async (req, res) => {
  try {
    const { orderType, fromZone, toZone } = req.query;

    if (!orderType || !fromZone || !toZone) {
      return res.status(400).json({ success: false, message: "orderType, fromZone and toZone are required" });
    }

    const rateType = fromZone === toZone ? "intra" : "inter";

    const rateCard = await RateCard.findOne({
      orderType,
      rateType,
      fromZone,
      toZone,
      isActive: true,
    });

    if (!rateCard) {
      return res.status(404).json({
        success: false,
        message: `No active ${rateType}-zone rate card configured for ${orderType} between these zones`,
      });
    }

    return res.status(200).json({ success: true, data: rateCard });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a rate card (typically baseRate / ratePerKg / isActive)
// @route   PUT /api/ratecards/:id
// @access  Private/Admin
exports.updateRateCard = async (req, res) => {
  try {
    const { baseRate, ratePerKg, isActive, fromZone, toZone, orderType, rateType } = req.body;

    const rateCard = await RateCard.findById(req.params.id);
    if (!rateCard) {
      return res.status(404).json({ success: false, message: "Rate card not found" });
    }

    // Changing the identity fields (orderType/rateType/fromZone/toZone) could collide
    // with another rate card, so re-check uniqueness if any of them change.
    const nextOrderType = orderType ?? rateCard.orderType;
    const nextRateType = rateType ?? rateCard.rateType;
    const nextFromZone = fromZone ?? String(rateCard.fromZone);
    const nextToZone = toZone ?? String(rateCard.toZone);

    const identityChanged =
      nextOrderType !== rateCard.orderType ||
      nextRateType !== rateCard.rateType ||
      nextFromZone !== String(rateCard.fromZone) ||
      nextToZone !== String(rateCard.toZone);

    if (identityChanged) {
      if (!validOrderTypes.includes(nextOrderType)) {
        return res.status(400).json({ success: false, message: "orderType must be B2B or B2C" });
      }
      if (!validRateTypes.includes(nextRateType)) {
        return res.status(400).json({ success: false, message: "rateType must be intra or inter" });
      }
      if (nextRateType === "intra" && nextFromZone !== nextToZone) {
        return res.status(400).json({ success: false, message: "For intra-zone rate cards, fromZone and toZone must be the same" });
      }
      if (nextRateType === "inter" && nextFromZone === nextToZone) {
        return res.status(400).json({ success: false, message: "For inter-zone rate cards, fromZone and toZone must differ" });
      }

      const zoneError = await validateZonesExist(nextFromZone, nextToZone);
      if (zoneError) {
        return res.status(404).json({ success: false, message: zoneError });
      }

      const duplicate = await RateCard.findOne({
        orderType: nextOrderType,
        rateType: nextRateType,
        fromZone: nextFromZone,
        toZone: nextToZone,
        _id: { $ne: rateCard._id },
      });
      if (duplicate) {
        return res.status(409).json({ success: false, message: "Another rate card already exists for this combination" });
      }

      rateCard.orderType = nextOrderType;
      rateCard.rateType = nextRateType;
      rateCard.fromZone = nextFromZone;
      rateCard.toZone = nextToZone;
    }

    if (baseRate !== undefined) {
      if (baseRate < 0) return res.status(400).json({ success: false, message: "baseRate cannot be negative" });
      rateCard.baseRate = baseRate;
    }
    if (ratePerKg !== undefined) {
      if (ratePerKg < 0) return res.status(400).json({ success: false, message: "ratePerKg cannot be negative" });
      rateCard.ratePerKg = ratePerKg;
    }
    if (isActive !== undefined) rateCard.isActive = isActive;

    await rateCard.save();
    const populated = await rateCard.populate(["fromZone", "toZone"]);

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate rate card for this combination" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a rate card
// @route   DELETE /api/ratecards/:id
// @access  Private/Admin
exports.deleteRateCard = async (req, res) => {
  try {
    const rateCard = await RateCard.findById(req.params.id);
    if (!rateCard) {
      return res.status(404).json({ success: false, message: "Rate card not found" });
    }

    await rateCard.deleteOne();

    return res.status(200).json({ success: true, message: "Rate card deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
