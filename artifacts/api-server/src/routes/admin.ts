import express from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  chefProfilesTable,
  commerceOrdersTable,
  commerceStoresTable,
  courierProfilesTable,
  deliveryJobsTable,
  deliveryLocationUpdatesTable,
  merchantProfilesTable,
  ordersTable,
  reviewsTable,
  usersTable,
} from "@workspace/db/schema";
import { requireAdmin, type AuthRequest } from "../middlewares/auth.js";
import { parseWithSchema, idParamSchema } from "../lib/validation.js";
import {
  adminChefStatusSchema,
  adminChefVerifySchema,
  adminCommerceStoreStatusSchema,
  adminCourierStatusSchema,
  adminCourierVerifySchema,
} from "../lib/request-schemas.js";
import { notifyUsers } from "../lib/notifications.js";

const router = express.Router();

type DashboardScale = "hour" | "day" | "week";

function startOfHour(date: Date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = (day + 6) % 7;
  next.setDate(next.getDate() - diff);
  return next;
}

function addHours(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 60 * 60 * 1000);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addWeeks(date: Date, amount: number) {
  return addDays(date, amount * 7);
}

function buildScaleMeta(scale: DashboardScale, now = new Date()) {
  if (scale === "hour") {
    const currentStart = addHours(startOfHour(now), -7);
    const previousStart = addHours(currentStart, -8);
    const labels = Array.from({ length: 8 }, (_, index) => `${addHours(currentStart, index).getHours()}h`);
    return { labels, currentStart, previousStart, bucketCount: 8 };
  }

  if (scale === "week") {
    const currentStart = addWeeks(startOfWeek(now), -5);
    const previousStart = addWeeks(currentStart, -6);
    const labels = Array.from({ length: 6 }, (_, index) => `S${index + 1}`);
    return { labels, currentStart, previousStart, bucketCount: 6 };
  }

  const currentStart = addDays(startOfDay(now), -6);
  const previousStart = addDays(currentStart, -7);
  const labels = Array.from({ length: 7 }, (_, index) => {
    const value = addDays(currentStart, index);
    return value.toLocaleDateString("fr-FR", { weekday: "short" });
  });
  return { labels, currentStart, previousStart, bucketCount: 7 };
}

function getBucketIndex(date: Date, scale: DashboardScale, rangeStart: Date) {
  if (scale === "hour") {
    return Math.floor((date.getTime() - rangeStart.getTime()) / (60 * 60 * 1000));
  }
  if (scale === "week") {
    return Math.floor((date.getTime() - rangeStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  }
  return Math.floor((date.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000));
}

function formatOrderStatus(status: string, deliveryStatus?: string | null) {
  if (deliveryStatus === "on_the_way" || deliveryStatus === "picked_up") {
    return "En livraison";
  }
  if (deliveryStatus === "accepted") {
    return "Coursier assigne";
  }
  if (status === "pending") {
    return "En attente";
  }
  if (status === "accepted") {
    return "Acceptee";
  }
  if (status === "preparing") {
    return "En preparation";
  }
  if (status === "ready") {
    return "Prete";
  }
  if (status === "delivered") {
    return "Livree";
  }
  if (status === "cancelled") {
    return "Annulee";
  }
  return status;
}

function resolveChefStatus(profile: typeof chefProfilesTable.$inferSelect): "active" | "suspended" | "pending_verification" | "rejected" {
  if (profile.isVerified && profile.isOnline) return "active";
  if (profile.isVerified && !profile.isOnline) return "suspended";
  if (!profile.isVerified && profile.isOnline) return "pending_verification";
  return "rejected";
}

function resolveCourierStatus(profile: typeof courierProfilesTable.$inferSelect): "active" | "suspended" | "pending_verification" | "rejected" {
  if (profile.isVerified && profile.isAvailable) return "active";
  if (profile.isVerified && !profile.isAvailable) return "suspended";
  if (!profile.isVerified && profile.isAvailable) return "pending_verification";
  return "rejected";
}

function isCourierDossierComplete(profile: typeof courierProfilesTable.$inferSelect) {
  return Boolean(
    profile.identityDocumentUrl &&
    profile.driverLicenseUrl &&
    profile.vehicleRegistrationUrl &&
    profile.vehiclePhotoUrl &&
    profile.selfiePhotoUrl
  );
}

function buildAdminCourier(profile: typeof courierProfilesTable.$inferSelect, user?: typeof usersTable.$inferSelect | null) {
  return {
    id: profile.id,
    name: user?.name ?? `Livreur ${profile.id}`,
    email: user?.email ?? null,
    phone: user?.phone ?? null,
    location: user?.location ?? null,
    zone: profile.zone || null,
    vehicleType: profile.vehicleType,
    isVerified: profile.isVerified,
    isAvailable: profile.isAvailable,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    stars: profile.stars ?? null,
    complaintCount: profile.complaintCount,
    activeInvestigationCount: profile.activeInvestigationCount,
    bonusEarnedAmount: profile.bonusEarnedAmount,
    isDossierComplete: isCourierDossierComplete(profile),
    rejectionReason: profile.rejectionReason ?? null,
    rejectionReasonUpdatedAt: profile.rejectionReasonUpdatedAt?.toISOString() ?? null,
    dossierSubmittedAt: profile.dossierSubmittedAt?.toISOString() ?? null,
    lastLocationAt: profile.lastLocationAt?.toISOString() ?? null,
    verificationDocuments: {
      identityDocumentUrl: profile.identityDocumentUrl ?? null,
      driverLicenseUrl: profile.driverLicenseUrl ?? null,
      vehicleRegistrationUrl: profile.vehicleRegistrationUrl ?? null,
      vehiclePhotoUrl: profile.vehiclePhotoUrl ?? null,
      selfiePhotoUrl: profile.selfiePhotoUrl ?? null,
    },
    status: resolveCourierStatus(profile),
    createdAt: profile.createdAt?.toISOString() ?? null,
  };
}

function buildCourierStatusNotification(status: "active" | "suspended" | "pending_verification" | "rejected", rejectionReason?: string | null) {
  if (status === "active") {
    return {
      title: "Profil livreur active",
      message: "Votre dossier livreur a ete valide. Vous pouvez reprendre les missions.",
    };
  }

  if (status === "suspended") {
    return {
      title: "Profil livreur suspendu",
      message: "Votre acces livreur est temporairement suspendu. Contactez le support si besoin.",
    };
  }

  if (status === "pending_verification") {
    return {
      title: "Dossier livreur en revision",
      message: "Votre dossier livreur est de nouveau en attente de verification.",
    };
  }

  return {
    title: "Dossier livreur rejete",
    message: rejectionReason
      ? `Votre dossier livreur a ete rejete. Motif: ${rejectionReason}`
      : "Votre dossier livreur a ete rejete. Consultez votre espace dossier pour corriger les pieces demandees.",
  };
}

function buildCourierBadgeNotification(isVerified: boolean, rejectionReason?: string | null) {
  if (isVerified) {
    return {
      title: "Badge livreur confirme",
      message: "Votre badge livreur a ete accorde par l equipe Nixyah.",
    };
  }

  return {
    title: "Badge livreur retire",
    message: rejectionReason
      ? `Votre badge livreur a ete retire. Motif: ${rejectionReason}`
      : "Votre badge livreur a ete retire. Votre dossier peut etre revu a nouveau si necessaire.",
  };
}

router.get("/admin/dashboard/overview", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const scale = (["hour", "day", "week"].includes(String(req.query.scale)) ? String(req.query.scale) : "day") as DashboardScale;
    const zone = typeof req.query.zone === "string" ? req.query.zone.trim() : "";
    const universe = typeof req.query.universe === "string" ? req.query.universe.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";

    const [mealOrders, commerceOrders, chefProfiles, courierProfiles, stores, deliveryJobs, reviews] = await Promise.all([
      db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)),
      db.select().from(commerceOrdersTable).orderBy(desc(commerceOrdersTable.createdAt)),
      db.select().from(chefProfilesTable),
      db.select().from(courierProfilesTable),
      db.select().from(commerceStoresTable).orderBy(desc(commerceStoresTable.createdAt)),
      db.select().from(deliveryJobsTable).orderBy(desc(deliveryJobsTable.createdAt)),
      db.select().from(reviewsTable),
    ]);

    const relatedUserIds = Array.from(new Set([
      ...mealOrders.map((order) => order.clientId),
      ...chefProfiles.map((profile) => profile.userId),
      ...courierProfiles.map((profile) => profile.userId),
      ...deliveryJobs.map((job) => job.clientId),
      ...deliveryJobs.map((job) => job.courierUserId).filter((value): value is number => typeof value === "number"),
    ]));
    const users = relatedUserIds.length > 0 ? await db.select().from(usersTable).where(inArray(usersTable.id, relatedUserIds)) : [];
    const latestLocations = deliveryJobs.length > 0
      ? await db.select().from(deliveryLocationUpdatesTable).where(inArray(deliveryLocationUpdatesTable.deliveryJobId, deliveryJobs.map((job) => job.id)))
      : [];

    const usersById = new Map(users.map((user) => [user.id, user]));
    const chefsByProfileId = new Map(chefProfiles.map((profile) => [profile.id, profile]));
    const couriersByUserId = new Map(courierProfiles.map((profile) => [profile.userId, profile]));
    const storesById = new Map(stores.map((store) => [store.id, store]));
    const deliveryByOrderId = new Map(deliveryJobs.map((job) => [job.orderId, job]));
    const latestLocationByJobId = new Map<number, typeof deliveryLocationUpdatesTable.$inferSelect>();
    for (const location of latestLocations) {
      const previous = latestLocationByJobId.get(location.deliveryJobId);
      if (!previous || previous.createdAt < location.createdAt) {
        latestLocationByJobId.set(location.deliveryJobId, location);
      }
    }

    const moderationStores = stores.filter((store) => {
      if (status && store.status !== status) {
        return false;
      }
      if (zone && (store.zone || store.location) !== zone) {
        return false;
      }
      if (universe && store.universe !== universe) {
        return false;
      }
      return true;
    });

    const visibleMealOrders = mealOrders.filter((order) => {
      const job = deliveryByOrderId.get(order.id);
      const client = usersById.get(order.clientId);
      if (zone) {
        const orderZone = order.deliveryAddress || client?.location || "";
        if (orderZone !== zone) {
          return false;
        }
      }
      return true;
    });

    const visibleCommerceOrders = commerceOrders.filter((order) => {
      const store = storesById.get(order.storeId);
      if (zone && (store?.zone || store?.location || "") !== zone) {
        return false;
      }
      if (universe && store?.universe !== universe) {
        return false;
      }
      return true;
    });

    const now = new Date();
    const scaleMeta = buildScaleMeta(scale, now);
    const currentSeries = Array.from({ length: scaleMeta.bucketCount }, () => 0);
    const previousSeries = Array.from({ length: scaleMeta.bucketCount }, () => 0);
    const combinedOrders = [
      ...visibleMealOrders.map((order) => ({ createdAt: order.createdAt, total: Number(order.totalWithDelivery ?? order.total ?? 0), clientId: order.clientId })),
      ...visibleCommerceOrders.map((order) => ({ createdAt: order.createdAt, total: Number(order.totalWithDelivery ?? order.total ?? 0), clientId: order.clientId })),
    ];

    for (const order of combinedOrders) {
      const createdAt = new Date(order.createdAt);
      const currentIndex = getBucketIndex(createdAt, scale, scaleMeta.currentStart);
      if (currentIndex >= 0 && currentIndex < scaleMeta.bucketCount) {
        currentSeries[currentIndex] += 1;
        continue;
      }
      const previousIndex = getBucketIndex(createdAt, scale, scaleMeta.previousStart);
      if (previousIndex >= 0 && previousIndex < scaleMeta.bucketCount) {
        previousSeries[previousIndex] += 1;
      }
    }

    const mealDelivered = visibleMealOrders.filter((order) => order.status === "delivered").length;
    const commerceDelivered = visibleCommerceOrders.filter((order) => order.status === "delivered").length;
    const inProgressOrders = visibleMealOrders.filter((order) => ["accepted", "preparing", "ready"].includes(order.status)).length + visibleCommerceOrders.filter((order) => ["accepted", "preparing", "ready"].includes(order.status)).length;
    const totalRevenue = combinedOrders.reduce((sum, order) => sum + order.total, 0);
    const uniqueClients = new Set(combinedOrders.map((order) => order.clientId));
    const hourMap = new Map<number, number>();
    for (const order of combinedOrders) {
      const hour = new Date(order.createdAt).getHours();
      hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
    }
    const sortedHours = Array.from(hourMap.entries()).sort((left, right) => right[1] - left[1]);
    const peakHour = sortedHours[0]?.[0] ?? 12;
    const quietHour = sortedHours[sortedHours.length - 1]?.[0] ?? 6;
    const previousTotal = previousSeries.reduce((sum, value) => sum + value, 0);

    const zonesMap = new Map<string, { zone: string; orders: number; revenue: number }>();
    for (const order of visibleMealOrders) {
      const client = usersById.get(order.clientId);
      const zoneKey = order.deliveryAddress || client?.location || "Zone inconnue";
      const current = zonesMap.get(zoneKey) ?? { zone: zoneKey, orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += Number(order.totalWithDelivery ?? order.total ?? 0);
      zonesMap.set(zoneKey, current);
    }
    for (const order of visibleCommerceOrders) {
      const store = storesById.get(order.storeId);
      const zoneKey = store?.zone || store?.location || order.deliveryAddress || "Zone inconnue";
      const current = zonesMap.get(zoneKey) ?? { zone: zoneKey, orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += Number(order.totalWithDelivery ?? order.total ?? 0);
      zonesMap.set(zoneKey, current);
    }
    const zones = Array.from(zonesMap.values()).sort((left, right) => right.orders - left.orders).slice(0, 5);

    const orderRows = visibleMealOrders.slice(0, 12).map((order) => {
      const client = usersById.get(order.clientId);
      const chefProfile = chefsByProfileId.get(order.chefProfileId);
      const chefUser = chefProfile ? usersById.get(chefProfile.userId) : null;
      const deliveryJob = deliveryByOrderId.get(order.id) ?? null;
      const courierUser = deliveryJob?.courierUserId ? usersById.get(deliveryJob.courierUserId) : null;
      const thresholdMinutes = 35;
      const actualDelayMinutes = Math.max(0, Math.round((now.getTime() - new Date(order.createdAt).getTime()) / 60000));
      const isDelayed = order.status !== "delivered" && actualDelayMinutes > thresholdMinutes;
      return {
        id: `OPS-${order.id}`,
        client: client?.name || "Client inconnu",
        chef: chefUser?.name || "Chef inconnu",
        courier: courierUser?.name || "Non assigne",
        status: formatOrderStatus(order.status, deliveryJob?.status ?? null),
        amount: Number(order.totalWithDelivery ?? order.total ?? 0),
        date: order.createdAt.toISOString(),
        etaMinutes: actualDelayMinutes,
        isDelayed,
        zone: order.deliveryAddress || client?.location || "Zone inconnue",
        orderId: order.id,
      };
    });

    const activeDeliveryJobs = deliveryJobs.filter((job) => ["accepted", "picked_up", "on_the_way"].includes(job.status));
    const courierLoad = new Map<number, number>();
    for (const job of activeDeliveryJobs) {
      if (job.courierUserId) {
        courierLoad.set(job.courierUserId, (courierLoad.get(job.courierUserId) ?? 0) + 1);
      }
    }

    const alerts = [
      {
        id: "delays",
        tone: "danger",
        title: `${orderRows.filter((row) => row.isDelayed).length} commandes en retard`,
        detail: "Issues des vraies commandes ouvertes cote API.",
      },
      {
        id: "couriers",
        tone: "warning",
        title: `${Array.from(courierLoad.values()).filter((value) => value >= 2).length} coursiers surcharges`,
        detail: "Charge detectee via les jobs de livraison actifs.",
      },
      {
        id: "drop",
        tone: previousTotal > 0 && currentSeries.reduce((sum, value) => sum + value, 0) < previousTotal * 0.75 ? "warning" : "success",
        title: previousTotal > 0 && currentSeries.reduce((sum, value) => sum + value, 0) < previousTotal * 0.75 ? "Baisse d activite anormale" : "Activite stable",
        detail: "Comparee a la periode precedente sur les vraies commandes.",
      },
    ];

    const chefOrdersMap = new Map<number, typeof ordersTable.$inferSelect[]>();
    for (const order of mealOrders) {
      const current = chefOrdersMap.get(order.chefProfileId) ?? [];
      current.push(order);
      chefOrdersMap.set(order.chefProfileId, current);
    }
    const reviewsByChefProfileId = new Map<number, typeof reviewsTable.$inferSelect[]>();
    for (const review of reviews) {
      const current = reviewsByChefProfileId.get(review.chefProfileId) ?? [];
      current.push(review);
      reviewsByChefProfileId.set(review.chefProfileId, current);
    }

    const chefs = chefProfiles
      .map((profile) => {
        const chefOrders = chefOrdersMap.get(profile.id) ?? [];
        const chefReviews = reviewsByChefProfileId.get(profile.id) ?? [];
        const deliveredJobs = deliveryJobs.filter((job) => job.chefProfileId === profile.id && job.deliveredAt && job.acceptedAt);
        const averageMinutes = deliveredJobs.length > 0
          ? Math.round(deliveredJobs.reduce((sum, job) => sum + ((job.deliveredAt?.getTime() ?? 0) - (job.acceptedAt?.getTime() ?? job.createdAt.getTime())) / 60000, 0) / deliveredJobs.length)
          : 0;
        const satisfaction = chefReviews.length > 0
          ? Number((chefReviews.reduce((sum, review) => sum + Number(review.rating), 0) / chefReviews.length).toFixed(1))
          : Number(profile.rating.toFixed(1));
        const score = Math.round(Math.min(100, satisfaction * 14 + chefOrders.length * 1.6 + Math.max(0, 30 - averageMinutes)));
        const user = usersById.get(profile.userId);
        return {
          id: profile.id,
          name: user?.name || `Chef ${profile.id}`,
          ordersHandled: chefOrders.length,
          averageMinutes,
          satisfaction,
          score,
          isOnline: profile.isOnline,
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);

    const couriers = courierProfiles
      .map((profile) => {
        const user = usersById.get(profile.userId);
        const assignedJobs = activeDeliveryJobs.filter((job) => job.courierUserId === profile.userId);
        const deliveredJobsForCourier = deliveryJobs.filter((job) => job.courierUserId === profile.userId && job.deliveredAt && job.acceptedAt);
        const averageMinutes = deliveredJobsForCourier.length > 0
          ? Math.round(deliveredJobsForCourier.reduce((sum, job) => sum + ((job.deliveredAt?.getTime() ?? 0) - (job.acceptedAt?.getTime() ?? job.createdAt.getTime())) / 60000, 0) / deliveredJobsForCourier.length)
          : 0;
        const statusLabel = assignedJobs.length > 0 ? "En course" : profile.isAvailable ? "En ligne" : "Hors ligne";
        const reliability = Math.round(Math.min(100, Number(profile.rating) * 16 + Math.max(0, 18 - Number(profile.complaintCount ?? 0) * 3)));
        return {
          id: profile.id,
          name: user?.name || `Coursier ${profile.id}`,
          status: statusLabel,
          zone: profile.zone,
          averageMinutes,
          reliability,
          rating: Number(profile.rating.toFixed(1)),
        };
      })
      .sort((left, right) => right.reliability - left.reliability)
      .slice(0, 6);

    const routes = deliveryJobs
      .filter((job) => job.courierUserId)
      .slice(0, 6)
      .map((job) => {
        const latestLocation = latestLocationByJobId.get(job.id);
        const actualMinutes = Math.round(((job.deliveredAt?.getTime() ?? now.getTime()) - (job.acceptedAt?.getTime() ?? job.createdAt.getTime())) / 60000);
        const estimatedMinutes = Math.max(8, Math.round(actualMinutes * 0.82));
        const optimizationPercent = actualMinutes > 0 ? Math.max(0, Math.round(((actualMinutes - estimatedMinutes) / actualMinutes) * 100)) : 0;
        return {
          id: job.id,
          from: job.restaurantName,
          to: job.deliveryAddress,
          estimatedMinutes,
          actualMinutes,
          distanceKm: latestLocation ? null : null,
          optimizationPercent,
          status: job.status,
        };
      });

    const partnerEntries = moderationStores.map((store) => {
      const relatedOrders = visibleCommerceOrders.filter((order) => order.storeId === store.id);
      const revenue = relatedOrders.reduce((sum, order) => sum + Number(order.totalWithDelivery ?? order.total ?? 0), 0);
      const performanceScore = Math.round(Math.min(100, relatedOrders.length * 6 + (store.status === "approved" ? 30 : 10)));
      return {
        id: store.id,
        name: store.name,
        universe: store.universe,
        zone: store.zone || store.location,
        revenue,
        orders: relatedOrders.length,
        performanceScore,
      };
    });

    return res.json({
      overview: {
        totalOrders: visibleMealOrders.length + visibleCommerceOrders.length,
        inProgressOrders,
        deliveredOrders: mealDelivered + commerceDelivered,
        cancelledOrders: 0,
        activeCouriers: courierProfiles.filter((profile) => profile.isAvailable).length,
        activeChefs: chefProfiles.filter((profile) => profile.isOnline).length,
        totalRevenue,
        averageBasket: combinedOrders.length > 0 ? Math.round(totalRevenue / combinedOrders.length) : 0,
        conversionRate: combinedOrders.length > 0 ? Number((((mealDelivered + commerceDelivered) / combinedOrders.length) * 100).toFixed(1)) : 0,
        ordersPerUser: uniqueClients.size > 0 ? Number((combinedOrders.length / uniqueClients.size).toFixed(1)) : 0,
        peakHour: `${peakHour}h`,
        quietHour: `${quietHour}h`,
      },
      chart: {
        labels: scaleMeta.labels,
        current: currentSeries,
        previous: previousSeries,
      },
      zones,
      alerts,
      orders: orderRows,
      chefs,
      couriers,
      routes,
      partners: {
        supermarkets: partnerEntries.filter((entry) => entry.universe === "supermarkets").slice(0, 5),
        boutiques: partnerEntries.filter((entry) => entry.universe === "boutiques").slice(0, 5),
      },
    });
  } catch (error) {
    console.error("admin dashboard overview error", error);
    return res.status(500).json({ error: "InternalError", message: "Impossible de charger le dashboard admin" });
  }
});

router.get("/admin/commerce/stores", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const stores = status
      ? await db.select().from(commerceStoresTable).where(eq(commerceStoresTable.status, status as any)).orderBy(desc(commerceStoresTable.createdAt))
      : await db.select().from(commerceStoresTable).orderBy(desc(commerceStoresTable.createdAt));

    const enriched = await Promise.all(stores.map(async (store) => {
      if (!store.merchantProfileId) {
        return { ...store, merchantProfile: null, merchantUser: null };
      }
      const [merchantProfile] = await db.select().from(merchantProfilesTable).where(eq(merchantProfilesTable.id, store.merchantProfileId)).limit(1);
      const [merchantUser] = merchantProfile
        ? await db.select().from(usersTable).where(eq(usersTable.id, merchantProfile.userId)).limit(1)
        : [null];
      return { ...store, merchantProfile: merchantProfile ?? null, merchantUser: merchantUser ?? null };
    }));

    res.json({ stores: enriched });
  } catch (error) {
    console.error("admin list commerce stores error", error);
    res.status(500).json({ error: "InternalError" });
  }
});

router.post("/admin/commerce/stores/:storeId/status", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const parsedStoreId = parseWithSchema(idParamSchema, req.params.storeId);
    const parsedBody = parseWithSchema(adminCommerceStoreStatusSchema, req.body);
    if (!parsedStoreId.success) {
      return res.status(400).json({ error: "BadRequest", message: "Enseigne invalide" });
    }
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const storeId = parsedStoreId.data;
    const { status, isActive } = parsedBody.data;

    const [store] = await db.update(commerceStoresTable)
      .set({ status, isActive: typeof isActive === "boolean" ? isActive : status === "approved" })
      .where(eq(commerceStoresTable.id, storeId))
      .returning();

    if (!store) {
      return res.status(404).json({ error: "NotFound", message: "Enseigne introuvable" });
    }
    return res.json({ store });
  } catch (error) {
    console.error("admin update commerce store status error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

/* ── Admin: list all chef profiles with user info ─────────── */
router.get("/admin/chefs", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const zoneFilter = typeof req.query.zone === "string" ? req.query.zone.trim() : "";

    const profiles = await db
      .select()
      .from(chefProfilesTable)
      .innerJoin(usersTable, eq(chefProfilesTable.userId, usersTable.id))
      .orderBy(desc(chefProfilesTable.createdAt));

    const chefs = profiles
      .map(({ chef_profiles: cp, users: u }) => {
        return {
          id: String(cp.id),
          name: u.name,
          email: u.email ?? null,
          phone: u.phone ?? null,
          location: cp.location,
          zone: cp.zone || null,
          avatarUrl: u.avatarUrl ?? null,
          coverColor: u.coverColor ?? null,
          specialty: cp.specialty,
          bio: cp.bio || null,
          isVerified: cp.isVerified,
          isOnline: cp.isOnline,
          rating: cp.rating,
          reviewCount: cp.reviewCount,
          stars: cp.stars ?? null,
          status: resolveChefStatus(cp),
          createdAt: cp.createdAt?.toISOString() ?? null,
        };
      })
      .filter((chef) => {
        if (statusFilter && statusFilter !== "all" && chef.status !== statusFilter) return false;
        if (zoneFilter && zoneFilter !== "all" && chef.zone !== zoneFilter) return false;
        return true;
      });

    return res.json({ chefs });
  } catch (error) {
    console.error("admin list chefs error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.post("/admin/chefs/:id/status", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const parsedChefId = parseWithSchema(idParamSchema, req.params.id);
    const parsedBody = parseWithSchema(adminChefStatusSchema, req.body);
    if (!parsedChefId.success) return res.status(400).json({ error: "BadRequest", message: "ID invalide" });
    if (!parsedBody.success) return res.status(400).json({ error: "BadRequest", message: parsedBody.message });

    const chefId = parsedChefId.data;
    const { status } = parsedBody.data;

    let updateFields: Partial<{ isVerified: boolean; isOnline: boolean }> = {};
    if (status === "active") updateFields = { isVerified: true, isOnline: true };
    else if (status === "suspended") updateFields = { isOnline: false };
    else if (status === "rejected") updateFields = { isVerified: false, isOnline: false };
    else if (status === "pending_verification") updateFields = { isVerified: false, isOnline: true };
    else return res.status(400).json({ error: "BadRequest", message: "Statut inconnu" });

    const [updated] = await db.update(chefProfilesTable).set(updateFields).where(eq(chefProfilesTable.id, chefId)).returning();
    if (!updated) return res.status(404).json({ error: "NotFound", message: "Cuisinière introuvable" });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId));
    return res.json({
      chef: {
        id: String(updated.id),
        name: user?.name ?? `Chef ${updated.id}`,
        email: user?.email ?? null,
        phone: user?.phone ?? null,
        location: updated.location,
        zone: updated.zone || null,
        avatarUrl: user?.avatarUrl ?? null,
        coverColor: user?.coverColor ?? null,
        specialty: updated.specialty,
        bio: updated.bio || null,
        isVerified: updated.isVerified,
        isOnline: updated.isOnline,
        rating: updated.rating,
        reviewCount: updated.reviewCount,
        stars: updated.stars ?? null,
        status: resolveChefStatus(updated),
        createdAt: updated.createdAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("admin update chef status error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.post("/admin/chefs/:id/verify", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const parsedChefId = parseWithSchema(idParamSchema, req.params.id);
    const parsedBody = parseWithSchema(adminChefVerifySchema, req.body);
    if (!parsedChefId.success) return res.status(400).json({ error: "BadRequest", message: "ID invalide" });
    if (!parsedBody.success) return res.status(400).json({ error: "BadRequest", message: parsedBody.message });

    const chefId = parsedChefId.data;
    const { isVerified } = parsedBody.data;

    const [updated] = await db.update(chefProfilesTable).set({ isVerified }).where(eq(chefProfilesTable.id, chefId)).returning();
    if (!updated) return res.status(404).json({ error: "NotFound", message: "Cuisinière introuvable" });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId));
    return res.json({
      chef: {
        id: String(updated.id),
        name: user?.name ?? `Chef ${updated.id}`,
        email: user?.email ?? null,
        phone: user?.phone ?? null,
        location: updated.location,
        zone: updated.zone || null,
        avatarUrl: user?.avatarUrl ?? null,
        coverColor: user?.coverColor ?? null,
        specialty: updated.specialty,
        bio: updated.bio || null,
        isVerified: updated.isVerified,
        isOnline: updated.isOnline,
        rating: updated.rating,
        reviewCount: updated.reviewCount,
        stars: updated.stars ?? null,
        status: resolveChefStatus(updated),
        createdAt: updated.createdAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("admin verify chef error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.get("/admin/couriers", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const zoneFilter = typeof req.query.zone === "string" ? req.query.zone.trim() : "";

    const profiles = await db
      .select()
      .from(courierProfilesTable)
      .innerJoin(usersTable, eq(courierProfilesTable.userId, usersTable.id))
      .orderBy(desc(courierProfilesTable.createdAt));

    const couriers = profiles
      .map(({ courier_profiles: cp, users: u }) => buildAdminCourier(cp, u))
      .filter((courier) => {
        if (statusFilter && statusFilter !== "all" && courier.status !== statusFilter) return false;
        if (zoneFilter && zoneFilter !== "all" && courier.zone !== zoneFilter) return false;
        return true;
      });

    return res.json({ couriers });
  } catch (error) {
    console.error("admin list couriers error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.post("/admin/couriers/:id/status", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const parsedCourierId = parseWithSchema(idParamSchema, req.params.id);
    const parsedBody = parseWithSchema(adminCourierStatusSchema, req.body);
    if (!parsedCourierId.success) return res.status(400).json({ error: "BadRequest", message: "ID invalide" });
    if (!parsedBody.success) return res.status(400).json({ error: "BadRequest", message: parsedBody.message });

    const courierId = parsedCourierId.data;
    const { status, rejectionReason } = parsedBody.data;

    const [currentProfile] = await db.select().from(courierProfilesTable).where(eq(courierProfilesTable.id, courierId)).limit(1);
    if (!currentProfile) return res.status(404).json({ error: "NotFound", message: "Livreur introuvable" });
    if ((status === "active" || status === "suspended") && !isCourierDossierComplete(currentProfile)) {
      return res.status(400).json({ error: "BadRequest", message: "Le dossier du livreur doit être complet avant validation." });
    }
    if (status === "rejected" && !rejectionReason) {
      return res.status(400).json({ error: "BadRequest", message: "Un motif de rejet est requis." });
    }

    let updateFields: Partial<typeof courierProfilesTable.$inferInsert> = {};
    if (status === "active") updateFields = { isVerified: true, isAvailable: true, rejectionReason: null, rejectionReasonUpdatedAt: null };
    else if (status === "suspended") updateFields = { isVerified: true, isAvailable: false, rejectionReason: null, rejectionReasonUpdatedAt: null };
    else if (status === "rejected") {
      updateFields = {
        isVerified: false,
        isAvailable: false,
        rejectionReason,
        rejectionReasonUpdatedAt: new Date(),
      };
    }
    else if (status === "pending_verification") updateFields = { isVerified: false, isAvailable: true, rejectionReason: null, rejectionReasonUpdatedAt: null };
    else return res.status(400).json({ error: "BadRequest", message: "Statut inconnu" });

    const [updated] = await db.update(courierProfilesTable).set(updateFields).where(eq(courierProfilesTable.id, courierId)).returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId));

    const notification = buildCourierStatusNotification(status, rejectionReason);
    await notifyUsers({
      userIds: [updated.userId],
      type: "system",
      title: notification.title,
      message: notification.message,
      data: {
        screen: "courier/verification",
        courierStatus: status,
        rejectionReason: rejectionReason ?? null,
      },
      pushOptions: { channelId: "system", priority: "high" },
    }).catch((error) => {
      console.error("admin update courier status notify error", error);
    });

    return res.json({ courier: buildAdminCourier(updated, user ?? null) });
  } catch (error) {
    console.error("admin update courier status error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.post("/admin/couriers/:id/verify", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const parsedCourierId = parseWithSchema(idParamSchema, req.params.id);
    const parsedBody = parseWithSchema(adminCourierVerifySchema, req.body);
    if (!parsedCourierId.success) return res.status(400).json({ error: "BadRequest", message: "ID invalide" });
    if (!parsedBody.success) return res.status(400).json({ error: "BadRequest", message: parsedBody.message });

    const courierId = parsedCourierId.data;
    const { isVerified, rejectionReason } = parsedBody.data;

    const [currentProfile] = await db.select().from(courierProfilesTable).where(eq(courierProfilesTable.id, courierId)).limit(1);
    if (!currentProfile) return res.status(404).json({ error: "NotFound", message: "Livreur introuvable" });
    if (isVerified && !isCourierDossierComplete(currentProfile)) {
      return res.status(400).json({ error: "BadRequest", message: "Le dossier du livreur doit être complet avant validation." });
    }

    const [updated] = await db.update(courierProfilesTable).set({
      isVerified,
      rejectionReason: isVerified ? null : currentProfile.rejectionReason ?? rejectionReason ?? null,
      rejectionReasonUpdatedAt: isVerified ? null : currentProfile.rejectionReasonUpdatedAt ?? null,
    }).where(eq(courierProfilesTable.id, courierId)).returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId));

    const notification = buildCourierBadgeNotification(isVerified, rejectionReason);
    await notifyUsers({
      userIds: [updated.userId],
      type: "system",
      title: notification.title,
      message: notification.message,
      data: {
        screen: "courier/verification",
        isVerified,
        rejectionReason: rejectionReason ?? null,
      },
      pushOptions: { channelId: "system", priority: "high" },
    }).catch((error) => {
      console.error("admin verify courier notify error", error);
    });

    return res.json({ courier: buildAdminCourier(updated, user ?? null) });
  } catch (error) {
    console.error("admin verify courier error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

router.get("/admin/users", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [allUsers, chefProfiles, courierProfiles, merchantProfiles] = await Promise.all([
      db.select().from(usersTable).orderBy(desc(usersTable.createdAt)),
      db.select().from(chefProfilesTable),
      db.select().from(courierProfilesTable),
      db.select().from(merchantProfilesTable),
    ]);

    const chefUserIds = new Set(chefProfiles.map((p) => p.userId));
    const courierUserIds = new Set(courierProfiles.map((p) => p.userId));
    const merchantUserIds = new Set(merchantProfiles.map((p) => p.userId));

    return res.json({
      users: allUsers.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        type: user.type,
        location: user.location,
        isOnline: null,
        createdAt: user.createdAt?.toISOString() ?? null,
        hasChefProfile: chefUserIds.has(user.id),
        hasCourierProfile: courierUserIds.has(user.id),
        hasMerchantProfile: merchantUserIds.has(user.id),
      })),
    });
  } catch (error) {
    console.error("admin list users error", error);
    return res.status(500).json({ error: "InternalError" });
  }
});

export default router;