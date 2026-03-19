import { db } from "@workspace/db";
import { dishesTable, chefProfilesTable, ordersTable, notificationsTable, reviewsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import express, { Response } from "express";
import { requireAuth, requireChef, type AuthRequest } from "../middlewares/auth.js";
import { isOwnedUploadUrl } from "../lib/uploads.js";

const router = express.Router();

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
      dishes: dishes.map((d) => ({
        id: String(d.dishes.id),
        chefProfileId: d.dishes.chefProfileId,
        name: d.dishes.name,
        description: d.dishes.description,
        imageUrl: d.dishes.imageUrl ?? null,
        price: d.dishes.price,
        category: d.dishes.category,
        prepTime: d.dishes.prepTime,
        isPopular: d.dishes.isPopular,
      })),
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

    return res.json({
      totalOrders: totalOrders.length,
      totalRevenue,
      averageRating: Number(averageRating.toFixed(1)),
      completionRate: Number(completionRate.toFixed(0)),
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

    const { name, description, price, category, prepTime, isPopular, imageUrl } = req.body;
    if (!name || typeof price === "undefined") {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (imageUrl && !isOwnedUploadUrl(String(imageUrl), "dish", req.userId!)) {
      return res.status(400).json({ error: "BadRequest", message: "Image de plat invalide ou non autorisée" });
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
      category: String(category ?? "Plats Principaux"),
      prepTime: String(prepTime ?? "30 min"),
      isPopular: Boolean(isPopular ?? false),
      imageUrl: imageUrl ?? null,
    }).returning();

    return res.status(201).json({ dish: inserted[0] });
  } catch (error) {
    console.error("Error creating dish:", error);
    return res.status(500).json({ error: "Failed to create dish" });
  }
});

export default router;
