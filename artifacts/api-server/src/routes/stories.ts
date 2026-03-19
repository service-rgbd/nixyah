import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { storiesTable, chefProfilesTable, usersTable, storyLikesTable, dishesTable } from "@workspace/db/schema";
import { eq, gt, desc, and } from "drizzle-orm";
import { requireAuth, requireChef, type AuthRequest } from "../middlewares/auth.js";
import { isOwnedUploadUrl } from "../lib/uploads.js";

const router: IRouter = Router();

router.get("/stories", async (req, res) => {
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(storiesTable)
      .innerJoin(chefProfilesTable, eq(storiesTable.chefProfileId, chefProfilesTable.id))
      .innerJoin(usersTable, eq(chefProfilesTable.userId, usersTable.id))
      .where(gt(storiesTable.expiresAt, now))
      .orderBy(desc(storiesTable.createdAt));

    const stories = rows.map(({ stories: s, chef_profiles: cp, users: u }) => ({
      id: String(s.id),
      chefId: String(cp.id),
      chefName: u.name,
      chefCoverColor: u.coverColor,
      imageUrl: s.imageUrl ?? null,
      caption: s.caption,
      dishName: s.dishName,
      price: s.price,
      emoji: s.emoji,
      bgColor: s.bgColor || u.coverColor,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    }));

    res.json({ stories });
  } catch (err) {
    console.error("list stories error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/stories", requireChef, async (req: AuthRequest, res) => {
  try {
    const { caption, dishName, price, emoji, bgColor, imageUrl } = req.body;
    const dishId = typeof req.body.dishId !== "undefined" ? Number(req.body.dishId) : null;
    if (!caption) {
      res.status(400).json({ error: "BadRequest", message: "La description est requise" });
      return;
    }

    const [cp] = await db
      .select()
      .from(chefProfilesTable)
      .where(eq(chefProfilesTable.userId, req.userId!));

    if (!cp) {
      res.status(404).json({ error: "NotFound", message: "Profil cuisinière introuvable" });
      return;
    }

    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (imageUrl && !isOwnedUploadUrl(String(imageUrl), "story", req.userId!)) {
      res.status(400).json({ error: "BadRequest", message: "Image de story invalide ou non autorisée" });
      return;
    }

    let linkedDish = null;
    if (dishId !== null) {
      const [dish] = await db.select().from(dishesTable).where(eq(dishesTable.id, dishId)).limit(1);
      if (!dish || dish.chefProfileId !== cp.id) {
        res.status(400).json({ error: "BadRequest", message: "Plat invalide pour cette story" });
        return;
      }
      linkedDish = dish;
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [story] = await db.insert(storiesTable).values({
      chefProfileId: cp.id,
      caption,
      imageUrl: imageUrl || null,
      dishId: linkedDish?.id ?? null,
      dishName: linkedDish?.name ?? dishName ?? null,
      price: linkedDish?.price ?? price ?? null,
      emoji: emoji || "🍲",
      bgColor: bgColor || u.coverColor,
      createdAt: new Date(),
      expiresAt,
    }).returning();

    res.status(201).json({
      id: String(story.id),
      chefId: String(cp.id),
      chefName: u.name,
      chefCoverColor: u.coverColor,
      imageUrl: story.imageUrl || null,
      caption: story.caption,
      dishName: story.dishName,
      price: story.price,
      emoji: story.emoji,
      bgColor: story.bgColor,
      createdAt: story.createdAt.toISOString(),
      expiresAt: story.expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("create story error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.delete("/stories/:id", requireChef, async (req: AuthRequest, res) => {
  try {
    const storyId = parseInt(String(req.params.id));
    const [cp] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.userId, req.userId!));

    if (!cp) {
      res.status(404).json({ error: "NotFound", message: "Profil introuvable" });
      return;
    }

    const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, storyId));
    if (!story || story.chefProfileId !== cp.id) {
      res.status(403).json({ error: "Forbidden", message: "Accès refusé" });
      return;
    }

    await db.delete(storiesTable).where(eq(storiesTable.id, storyId));
    res.json({ success: true });
  } catch (err) {
    console.error("delete story error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

export default router;

// POST /api/stories/:id/like - toggle like on a story
router.post("/stories/:id/like", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storyId = Number(req.params.id);
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const existing = await db.select().from(storyLikesTable).where(and(eq(storyLikesTable.storyId, storyId), eq(storyLikesTable.userId, userId)));
    if (existing.length > 0) {
      // unlike
      await db.delete(storyLikesTable).where(eq(storyLikesTable.id, existing[0].id));
      res.json({ liked: false });
      return;
    }
    await db.insert(storyLikesTable).values({ storyId, userId }).returning();
    res.json({ liked: true });
    return;
  } catch (err) {
    console.error("like story error", err);
    res.status(500).json({ error: "InternalError" });
  }
});
