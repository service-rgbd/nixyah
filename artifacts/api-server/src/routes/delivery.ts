import express from "express";
import { db } from "@workspace/db";
import {
  chefProfilesTable,
  courierProfilesTable,
  deliveryJobsTable,
  deliveryLocationUpdatesTable,
  deliveryOffersTable,
  ordersTable,
  usersTable,
} from "@workspace/db/schema";
import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { notifyUsers } from "../lib/notifications.js";
import { requireAuth, requireChef, requireCourier, type AuthRequest } from "../middlewares/auth.js";

const router = express.Router();

async function getDeliveryJobPayload(jobId: number) {
  const [job] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.id, jobId)).limit(1);
  if (!job) {
    return null;
  }

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
  const [latestLocation] = await db
    .select()
    .from(deliveryLocationUpdatesTable)
    .where(eq(deliveryLocationUpdatesTable.deliveryJobId, job.id))
    .orderBy(desc(deliveryLocationUpdatesTable.createdAt))
    .limit(1);

  return {
    id: String(job.id),
    orderId: String(job.orderId),
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
  if (req.userType === "courier" && req.userId === job.courierUserId) {
    return { job };
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

    await db.update(ordersTable).set({ status: "ready" }).where(eq(ordersTable.id, order.id));

    const [existingJob] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.orderId, order.id)).limit(1);
    if (existingJob) {
      const payload = await getDeliveryJobPayload(existingJob.id);
      return res.json({ job: payload, reused: true });
    }

    const [chefProfile] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, order.chefProfileId)).limit(1);
    const [chefUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, order.clientId)).limit(1);
    if (!chefProfile || !chefUser || !clientUser) {
      return res.status(400).json({ error: "BadRequest", message: "Participants de livraison introuvables" });
    }

    const [job] = await db.insert(deliveryJobsTable).values({
      orderId: order.id,
      chefProfileId: order.chefProfileId,
      clientId: order.clientId,
      status: "available",
      restaurantName: chefUser.name,
      restaurantAddress: chefProfile.location,
      clientName: clientUser.name,
      deliveryAddress: clientUser.location,
      notes: order.notes ?? null,
    }).returning();

    const couriers = await db
      .select()
      .from(courierProfilesTable)
      .where(eq(courierProfilesTable.isAvailable, true));

    if (couriers.length > 0) {
      await db.insert(deliveryOffersTable).values(
        couriers.map((courier) => ({
          deliveryJobId: job.id,
          courierUserId: courier.userId,
          status: "pending" as const,
        })),
      );

      await notifyUsers({
        userIds: couriers.map((courier) => courier.userId),
        type: "order",
        title: "Nouvelle mission de livraison",
        message: `${chefUser.name} a une commande prete pour ${clientUser.name}.`,
        orderId: order.id,
        deliveryJobId: job.id,
        data: {
          screen: "courier/orders",
          deliveryJobId: String(job.id),
        },
      });
    }

    const payload = await getDeliveryJobPayload(job.id);
    return res.status(201).json({ job: payload, notifiedCouriers: couriers.length });
  } catch (error) {
    console.error("broadcast delivery error", error);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.get("/delivery/jobs/available", requireCourier, async (req: AuthRequest, res) => {
  try {
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
          return payload ? { ...payload, offerId: String(offer.id), offerStatus: offer.status } : null;
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
    await notifyUsers({
      userIds: [job.clientId, chefUser?.id].filter((value): value is number => typeof value === "number"),
      type: "order",
      title: "Commande recuperee",
      message: "Le livreur a recupere la commande au restaurant.",
      orderId: job.orderId,
      deliveryJobId: job.id,
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

    if (job.status === "picked_up") {
      await db.update(deliveryJobsTable).set({ status: "on_the_way" }).where(eq(deliveryJobsTable.id, job.id));
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("delivery location update error", error);
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
      message: "La commande a ete livree avec succes.",
      orderId: job.orderId,
      deliveryJobId: job.id,
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
