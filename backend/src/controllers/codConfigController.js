const CODConfig = require("../models/CODConfig");

const validOrderTypes = ["B2B", "B2C"];
const validSurchargeTypes = ["flat", "percentage"];

// @desc    Create COD config for an order type
// @route   POST /api/codconfig
// @access  Private/Admin
exports.createCODConfig = async (req, res) => {
  try {
    const { orderType, surchargeType, value } = req.body;

    if (!orderType || !surchargeType || value === undefined) {
      return res.status(400).json({ success: false, message: "orderType, surchargeType and value are required" });
    }
    if (!validOrderTypes.includes(orderType)) {
      return res.status(400).json({ success: false, message: "orderType must be B2B or B2C" });
    }
    if (!validSurchargeTypes.includes(surchargeType)) {
      return res.status(400).json({ success: false, message: "surchargeType must be flat or percentage" });
    }
    if (value < 0) {
      return res.status(400).json({ success: false, message: "value cannot be negative" });
    }
    if (surchargeType === "percentage" && value > 100) {
      return res.status(400).json({ success: false, message: "percentage value cannot exceed 100" });
    }

    const existing = await CODConfig.findOne({ orderType });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `COD config for ${orderType} already exists. Update it instead.`,
      });
    }

    const codConfig = await CODConfig.create({ orderType, surchargeType, value });

    return res.status(201).json({ success: true, data: codConfig });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "COD config for this orderType already exists" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all COD configs
// @route   GET /api/codconfig
// @access  Private/Admin
exports.getCODConfigs = async (req, res) => {
  try {
    const filter = {};
    if (req.query.orderType) filter.orderType = req.query.orderType;
    if (req.query.active !== undefined) filter.isActive = req.query.active === "true";

    const configs = await CODConfig.find(filter).sort({ orderType: 1 });
    return res.status(200).json({ success: true, count: configs.length, data: configs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get COD config by order type (used by rate calculation engine in Part 3)
// @route   GET /api/codconfig/lookup/:orderType
// @access  Private/Admin
exports.getCODConfigByOrderType = async (req, res) => {
  try {
    const { orderType } = req.params;
    if (!validOrderTypes.includes(orderType)) {
      return res.status(400).json({ success: false, message: "orderType must be B2B or B2C" });
    }

    const config = await CODConfig.findOne({ orderType, isActive: true });
    if (!config) {
      return res.status(404).json({ success: false, message: `No active COD config found for ${orderType}` });
    }

    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single COD config by id
// @route   GET /api/codconfig/:id
// @access  Private/Admin
exports.getCODConfigById = async (req, res) => {
  try {
    const config = await CODConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, message: "COD config not found" });
    }
    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(400).json({ success: false, message: "Invalid COD config id" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a COD config
// @route   PUT /api/codconfig/:id
// @access  Private/Admin
exports.updateCODConfig = async (req, res) => {
  try {
    const { surchargeType, value, isActive } = req.body;

    const config = await CODConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, message: "COD config not found" });
    }

    if (surchargeType !== undefined) {
      if (!validSurchargeTypes.includes(surchargeType)) {
        return res.status(400).json({ success: false, message: "surchargeType must be flat or percentage" });
      }
      config.surchargeType = surchargeType;
    }

    if (value !== undefined) {
      if (value < 0) {
        return res.status(400).json({ success: false, message: "value cannot be negative" });
      }
      const effectiveSurchargeType = surchargeType ?? config.surchargeType;
      if (effectiveSurchargeType === "percentage" && value > 100) {
        return res.status(400).json({ success: false, message: "percentage value cannot exceed 100" });
      }
      config.value = value;
    }

    if (isActive !== undefined) config.isActive = isActive;

    await config.save();

    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a COD config
// @route   DELETE /api/codconfig/:id
// @access  Private/Admin
exports.deleteCODConfig = async (req, res) => {
  try {
    const config = await CODConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, message: "COD config not found" });
    }

    await config.deleteOne();

    return res.status(200).json({ success: true, message: "COD config deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
