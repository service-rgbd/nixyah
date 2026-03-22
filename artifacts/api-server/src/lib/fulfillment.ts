import { and, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  chefProfilesTable,
  complaintsTable,
  courierProfilesTable,
  deliveryJobsTable,
  usersTable,
} from "@workspace/db/schema";
import {
  CHEF_FEATURE_STARS_THRESHOLD,
  COURIER_BONUS_AMOUNT_XOF,
  COURIER_BONUS_STARS_THRESHOLD,
  REFERRAL_FREE_DELIVERY_CREDITS,
  computeDeliveryPricing,
} from "./commerce.js";
import { geocodeAddress } from "./geocoding.js";
import { notifyUsers } from "./notifications.js";

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function haversineDistanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveCoordinates(input: {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  if (isFiniteCoordinate(input.latitude) && isFiniteCoordinate(input.longitude)) {
    return { latitude: input.latitude, longitude: input.longitude };
  }

  const geocoded = await geocodeAddress(input.address ?? null);
  if (!geocoded) {
    return null;
  }

  return {
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
  };
}

async function getActiveDeliveryLoadCount() {
  const activeJobs = await db
    .select({ id: deliveryJobsTable.id })
    .from(deliveryJobsTable)
    .where(
      inArray(deliveryJobsTable.status, ["broadcasting", "available", "accepted", "picked_up", "on_the_way"]),
    );

  return activeJobs.length;
}

export async function quoteDeliveryOrderPricing(input: {
  subtotal: number;
  restaurantAddress?: string | null;
  restaurantLatitude?: number | null;
  restaurantLongitude?: number | null;
  deliveryAddress?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  hasReferralCredit?: boolean;
}) {
  const [restaurantPoint, deliveryPoint, activeJobs] = await Promise.all([
    resolveCoordinates({
      address: input.restaurantAddress ?? null,
      latitude: input.restaurantLatitude ?? null,
      longitude: input.restaurantLongitude ?? null,
    }),
    resolveCoordinates({
      address: input.deliveryAddress ?? null,
      latitude: input.deliveryLatitude ?? null,
      longitude: input.deliveryLongitude ?? null,
    }),
    getActiveDeliveryLoadCount(),
  ]);

  const distanceKm = restaurantPoint && deliveryPoint
    ? haversineDistanceKm(restaurantPoint, deliveryPoint)
    : null;

  return computeDeliveryPricing({
    subtotal: input.subtotal,
    distanceKm,
    activeJobs,
    hasReferralCredit: input.hasReferralCredit,
  });
}

export async function refreshChefReviewAggregates(chefProfileId: number) {
  const { reviewsTable } = await import("@workspace/db/schema");
  const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.chefProfileId, chefProfileId));
  const ratedReviews = reviews.filter((review) => Number.isFinite(review.rating));
  const reviewCount = ratedReviews.length;
  const stars = ratedReviews.reduce((sum, review) => sum + Math.round(Number(review.rating) || 0), 0);
  const rating = reviewCount > 0
    ? Number((ratedReviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviewCount).toFixed(1))
    : 5.0;

  await db.update(chefProfilesTable).set({
    rating,
    reviewCount,
    stars,
    isFeatured: stars >= CHEF_FEATURE_STARS_THRESHOLD,
  }).where(eq(chefProfilesTable.id, chefProfileId));
}

export async function refreshCourierReviewAggregates(courierUserId: number) {
  const { reviewsTable } = await import("@workspace/db/schema");
  const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.courierUserId, courierUserId));
  const ratedReviews = reviews.filter((review) => Number.isFinite(review.deliveryRating));
  const reviewCount = ratedReviews.length;
  const stars = ratedReviews.reduce((sum, review) => sum + Math.round(Number(review.deliveryRating ?? 0)), 0);
  const rating = reviewCount > 0
    ? Number((ratedReviews.reduce((sum, review) => sum + Number(review.deliveryRating ?? 0), 0) / reviewCount).toFixed(1))
    : 5.0;

  const [courierProfile] = await db.select().from(courierProfilesTable).where(eq(courierProfilesTable.userId, courierUserId)).limit(1);
  const unlockBonus = courierProfile && stars >= COURIER_BONUS_STARS_THRESHOLD && !courierProfile.bonusUnlockedAt;

  await db.update(courierProfilesTable).set({
    rating,
    reviewCount,
    stars,
    bonusEarnedAmount: unlockBonus
      ? courierProfile!.bonusEarnedAmount + COURIER_BONUS_AMOUNT_XOF
      : courierProfile?.bonusEarnedAmount ?? 0,
    bonusUnlockedAt: unlockBonus ? new Date() : courierProfile?.bonusUnlockedAt ?? null,
  }).where(eq(courierProfilesTable.userId, courierUserId));

  if (unlockBonus) {
    await notifyUsers({
      userIds: [courierUserId],
      type: "payment",
      title: "Bonus livreur débloqué",
      message: `Vous avez atteint ${COURIER_BONUS_STARS_THRESHOLD} étoiles. Bonus crédité: ${COURIER_BONUS_AMOUNT_XOF.toLocaleString("fr-FR")} XOF.`,
      data: {
        screen: "courier/orders",
        bonusAmount: String(COURIER_BONUS_AMOUNT_XOF),
      },
    });
  }
}

export async function refreshComplaintAggregates(input: { chefProfileId?: number | null; courierUserId?: number | null }) {
  if (input.chefProfileId) {
    const complaints = await db.select().from(complaintsTable).where(eq(complaintsTable.chefProfileId, input.chefProfileId));
    await db.update(chefProfilesTable).set({
      complaintCount: complaints.length,
      activeInvestigationCount: complaints.filter((complaint) => complaint.status === "open" || complaint.status === "investigating").length,
    }).where(eq(chefProfilesTable.id, input.chefProfileId));
  }

  if (input.courierUserId) {
    const complaints = await db.select().from(complaintsTable).where(eq(complaintsTable.courierUserId, input.courierUserId));
    await db.update(courierProfilesTable).set({
      complaintCount: complaints.length,
      activeInvestigationCount: complaints.filter((complaint) => complaint.status === "open" || complaint.status === "investigating").length,
    }).where(eq(courierProfilesTable.userId, input.courierUserId));
  }
}

export async function maybeGrantReferralReward(clientUserId: number) {
  const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, clientUserId)).limit(1);
  if (!clientUser?.referredByUserId || clientUser.referralRewardGrantedAt) {
    return null;
  }

  const [referrer] = await db.select().from(usersTable).where(eq(usersTable.id, clientUser.referredByUserId)).limit(1);
  if (!referrer) {
    return null;
  }

  await db.update(usersTable).set({
    freeDeliveryCredits: referrer.freeDeliveryCredits + REFERRAL_FREE_DELIVERY_CREDITS,
  }).where(eq(usersTable.id, referrer.id));

  await db.update(usersTable).set({
    referralRewardGrantedAt: new Date(),
  }).where(eq(usersTable.id, clientUser.id));

  await notifyUsers({
    userIds: [referrer.id],
    type: "system",
    title: "Parrainage validé",
    message: `Votre parrainage est validé. ${REFERRAL_FREE_DELIVERY_CREDITS} livraisons offertes viennent d'être ajoutées à votre compte.`,
    data: {
      screen: "orders",
      freeDeliveryCredits: String(referrer.freeDeliveryCredits + REFERRAL_FREE_DELIVERY_CREDITS),
    },
  });

  return {
    referrerUserId: referrer.id,
    freeDeliveryCredits: referrer.freeDeliveryCredits + REFERRAL_FREE_DELIVERY_CREDITS,
  };
}

export async function resolveReferralCode(referralCode: string) {
  return db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.referralCode, referralCode.trim().toUpperCase())))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}