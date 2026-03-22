import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import * as dbSchema from "../../../../lib/db/src/schema/index.js";
import { eq, gt, desc, and, ne, inArray } from "drizzle-orm";
import { requireAuth, requireChef, type AuthRequest } from "../middlewares/auth.js";
import { getDishEffectivePrice } from "../lib/menu.js";
import { isOwnedUploadUrl } from "../lib/uploads.js";
import { notifyUsers } from "../lib/notifications.js";
import { verifyToken } from "../lib/auth.js";

const {
  storiesTable,
  chefProfilesTable,
  usersTable,
  storyLikesTable,
  storyCommentsTable,
  dishesTable,
} = dbSchema;

const router: IRouter = Router();

router.get("/stories", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const payload = token ? verifyToken(token) : null;
    const authenticatedUserId = payload?.userId ?? null;
    const now = new Date();
    const rows = await db
      .select()
      .from(storiesTable)
      .innerJoin(chefProfilesTable, eq(storiesTable.chefProfileId, chefProfilesTable.id))
      .innerJoin(usersTable, eq(chefProfilesTable.userId, usersTable.id))
      .where(gt(storiesTable.expiresAt, now))
      .orderBy(desc(storiesTable.createdAt));

    const storyIds = rows.map(({ stories: s }) => s.id);

    const likes = storyIds.length
      ? await db
          .select({ storyId: storyLikesTable.storyId, userId: storyLikesTable.userId })
          .from(storyLikesTable)
          .where(inArray(storyLikesTable.storyId, storyIds))
      : [];

    const comments = storyIds.length
      ? await db
          .select({
            id: storyCommentsTable.id,
            storyId: storyCommentsTable.storyId,
            userId: storyCommentsTable.userId,
            body: storyCommentsTable.body,
            createdAt: storyCommentsTable.createdAt,
            userName: usersTable.name,
            userAvatarUrl: usersTable.avatarUrl,
            userCoverColor: usersTable.coverColor,
          })
          .from(storyCommentsTable)
          .innerJoin(usersTable, eq(storyCommentsTable.userId, usersTable.id))
          .where(inArray(storyCommentsTable.storyId, storyIds))
          .orderBy(desc(storyCommentsTable.createdAt))
      : [];

    const likeCountByStory = new Map<number, number>();
    const likedByMe = new Set<number>();
    for (const like of likes) {
      likeCountByStory.set(like.storyId, (likeCountByStory.get(like.storyId) ?? 0) + 1);
      if (authenticatedUserId && like.userId === authenticatedUserId) {
        likedByMe.add(like.storyId);
      }
    }

    const commentsByStory = new Map<number, Array<{
      id: string;
      userId: string;
      userName: string;
      userAvatarUrl: string | null;
      userCoverColor: string | null;
      body: string;
      createdAt: string;
    }>>();

    for (const comment of comments) {
      const existing = commentsByStory.get(comment.storyId) ?? [];
      if (existing.length < 12) {
        existing.push({
          id: String(comment.id),
          userId: String(comment.userId),
          userName: comment.userName,
          userAvatarUrl: comment.userAvatarUrl ?? null,
          userCoverColor: comment.userCoverColor ?? null,
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
        });
      }
      commentsByStory.set(comment.storyId, existing);
    }

    const stories = rows.map(({ stories: s, chef_profiles: cp, users: u }) => ({
      id: String(s.id),
      chefId: String(cp.id),
      chefName: u.name,
      chefCoverColor: u.coverColor,
      imageUrl: s.imageUrl ?? null,
      videoUrl: s.videoUrl ?? null,
      videoDurationSeconds: s.videoDurationSeconds ?? null,
      caption: s.caption,
      dishName: s.dishName,
      price: s.price,
      emoji: s.emoji,
      bgColor: s.bgColor || u.coverColor,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      likeCount: likeCountByStory.get(s.id) ?? 0,
      likedByMe: likedByMe.has(s.id),
      commentCount: comments.filter((comment) => comment.storyId === s.id).length,
      comments: commentsByStory.get(s.id) ?? [],
    }));

    res.json({ stories });
  } catch (err) {
    console.error("list stories error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/stories", requireChef, async (req: AuthRequest, res) => {
  try {
    const { caption, dishName, price, emoji, bgColor, imageUrl, videoUrl } = req.body;
    const videoDurationSeconds = typeof req.body.videoDurationSeconds === "number"
      ? req.body.videoDurationSeconds
      : Number(req.body.videoDurationSeconds ?? NaN);
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
    if (videoUrl && !isOwnedUploadUrl(String(videoUrl), "story", req.userId!)) {
      res.status(400).json({ error: "BadRequest", message: "Video de story invalide ou non autorisée" });
      return;
    }
    if (videoUrl && Number.isFinite(videoDurationSeconds) && videoDurationSeconds > 10) {
      res.status(400).json({ error: "BadRequest", message: "La video doit durer au maximum 10 secondes" });
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
      videoUrl: videoUrl || null,
      videoDurationSeconds: Number.isFinite(videoDurationSeconds) ? videoDurationSeconds : null,
      dishId: linkedDish?.id ?? null,
      dishName: linkedDish?.name ?? dishName ?? null,
      price: linkedDish ? getDishEffectivePrice(linkedDish) : price ?? null,
      emoji: emoji || "🍲",
      bgColor: bgColor || u.coverColor,
      createdAt: new Date(),
      expiresAt,
    }).returning();

    if (story.videoUrl) {
      try {
        const recipients = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(ne(usersTable.id, req.userId!));

        await notifyUsers({
          userIds: recipients.map((recipient) => recipient.id),
          type: "system",
          title: `${u.name} vient de publier une vidéo`,
          message: linkedDish?.name ?? dishName ?? caption,
          data: {
            type: "story-video",
            storyId: String(story.id),
            chefId: String(cp.id),
          },
        });
      } catch (notificationError) {
        console.warn("story video notification failed", notificationError);
      }
    }

    res.status(201).json({
      id: String(story.id),
      chefId: String(cp.id),
      chefName: u.name,
      chefCoverColor: u.coverColor,
      imageUrl: story.imageUrl || null,
      videoUrl: story.videoUrl || null,
      videoDurationSeconds: story.videoDurationSeconds ?? null,
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
      const remaining = await db.select().from(storyLikesTable).where(eq(storyLikesTable.storyId, storyId));
      res.json({ liked: false, likeCount: remaining.length });
      return;
    }
    await db.insert(storyLikesTable).values({ storyId, userId }).returning();
    const updated = await db.select().from(storyLikesTable).where(eq(storyLikesTable.storyId, storyId));
    res.json({ liked: true, likeCount: updated.length });
    return;
  } catch (err) {
    console.error("like story error", err);
    res.status(500).json({ error: "InternalError" });
  }
});

router.post("/stories/:id/comments", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storyId = Number(req.params.id);
    const userId = req.userId;
    const body = String(req.body?.body ?? "").trim();

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!body) {
      res.status(400).json({ error: "BadRequest", message: "Le commentaire est requis" });
      return;
    }

    if (body.length > 180) {
      res.status(400).json({ error: "BadRequest", message: "Le commentaire est trop long" });
      return;
    }

    const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, storyId)).limit(1);
    if (!story) {
      res.status(404).json({ error: "NotFound", message: "Story introuvable" });
      return;
    }

    const [comment] = await db.insert(storyCommentsTable).values({
      storyId,
      userId,
      body,
    }).returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const allComments = await db.select().from(storyCommentsTable).where(eq(storyCommentsTable.storyId, storyId));

    res.status(201).json({
      comment: {
        id: String(comment.id),
        storyId: String(comment.storyId),
        userId: String(comment.userId),
        userName: user?.name ?? "Utilisateur",
        userAvatarUrl: user?.avatarUrl ?? null,
        userCoverColor: user?.coverColor ?? null,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
      },
      commentCount: allComments.length,
    });
  } catch (err) {
    console.error("comment story error", err);
    res.status(500).json({ error: "InternalError" });
  }
});

export default router;
