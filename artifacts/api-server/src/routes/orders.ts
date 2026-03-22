import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, chefProfilesTable, courierProfilesTable, usersTable, dishesTable, deliveryJobsTable, deliveryLocationUpdatesTable, reviewsTable } from "@workspace/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { requireClient, type AuthRequest } from "../middlewares/auth.js";
import { geocodeAddress } from "../lib/geocoding.js";
import { getDishEffectivePrice } from "../lib/menu.js";
import { notifyUsers } from "../lib/notifications.js";

const router: IRouter = Router();

function normalizeRatingValue(input: unknown): number | null {
  const value = Number(input);
  if (!Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 5) {
    return null;
  }

  return rounded;
}

async function refreshChefReviewAggregates(chefProfileId: number) {
  const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.chefProfileId, chefProfileId));
  const ratedReviews = reviews.filter((review) => Number.isFinite(review.rating));
  const reviewCount = ratedReviews.length;
  const rating = reviewCount > 0
    ? Number((ratedReviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviewCount).toFixed(1))
    : 5.0;

  await db.update(chefProfilesTable).set({ rating, reviewCount }).where(eq(chefProfilesTable.id, chefProfileId));
}

async function refreshCourierReviewAggregates(courierUserId: number) {
  const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.courierUserId, courierUserId));
  const ratedReviews = reviews.filter((review) => Number.isFinite(review.deliveryRating));
  const reviewCount = ratedReviews.length;
  const rating = reviewCount > 0
    ? Number((ratedReviews.reduce((sum, review) => sum + Number(review.deliveryRating ?? 0), 0) / reviewCount).toFixed(1))
    : 5.0;

  await db.update(courierProfilesTable).set({ rating, reviewCount }).where(eq(courierProfilesTable.userId, courierUserId));
}

router.get("/orders", requireClient, async (req: AuthRequest, res) => {
  try {
    const orders = await db
      .select()
      .from(ordersTable)
      .innerJoin(chefProfilesTable, eq(ordersTable.chefProfileId, chefProfilesTable.id))
      .innerJoin(usersTable, eq(chefProfilesTable.userId, usersTable.id))
      .where(eq(ordersTable.clientId, req.userId!));

    const result = await Promise.all(
      orders.map(async ({ orders: o, users: u }) => {
        const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, o.id));
        const [deliveryJob] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.orderId, o.id)).limit(1);
        const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.orderId, o.id)).limit(1);
        const [latestLocation] = deliveryJob
          ? await db
              .select()
              .from(deliveryLocationUpdatesTable)
              .where(eq(deliveryLocationUpdatesTable.deliveryJobId, deliveryJob.id))
              .orderBy(desc(deliveryLocationUpdatesTable.createdAt))
              .limit(1)
          : [];
        return {
          id: String(o.id),
          clientId: String(o.clientId),
          chefId: String(o.chefProfileId),
          chefName: u.name,
          status: o.status,
          total: o.total,
          occasion: o.occasion,
          persons: o.persons,
          deliveryAddress: o.deliveryAddress,
          notes: o.notes,
          createdAt: o.createdAt.toISOString(),
          delivery: deliveryJob
            ? {
                id: String(deliveryJob.id),
                status: deliveryJob.status,
                courierUserId: deliveryJob.courierUserId ? String(deliveryJob.courierUserId) : null,
                deliveryAddress: deliveryJob.deliveryAddress,
                restaurantAddress: deliveryJob.restaurantAddress,
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
              }
            : null,
          review: review
            ? {
                restaurantRating: Number(review.rating),
                restaurantComment: review.comment ?? "",
                deliveryRating: review.deliveryRating != null ? Number(review.deliveryRating) : null,
                deliveryComment: review.deliveryComment ?? "",
                submittedAt: review.createdAt.toISOString(),
              }
            : null,
          canReview:
            (o.status === "delivered" || deliveryJob?.status === "delivered") &&
            (!review || review.rating == null || Boolean(deliveryJob && review.deliveryRating == null)),
          items: items.map((i) => ({
            dishId: String(i.dishId ?? ""),
            dishName: i.dishName,
            quantity: i.quantity,
            price: i.price,
          })),
        };
      })
    );

    res.json({ orders: result });
  } catch (err) {
    console.error("list orders error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/orders", requireClient, async (req: AuthRequest, res) => {
  try {
    const { chefId, occasion, persons, budget, notes, items, deliveryAddress, deliveryLatitude, deliveryLongitude } = req.body;
    const parsedChefId = Number(chefId);
    const normalizedItems = Array.isArray(items) ? items : [];

    if (!Number.isInteger(parsedChefId) || parsedChefId <= 0) {
      res.status(400).json({ error: "BadRequest", message: "Cuisinière invalide" });
      return;
    }
    if (normalizedItems.length === 0) {
      res.status(400).json({ error: "BadRequest", message: "La commande doit contenir au moins un plat" });
      return;
    }

    const [cp] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, parsedChefId));
    if (!cp) {
      res.status(404).json({ error: "NotFound", message: "Cuisinière introuvable" });
      return;
    }

    const requestedDishIds = normalizedItems
      .map((item: any) => Number(item?.dishId))
      .filter((dishId: number) => Number.isInteger(dishId) && dishId > 0);

    if (requestedDishIds.length !== normalizedItems.length) {
      res.status(400).json({ error: "BadRequest", message: "Les plats de la commande sont invalides" });
      return;
    }

    const dishes = await db.select().from(dishesTable).where(inArray(dishesTable.id, requestedDishIds));
    if (dishes.length !== requestedDishIds.length) {
      res.status(400).json({ error: "BadRequest", message: "Un ou plusieurs plats sont introuvables" });
      return;
    }

    const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
    const invalidChefDish = dishes.some((dish) => dish.chefProfileId !== cp.id);
    if (invalidChefDish) {
      res.status(400).json({ error: "BadRequest", message: "Tous les plats doivent appartenir à la même cuisinière" });
      return;
    }

    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, cp.userId));
    const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const safeItems = normalizedItems.map((item: any) => {
      const dish = dishesById.get(Number(item.dishId));
      const quantity = Number(item.quantity);
      if (!dish || !Number.isInteger(quantity) || quantity <= 0) {
        return null;
      }
      return {
        dishId: dish.id,
        dishName: dish.name,
        quantity,
        price: getDishEffectivePrice(dish),
      };
    });
    if (safeItems.some((item) => item === null)) {
      res.status(400).json({ error: "BadRequest", message: "Les quantités de commande sont invalides" });
      return;
    }
    const finalItems = safeItems.filter((item): item is NonNullable<typeof item> => item !== null);
    const total = finalItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const fallbackDeliveryAddress = deliveryAddress ? String(deliveryAddress) : clientUser?.location ?? null;
    const geocodedDeliveryPoint =
      Number.isFinite(Number(deliveryLatitude)) && Number.isFinite(Number(deliveryLongitude))
        ? null
        : await geocodeAddress(fallbackDeliveryAddress);

    const [order] = await db.insert(ordersTable).values({
      clientId: req.userId!,
      chefProfileId: cp.id,
      status: "pending",
      total,
      occasion: occasion || null,
      persons: persons ? Number(persons) : null,
      budget: budget || null,
      deliveryAddress: fallbackDeliveryAddress,
      deliveryLatitude: Number.isFinite(Number(deliveryLatitude)) ? Number(deliveryLatitude) : geocodedDeliveryPoint?.latitude ?? null,
      deliveryLongitude: Number.isFinite(Number(deliveryLongitude)) ? Number(deliveryLongitude) : geocodedDeliveryPoint?.longitude ?? null,
      notes: notes || null,
    }).returning();

    if (finalItems.length > 0) {
      await db.insert(orderItemsTable).values(
        finalItems.map((item) => ({
          orderId: order.id,
          dishId: item.dishId,
          dishName: item.dishName,
          quantity: item.quantity,
          price: item.price,
        }))
      );
    }

    await notifyUsers({
      userIds: [cp.userId],
      type: "order",
      title: "Nouvelle commande",
      message: `${clientUser?.name ?? "Une cliente"} a passé une nouvelle commande.`,
      orderId: order.id,
      data: {
        orderId: order.id,
        chefProfileId: cp.id,
        total,
      },
    });

    res.status(201).json({
      id: String(order.id),
      clientId: String(order.clientId),
      chefId: String(order.chefProfileId),
      chefName: u.name,
      status: order.status,
      total: order.total,
      occasion: order.occasion,
      persons: order.persons,
      deliveryAddress: order.deliveryAddress,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      items: finalItems,
    });
  } catch (err) {
    console.error("create order error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/orders/:orderId/review", requireClient, async (req: AuthRequest, res) => {
  try {
    const parsedOrderId = Number(req.params.orderId);
    const restaurantRating = normalizeRatingValue(req.body?.restaurantRating);
    const deliveryRating = normalizeRatingValue(req.body?.deliveryRating);
    const restaurantComment = typeof req.body?.restaurantComment === "string" ? req.body.restaurantComment.trim() : "";
    const deliveryComment = typeof req.body?.deliveryComment === "string" ? req.body.deliveryComment.trim() : "";

    if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
      res.status(400).json({ error: "BadRequest", message: "Commande invalide" });
      return;
    }

    if (restaurantRating == null) {
      res.status(400).json({ error: "BadRequest", message: "La note du restaurant doit être comprise entre 1 et 5" });
      return;
    }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsedOrderId)).limit(1);
    if (!order || order.clientId !== req.userId) {
      res.status(404).json({ error: "NotFound", message: "Commande introuvable" });
      return;
    }

    const [deliveryJob] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.orderId, order.id)).limit(1);
    const isDelivered = order.status === "delivered" || deliveryJob?.status === "delivered";
    if (!isDelivered) {
      res.status(409).json({ error: "Conflict", message: "La commande doit être livrée avant de pouvoir être notée" });
      return;
    }

    if (deliveryJob && deliveryRating == null) {
      res.status(400).json({ error: "BadRequest", message: "La note de livraison doit être comprise entre 1 et 5" });
      return;
    }

    const [existingReview] = await db.select().from(reviewsTable).where(eq(reviewsTable.orderId, order.id)).limit(1);
    if (existingReview && existingReview.rating != null && (!deliveryJob || existingReview.deliveryRating != null)) {
      res.status(409).json({ error: "Conflict", message: "Cette commande a déjà été évaluée" });
      return;
    }

    const reviewPayload = {
      clientId: req.userId!,
      chefProfileId: order.chefProfileId,
      courierUserId: deliveryJob?.courierUserId ?? null,
      rating: restaurantRating,
      comment: restaurantComment,
      deliveryRating: deliveryJob ? deliveryRating : null,
      deliveryComment: deliveryJob ? deliveryComment : "",
    };

    if (existingReview) {
      await db
        .update(reviewsTable)
        .set(reviewPayload)
        .where(eq(reviewsTable.id, existingReview.id));
    } else {
      await db.insert(reviewsTable).values({
        orderId: order.id,
        ...reviewPayload,
      });
    }

    await refreshChefReviewAggregates(order.chefProfileId);
    if (deliveryJob?.courierUserId) {
      await refreshCourierReviewAggregates(deliveryJob.courierUserId);
    }

    const [chefProfile] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, order.chefProfileId)).limit(1);
    const recipients = [chefProfile?.userId, deliveryJob?.courierUserId].filter((value): value is number => typeof value === "number");
    if (recipients.length > 0) {
      await notifyUsers({
        userIds: recipients,
        type: "review",
        title: "Nouvel avis client",
        message: deliveryJob
          ? `Le client a noté le restaurant ${restaurantRating}/5 et la livraison ${deliveryRating}/5.`
          : `Le client a noté le restaurant ${restaurantRating}/5.`,
        orderId: order.id,
        deliveryJobId: deliveryJob?.id ?? null,
        data: {
          screen: "orders",
          orderId: String(order.id),
          deliveryJobId: deliveryJob?.id ? String(deliveryJob.id) : null,
          restaurantRating,
          deliveryRating: deliveryJob ? deliveryRating : null,
        },
      });
    }

    res.status(201).json({
      success: true,
      review: {
        restaurantRating,
        restaurantComment,
        deliveryRating: deliveryJob ? deliveryRating : null,
        deliveryComment: deliveryJob ? deliveryComment : "",
      },
    });
  } catch (err) {
    console.error("submit order review error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/orders/:orderId/report-issue", requireClient, async (req: AuthRequest, res) => {
  try {
    const parsedOrderId = Number(req.params.orderId);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    const details = typeof req.body?.details === "string" ? req.body.details.trim() : "";

    if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
      res.status(400).json({ error: "BadRequest", message: "Commande invalide" });
      return;
    }

    if (!reason) {
      res.status(400).json({ error: "BadRequest", message: "Le motif du signalement est requis" });
      return;
    }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsedOrderId)).limit(1);
    if (!order || order.clientId !== req.userId) {
      res.status(404).json({ error: "NotFound", message: "Commande introuvable" });
      return;
    }

    const [chefProfile] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, order.chefProfileId)).limit(1);
    const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const [deliveryJob] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.orderId, order.id)).limit(1);

    const recipients = [chefProfile?.userId, deliveryJob?.courierUserId].filter(
      (value): value is number => typeof value === "number" && Number.isInteger(value) && value > 0,
    );

    await notifyUsers({
      userIds: recipients,
      type: "order",
      title: "Problème signalé sur une commande",
      message: `${clientUser?.name ?? "Une cliente"} a signalé: ${reason}${details ? ` (${details})` : ""}`,
      orderId: order.id,
      deliveryJobId: deliveryJob?.id ?? null,
      data: {
        orderId: order.id,
        reason,
        details,
      },
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("report order issue error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

export default router;
