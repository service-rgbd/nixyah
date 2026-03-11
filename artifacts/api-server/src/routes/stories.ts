import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { storiesTable, chefProfilesTable, usersTable } from "@workspace/db/schema";
import { eq, gt, desc } from "drizzle-orm";
import { requireChef, type AuthRequest } from "../middlewares/auth.js";

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
    const { caption, dishName, price, emoji, bgColor } = req.body;
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

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [story] = await db.insert(storiesTable).values({
      chefProfileId: cp.id,
      caption,
      dishName: dishName || null,
      price: price || null,
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
    const storyId = parseInt(req.params.id);
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
