const Zone = require("../models/Zone");
const RateCard = require("../models/RateCard");
const CODConfig = require("../models/CODConfig");

// Custom error so controllers can map this to a clean 4xx response
// instead of a generic 500.
class RateCalculationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "RateCalculationError";
    this.statusCode = statusCode;
  }
}

/**
 * Detects which Zone an address belongs to.
 * Match priority: exact pincode match first, then fallback to a
 * case-insensitive match against the zone's areas list.
 */
const detectZone = async (address, label = "address") => {
  if (!address || !address.pincode) {
    throw new RateCalculationError(`${label}: pincode is required for zone detection`);
  }

  let zone = await Zone.findOne({ pincodes: address.pincode.trim(), isActive: true });

  if (!zone && address.area) {
    zone = await Zone.findOne({
      areas: { $regex: `^${address.area.trim()}$`, $options: "i" },
      isActive: true,
    });
  }

  if (!zone) {
    throw new RateCalculationError(
      `${label}: could not detect a serviceable zone for pincode "${address.pincode}"${
        address.area ? ` / area "${address.area}"` : ""
      }`,
      404
    );
  }

  return zone;
};

/**
 * Volumetric weight (kg) = (L x B x H in cm) / 5000
 */
const calculateVolumetricWeight = (length, breadth, height) => {
  if ([length, breadth, height].some((v) => typeof v !== "number" || v <= 0)) {
    throw new RateCalculationError("Package length, breadth and height must all be positive numbers");
  }
  return (length * breadth * height) / 5000;
};

/**
 * Chargeable weight = higher of actual vs volumetric weight.
 */
const calculateChargeableWeight = (actualWeight, volumetricWeight) => {
  if (typeof actualWeight !== "number" || actualWeight <= 0) {
    throw new RateCalculationError("actualWeight must be a positive number");
  }
  return Math.max(actualWeight, volumetricWeight);
};

/**
 * Resolves the correct RateCard for an orderType between two zones.
 * rateType is derived automatically: same zone => intra, different => inter.
 */
const resolveRateCard = async (orderType, pickupZoneId, dropZoneId) => {
  const rateType = String(pickupZoneId) === String(dropZoneId) ? "intra" : "inter";

  const rateCard = await RateCard.findOne({
    orderType,
    rateType,
    fromZone: pickupZoneId,
    toZone: dropZoneId,
    isActive: true,
  });

  if (!rateCard) {
    throw new RateCalculationError(
      `No active ${rateType}-zone rate card configured for ${orderType} orders between these zones. Ask admin to configure one.`,
      404
    );
  }

  return rateCard;
};

/**
 * Resolves the active COD config for an orderType. Returns null if
 * paymentType isn't COD (no lookup needed / no surcharge applies).
 */
const resolveCODConfig = async (orderType, paymentType) => {
  if (paymentType !== "COD") return null;

  const config = await CODConfig.findOne({ orderType, isActive: true });
  if (!config) {
    throw new RateCalculationError(
      `No active COD config found for ${orderType} orders. Ask admin to configure one, or use Prepaid.`,
      404
    );
  }
  return config;
};

/**
 * Builds the full charge breakdown:
 *   weightCharge = baseRate + (chargeableWeight * ratePerKg)
 *   codSurcharge = flat value, or (weightCharge * value/100) for percentage
 *   totalCharge  = weightCharge + codSurcharge
 */
const buildChargeBreakdown = (rateCard, chargeableWeight, codConfig) => {
  const baseRate = rateCard.baseRate;
  const ratePerKg = rateCard.ratePerKg;
  const weightCharge = Number((baseRate + chargeableWeight * ratePerKg).toFixed(2));

  let codSurcharge = 0;
  if (codConfig) {
    codSurcharge =
      codConfig.surchargeType === "flat"
        ? codConfig.value
        : Number(((weightCharge * codConfig.value) / 100).toFixed(2));
  }

  const totalCharge = Number((weightCharge + codSurcharge).toFixed(2));

  return { baseRate, ratePerKg, weightCharge, codSurcharge, totalCharge };
};

/**
 * Full pipeline used by both the preview (calculate-charge) and
 * confirm (create order) endpoints, so the two can never drift apart.
 *
 * @param {Object} input
 * @param {Object} input.pickupAddress  { addressLine, area, city, state, pincode }
 * @param {Object} input.dropAddress    same shape
 * @param {Object} input.dimensions     { length, breadth, height } in cm
 * @param {Number} input.actualWeight   in kg
 * @param {String} input.orderType      "B2B" | "B2C"
 * @param {String} input.paymentType    "Prepaid" | "COD"
 */
const calculateOrderCharge = async ({
  pickupAddress,
  dropAddress,
  dimensions,
  actualWeight,
  orderType,
  paymentType,
}) => {
  if (!["B2B", "B2C"].includes(orderType)) {
    throw new RateCalculationError("orderType must be B2B or B2C");
  }
  if (!["Prepaid", "COD"].includes(paymentType)) {
    throw new RateCalculationError("paymentType must be Prepaid or COD");
  }
  if (!dimensions) {
    throw new RateCalculationError("dimensions (length, breadth, height) are required");
  }

  const [pickupZone, dropZone] = await Promise.all([
    detectZone(pickupAddress, "pickupAddress"),
    detectZone(dropAddress, "dropAddress"),
  ]);

  const volumetricWeight = Number(
    calculateVolumetricWeight(dimensions.length, dimensions.breadth, dimensions.height).toFixed(3)
  );
  const chargeableWeight = Number(
    calculateChargeableWeight(actualWeight, volumetricWeight).toFixed(3)
  );

  const rateCard = await resolveRateCard(orderType, pickupZone._id, dropZone._id);
  const codConfig = await resolveCODConfig(orderType, paymentType);

  const charge = buildChargeBreakdown(rateCard, chargeableWeight, codConfig);

  return {
    pickupZone,
    dropZone,
    volumetricWeight,
    chargeableWeight,
    rateCard,
    charge,
  };
};

module.exports = {
  RateCalculationError,
  detectZone,
  calculateVolumetricWeight,
  calculateChargeableWeight,
  resolveRateCard,
  resolveCODConfig,
  buildChargeBreakdown,
  calculateOrderCharge,
};
