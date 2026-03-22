export const CHEF_FEATURE_STARS_THRESHOLD = 200;
export const COURIER_BONUS_STARS_THRESHOLD = 250;
export const COURIER_BONUS_AMOUNT_XOF = 10_000;
export const REFERRAL_FREE_DELIVERY_CREDITS = 2;
export const FREE_DELIVERY_PROMO_MIN_SUBTOTAL = 3_000;
export const FREE_DELIVERY_PROMO_RADIUS_KM = 5;

export type DeliveryPricingQuote = {
  subtotal: number;
  distanceKm: number;
  demandMultiplier: number;
  baseFee: number;
  distanceFee: number;
  surgeFee: number;
  deliveryFee: number;
  totalWithDelivery: number;
  freeDeliveryApplied: boolean;
  freeDeliveryReason: "promo" | "referral" | null;
  referralCreditWillBeUsed: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundUpToNearest50(value: number) {
  return Math.ceil(value / 50) * 50;
}

export function buildReferralCode(name: string, userId: number) {
  const letters = name
    .normalize("NFD")
    .replace(/[^A-Za-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .map((part) => part.slice(0, 3).toUpperCase())
    .join("")
    .slice(0, 6) || "NIXYAH";

  const suffix = String(1000 + (userId % 9000));
  return `${letters}${suffix}`;
}

export function isPeakDemandHour(now = new Date()) {
  const hour = now.getHours();
  return (hour >= 11 && hour < 14) || (hour >= 18 && hour < 22);
}

export function getDemandMultiplier(activeJobs: number, now = new Date()) {
  const peakMultiplier = isPeakDemandHour(now) ? 1.12 : 1;
  const loadMultiplier = activeJobs >= 12 ? 1.4 : activeJobs >= 7 ? 1.25 : activeJobs >= 4 ? 1.12 : 1;
  return Number(Math.max(peakMultiplier, loadMultiplier).toFixed(2));
}

export function computeDeliveryPricing(input: {
  subtotal: number;
  distanceKm?: number | null;
  activeJobs?: number;
  hasReferralCredit?: boolean;
  now?: Date;
}): DeliveryPricingQuote {
  const subtotal = Math.max(0, Number(input.subtotal) || 0);
  const rawDistance = Number(input.distanceKm ?? 0);
  const distanceKm = clamp(Number.isFinite(rawDistance) && rawDistance > 0 ? rawDistance : 3, 0.5, 25);
  const activeJobs = Math.max(0, Number(input.activeJobs) || 0);
  const demandMultiplier = getDemandMultiplier(activeJobs, input.now);

  const promoFreeDelivery = subtotal >= FREE_DELIVERY_PROMO_MIN_SUBTOTAL && distanceKm <= FREE_DELIVERY_PROMO_RADIUS_KM;
  const referralCreditWillBeUsed = !promoFreeDelivery && Boolean(input.hasReferralCredit);

  const baseFee = 500;
  const distanceFee = Math.max(0, Math.ceil(Math.max(0, distanceKm - 1) * 220));
  const beforeSurge = baseFee + distanceFee;
  const surged = beforeSurge * demandMultiplier;
  const deliveryFeeBeforeBenefits = clamp(roundUpToNearest50(surged), 500, 5_000);

  const deliveryFee = promoFreeDelivery || referralCreditWillBeUsed ? 0 : deliveryFeeBeforeBenefits;
  const freeDeliveryReason = promoFreeDelivery ? "promo" : referralCreditWillBeUsed ? "referral" : null;

  return {
    subtotal,
    distanceKm: Number(distanceKm.toFixed(1)),
    demandMultiplier,
    baseFee,
    distanceFee,
    surgeFee: Math.max(0, deliveryFeeBeforeBenefits - beforeSurge),
    deliveryFee,
    totalWithDelivery: subtotal + deliveryFee,
    freeDeliveryApplied: deliveryFee === 0,
    freeDeliveryReason,
    referralCreditWillBeUsed,
  };
}

export function shouldInvestigateComplaint(target: "chef" | "courier" | "platform", category: string) {
  const severeChefCategories = new Set(["hygiene", "wrong_order", "missing_items", "unsafe_food"]);
  const severeCourierCategories = new Set(["suspicious_behavior", "wrong_address", "damaged_order"]);
  const severePlatformCategories = new Set(["billing", "refund"]);

  if (target === "chef") {
    return severeChefCategories.has(category);
  }

  if (target === "courier") {
    return severeCourierCategories.has(category);
  }

  return severePlatformCategories.has(category);
}