import { db } from "@workspace/db";
import {
  deliveryJobsTable,
  deliveryLocationUpdatesTable,
  dishesTable,
  chefProfilesTable,
  notificationsTable,
  orderItemsTable,
  ordersTable,
  reviewsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import express, { Response } from "express";
import { requireAuth, requireChef, type AuthRequest } from "../middlewares/auth.js";
import {
  getDishEffectivePrice,
  getDishSavingsAmount,
  normalizeChefMenuCategory,
  normalizeDiscountPercent,
  sanitizeDiscountLabel,
} from "../lib/menu.js";
import { notifyUsers } from "../lib/notifications.js";
import { isOwnedUploadUrl } from "../lib/uploads.js";

const router = express.Router();

function normalizeDishImageUrls(input: unknown, fallbackImageUrl?: unknown): string[] {
  const values = Array.isArray(input) ? input : [];
  const collected = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  if (typeof fallbackImageUrl === "string" && fallbackImageUrl.trim()) {
    collected.unshift(fallbackImageUrl.trim());
  }

  return Array.from(new Set(collected)).slice(0, 3);
}

function isDishImageAllowedForUpdate(options: {
  url: string;
  userId: number;
  existingUrls: Set<string>;
}): boolean {
  const normalizedUrl = options.url.trim();
  if (!normalizedUrl) {
    return false;
  }

  if (options.existingUrls.has(normalizedUrl)) {
    return true;
  }

  return isOwnedUploadUrl(normalizedUrl, "dish", options.userId);
}

function serializeDish(dish: typeof dishesTable.$inferSelect) {
  const effectivePrice = getDishEffectivePrice(dish);
  return {
    id: String(dish.id),
    chefProfileId: dish.chefProfileId,
    name: dish.name,
    description: dish.description,
    imageUrl: dish.imageUrl ?? null,
    imageUrls: dish.imageUrls?.length ? dish.imageUrls : dish.imageUrl ? [dish.imageUrl] : [],
    price: effectivePrice,
    basePrice: dish.price,
    category: normalizeChefMenuCategory(dish.category),
    prepTime: dish.prepTime,
    isPopular: dish.isPopular,
    discountPercent: normalizeDiscountPercent(dish.discountPercent),
    discountLabel: sanitizeDiscountLabel(dish.discountLabel),
    savingsAmount: getDishSavingsAmount(dish),
  };
}

async function buildChefOrderPayload(order: typeof ordersTable.$inferSelect, clientUser: typeof usersTable.$inferSelect) {
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const [deliveryJob] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.orderId, order.id)).limit(1);
  const [latestLocation] = deliveryJob
    ? await db
        .select()
        .from(deliveryLocationUpdatesTable)
        .where(eq(deliveryLocationUpdatesTable.deliveryJobId, deliveryJob.id))
        .orderBy(desc(deliveryLocationUpdatesTable.createdAt))
        .limit(1)
    : [];

  return {
    id: String(order.id),
    clientId: String(order.clientId),
    clientName: clientUser.name,
    clientLocation: clientUser.location,
    status: order.status,
    total: order.total,
    occasion: order.occasion,
    persons: order.persons,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    items: items.map((item) => ({
      dishId: item.dishId ? String(item.dishId) : null,
      dishName: item.dishName,
      quantity: item.quantity,
      price: item.price,
    })),
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
  };
}

const CHEF_ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ["accepted"],
  accepted: ["preparing", "ready"],
  preparing: ["ready"],
  ready: ["delivered"],
  delivered: [],
};

const CHEF_ORDER_NOTIFICATIONS: Record<string, { title: string; message: string }> = {
  accepted: {
    title: "Commande prise en charge",
    message: "Votre commande est confirmee en cuisine.",
  },
  preparing: {
    title: "Commande en preparation",
    message: "La cuisiniere est en train de preparer votre commande.",
  },
  ready: {
    title: "Commande prete",
    message: "Votre commande est prete. Vous pouvez la recuperer ou attendre le livreur.",
  },
  delivered: {
    title: "Commande terminee",
    message: "Votre commande a ete marquee comme finalisee.",
  },
};

// GET /api/chef/:id/dishes - Get dishes for a specific chef
router.get("/:id/dishes", async (req, res) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const chefId = parseInt(String(idParam), 10);
    if (Number.isNaN(chefId)) {
      return res.status(400).json({ error: "Invalid chef id" });
    }
    const dishes = await db
      .select()
      .from(dishesTable)
      .innerJoin(chefProfilesTable, eq(dishesTable.chefProfileId, chefProfilesTable.id))
      .where(eq(chefProfilesTable.userId, chefId));

    return res.json({
      dishes: dishes.map((d) => serializeDish(d.dishes)),
    });
  } catch (error) {
    console.error("Error fetching chef dishes:", error);
    return res.status(500).json({ error: "Failed to fetch dishes" });
  }
});

// GET /api/chef/:id/stats - Get statistics for a chef
router.get("/:id/stats", requireChef, async (req: AuthRequest, res) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const chefId = parseInt(String(idParam), 10);
    if (Number.isNaN(chefId)) {
      return res.status(400).json({ error: "Invalid chef id" });
    }
    if (req.userId !== chefId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Get chef profile
    const chefProfile = await db
      .select()
      .from(chefProfilesTable)
      .where(eq(chefProfilesTable.userId, chefId));

    if (chefProfile.length === 0) {
      return res.status(404).json({ error: "Chef not found" });
    }

    const profileId = chefProfile[0].id;

    // Get total orders
    const totalOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.chefProfileId, profileId));

    // Get reviews
    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(eq(reviewsTable.chefProfileId, profileId));

    // Calculate stats
    const totalRevenue = totalOrders.reduce((sum, order) => sum + order.total, 0);
    const averageRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;
    const completionRate = totalOrders.length > 0
      ? (totalOrders.filter((o) => o.status === "delivered").length / totalOrders.length) * 100
      : 0;

    // This month stats
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthOrders = totalOrders.filter((o) => new Date(o.createdAt) >= monthStart);
    const monthRevenue = monthOrders.reduce((sum, o) => sum + o.total, 0);
    const breakdown = {
      pending: totalOrders.filter((o) => o.status === "pending").length,
      accepted: totalOrders.filter((o) => o.status === "accepted").length,
      preparing: totalOrders.filter((o) => o.status === "preparing").length,
      ready: totalOrders.filter((o) => o.status === "ready").length,
      delivered: totalOrders.filter((o) => o.status === "delivered").length,
    };

    return res.json({
      totalOrders: totalOrders.length,
      totalRevenue,
      averageRating: Number(averageRating.toFixed(1)),
      completionRate: Number(completionRate.toFixed(0)),
      activeOrders: breakdown.accepted + breakdown.preparing,
      averageBasket: totalOrders.length > 0 ? Number((totalRevenue / totalOrders.length).toFixed(0)) : 0,
      breakdown,
      thisMonth: {
        orders: monthOrders.length,
        revenue: monthRevenue,
      },
      reviews: reviews.length,
    });
  } catch (error) {
    console.error("Error fetching chef stats:", error);
    return res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// GET /api/chef/notifications - Get notifications for logged-in user
router.get("/notifications/list", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt));

    return res.json({
      notifications: notifications.map((n) => ({
        id: String(n.id),
        type: n.type,
        title: n.title,
        message: n.message,
        orderId: n.orderId ? String(n.orderId) : null,
        deliveryJobId: n.deliveryJobId ? String(n.deliveryJobId) : null,
        isRead: n.isRead,
        timestamp: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// GET /api/chef/orders - Get received orders for logged-in chef
router.get("/orders", requireChef, async (req: AuthRequest, res) => {
  try {
    const chefProfileId = req.chefProfileId!;
    const rows = await db
      .select()
      .from(ordersTable)
      .innerJoin(usersTable, eq(ordersTable.clientId, usersTable.id))
      .where(eq(ordersTable.chefProfileId, chefProfileId))
      .orderBy(desc(ordersTable.createdAt));

    const orders = await Promise.all(
      rows.map(({ orders, users }) => buildChefOrderPayload(orders, users))
    );

    return res.json({ orders });
  } catch (error) {
    console.error("Error fetching chef orders:", error);
    return res.status(500).json({ error: "Failed to fetch chef orders" });
  }
});

// PATCH /api/chef/orders/:orderId/status - Update a received order status
router.patch("/orders/:orderId/status", requireChef, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const nextStatus = String(req.body?.status ?? "").trim();
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: "BadRequest", message: "Commande invalide" });
    }
    if (!Object.prototype.hasOwnProperty.call(CHEF_ORDER_TRANSITIONS, nextStatus)) {
      return res.status(400).json({ error: "BadRequest", message: "Statut invalide" });
    }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order || order.chefProfileId !== req.chefProfileId) {
      return res.status(404).json({ error: "NotFound", message: "Commande introuvable" });
    }

    if (order.status === nextStatus) {
      const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, order.clientId)).limit(1);
      return res.json({ order: await buildChefOrderPayload(order, clientUser) });
    }

    if (!CHEF_ORDER_TRANSITIONS[order.status]?.includes(nextStatus)) {
      return res.status(400).json({ error: "BadRequest", message: "Transition de statut non autorisee" });
    }

    const [deliveryJob] = await db.select().from(deliveryJobsTable).where(eq(deliveryJobsTable.orderId, order.id)).limit(1);
    if (nextStatus === "delivered" && deliveryJob && deliveryJob.status !== "delivered") {
      return res.status(400).json({ error: "BadRequest", message: "La livraison doit etre terminee avant de cloturer la commande" });
    }

    await db.update(ordersTable).set({ status: nextStatus as any }).where(eq(ordersTable.id, order.id));
    const [updatedOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id)).limit(1);
    const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, order.clientId)).limit(1);

    const notification = CHEF_ORDER_NOTIFICATIONS[nextStatus];
    if (notification) {
      await notifyUsers({
        userIds: [order.clientId],
        type: "order",
        title: notification.title,
        message: notification.message,
        orderId: order.id,
        deliveryJobId: deliveryJob?.id ?? null,
        data: {
          screen: nextStatus === "ready" && deliveryJob ? "delivery-tracking" : "orders",
          orderId: String(order.id),
          deliveryJobId: deliveryJob?.id ? String(deliveryJob.id) : null,
          orderStatus: nextStatus,
        },
      });
    }

    return res.json({ order: await buildChefOrderPayload(updatedOrder, clientUser) });
  } catch (error) {
    console.error("Error updating chef order status:", error);
    return res.status(500).json({ error: "Failed to update order status" });
  }
});

// POST /api/chef/:id/dishes - Create a new dish (chef only)
router.post("/:id/dishes", requireChef, async (req: AuthRequest, res: Response) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const chefId = parseInt(String(idParam), 10);
    if (Number.isNaN(chefId)) {
      return res.status(400).json({ error: "Invalid chef id" });
    }

    // ensure the authenticated user matches the chef id
    if (req.userId !== chefId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { name, description, price, category, prepTime, isPopular, imageUrl, imageUrls, discountPercent, discountLabel } = req.body;
    if (!name || typeof price === "undefined") {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const normalizedImageUrls = normalizeDishImageUrls(imageUrls, imageUrl);
    if (normalizedImageUrls.some((url) => !isOwnedUploadUrl(url, "dish", req.userId!))) {
      return res.status(400).json({ error: "BadRequest", message: "Une ou plusieurs images de plat sont invalides ou non autorisées" });
    }

    // find chef profile
    const chefProfile = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.userId, chefId));
    if (chefProfile.length === 0) return res.status(404).json({ error: "Chef profile not found" });
    const profileId = chefProfile[0].id;

    const inserted = await db.insert(dishesTable).values({
      chefProfileId: profileId,
      name: String(name),
      description: String(description ?? ""),
      price: Number(price),
      category: normalizeChefMenuCategory(category),
      prepTime: String(prepTime ?? "30 min"),
      isPopular: Boolean(isPopular ?? false),
      discountPercent: normalizeDiscountPercent(discountPercent),
      discountLabel: sanitizeDiscountLabel(discountLabel),
      imageUrl: normalizedImageUrls[0] ?? null,
      imageUrls: normalizedImageUrls,
    }).returning();

    return res.status(201).json({ dish: serializeDish(inserted[0]) });
  } catch (error) {
    console.error("Error creating dish:", error);
    return res.status(500).json({ error: "Failed to create dish" });
  }
});

// PATCH /api/chef/:id/dishes/:dishId - Update a dish except its price
router.patch("/:id/dishes/:dishId", requireChef, async (req: AuthRequest, res: Response) => {
  try {
    const chefId = Number(req.params.id);
    const dishId = Number(req.params.dishId);
    if (!Number.isInteger(chefId) || !Number.isInteger(dishId)) {
      return res.status(400).json({ error: "BadRequest", message: "Identifiants invalides" });
    }
    if (req.userId !== chefId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (typeof req.body?.price !== "undefined") {
      return res.status(400).json({ error: "BadRequest", message: "Le prix ne peut pas etre modifie apres publication" });
    }

    const [dish] = await db.select().from(dishesTable).where(eq(dishesTable.id, dishId)).limit(1);
    if (!dish || dish.chefProfileId !== req.chefProfileId) {
      return res.status(404).json({ error: "NotFound", message: "Plat introuvable" });
    }

    const updates: Partial<typeof dishesTable.$inferInsert> = {};
    if (typeof req.body?.name === "string") updates.name = req.body.name.trim() || dish.name;
    if (typeof req.body?.description === "string") updates.description = req.body.description;
    if (typeof req.body?.category === "string") updates.category = normalizeChefMenuCategory(req.body.category);
    if (typeof req.body?.prepTime === "string") updates.prepTime = req.body.prepTime;
    if (typeof req.body?.isPopular === "boolean") updates.isPopular = req.body.isPopular;
    if (typeof req.body?.discountPercent !== "undefined") updates.discountPercent = normalizeDiscountPercent(req.body.discountPercent);
    if (typeof req.body?.discountLabel !== "undefined") updates.discountLabel = sanitizeDiscountLabel(req.body.discountLabel);
    if (typeof req.body?.imageUrl !== "undefined" || typeof req.body?.imageUrls !== "undefined") {
      const normalizedExistingUrls = normalizeDishImageUrls(dish.imageUrls, dish.imageUrl);
      const normalizedImageUrls = normalizeDishImageUrls(req.body?.imageUrls, req.body?.imageUrl);
      const existingUrls = new Set(normalizedExistingUrls);

      if (normalizedImageUrls.some((url) => !isDishImageAllowedForUpdate({ url, userId: req.userId!, existingUrls }))) {
        return res.status(400).json({ error: "BadRequest", message: "Une ou plusieurs images de plat sont invalides ou non autorisees" });
      }
      updates.imageUrl = normalizedImageUrls[0] ?? null;
      updates.imageUrls = normalizedImageUrls;
    }

    await db.update(dishesTable).set(updates).where(eq(dishesTable.id, dish.id));
    const [updatedDish] = await db.select().from(dishesTable).where(eq(dishesTable.id, dish.id)).limit(1);
    return res.json({ dish: serializeDish(updatedDish) });
  } catch (error) {
    console.error("Error updating dish:", error);
    return res.status(500).json({ error: "Failed to update dish" });
  }
});

// DELETE /api/chef/:id/dishes/:dishId - Delete a dish owned by the current chef
router.delete("/:id/dishes/:dishId", requireChef, async (req: AuthRequest, res: Response) => {
  try {
    const chefId = Number(req.params.id);
    const dishId = Number(req.params.dishId);
    if (!Number.isInteger(chefId) || !Number.isInteger(dishId)) {
      return res.status(400).json({ error: "BadRequest", message: "Identifiants invalides" });
    }
    if (req.userId !== chefId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [dish] = await db.select().from(dishesTable).where(eq(dishesTable.id, dishId)).limit(1);
    if (!dish || dish.chefProfileId !== req.chefProfileId) {
      return res.status(404).json({ error: "NotFound", message: "Plat introuvable" });
    }

    await db.delete(dishesTable).where(eq(dishesTable.id, dish.id));
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting dish:", error);
    return res.status(500).json({ error: "Failed to delete dish" });
  }
});

export default router;
