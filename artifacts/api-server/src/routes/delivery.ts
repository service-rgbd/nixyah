import express from "express";
import { db } from "@workspace/db";
import {
  chefProfilesTable,
  courierProfilesTable,
  deliveryJobsTable,
  deliveryLocationUpdatesTable,
  deliveryOffersTable,
  notificationsTable,
  ordersTable,
  usersTable,
} from "@workspace/db/schema";
import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { geocodeAddress } from "../lib/geocoding.js";
import { notifyUsers } from "../lib/notifications.js";
import { requireAuth, requireChef, requireClient, requireCourier, type AuthRequest } from "../middlewares/auth.js";

const router = express.Router();

const BROADCAST_ETA_STEPS_MINUTES = [10, 20] as const;
const BROADCAST_STEP_DURATION_MS = 1 * 60 * 1000;
const BROADCAST_WINDOW_MS = BROADCAST_ETA_STEPS_MINUTES.length * BROADCAST_STEP_DURATION_MS;

type MapPoint = {
  latitude: number;
  longitude: number;
};

const scheduledBroadcasts = new Map<number, NodeJS.Timeout[]>();

function toPoint(latitude?: number | null, longitude?: number | null): MapPoint | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude: Number(latitude), longitude: Number(longitude) };
}

function getDistanceKm(from: MapPoint, to: MapPoint): number {
  const earthRadiusKm = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCourierSpeedKmPerHour(vehicleType?: string | null): number {
  const normalizedType = String(vehicleType ?? "").trim().toLowerCase();

  if (normalizedType.includes("velo") || normalizedType.includes("vélo")) {
    return 16;
  }

  if (normalizedType.includes("voiture") || normalizedType.includes("car")) {
    return 24;
  }

  return 28;
}

function getTravelMinutes(from: MapPoint, to: MapPoint, vehicleType?: string | null): number {
  const speedKmPerHour = getCourierSpeedKmPerHour(vehicleType);
  const distanceKm = getDistanceKm(from, to);
  return Math.max(1, Math.round((distanceKm / speedKmPerHour) * 60));
}

function formatEtaMessage(minutes: number) {
  if (minutes <= 1) {
    return "dans environ 1 minute";
  }

  if (minutes < 60) {
    return `dans environ ${minutes} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `dans environ ${hours} h ${remainder} min` : `dans environ ${hours} h`;
}

function getEstimatedArrival(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function getDeliveryArrivalMetrics(params: {
  job: typeof deliveryJobsTable.$inferSelect;
  courierPoint?: MapPoint | null;
  vehicleType?: string | null;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const restaurantPoint = toPoint(params.job.restaurantLatitude, params.job.restaurantLongitude);
  const clientPoint = toPoint(params.job.deliveryLatitude, params.job.deliveryLongitude);
  const courierPoint = params.courierPoint ?? null;
  const routeDistanceKm = restaurantPoint && clientPoint ? getDistanceKm(restaurantPoint, clientPoint) : null;
  const routeEtaMinutes = restaurantPoint && clientPoint
    ? getTravelMinutes(restaurantPoint, clientPoint, params.vehicleType)
    : null;

  const courierToClientDistanceKm = courierPoint && clientPoint ? getDistanceKm(courierPoint, clientPoint) : null;
  const courierToRestaurantMinutes = courierPoint && restaurantPoint
    ? getTravelMinutes(courierPoint, restaurantPoint, params.vehicleType)
    : null;
  const restaurantToClientMinutes = restaurantPoint && clientPoint
    ? getTravelMinutes(restaurantPoint, clientPoint, params.vehicleType)
    : null;

  let etaToClientMinutes: number | null = null;
  if (["picked_up", "on_the_way"].includes(params.job.status) && courierPoint && clientPoint) {
    etaToClientMinutes = getTravelMinutes(courierPoint, clientPoint, params.vehicleType);
  } else if (params.job.status === "accepted" && restaurantToClientMinutes != null) {
    etaToClientMinutes = (courierToRestaurantMinutes ?? 0) + restaurantToClientMinutes;
  }

  return {
    routeDistanceKm,
    routeEtaMinutes,
    courierToClientDistanceKm,
    etaToClientMinutes,
    estimatedArrivalAt: etaToClientMinutes != null ? getEstimatedArrival(now, etaToClientMinutes) : null,
    almostArrived: etaToClientMinutes != null && etaToClientMinutes <= 2,
    arrivedAtDestination: courierToClientDistanceKm != null && courierToClientDistanceKm <= 0.08,
  };
}

async function hasExistingDeliveryNotification(userId: number, jobId: number, title: string) {
  const [existingNotification] = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.deliveryJobId, jobId),
        eq(notificationsTable.title, title),
      ),
    )
    .limit(1);

  return Boolean(existingNotification);
}

async function notifyClientDeliveryMilestone(params: {
  userId: number;
  job: typeof deliveryJobsTable.$inferSelect;
  title: string;
  message: string;
  data?: Record<string, string>;
}) {
  if (await hasExistingDeliveryNotification(params.userId, params.job.id, params.title)) {
    return;
  }

  await notifyUsers({
    userIds: [params.userId],
    type: "order",
    title: params.title,
    message: params.message,
    orderId: params.job.orderId,
    deliveryJobId: params.job.id,
    data: {
      screen: "delivery-tracking",
      orderId: String(params.job.orderId),
      deliveryJobId: String(params.job.id),
      ...(params.data ?? {}),
    },
  });
}

function getBroadcastAgeMs(broadcastedAt: Date, now = new Date()): number {
  return Math.max(0, now.getTime() - broadcastedAt.getTime());
}

function isBroadcastExpired(broadcastedAt: Date, now = new Date()): boolean {
  return getBroadcastAgeMs(broadcastedAt, now) >= BROADCAST_WINDOW_MS;
}

function getBroadcastMaxEtaMinutes(broadcastedAt: Date, now = new Date()): number {
  const ageMs = getBroadcastAgeMs(broadcastedAt, now);
  const stepIndex = Math.min(
    BROADCAST_ETA_STEPS_MINUTES.length - 1,
    Math.floor(ageMs / BROADCAST_STEP_DURATION_MS),
  );

  return BROADCAST_ETA_STEPS_MINUTES[stepIndex];
}

function getBroadcastEndsAt(broadcastedAt: Date): Date {
  return new Date(broadcastedAt.getTime() + BROADCAST_WINDOW_MS);
}

function getRemainingBroadcastMinutes(broadcastedAt: Date, now = new Date()): number {
  const remainingMs = Math.max(0, getBroadcastEndsAt(broadcastedAt).getTime() - now.getTime());
  return Math.ceil(remainingMs / 60000);
}

function canCancelDeliverySearch(job: typeof deliveryJobsTable.$inferSelect, now = new Date()) {
  return !job.courierUserId && ["broadcasting", "available"].includes(job.status) && !isBroadcastExpired(job.broadcastedAt, now);
}

function canRebroadcastDeliverySearch(job: typeof deliveryJobsTable.$inferSelect, now = new Date()) {
  return !job.courierUserId && !["delivered"].includes(job.status) && isBroadcastExpired(job.broadcastedAt, now);
}

async function notifyCouriersAboutDeliveryJob(jobId: number, courierUserIds: number[]) {
  if (courierUserIds.length === 0) {
    return;
  }

  const [job] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.id, jobId)).limit(1);
  if (!job) {
    return;
  }

  const [chefProfile] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, job.chefProfileId)).limit(1);
  const [chefUser] = chefProfile
    ? await db.select().from(usersTable).where(eq(usersTable.id, chefProfile.userId)).limit(1)
    : [];
  const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, job.clientId)).limit(1);

  await notifyUsers({
    userIds: courierUserIds,
    type: "order",
    title: "Nouvelle mission de livraison",
    message: `${chefUser?.name ?? job.restaurantName} a une commande prete pour ${clientUser?.name ?? job.clientName}.`,
    orderId: job.orderId,
    deliveryJobId: job.id,
    pushOptions: {
      channelId: "default",
      priority: "high",
    },
    data: {
      screen: "courier/orders",
      deliveryJobId: String(job.id),
    },
  });
}

async function notifyChefNoCourierAvailable(jobId: number) {
  const [job] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.id, jobId)).limit(1);
  if (!job || job.courierUserId) {
    return;
  }

  const [chefProfile] = await db
    .select()
    .from(chefProfilesTable)
    .where(eq(chefProfilesTable.id, job.chefProfileId))
    .limit(1);
  if (!chefProfile) {
    return;
  }

  const [existingNotification] = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.deliveryJobId, job.id),
        eq(notificationsTable.userId, chefProfile.userId),
        eq(notificationsTable.title, "Aucun livreur disponible pour le moment"),
      ),
    )
    .limit(1);

  if (existingNotification) {
    return;
  }

  await notifyUsers({
    userIds: [chefProfile.userId],
    type: "system",
    title: "Aucun livreur disponible pour le moment",
    message: "Aucun livreur a proximite n'a accepte la mission. Vous pouvez relancer la recherche dans quelques instants.",
    orderId: job.orderId,
    deliveryJobId: job.id,
    data: {
      screen: "chef-orders",
      orderId: String(job.orderId),
      deliveryJobId: String(job.id),
    },
  });
}

function clearScheduledBroadcast(jobId: number) {
  const timeouts = scheduledBroadcasts.get(jobId);
  if (!timeouts) {
    return;
  }

  for (const timeout of timeouts) {
    clearTimeout(timeout);
  }

  scheduledBroadcasts.delete(jobId);
}

function scheduleDeliveryBroadcast(jobId: number) {
  clearScheduledBroadcast(jobId);

  const timeouts: NodeJS.Timeout[] = [];
  for (let stepIndex = 1; stepIndex <= BROADCAST_ETA_STEPS_MINUTES.length; stepIndex += 1) {
    const timeout = setTimeout(() => {
      void syncDeliveryJobOffers(jobId).catch((error) => {
        console.error("scheduled delivery broadcast sync error", error);
      });
    }, stepIndex * BROADCAST_STEP_DURATION_MS);
    timeouts.push(timeout);
  }

  scheduledBroadcasts.set(jobId, timeouts);
}

async function syncDeliveryJobOffers(jobId: number) {
  const [job] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.id, jobId)).limit(1);
  if (!job || job.courierUserId || ["delivered", "cancelled"].includes(job.status)) {
    clearScheduledBroadcast(jobId);
    return { maxEtaMinutes: 0, remainingMinutes: 0, newCourierIds: [] as number[] };
  }

  const now = new Date();
  if (isBroadcastExpired(job.broadcastedAt, now)) {
    clearScheduledBroadcast(jobId);
    await db
      .update(deliveryOffersTable)
      .set({ status: "expired", respondedAt: now })
      .where(and(eq(deliveryOffersTable.deliveryJobId, job.id), eq(deliveryOffersTable.status, "pending")));

    await notifyChefNoCourierAvailable(job.id);

    return {
      maxEtaMinutes: BROADCAST_ETA_STEPS_MINUTES[BROADCAST_ETA_STEPS_MINUTES.length - 1],
      remainingMinutes: 0,
      newCourierIds: [] as number[],
    };
  }

  const maxEtaMinutes = getBroadcastMaxEtaMinutes(job.broadcastedAt, now);
  const restaurantPoint = toPoint(job.restaurantLatitude, job.restaurantLongitude);

  const [existingOffers, couriers] = await Promise.all([
    db.select().from(deliveryOffersTable).where(eq(deliveryOffersTable.deliveryJobId, job.id)),
    db.select().from(courierProfilesTable).where(eq(courierProfilesTable.isAvailable, true)),
  ]);

  const offeredCourierIds = new Set(existingOffers.map((offer) => offer.courierUserId));
  const newCouriers = couriers.filter((courier) => {
    if (offeredCourierIds.has(courier.userId)) {
      return false;
    }

    const courierPoint = toPoint(courier.currentLatitude, courier.currentLongitude);
    if (!restaurantPoint || !courierPoint) {
      return true;
    }

    return getTravelMinutes(restaurantPoint, courierPoint, courier.vehicleType) <= maxEtaMinutes;
  });

  if (newCouriers.length > 0) {
    await db.insert(deliveryOffersTable).values(
      newCouriers.map((courier) => ({
        deliveryJobId: job.id,
        courierUserId: courier.userId,
        status: "pending" as const,
      })),
    );

    await notifyCouriersAboutDeliveryJob(job.id, newCouriers.map((courier) => courier.userId));
  }

  return {
    maxEtaMinutes,
    remainingMinutes: getRemainingBroadcastMinutes(job.broadcastedAt, now),
    newCourierIds: newCouriers.map((courier) => courier.userId),
  };
}

async function syncOpenDeliveryBroadcasts() {
  const jobs = await db
    .select({ id: deliveryJobsTable.id })
    .from(deliveryJobsTable)
    .where(
      and(
        isNull(deliveryJobsTable.courierUserId),
        ne(deliveryJobsTable.status, "delivered"),
        ne(deliveryJobsTable.status, "cancelled"),
      ),
    );

  await Promise.all(jobs.map((job) => syncDeliveryJobOffers(job.id)));
}

async function getDeliveryJobPayload(jobId: number) {
  let [job] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.id, jobId)).limit(1);
  if (!job) {
    return null;
  }

  if (!job.courierUserId && !["delivered", "cancelled"].includes(job.status)) {
    await syncDeliveryJobOffers(job.id);
    const [freshJob] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.id, jobId)).limit(1);
    if (!freshJob) {
      return null;
    }
    job = freshJob;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, job.orderId)).limit(1);

  const [chefProfile] = await db
    .select()
    .from(chefProfilesTable)
    .where(eq(chefProfilesTable.id, job.chefProfileId))
    .limit(1);
  const [chefUser] = chefProfile
    ? await db.select().from(usersTable).where(eq(usersTable.id, chefProfile.userId)).limit(1)
    : [];
  const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, job.clientId)).limit(1);
  const [courierUser] = job.courierUserId
    ? await db.select().from(usersTable).where(eq(usersTable.id, job.courierUserId)).limit(1)
    : [];
  const [courierProfile] = job.courierUserId
    ? await db.select().from(courierProfilesTable).where(eq(courierProfilesTable.userId, job.courierUserId)).limit(1)
    : [];
  const [latestLocation] = await db
    .select()
    .from(deliveryLocationUpdatesTable)
    .where(eq(deliveryLocationUpdatesTable.deliveryJobId, job.id))
    .orderBy(desc(deliveryLocationUpdatesTable.createdAt))
    .limit(1);

  const now = new Date();
  const restaurantPoint = toPoint(job.restaurantLatitude, job.restaurantLongitude);
  const courierPoint = toPoint(
    latestLocation?.latitude ?? courierProfile?.currentLatitude,
    latestLocation?.longitude ?? courierProfile?.currentLongitude,
  );
  const arrivalMetrics = getDeliveryArrivalMetrics({
    job,
    courierPoint,
    vehicleType: courierProfile?.vehicleType,
    now,
  });
  const canCancelSearch = canCancelDeliverySearch(job, now);
  const canRebroadcast = canRebroadcastDeliverySearch(job, now);

  return {
    id: String(job.id),
    orderId: String(job.orderId),
    orderTotal: Number(order?.total ?? 0),
    chefProfileId: String(job.chefProfileId),
    clientId: String(job.clientId),
    courierUserId: job.courierUserId ? String(job.courierUserId) : null,
    status: job.status,
    restaurantName: job.restaurantName,
    restaurantAddress: job.restaurantAddress,
    restaurantLatitude: job.restaurantLatitude,
    restaurantLongitude: job.restaurantLongitude,
    clientName: job.clientName,
    deliveryAddress: job.deliveryAddress,
    deliveryLatitude: job.deliveryLatitude,
    deliveryLongitude: job.deliveryLongitude,
    notes: job.notes,
    broadcastedAt: job.broadcastedAt.toISOString(),
    broadcastRadiusKm: null,
    broadcastEtaMinutes: restaurantPoint ? getBroadcastMaxEtaMinutes(job.broadcastedAt, now) : null,
    broadcastEndsAt: getBroadcastEndsAt(job.broadcastedAt).toISOString(),
    broadcastRemainingMinutes: getRemainingBroadcastMinutes(job.broadcastedAt, now),
    canCancelSearch,
    canRebroadcast,
    routeDistanceKm: arrivalMetrics.routeDistanceKm != null ? Number(arrivalMetrics.routeDistanceKm.toFixed(2)) : null,
    routeEtaMinutes: arrivalMetrics.routeEtaMinutes,
    courierToClientDistanceKm: arrivalMetrics.courierToClientDistanceKm != null ? Number(arrivalMetrics.courierToClientDistanceKm.toFixed(2)) : null,
    etaToClientMinutes: arrivalMetrics.etaToClientMinutes,
    estimatedArrivalAt: arrivalMetrics.estimatedArrivalAt?.toISOString() ?? null,
    almostArrived: arrivalMetrics.almostArrived,
    arrivedAtDestination: arrivalMetrics.arrivedAtDestination,
    acceptedAt: job.acceptedAt?.toISOString() ?? null,
    pickedUpAt: job.pickedUpAt?.toISOString() ?? null,
    deliveredAt: job.deliveredAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    chef: chefUser ? { id: String(chefUser.id), name: chefUser.name, phone: chefUser.phone ?? null } : null,
    client: clientUser ? { id: String(clientUser.id), name: clientUser.name, phone: clientUser.phone ?? null } : null,
    courier: courierUser ? { id: String(courierUser.id), name: courierUser.name, phone: courierUser.phone ?? null } : null,
    latestLocation: latestLocation
      ? {
          latitude: latestLocation.latitude,
          longitude: latestLocation.longitude,
          accuracy: latestLocation.accuracy,
          heading: latestLocation.heading,
          speed: latestLocation.speed,
          createdAt: latestLocation.createdAt.toISOString(),
        }
      : null,
  };
}

async function assertJobParticipant(req: AuthRequest, jobId: number) {
  const [job] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.id, jobId)).limit(1);
  if (!job) {
    return { error: "NotFound" as const };
  }

  if (req.userType === "chef" && req.chefProfileId === job.chefProfileId) {
    return { job };
  }
  if (req.userType === "client" && req.userId === job.clientId) {
    return { job };
  }
  if (req.userType === "courier") {
    if (req.userId === job.courierUserId) {
      return { job };
    }

    const [offer] = await db
      .select({ id: deliveryOffersTable.id })
      .from(deliveryOffersTable)
      .where(
        and(
          eq(deliveryOffersTable.deliveryJobId, job.id),
          eq(deliveryOffersTable.courierUserId, req.userId!),
          eq(deliveryOffersTable.status, "pending"),
        ),
      )
      .limit(1);
    if (offer) {
      return { job };
    }
  }

  return { error: "Forbidden" as const };
}

router.post("/delivery/orders/:orderId/broadcast", requireChef, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Commande invalide" });
    }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order || order.chefProfileId !== req.chefProfileId) {
      return res.status(404).json({ error: "NotFound", message: "Commande introuvable" });
    }

    const [existingJob] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.orderId, order.id)).limit(1);
    if (existingJob) {
      if (order.status !== "ready") {
        await db.update(ordersTable).set({ status: "ready" }).where(eq(ordersTable.id, order.id));
      }

      let activeJob = existingJob;
      let rebroadcasted = false;

      if (!existingJob.courierUserId && existingJob.status === "cancelled" && !canRebroadcastDeliverySearch(existingJob)) {
        const payload = await getDeliveryJobPayload(existingJob.id);
        return res.status(409).json({
          error: "CooldownActive",
          message: "La recherche est suspendue. Vous pourrez la relancer après le délai de pause.",
          job: payload,
        });
      }

      if (!existingJob.courierUserId && canRebroadcastDeliverySearch(existingJob)) {
        await db.delete(deliveryOffersTable).where(eq(deliveryOffersTable.deliveryJobId, existingJob.id));
        const [resetJob] = await db
          .update(deliveryJobsTable)
          .set({ status: "broadcasting", broadcastedAt: new Date() })
          .where(eq(deliveryJobsTable.id, existingJob.id))
          .returning();

        if (resetJob) {
          activeJob = resetJob;
          rebroadcasted = true;
        }
      }

      if (!activeJob.courierUserId) {
        scheduleDeliveryBroadcast(activeJob.id);
      }

      const syncResult = await syncDeliveryJobOffers(activeJob.id);
      await notifyUsers({
        userIds: [order.clientId],
        type: "order",
        title: "Recherche de livreur en cours",
        message: "Votre commande est prête. Nous cherchons maintenant un livreur disponible.",
        orderId: order.id,
        deliveryJobId: activeJob.id,
        data: {
          screen: "delivery-tracking",
          orderId: String(order.id),
          deliveryJobId: String(activeJob.id),
        },
      });
      const payload = await getDeliveryJobPayload(activeJob.id);
      return res.json({ job: payload, reused: true, rebroadcasted, notifiedCouriers: syncResult.newCourierIds.length });
    }

    if (order.status !== "ready") {
      await db.update(ordersTable).set({ status: "ready" }).where(eq(ordersTable.id, order.id));
    }

    const [chefProfile] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, order.chefProfileId)).limit(1);
    const [chefUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, order.clientId)).limit(1);
    if (!chefProfile || !chefUser || !clientUser) {
      return res.status(400).json({ error: "BadRequest", message: "Participants de livraison introuvables" });
    }

    const restaurantPoint = await geocodeAddress(chefProfile.location);
    const clientPoint =
      order.deliveryLatitude != null && order.deliveryLongitude != null
        ? { latitude: order.deliveryLatitude, longitude: order.deliveryLongitude }
        : await geocodeAddress(order.deliveryAddress || clientUser.location);

    if (
      clientPoint &&
      (order.deliveryLatitude == null || order.deliveryLongitude == null)
    ) {
      await db
        .update(ordersTable)
        .set({
          deliveryLatitude: clientPoint.latitude,
          deliveryLongitude: clientPoint.longitude,
        })
        .where(eq(ordersTable.id, order.id));
    }

    let job;
    try {
      [job] = await db.insert(deliveryJobsTable).values({
        orderId: order.id,
        chefProfileId: order.chefProfileId,
        clientId: order.clientId,
        status: "broadcasting",
        restaurantName: chefUser.name,
        restaurantAddress: chefProfile.location,
        restaurantLatitude: restaurantPoint?.latitude ?? null,
        restaurantLongitude: restaurantPoint?.longitude ?? null,
        clientName: clientUser.name,
        deliveryAddress: order.deliveryAddress || clientUser.location,
        deliveryLatitude: clientPoint?.latitude ?? order.deliveryLatitude ?? null,
        deliveryLongitude: clientPoint?.longitude ?? order.deliveryLongitude ?? null,
        notes: order.notes ?? null,
      }).returning();
    } catch (error) {
      const [raceJob] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.orderId, order.id)).limit(1);
      if (raceJob) {
        const payload = await getDeliveryJobPayload(raceJob.id);
        return res.json({ job: payload, reused: true, raced: true });
      }
      throw error;
    }

    const syncResult = await syncDeliveryJobOffers(job.id);
    scheduleDeliveryBroadcast(job.id);
    await notifyUsers({
      userIds: [order.clientId],
      type: "order",
      title: "Recherche de livreur en cours",
      message: "Votre commande est prête. Nous cherchons maintenant un livreur disponible.",
      orderId: order.id,
      deliveryJobId: job.id,
      data: {
        screen: "delivery-tracking",
        orderId: String(order.id),
        deliveryJobId: String(job.id),
      },
    });

    const payload = await getDeliveryJobPayload(job.id);
    return res.status(201).json({ job: payload, notifiedCouriers: syncResult.newCourierIds.length });
  } catch (error) {
    console.error("broadcast delivery error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/delivery/jobs/:jobId/cancel-search", requireChef, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.jobId);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Mission invalide" });
    }

    const [job] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.id, jobId)).limit(1);
    if (!job || job.chefProfileId !== req.chefProfileId) {
      return res.status(404).json({ error: "NotFound", message: "Mission introuvable" });
    }

    if (job.courierUserId) {
      return res.status(400).json({ error: "BadRequest", message: "Un livreur a déjà accepté cette mission" });
    }

    if (["delivered"].includes(job.status)) {
      return res.status(400).json({ error: "BadRequest", message: "Cette mission ne peut plus être suspendue" });
    }

    const now = new Date();
    clearScheduledBroadcast(job.id);

    await db
      .update(deliveryOffersTable)
      .set({ status: "expired", respondedAt: now })
      .where(and(eq(deliveryOffersTable.deliveryJobId, job.id), eq(deliveryOffersTable.status, "pending")));

    const [updatedJob] = await db
      .update(deliveryJobsTable)
      .set({ status: "cancelled", broadcastedAt: now })
      .where(eq(deliveryJobsTable.id, job.id))
      .returning();

    await notifyUsers({
      userIds: [job.clientId],
      type: "order",
      title: "Recherche de livreur suspendue",
      message: "La cuisinière a momentanément suspendu la recherche de livreur. Elle pourra la relancer après un court délai.",
      orderId: job.orderId,
      deliveryJobId: job.id,
      data: {
        screen: "orders",
        orderId: String(job.orderId),
        deliveryJobId: String(job.id),
      },
    });

    const payload = await getDeliveryJobPayload(updatedJob?.id ?? job.id);
    return res.json({ job: payload });
  } catch (error) {
    console.error("cancel delivery search error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.get("/delivery/jobs/available", requireCourier, async (req: AuthRequest, res) => {
  try {
    await syncOpenDeliveryBroadcasts();

    const [courierProfile] = await db
      .select()
      .from(courierProfilesTable)
      .where(eq(courierProfilesTable.userId, req.userId!))
      .limit(1);
    const courierPoint = toPoint(courierProfile?.currentLatitude, courierProfile?.currentLongitude);

    const offers = await db
      .select()
      .from(deliveryOffersTable)
      .where(and(eq(deliveryOffersTable.courierUserId, req.userId!), eq(deliveryOffersTable.status, "pending")))
      .orderBy(desc(deliveryOffersTable.notifiedAt));

    const jobIds = offers.map((offer) => offer.deliveryJobId);
    const jobs = jobIds.length > 0
      ? await db.select().from(deliveryJobsTable).where(and(inArray(deliveryJobsTable.id, jobIds), isNull(deliveryJobsTable.courierUserId)))
      : [];
    const jobMap = new Map(jobs.map((job) => [job.id, job]));

    const payloads = await Promise.all(
      offers
        .filter((offer) => jobMap.has(offer.deliveryJobId))
        .map(async (offer) => {
          const payload = await getDeliveryJobPayload(offer.deliveryJobId);
          if (!payload) {
            return null;
          }

          const restaurantPoint = toPoint(payload.restaurantLatitude, payload.restaurantLongitude);
          const distanceKm = courierPoint && restaurantPoint
            ? Number(getDistanceKm(courierPoint, restaurantPoint).toFixed(1))
            : null;

          return {
            ...payload,
            offerId: String(offer.id),
            offerStatus: offer.status,
            distanceKm,
          };
        }),
    );

    return res.json({ jobs: payloads.filter(Boolean) });
  } catch (error) {
    console.error("available delivery jobs error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.get("/delivery/jobs/current", requireCourier, async (req: AuthRequest, res) => {
  try {
    const jobs = await db
      .select()
      .from(deliveryJobsTable)
      .where(
        and(
          eq(deliveryJobsTable.courierUserId, req.userId!),
          ne(deliveryJobsTable.status, "delivered"),
          ne(deliveryJobsTable.status, "cancelled"),
        ),
      )
      .orderBy(desc(deliveryJobsTable.acceptedAt), desc(deliveryJobsTable.createdAt));

    const payloads = await Promise.all(jobs.map((job) => getDeliveryJobPayload(job.id)));
    return res.json({ jobs: payloads.filter(Boolean) });
  } catch (error) {
    console.error("current delivery jobs error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.get("/delivery/jobs/history", requireCourier, async (req: AuthRequest, res) => {
  try {
    const jobs = await db
      .select()
      .from(deliveryJobsTable)
      .where(
        and(
          eq(deliveryJobsTable.courierUserId, req.userId!),
          or(
            eq(deliveryJobsTable.status, "delivered"),
            eq(deliveryJobsTable.status, "cancelled"),
          ),
        ),
      )
      .orderBy(desc(deliveryJobsTable.deliveredAt), desc(deliveryJobsTable.createdAt));

    const payloads = await Promise.all(jobs.map((job) => getDeliveryJobPayload(job.id)));
    return res.json({ jobs: payloads.filter(Boolean) });
  } catch (error) {
    console.error("history delivery jobs error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.patch("/delivery/courier/availability", requireCourier, async (req: AuthRequest, res) => {
  try {
    const isAvailable = Boolean(req.body.isAvailable);
    const [profile] = await db
      .update(courierProfilesTable)
      .set({ isAvailable })
      .where(eq(courierProfilesTable.userId, req.userId!))
      .returning();

    return res.json({
      courierProfile: profile
        ? {
            id: String(profile.id),
            userId: String(profile.userId),
            isAvailable: profile.isAvailable,
            zone: profile.zone,
            vehicleType: profile.vehicleType,
            isVerified: profile.isVerified,
          }
        : null,
    });
  } catch (error) {
    console.error("update courier availability error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/delivery/courier/location", requireCourier, async (req: AuthRequest, res) => {
  try {
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: "BadRequest", message: "Coordonnees invalides" });
    }

    const [profile] = await db
      .update(courierProfilesTable)
      .set({
        currentLatitude: latitude,
        currentLongitude: longitude,
        lastLocationAt: new Date(),
      })
      .where(eq(courierProfilesTable.userId, req.userId!))
      .returning();

    await syncOpenDeliveryBroadcasts();

    return res.json({
      courierProfile: profile
        ? {
            id: String(profile.id),
            userId: String(profile.userId),
            currentLatitude: profile.currentLatitude,
            currentLongitude: profile.currentLongitude,
            lastLocationAt: profile.lastLocationAt?.toISOString() ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error("update courier location error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/delivery/jobs/:jobId/accept", requireCourier, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.jobId);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Mission invalide" });
    }

    const [offer] = await db
      .select()
      .from(deliveryOffersTable)
      .where(and(eq(deliveryOffersTable.deliveryJobId, jobId), eq(deliveryOffersTable.courierUserId, req.userId!), eq(deliveryOffersTable.status, "pending")))
      .limit(1);
    if (!offer) {
      return res.status(404).json({ error: "NotFound", message: "Offre de livraison introuvable" });
    }

    const acceptedJob = await db.transaction(async (tx) => {
      const [updatedJob] = await tx
        .update(deliveryJobsTable)
        .set({
          courierUserId: req.userId!,
          status: "accepted",
          acceptedAt: new Date(),
        })
        .where(
          and(
            eq(deliveryJobsTable.id, jobId),
            isNull(deliveryJobsTable.courierUserId),
            or(eq(deliveryJobsTable.status, "available"), eq(deliveryJobsTable.status, "broadcasting")),
          ),
        )
        .returning();

      if (!updatedJob) {
        return null;
      }

      await tx
        .update(deliveryOffersTable)
        .set({ status: "accepted", respondedAt: new Date() })
        .where(eq(deliveryOffersTable.id, offer.id));

      await tx
        .update(deliveryOffersTable)
        .set({ status: "expired", respondedAt: new Date() })
        .where(and(eq(deliveryOffersTable.deliveryJobId, jobId), ne(deliveryOffersTable.id, offer.id), eq(deliveryOffersTable.status, "pending")));

      await tx
        .update(courierProfilesTable)
        .set({ isAvailable: false })
        .where(eq(courierProfilesTable.userId, req.userId!));

      return updatedJob;
    });

    if (!acceptedJob) {
      return res.status(409).json({ error: "Conflict", message: "Cette mission a deja ete attribuee" });
    }

    clearScheduledBroadcast(acceptedJob.id);

    const [chefProfile] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, acceptedJob.chefProfileId)).limit(1);
    const [chefUser] = chefProfile
      ? await db.select().from(usersTable).where(eq(usersTable.id, chefProfile.userId)).limit(1)
      : [];
    const [courierUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

    await notifyUsers({
      userIds: [acceptedJob.clientId, chefUser?.id].filter((value): value is number => typeof value === "number"),
      type: "order",
      title: "Livreur assigne",
      message: `${courierUser?.name ?? "Un livreur"} a accepte la mission.`,
      orderId: acceptedJob.orderId,
      deliveryJobId: acceptedJob.id,
      data: {
        screen: "delivery-tracking",
        deliveryJobId: String(acceptedJob.id),
      },
    });

    const payload = await getDeliveryJobPayload(acceptedJob.id);
    return res.json({ job: payload });
  } catch (error) {
    console.error("accept delivery job error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/delivery/jobs/:jobId/pickup", requireCourier, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.jobId);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Mission invalide" });
    }

    const [job] = await db
      .update(deliveryJobsTable)
      .set({ status: "picked_up", pickedUpAt: new Date() })
      .where(and(eq(deliveryJobsTable.id, jobId), eq(deliveryJobsTable.courierUserId, req.userId!), eq(deliveryJobsTable.status, "accepted")))
      .returning();

    if (!job) {
      return res.status(404).json({ error: "NotFound", message: "Mission introuvable ou non assignée" });
    }

    const [chefProfile] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, job.chefProfileId)).limit(1);
    const [chefUser] = chefProfile
      ? await db.select().from(usersTable).where(eq(usersTable.id, chefProfile.userId)).limit(1)
      : [];
    const [courierProfile] = await db.select().from(courierProfilesTable).where(eq(courierProfilesTable.userId, req.userId!)).limit(1);
    const courierPoint = toPoint(courierProfile?.currentLatitude, courierProfile?.currentLongitude);
    const arrivalMetrics = getDeliveryArrivalMetrics({ job, courierPoint, vehicleType: courierProfile?.vehicleType });
    const etaSnippet = arrivalMetrics.etaToClientMinutes != null
      ? ` Livraison estimée ${formatEtaMessage(arrivalMetrics.etaToClientMinutes)}.`
      : "";
    await notifyUsers({
      userIds: [job.clientId, chefUser?.id].filter((value): value is number => typeof value === "number"),
      type: "order",
      title: "Commande recuperee",
      message: `Le livreur a recupere la commande et se dirige vers votre destination.${etaSnippet}`,
      orderId: job.orderId,
      deliveryJobId: job.id,
      data: {
        screen: "delivery-tracking",
        orderId: String(job.orderId),
        deliveryJobId: String(job.id),
      },
    });

    return res.json({ job: await getDeliveryJobPayload(job.id) });
  } catch (error) {
    console.error("pickup delivery job error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/delivery/jobs/:jobId/location", requireCourier, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.jobId);
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    const accuracy = typeof req.body.accuracy === "number" ? req.body.accuracy : Number(req.body.accuracy ?? NaN);
    const heading = typeof req.body.heading === "number" ? req.body.heading : Number(req.body.heading ?? NaN);
    const speed = typeof req.body.speed === "number" ? req.body.speed : Number(req.body.speed ?? NaN);

    if (!Number.isInteger(jobId) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: "BadRequest", message: "Coordonnees invalides" });
    }

    const [job] = await db
      .select()
      .from(deliveryJobsTable)
      .where(and(eq(deliveryJobsTable.id, jobId), eq(deliveryJobsTable.courierUserId, req.userId!)))
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: "NotFound", message: "Mission introuvable" });
    }

    await db.insert(deliveryLocationUpdatesTable).values({
      deliveryJobId: job.id,
      courierUserId: req.userId!,
      latitude,
      longitude,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      heading: Number.isFinite(heading) ? heading : null,
      speed: Number.isFinite(speed) ? speed : null,
    });

    await db
      .update(courierProfilesTable)
      .set({
        currentLatitude: latitude,
        currentLongitude: longitude,
        lastLocationAt: new Date(),
      })
      .where(eq(courierProfilesTable.userId, req.userId!));

    const [courierProfile] = await db.select().from(courierProfilesTable).where(eq(courierProfilesTable.userId, req.userId!)).limit(1);
    const arrivalMetrics = getDeliveryArrivalMetrics({
      job,
      courierPoint: { latitude, longitude },
      vehicleType: courierProfile?.vehicleType,
    });

    if (job.status === "picked_up") {
      await db.update(deliveryJobsTable).set({ status: "on_the_way" }).where(eq(deliveryJobsTable.id, job.id));

      const [chefProfile] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, job.chefProfileId)).limit(1);
      const [chefUser] = chefProfile
        ? await db.select().from(usersTable).where(eq(usersTable.id, chefProfile.userId)).limit(1)
        : [];
      const etaSnippet = arrivalMetrics.etaToClientMinutes != null
        ? ` Arrivée estimée ${formatEtaMessage(arrivalMetrics.etaToClientMinutes)}.`
        : "";
      await notifyUsers({
        userIds: [job.clientId, chefUser?.id].filter((value): value is number => typeof value === "number"),
        type: "order",
        title: "Commande en route",
        message: `Le livreur est maintenant en route vers votre destination.${etaSnippet}`,
        orderId: job.orderId,
        deliveryJobId: job.id,
        data: {
          screen: "delivery-tracking",
          orderId: String(job.orderId),
          deliveryJobId: String(job.id),
        },
      });
    }

    if (["picked_up", "on_the_way"].includes(job.status)) {
      if (arrivalMetrics.arrivedAtDestination) {
        await notifyClientDeliveryMilestone({
          userId: job.clientId,
          job,
          title: "Livreur arrivé",
          message: "Votre livreur est arrivé devant votre destination. Vous pouvez le joindre si besoin.",
        });
      } else if (arrivalMetrics.almostArrived) {
        await notifyClientDeliveryMilestone({
          userId: job.clientId,
          job,
          title: "Livreur presque arrivé",
          message: "Votre livreur est presque à votre porte, à environ 2 minutes de votre destination.",
        });
      }
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("delivery location update error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/delivery/jobs/:jobId/client-location", requireClient, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.jobId);
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    const deliveryAddress = typeof req.body.deliveryAddress === "string" ? req.body.deliveryAddress.trim() : "";

    if (!Number.isInteger(jobId) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: "BadRequest", message: "Coordonnees invalides" });
    }

    const [job] = await db
      .select()
      .from(deliveryJobsTable)
      .where(and(eq(deliveryJobsTable.id, jobId), eq(deliveryJobsTable.clientId, req.userId!)))
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: "NotFound", message: "Mission introuvable" });
    }

    if (["delivered", "cancelled"].includes(job.status)) {
      return res.status(409).json({ error: "Conflict", message: "Cette mission ne peut plus etre mise a jour" });
    }

    const nextAddress = deliveryAddress || job.deliveryAddress;

    await db
      .update(deliveryJobsTable)
      .set({
        deliveryAddress: nextAddress,
        deliveryLatitude: latitude,
        deliveryLongitude: longitude,
      })
      .where(eq(deliveryJobsTable.id, job.id));

    await db
      .update(ordersTable)
      .set({
        deliveryAddress: nextAddress,
        deliveryLatitude: latitude,
        deliveryLongitude: longitude,
      })
      .where(eq(ordersTable.id, job.orderId));

    const payload = await getDeliveryJobPayload(job.id);
    return res.json({ job: payload });
  } catch (error) {
    console.error("client delivery location update error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/delivery/jobs/:jobId/complete", requireCourier, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.jobId);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Mission invalide" });
    }

    const [job] = await db
      .update(deliveryJobsTable)
      .set({ status: "delivered", deliveredAt: new Date() })
      .where(
        and(
          eq(deliveryJobsTable.id, jobId),
          eq(deliveryJobsTable.courierUserId, req.userId!),
          or(eq(deliveryJobsTable.status, "picked_up"), eq(deliveryJobsTable.status, "on_the_way")),
        ),
      )
      .returning();

    if (!job) {
      return res.status(404).json({ error: "NotFound", message: "Mission introuvable ou invalide" });
    }

    clearScheduledBroadcast(job.id);

    await db.update(ordersTable).set({ status: "delivered" }).where(eq(ordersTable.id, job.orderId));
    await db.update(courierProfilesTable).set({ isAvailable: true }).where(eq(courierProfilesTable.userId, req.userId!));

    const [chefProfile] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, job.chefProfileId)).limit(1);
    const [chefUser] = chefProfile
      ? await db.select().from(usersTable).where(eq(usersTable.id, chefProfile.userId)).limit(1)
      : [];
    await notifyUsers({
      userIds: [job.clientId, chefUser?.id].filter((value): value is number => typeof value === "number"),
      type: "order",
      title: "Livraison terminee",
      message: "La commande a ete livree avec succes. Vous pouvez maintenant noter le restaurant et la livraison.",
      orderId: job.orderId,
      deliveryJobId: job.id,
      data: {
        screen: "client-review",
        orderId: String(job.orderId),
        deliveryJobId: String(job.id),
      },
    });

    return res.json({ job: await getDeliveryJobPayload(job.id) });
  } catch (error) {
    console.error("complete delivery job error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.get("/delivery/jobs/:jobId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.jobId);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Mission invalide" });
    }

    const access = await assertJobParticipant(req, jobId);
    if ("error" in access) {
      return res.status(access.error === "NotFound" ? 404 : 403).json({ error: access.error });
    }

    const history = await db
      .select()
      .from(deliveryLocationUpdatesTable)
      .where(eq(deliveryLocationUpdatesTable.deliveryJobId, jobId))
      .orderBy(desc(deliveryLocationUpdatesTable.createdAt))
      .limit(50);

    const payload = await getDeliveryJobPayload(jobId);
    return res.json({
      job: payload,
      locations: history.map((item) => ({
        latitude: item.latitude,
        longitude: item.longitude,
        accuracy: item.accuracy,
        heading: item.heading,
        speed: item.speed,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("get delivery job error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.get("/delivery/orders/:orderId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Commande invalide" });
    }

    const [job] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.orderId, orderId)).limit(1);
    if (!job) {
      return res.status(404).json({ error: "NotFound", message: "Aucune livraison associee" });
    }

    const access = await assertJobParticipant(req, job.id);
    if ("error" in access) {
      return res.status(access.error === "NotFound" ? 404 : 403).json({ error: access.error });
    }

    const payload = await getDeliveryJobPayload(job.id);
    return res.json({ job: payload });
  } catch (error) {
    console.error("get delivery by order error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

export default router;
