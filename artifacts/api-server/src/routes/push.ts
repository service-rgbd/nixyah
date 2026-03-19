import express from "express";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db/schema";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { eq } from "drizzle-orm";
import { notifyUsers } from "../lib/notifications.js";

const router = express.Router();

// POST /api/push/subscribe
router.post("/subscribe", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { endpoint, keys, platform } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription payload" });
    }

    // upsert: remove existing same endpoint then insert
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, String(endpoint)));
    const inserted = await db.insert(pushSubscriptionsTable).values({
      userId,
      endpoint: String(endpoint),
      p256dh: String(keys.p256dh),
      auth: String(keys.auth),
      platform: String(platform ?? "web"),
    }).returning();

    return res.status(201).json({ subscription: inserted[0] });
  } catch (err) {
    console.error("subscribe error", err);
    return res.status(500).json({ error: "Failed to save subscription" });
  }
});

// POST /api/push/unsubscribe
router.post("/unsubscribe", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, String(endpoint)));
    return res.json({ ok: true });
  } catch (err) {
    console.error("unsubscribe error", err);
    return res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

// POST /api/push/send - send a push to a specific user or list
// Body: { userId?, title, message, data?, targets?: [userId] }
router.post("/send", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId: targetUserId, title, message, data, targets } = req.body;

    const targetIds: number[] = Array.isArray(targets) ? targets.map(Number) : (targetUserId ? [Number(targetUserId)] : []);
    if (targetIds.length === 0) return res.status(400).json({ error: "No targets provided" });
    const results = await notifyUsers({
      userIds: targetIds,
      type: "system",
      title: String(title ?? ""),
      message: String(message ?? ""),
      data,
    });

    return res.json({ results });
  } catch (err) {
    console.error("push send error", err);
    return res.status(500).json({ error: "Failed to send push" });
  }
});

export default router;
