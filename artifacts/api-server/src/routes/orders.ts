import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, chefProfilesTable, complaintsTable, usersTable, dishesTable, deliveryJobsTable, deliveryLocationUpdatesTable, reviewsTable, commerceOrdersTable, commerceOrderItemsTable, commerceStoresTable } from "@workspace/db/schema";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { requireClient, type AuthRequest } from "../middlewares/auth.js";
import { geocodeAddress } from "../lib/geocoding.js";
import { getDishEffectivePrice } from "../lib/menu.js";
import { notifyUsers } from "../lib/notifications.js";
import { shouldInvestigateComplaint } from "../lib/commerce.js";
import { quoteDeliveryOrderPricing, refreshChefReviewAggregates, refreshComplaintAggregates, refreshCourierReviewAggregates } from "../lib/fulfillment.js";
import { buildApiRateLimiter } from "../lib/rate-limit.js";
import { expirePendingMealOrders, getOrderPendingDeadline, hasOrderPendingWindowExpired } from "../lib/order-window.js";

const router: IRouter = Router();

const orderIssueLimiter = buildApiRateLimiter({
  windowMs: 30 * 60 * 1000,
  max: 4,
  message: "Trop de signalements sur cette commande. Reessayez plus tard.",
  keyGenerator(req, baseKey) {
    const orderId = typeof req.params?.orderId === "string" ? req.params.orderId.trim() : "unknown";
    return `order-issue:${orderId}:${baseKey}`;
  },
});

const orderCancelLimiter = buildApiRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: "Trop de tentatives d'annulation. Reessayez plus tard.",
  keyGenerator(req, baseKey) {
    const orderId = typeof req.params?.orderId === "string" ? req.params.orderId.trim() : "unknown";
    return `order-cancel:${orderId}:${baseKey}`;
  },
});

const orderReviewLimiter = buildApiRateLimiter({
  windowMs: 30 * 60 * 1000,
  max: 6,
  message: "Trop de tentatives de notation. Reessayez plus tard.",
  keyGenerator(req, baseKey) {
    const orderId = typeof req.params?.orderId === "string" ? req.params.orderId.trim() : "unknown";
    return `order-review:${orderId}:${baseKey}`;
  },
});

const COMPLAINT_CATEGORIES: Record<"chef" | "courier" | "platform", Set<string>> = {
  chef: new Set(["hygiene", "taste_quality", "missing_items", "wrong_order", "poor_packaging", "rude_behavior", "unsafe_food"]),
  courier: new Set(["delay", "unreachable", "damaged_order", "wrong_address", "rude_behavior", "suspicious_behavior"]),
  platform: new Set(["billing", "refund", "app_issue"]),
};

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

function mapLegacyComplaint(reason: string) {
  const normalized = reason.trim().toLowerCase();

  if (normalized.includes("retard")) {
    return { target: "courier" as const, category: "delay" };
  }

  if (normalized.includes("livraison")) {
    return { target: "courier" as const, category: "damaged_order" };
  }

  if (normalized.includes("incompl")) {
    return { target: "chef" as const, category: "missing_items" };
  }

  return { target: "platform" as const, category: "app_issue" };
}

function normalizeComplaintPayload(input: { target?: unknown; category?: unknown; reason?: unknown }): { target: "chef" | "courier" | "platform"; category: string } | null {
  const fallback = typeof input.reason === "string" ? mapLegacyComplaint(input.reason) : null;
  const target = typeof input.target === "string" ? input.target.trim().toLowerCase() : fallback?.target ?? "platform";
  const category = typeof input.category === "string" ? input.category.trim().toLowerCase() : fallback?.category ?? "app_issue";

  if (target !== "chef" && target !== "courier" && target !== "platform") {
    return null;
  }

  if (!COMPLAINT_CATEGORIES[target].has(category)) {
    return null;
  }

  return { target, category };
}

router.get("/orders", requireClient, async (req: AuthRequest, res) => {
  try {
    await expirePendingMealOrders({ clientId: req.userId! });

    const mealOrders = await db
      .select()
      .from(ordersTable)
      .innerJoin(chefProfilesTable, eq(ordersTable.chefProfileId, chefProfilesTable.id))
      .innerJoin(usersTable, eq(chefProfilesTable.userId, usersTable.id))
      .where(eq(ordersTable.clientId, req.userId!));

    const commerceOrders = await db
      .select()
      .from(commerceOrdersTable)
      .innerJoin(commerceStoresTable, eq(commerceOrdersTable.storeId, commerceStoresTable.id))
      .where(eq(commerceOrdersTable.clientId, req.userId!));

    const mealResult = await Promise.all(
      mealOrders.map(async ({ orders: o, users: u }) => {
        const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, o.id));
        const dishIds = items
          .map((item) => item.dishId)
          .filter((dishId): dishId is number => typeof dishId === "number" && Number.isInteger(dishId) && dishId > 0);
        const dishes = dishIds.length > 0
          ? await db.select().from(dishesTable).where(inArray(dishesTable.id, dishIds))
          : [];
        const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
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
          kind: "meal",
          clientId: String(o.clientId),
          chefId: String(o.chefProfileId),
          chefName: u.name,
          status: o.status,
          total: o.total,
          deliveryFee: Number(o.deliveryFee ?? 0),
          totalWithDelivery: Number(o.totalWithDelivery ?? o.total ?? 0),
          deliveryDistanceKm: o.deliveryDistanceKm != null ? Number(o.deliveryDistanceKm) : null,
          deliveryDemandMultiplier: Number(o.deliveryDemandMultiplier ?? 1),
          freeDeliveryApplied: Boolean(o.freeDeliveryApplied),
          referralCreditUsed: Boolean(o.referralCreditUsed),
          occasion: o.occasion,
          persons: o.persons,
          deliveryAddress: o.deliveryAddress,
          notes: o.notes,
          createdAt: o.createdAt.toISOString(),
          cancelAvailableUntil:
            o.status === "pending" && !deliveryJob
              ? getOrderPendingDeadline(o.createdAt).toISOString()
              : null,
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
            imageUrl: i.dishId ? dishesById.get(i.dishId)?.imageUrl ?? null : null,
            imageUrls: i.dishId ? dishesById.get(i.dishId)?.imageUrls ?? [] : [],
          })),
        };
      })
    );

    const commerceResult = await Promise.all(
      commerceOrders.map(async ({ commerce_orders: o, commerce_stores: store }) => {
        const items = await db.select().from(commerceOrderItemsTable).where(eq(commerceOrderItemsTable.orderId, o.id));
        return {
          id: `commerce:${o.id}`,
          kind: "commerce",
          commerceUniverse: store.universe,
          merchantVisualKey: store.visualKey,
          clientId: String(o.clientId),
          chefId: `store:${store.id}`,
          chefName: store.name,
          status: o.status,
          total: Number(o.total ?? 0),
          deliveryFee: Number(o.deliveryFee ?? 0),
          totalWithDelivery: Number(o.totalWithDelivery ?? o.total ?? 0),
          deliveryDistanceKm: o.deliveryDistanceKm != null ? Number(o.deliveryDistanceKm) : null,
          deliveryDemandMultiplier: 1,
          freeDeliveryApplied: false,
          referralCreditUsed: false,
          occasion: null,
          persons: null,
          deliveryAddress: o.deliveryAddress,
          notes: o.notes,
          createdAt: o.createdAt.toISOString(),
          cancelAvailableUntil: o.status === "pending" ? getOrderPendingDeadline(o.createdAt).toISOString() : null,
          delivery: null,
          review: null,
          canReview: false,
          items: items.map((item) => ({
            dishId: item.productId ? String(item.productId) : "",
            dishName: item.productName,
            quantity: item.quantity,
            price: Number(item.price),
            imageUrl: null,
            imageUrls: [],
            category: item.category,
            unitLabel: item.unitLabel,
            visualKey: item.visualKey,
          })),
        };
      }),
    );

    const result = [...mealResult, ...commerceResult].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );

    res.json({ orders: result });
  } catch (err) {
    console.error("list orders error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/orders/:orderId/cancel", requireClient, orderCancelLimiter, async (req: AuthRequest, res) => {
  try {
    const rawOrderId = String(req.params.orderId ?? "");
    const isCommerceOrder = rawOrderId.startsWith("commerce:");

    if (isCommerceOrder) {
      const numericOrderId = Number(rawOrderId.slice("commerce:".length));
      if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
        return res.status(400).json({ error: "BadRequest", message: "Commande invalide" });
      }

      const [order] = await db.select().from(commerceOrdersTable).where(eq(commerceOrdersTable.id, numericOrderId)).limit(1);
      if (!order || order.clientId !== req.userId) {
        return res.status(404).json({ error: "NotFound", message: "Commande introuvable" });
      }

      if (order.status !== "pending" || hasOrderPendingWindowExpired(order.createdAt)) {
        return res.status(409).json({ error: "Conflict", message: "Cette commande ne peut plus etre annulee" });
      }

      await db.delete(commerceOrderItemsTable).where(eq(commerceOrderItemsTable.orderId, order.id));
      await db.delete(commerceOrdersTable).where(eq(commerceOrdersTable.id, order.id));
      return res.json({ success: true });
    }

    const orderId = Number(rawOrderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Commande invalide" });
    }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order || order.clientId !== req.userId) {
      return res.status(404).json({ error: "NotFound", message: "Commande introuvable" });
    }

    const [deliveryJob] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.orderId, order.id)).limit(1);

    if (hasOrderPendingWindowExpired(order.createdAt)) {
      await expirePendingMealOrders({ orderIds: [order.id] });
    }

    if (deliveryJob || order.status !== "pending" || hasOrderPendingWindowExpired(order.createdAt)) {
      return res.status(409).json({ error: "Conflict", message: "Cette commande ne peut plus être annulée" });
    }

    const [chefProfile] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, order.chefProfileId)).limit(1);
    const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

    await db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    await db.delete(ordersTable).where(eq(ordersTable.id, order.id));

    if (chefProfile?.userId) {
      await notifyUsers({
        userIds: [chefProfile.userId],
        type: "order",
        title: "Commande annulée",
        message: `${clientUser?.name ?? "Une cliente"} a annulé sa commande juste après validation.`,
        orderId: order.id,
        data: {
          screen: "orders",
          orderId: String(order.id),
        },
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("cancel order error:", err);
    return res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
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
    if (!cp.isVerified || !cp.isOnline) {
      res.status(409).json({ error: "Conflict", message: "Cette cuisinière n'accepte pas de nouvelles commandes actuellement" });
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
    const pricing = await quoteDeliveryOrderPricing({
      subtotal: total,
      restaurantAddress: cp.location,
      deliveryAddress: fallbackDeliveryAddress,
      deliveryLatitude: Number.isFinite(Number(deliveryLatitude)) ? Number(deliveryLatitude) : geocodedDeliveryPoint?.latitude ?? null,
      deliveryLongitude: Number.isFinite(Number(deliveryLongitude)) ? Number(deliveryLongitude) : geocodedDeliveryPoint?.longitude ?? null,
      hasReferralCredit: (clientUser?.freeDeliveryCredits ?? 0) > 0,
    });

    const [order] = await db.insert(ordersTable).values({
      clientId: req.userId!,
      chefProfileId: cp.id,
      status: "pending",
      total,
      deliveryFee: pricing.deliveryFee,
      totalWithDelivery: pricing.totalWithDelivery,
      deliveryDistanceKm: pricing.distanceKm,
      deliveryDemandMultiplier: pricing.demandMultiplier,
      freeDeliveryApplied: pricing.freeDeliveryApplied,
      referralCreditUsed: pricing.referralCreditWillBeUsed,
      occasion: occasion || null,
      persons: persons ? Number(persons) : null,
      budget: budget || null,
      deliveryAddress: fallbackDeliveryAddress,
      deliveryLatitude: Number.isFinite(Number(deliveryLatitude)) ? Number(deliveryLatitude) : geocodedDeliveryPoint?.latitude ?? null,
      deliveryLongitude: Number.isFinite(Number(deliveryLongitude)) ? Number(deliveryLongitude) : geocodedDeliveryPoint?.longitude ?? null,
      notes: notes || null,
    }).returning();

    if (pricing.referralCreditWillBeUsed && (clientUser?.freeDeliveryCredits ?? 0) > 0) {
      await db.update(usersTable).set({
        freeDeliveryCredits: Math.max(0, (clientUser?.freeDeliveryCredits ?? 0) - 1),
      }).where(eq(usersTable.id, req.userId!));
    }

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
      message: `${clientUser?.name ?? "Une cliente"} a passé une nouvelle commande.${pricing.freeDeliveryApplied ? " Livraison offerte appliquée." : ""}`,
      orderId: order.id,
      data: {
        screen: "orders",
        orderId: order.id,
        chefProfileId: cp.id,
        total,
        deliveryFee: String(pricing.deliveryFee),
        totalWithDelivery: String(pricing.totalWithDelivery),
      },
    });

    await notifyUsers({
      userIds: [req.userId!],
      type: "order",
      title: "Commande enregistrée",
      message: "Votre commande a bien été enregistrée. Vous recevrez les prochaines étapes en temps réel.",
      orderId: order.id,
      data: {
        screen: "orders",
        orderId: String(order.id),
        deliveryFee: String(pricing.deliveryFee),
        totalWithDelivery: String(pricing.totalWithDelivery),
      },
    });
    res.status(201).json({
      id: String(order.id),
      clientId: String(order.clientId),
      chefId: String(order.chefProfileId),
      chefName: u.name,
      status: order.status,
      total: order.total,
      deliveryFee: Number(order.deliveryFee ?? 0),
      totalWithDelivery: Number(order.totalWithDelivery ?? order.total),
      deliveryDistanceKm: order.deliveryDistanceKm != null ? Number(order.deliveryDistanceKm) : null,
      deliveryDemandMultiplier: Number(order.deliveryDemandMultiplier ?? 1),
      freeDeliveryApplied: Boolean(order.freeDeliveryApplied),
      referralCreditUsed: Boolean(order.referralCreditUsed),
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

router.post("/orders/:orderId/review", requireClient, orderReviewLimiter, async (req: AuthRequest, res) => {
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

    const [existingReview] = await db.select().from(reviewsTable).where(eq(reviewsTable.orderId, order.id)).limit(1);
    const restaurantReviewAlreadySubmitted = existingReview?.rating != null;
    const deliveryReviewAlreadySubmitted = existingReview?.deliveryRating != null;

    if (!restaurantReviewAlreadySubmitted && restaurantRating == null) {
      res.status(400).json({ error: "BadRequest", message: "La note du restaurant doit être comprise entre 1 et 5" });
      return;
    }

    if (deliveryJob && !deliveryReviewAlreadySubmitted && deliveryRating == null) {
      res.status(400).json({ error: "BadRequest", message: "La note de livraison doit être comprise entre 1 et 5" });
      return;
    }

    if (existingReview && restaurantReviewAlreadySubmitted && (!deliveryJob || deliveryReviewAlreadySubmitted)) {
      res.status(409).json({ error: "Conflict", message: "Cette commande a déjà été évaluée" });
      return;
    }

    if (restaurantReviewAlreadySubmitted) {
      if (restaurantRating !== Number(existingReview.rating)) {
        res.status(409).json({ error: "Conflict", message: "La note du restaurant ne peut plus etre modifiee" });
        return;
      }
      if (restaurantComment !== (existingReview.comment ?? "")) {
        res.status(409).json({ error: "Conflict", message: "Le commentaire restaurant ne peut plus etre modifie" });
        return;
      }
    }

    const resolvedRestaurantRating = restaurantReviewAlreadySubmitted
      ? Number(existingReview.rating)
      : restaurantRating!;
    const resolvedRestaurantComment = restaurantReviewAlreadySubmitted
      ? (existingReview.comment ?? "")
      : restaurantComment;
    const resolvedDeliveryRating = deliveryJob
      ? deliveryReviewAlreadySubmitted
        ? Number(existingReview?.deliveryRating)
        : deliveryRating!
      : null;
    const resolvedDeliveryComment = deliveryJob
      ? deliveryReviewAlreadySubmitted
        ? (existingReview?.deliveryComment ?? "")
        : deliveryComment
      : "";

    const reviewPayload = {
      clientId: req.userId!,
      chefProfileId: order.chefProfileId,
      courierUserId: deliveryJob?.courierUserId ?? null,
      rating: resolvedRestaurantRating,
      comment: resolvedRestaurantComment,
      deliveryRating: resolvedDeliveryRating,
      deliveryComment: resolvedDeliveryComment,
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

router.post("/orders/:orderId/report-issue", requireClient, orderIssueLimiter, async (req: AuthRequest, res) => {
  try {
    const parsedOrderId = Number(req.params.orderId);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    const details = typeof req.body?.details === "string" ? req.body.details.trim() : "";
    const normalizedComplaint = normalizeComplaintPayload({
      target: req.body?.target,
      category: req.body?.category,
      reason,
    });

    if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
      res.status(400).json({ error: "BadRequest", message: "Commande invalide" });
      return;
    }

    if (!reason) {
      res.status(400).json({ error: "BadRequest", message: "Le motif du signalement est requis" });
      return;
    }
    if (!normalizedComplaint) {
      res.status(400).json({ error: "BadRequest", message: "Catégorie de signalement invalide" });
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
    const complaintStatus = shouldInvestigateComplaint(normalizedComplaint.target, normalizedComplaint.category)
      ? "investigating"
      : "open";

    const [existingComplaint] = await db
      .select()
      .from(complaintsTable)
      .where(
        and(
          eq(complaintsTable.orderId, order.id),
          eq(complaintsTable.reporterUserId, req.userId!),
          eq(complaintsTable.target, normalizedComplaint.target),
          eq(complaintsTable.category, normalizedComplaint.category),
          or(
            eq(complaintsTable.status, "open"),
            eq(complaintsTable.status, "investigating"),
          ),
        ),
      )
      .limit(1);

    if (existingComplaint) {
      res.status(409).json({
        error: "Conflict",
        message: "Un signalement similaire est deja en cours pour cette commande",
        complaintId: String(existingComplaint.id),
        status: existingComplaint.status,
      });
      return;
    }

    const [complaint] = await db.insert(complaintsTable).values({
      orderId: order.id,
      reporterUserId: req.userId!,
      chefProfileId: chefProfile?.id ?? null,
      courierUserId: deliveryJob?.courierUserId ?? null,
      target: normalizedComplaint.target,
      category: normalizedComplaint.category,
      details: details || reason,
      status: complaintStatus,
      investigationNotes: complaintStatus === "investigating" ? "Ouvert automatiquement depuis l'application mobile." : "",
    }).returning();

    await refreshComplaintAggregates({
      chefProfileId: chefProfile?.id ?? null,
      courierUserId: deliveryJob?.courierUserId ?? null,
    });

    await notifyUsers({
      userIds: recipients,
      type: "order",
      title: complaintStatus === "investigating" ? "Réclamation sous enquête" : "Problème signalé sur une commande",
      message: `${clientUser?.name ?? "Une cliente"} a signalé: ${reason}${details ? ` (${details})` : ""}`,
      orderId: order.id,
      deliveryJobId: deliveryJob?.id ?? null,
      data: {
        orderId: order.id,
        complaintId: String(complaint.id),
        complaintTarget: normalizedComplaint.target,
        complaintCategory: normalizedComplaint.category,
        complaintStatus,
        reason,
        details,
      },
    });

    res.status(201).json({ success: true, complaintId: String(complaint.id), status: complaintStatus });
  } catch (err) {
    console.error("report order issue error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

export default router;
