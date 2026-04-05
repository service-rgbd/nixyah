import express from "express";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db/schema";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { and, eq } from "drizzle-orm";
import { notifyUsers } from "../lib/notifications.js";
import { parseWithSchema } from "../lib/validation.js";
import {
  sendPushBodySchema,
  subscribeBodySchema,
  unsubscribeBodySchema,
} from "../lib/push-validation.js";
import { buildApiRateLimiter } from "../lib/rate-limit.js";

const router = express.Router();
const pushSubscriptionLimiter = buildApiRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Trop de changements de souscription push. Reessayez plus tard.",
});
const pushSendLimiter = buildApiRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 8,
  message: "Trop de tests push envoyes. Reessayez plus tard.",
});

// POST /api/push/subscribe
router.post("/subscribe", requireAuth, pushSubscriptionLimiter as any, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const parsedBody = parseWithSchema(subscribeBodySchema, req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const { endpoint, keys, platform, token } = parsedBody.data;
    const normalizedPlatform = String(platform ?? "web");
    const subscriptionEndpoint = normalizedPlatform === "expo" ? String(token ?? endpoint ?? "") : String(endpoint ?? "");
    const p256dh = normalizedPlatform === "expo" ? "expo" : String(keys?.p256dh ?? "");
    const auth = normalizedPlatform === "expo" ? "expo" : String(keys?.auth ?? "");

    if (!subscriptionEndpoint || !p256dh || !auth) {
      return res.status(400).json({ error: "Invalid subscription payload" });
    }

    // upsert: remove existing same endpoint then insert
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, subscriptionEndpoint));
    const inserted = await db.insert(pushSubscriptionsTable).values({
      userId,
      endpoint: subscriptionEndpoint,
      p256dh,
      auth,
      platform: normalizedPlatform,
    }).returning();

    return res.status(201).json({ subscription: inserted[0] });
  } catch (err) {
    console.error("subscribe error", err);
    return res.status(500).json({ error: "Failed to save subscription" });
  }
});

// POST /api/push/unsubscribe
router.post("/unsubscribe", requireAuth, pushSubscriptionLimiter as any, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const parsedBody = parseWithSchema(unsubscribeBodySchema, req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const { endpoint } = parsedBody.data;
    await db
      .delete(pushSubscriptionsTable)
      .where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.userId, userId)));
    return res.json({ ok: true });
  } catch (err) {
    console.error("unsubscribe error", err);
    return res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

// POST /api/push/send - send a push to a specific user or list
// Body: { userId?, title, message, data?, targets?: [userId] }
router.post("/send", requireAuth, pushSendLimiter as any, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsedBody = parseWithSchema(sendPushBodySchema, req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "BadRequest", message: parsedBody.message });
    }

    const { userId: targetUserId, title, message, data, targets } = parsedBody.data;

    const targetIds: number[] = Array.isArray(targets) ? targets.map(Number) : (targetUserId ? [Number(targetUserId)] : [currentUserId]);
    if (targetIds.length === 0) return res.status(400).json({ error: "No targets provided" });

    const hasForeignTarget = targetIds.some((targetId) => !Number.isInteger(targetId) || targetId !== currentUserId);
    if (hasForeignTarget) {
      return res.status(403).json({ error: "Forbidden", message: "Vous ne pouvez envoyer qu'un test push à votre propre compte." });
    }

    const results = await notifyUsers({
      userIds: [currentUserId],
      type: "system",
      title,
      message,
      data,
    });

    return res.json({ results });
  } catch (err) {
    console.error("push send error", err);
    return res.status(500).json({ error: "Failed to send push" });
  }
});

export default router;
