const Zone = require("../models/Zone");

// @desc    Create a new zone
// @route   POST /api/zones
// @access  Private/Admin
exports.createZone = async (req, res) => {
  try {
    const { name, pincodes = [], areas = [] } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Zone name is required" });
    }

    const existing = await Zone.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: "Zone with this name already exists" });
    }

    const zone = await Zone.create({ name: name.trim(), pincodes, areas });

    return res.status(201).json({ success: true, data: zone });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all zones (supports ?active=true and ?search=)
// @route   GET /api/zones
// @access  Private/Admin
exports.getZones = async (req, res) => {
  try {
    const filter = {};
    if (req.query.active !== undefined) {
      filter.isActive = req.query.active === "true";
    }
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { pincodes: { $regex: req.query.search, $options: "i" } },
        { areas: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const zones = await Zone.find(filter).sort({ name: 1 });
    return res.status(200).json({ success: true, count: zones.length, data: zones });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single zone by id
// @route   GET /api/zones/:id
// @access  Private/Admin
exports.getZoneById = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found" });
    }
    return res.status(200).json({ success: true, data: zone });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(400).json({ success: false, message: "Invalid zone id" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a zone (rename, or overwrite pincodes & areas)
// @route   PUT /api/zones/:id
// @access  Private/Admin
exports.updateZone = async (req, res) => {
  try {
    const { name, pincodes, areas, isActive } = req.body;

    const zone = await Zone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found" });
    }

    if (name && name.trim() !== zone.name) {
      const duplicate = await Zone.findOne({ name: name.trim(), _id: { $ne: zone._id } });
      if (duplicate) {
        return res.status(409).json({ success: false, message: "Another zone with this name already exists" });
      }
      zone.name = name.trim();
    }

    if (pincodes !== undefined) zone.pincodes = pincodes;
    if (areas !== undefined) zone.areas = areas;
    if (isActive !== undefined) zone.isActive = isActive;

    await zone.save();

    return res.status(200).json({ success: true, data: zone });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add pincodes/areas to an existing zone without overwriting
// @route   PATCH /api/zones/:id/assign
// @access  Private/Admin
exports.assignToZone = async (req, res) => {
  try {
    const { pincodes = [], areas = [] } = req.body;

    const zone = await Zone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found" });
    }

    const mergedPincodes = new Set([...zone.pincodes, ...pincodes]);
    const mergedAreas = new Set([...zone.areas, ...areas]);

    zone.pincodes = Array.from(mergedPincodes);
    zone.areas = Array.from(mergedAreas);

    await zone.save();

    return res.status(200).json({ success: true, data: zone });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a zone
// @route   DELETE /api/zones/:id
// @access  Private/Admin
exports.deleteZone = async (req, res) => {
  try {
    const RateCard = require("../models/RateCard");

    const zone = await Zone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found" });
    }

    const inUse = await RateCard.findOne({
      $or: [{ fromZone: zone._id }, { toZone: zone._id }],
    });
    if (inUse) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete zone: it is referenced by one or more rate cards. Deactivate it instead.",
      });
    }

    await zone.deleteOne();

    return res.status(200).json({ success: true, message: "Zone deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
