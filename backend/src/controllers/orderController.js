const Order = require("../models/Order");
const TrackingHistory = require("../models/TrackingHistory");
const User = require("../models/User");
const { calculateOrderCharge, RateCalculationError } = require("../utils/rateCalculator");
const { findBestAgent, AssignmentError } = require("../utils/agentAssigner");
const { applyAssignment } = require("./assignmentController");

// Shared input validation for both preview and confirm.
const validateOrderInput = (body) => {
  const { pickupAddress, dropAddress, dimensions, actualWeight, orderType, paymentType, receiverPhone } = body;

  if (!pickupAddress || !pickupAddress.addressLine || !pickupAddress.pincode) {
    return "pickupAddress with addressLine and pincode is required";
  }
  if (!dropAddress || !dropAddress.addressLine || !dropAddress.pincode) {
    return "dropAddress with addressLine and pincode is required";
  }
  if (!dimensions || !dimensions.length || !dimensions.breadth || !dimensions.height) {
    return "dimensions (length, breadth, height) are required";
  }
  if (!actualWeight) {
    return "actualWeight is required";
  }
  if (!orderType) {
    return "orderType is required";
  }
  if (!paymentType) {
    return "paymentType is required";
  }
  if (!receiverPhone || !receiverPhone.trim()) {
    return "receiverPhone is required";
  }
  return null;
};

// Resolves which user the order is placed FOR.
// - customer role: always themselves, ignore any customerId in the body.
// - admin role: can pass customerId to create on behalf of a customer.
const resolveCustomer = async (req) => {
  if (req.user.role === "customer") {
    return req.user._id;
  }

  if (req.user.role === "admin") {
    const { customerId } = req.body;
    if (!customerId) {
      throw new RateCalculationError("customerId is required when admin creates an order on behalf of a customer");
    }
    const customer = await User.findById(customerId);
    if (!customer || customer.role !== "customer") {
      throw new RateCalculationError("customerId does not match a valid customer account", 404);
    }
    return customer._id;
  }

  throw new RateCalculationError("Only customers or admins can create orders", 403);
};

// @desc    Preview the charge for an order WITHOUT creating it
// @route   POST /api/orders/calculate-charge
// @access  Private/Customer,Admin
exports.calculateCharge = async (req, res) => {
  try {
    const validationError = validateOrderInput(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const { pickupAddress, dropAddress, dimensions, actualWeight, orderType, paymentType } = req.body;

    const result = await calculateOrderCharge({
      pickupAddress,
      dropAddress,
      dimensions,
      actualWeight,
      orderType,
      paymentType,
    });

    return res.status(200).json({
      success: true,
      data: {
        pickupZone: { id: result.pickupZone._id, name: result.pickupZone.name },
        dropZone: { id: result.dropZone._id, name: result.dropZone.name },
        volumetricWeight: result.volumetricWeight,
        actualWeight,
        chargeableWeight: result.chargeableWeight,
        rateCardUsed: {
          id: result.rateCard._id,
          rateType: result.rateCard.rateType,
        },
        charge: result.charge,
        // Echoed back so the client can pass the exact same payload to /confirm
        // without re-typing everything.
        orderType,
        paymentType,
      },
    });
  } catch (error) {
    if (error instanceof RateCalculationError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create (confirm) an order. Recalculates the charge server-side —
//          never trusts a charge value sent from the client.
// @route   POST /api/orders
// @access  Private/Customer,Admin
exports.createOrder = async (req, res) => {
  try {
    const validationError = validateOrderInput(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const { pickupAddress, dropAddress, dimensions, actualWeight, orderType, paymentType, receiverPhone } = req.body;

    const customerId = await resolveCustomer(req);

    const result = await calculateOrderCharge({
      pickupAddress,
      dropAddress,
      dimensions,
      actualWeight,
      orderType,
      paymentType,
    });

    const order = await Order.create({
      customer: customerId,
      createdBy: req.user._id,
      orderType,
      paymentType,
      receiverPhone: receiverPhone.trim(),
      pickupAddress,
      dropAddress,
      pickupZone: result.pickupZone._id,
      dropZone: result.dropZone._id,
      package: {
        length: dimensions.length,
        breadth: dimensions.breadth,
        height: dimensions.height,
        actualWeight,
      },
      volumetricWeight: result.volumetricWeight,
      chargeableWeight: result.chargeableWeight,
      rateCardUsed: result.rateCard._id,
      charge: result.charge,
      status: "Created",
    });

    // First immutable tracking entry — logged the moment the order exists.
    await TrackingHistory.create({
      order: order._id,
      status: "Created",
      changedBy: req.user._id,
      notes: req.user.role === "admin" ? "Order created by admin on behalf of customer" : "Order placed by customer",
    });

    // --- Auto-assign on creation ---
    // Best-effort: try to find and assign the best available agent right
    // away instead of making the admin click "Auto-assign" manually. This
    // must NEVER fail the order-creation request — if no agent is available
    // right now, the order is simply created "Unassigned" and an admin can
    // still trigger manual/auto assignment later from the Orders screen.
    let assignmentMeta = { autoAssigned: false, reason: null };
    try {
      const { agent, usedZoneFallback } = await findBestAgent(order.pickupZone);
      await applyAssignment({
        order,
        agent,
        assignedBy: req.user._id,
        assignmentType: "auto",
        notes: usedZoneFallback
          ? "Auto-assigned on order creation — no agent available in pickup zone, assigned from all available agents"
          : "Auto-assigned on order creation — nearest available agent by pickup zone",
      });
      assignmentMeta = { autoAssigned: true, usedZoneFallback };
    } catch (assignErr) {
      // AssignmentError ("no agents available" etc.) is expected/benign —
      // anything else still gets logged but still shouldn't block the order.
      assignmentMeta = {
        autoAssigned: false,
        reason: assignErr instanceof AssignmentError ? assignErr.message : "Auto-assignment failed unexpectedly",
      };
      console.error(`[createOrder] Auto-assign skipped for order ${order._id}:`, assignErr.message);
    }

    const populatedOrder = await Order.findById(order._id)
      .populate("customer", "name email")
      .populate("createdBy", "name email role")
      .populate("pickupZone", "name")
      .populate("dropZone", "name")
      .populate("rateCardUsed")
      .populate("assignedAgent", "name email agentDetails");

    return res.status(201).json({ success: true, data: populatedOrder, meta: assignmentMeta });
  } catch (error) {
    if (error instanceof RateCalculationError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single order (customer can only view their own; admin/agent can view any)
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name email")
      .populate("createdBy", "name email role")
      .populate("pickupZone", "name")
      .populate("dropZone", "name")
      .populate("assignedAgent", "name email")
      .populate("rateCardUsed");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isOwner = String(order.customer._id) === String(req.user._id);
    const isPrivileged = ["admin", "agent"].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ success: false, message: "Not authorized to view this order" });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get orders for the logged-in customer
// @route   GET /api/orders/my
// @access  Private/Customer
exports.getMyOrders = async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ success: false, message: "Only customers have a personal order list. Admins should use GET /api/orders." });
    }

    const orders = await Order.find({ customer: req.user._id })
      .populate("pickupZone", "name")
      .populate("dropZone", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all orders (admin), with optional filters
// @route   GET /api/orders
// @access  Private/Admin
exports.getOrders = async (req, res) => {
  try {
    const filter = {};
    const { status, orderType, paymentType, customerId, zone, agentId } = req.query;

    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;
    if (paymentType) filter.paymentType = paymentType;
    if (customerId) filter.customer = customerId;
    // zone filters match either leg of the delivery (pickup OR drop in that zone)
    if (zone) filter.$or = [{ pickupZone: zone }, { dropZone: zone }];
    if (agentId) filter.assignedAgent = agentId;

    const orders = await Order.find(filter)
      .populate("customer", "name email")
      .populate("pickupZone", "name")
      .populate("dropZone", "name")
      .populate("assignedAgent", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};