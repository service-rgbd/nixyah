import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import * as dbSchema from "../../../../lib/db/src/schema/index.js";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";

import { type AuthRequest, requireAuth, requireClient } from "../middlewares/auth.js";
import { getSupportParticipantLabel } from "../lib/chef-followers.js";
import { notifyUsers } from "../lib/notifications.js";
import { nonEmptyTrimmedString, parseWithSchema } from "../lib/validation.js";

const router: IRouter = Router();
const {
  chefProfilesTable,
  deliveryJobsTable,
  ordersTable,
  supportMessagesTable,
  supportThreadsTable,
} = dbSchema;

const openSupportThreadSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  targetRole: z.enum(["chef", "courier"]),
  text: nonEmptyTrimmedString(1000),
});

const supportMessageSchema = z.object({
  text: nonEmptyTrimmedString(1000),
});

async function getThreadForRequest(threadId: number, req: AuthRequest) {
  if (!req.userId) {
    return null;
  }

  const rows = await db
    .select()
    .from(supportThreadsTable)
    .leftJoin(chefProfilesTable, eq(supportThreadsTable.chefProfileId, chefProfilesTable.id))
    .where(eq(supportThreadsTable.id, threadId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const thread = row.support_threads;
  const chefProfile = row.chef_profiles;
  const isClient = thread.clientUserId === req.userId;
  const isChef = req.userType === "chef" && Boolean(chefProfile?.userId && chefProfile.userId === req.userId);
  const isCourier = req.userType === "courier" && Boolean(thread.courierUserId && thread.courierUserId === req.userId);

  if (!isClient && !isChef && !isCourier) {
    return null;
  }

  return { thread, chefProfile };
}

router.get("/support/threads", requireAuth, async (req: AuthRequest, res) => {
  try {
    const visibilityClauses = [eq(supportThreadsTable.clientUserId, req.userId!)];
    if (req.userType === "chef") {
      visibilityClauses.push(eq(chefProfilesTable.userId, req.userId!));
    }
    if (req.userType === "courier") {
      visibilityClauses.push(eq(supportThreadsTable.courierUserId, req.userId!));
    }

    const rows = await db
      .select()
      .from(supportThreadsTable)
      .leftJoin(chefProfilesTable, eq(supportThreadsTable.chefProfileId, chefProfilesTable.id))
      .where(or(...visibilityClauses))
      .orderBy(desc(supportThreadsTable.updatedAt));

    const threads = await Promise.all(
      rows.map(async ({ support_threads: thread }) => {
        const [lastMessage] = await db
          .select()
          .from(supportMessagesTable)
          .where(eq(supportMessagesTable.threadId, thread.id))
          .orderBy(desc(supportMessagesTable.createdAt))
          .limit(1);

        const participantLabel = await getSupportParticipantLabel({
          chefProfileId: thread.chefProfileId,
          courierUserId: thread.courierUserId,
        });

        return {
          id: String(thread.id),
          orderId: String(thread.orderId),
          targetRole: thread.targetRole,
          subject: thread.subject,
          participantLabel,
          lastMessage: lastMessage?.text ?? "",
          lastMessageAt: (lastMessage?.createdAt ?? thread.updatedAt).toISOString(),
          updatedAt: thread.updatedAt.toISOString(),
        };
      }),
    );

    res.json({ threads });
  } catch (error) {
    console.error("list support threads error:", error);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.get("/support/threads/:threadId/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const threadId = Number(req.params.threadId);
    if (!Number.isInteger(threadId) || threadId <= 0) {
      res.status(400).json({ error: "BadRequest", message: "Conversation invalide" });
      return;
    }

    const authorizedThread = await getThreadForRequest(threadId, req);
    if (!authorizedThread) {
      res.status(403).json({ error: "Forbidden", message: "Accès refusé" });
      return;
    }

    const messages = await db
      .select()
      .from(supportMessagesTable)
      .where(eq(supportMessagesTable.threadId, threadId))
      .orderBy(desc(supportMessagesTable.createdAt));

    res.json({
      messages: messages.map((message) => ({
        id: String(message.id),
        threadId: String(message.threadId),
        senderId: String(message.senderId),
        isMe: message.senderId === req.userId,
        text: message.text,
        createdAt: message.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("list support messages error:", error);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/support/threads/open", requireClient, async (req: AuthRequest, res) => {
  try {
    const parsed = parseWithSchema(openSupportThreadSchema, req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "BadRequest", message: parsed.message });
      return;
    }

    const { orderId, targetRole, text } = parsed.data;
    const rows = await db
      .select()
      .from(ordersTable)
      .leftJoin(deliveryJobsTable, eq(deliveryJobsTable.orderId, ordersTable.id))
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.clientId, req.userId!)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: "NotFound", message: "Commande introuvable" });
      return;
    }

    if (targetRole === "courier" && !row.delivery_jobs?.courierUserId) {
      res.status(409).json({ error: "Conflict", message: "Aucun livreur n'est encore affecté à cette commande" });
      return;
    }

    const [existing] = await db
      .select()
      .from(supportThreadsTable)
      .where(and(eq(supportThreadsTable.orderId, orderId), eq(supportThreadsTable.targetRole, targetRole)))
      .limit(1);

    const thread =
      existing ??
      (
        await db
          .insert(supportThreadsTable)
          .values({
            orderId,
            clientUserId: req.userId!,
            chefProfileId: row.orders.chefProfileId,
            courierUserId: row.delivery_jobs?.courierUserId ?? null,
            targetRole,
            subject: targetRole === "chef" ? "Support commande avec la cuisinière" : "Support commande avec le livreur",
          })
          .returning()
      )[0];

    const [message] = await db
      .insert(supportMessagesTable)
      .values({
        threadId: thread.id,
        senderId: req.userId!,
        text,
      })
      .returning();

    await db.update(supportThreadsTable).set({ updatedAt: new Date() }).where(eq(supportThreadsTable.id, thread.id));

    const recipientUserIds =
      targetRole === "chef"
        ? row.orders.chefProfileId
          ? (
              await db
                .select({ userId: chefProfilesTable.userId })
                .from(chefProfilesTable)
                .where(eq(chefProfilesTable.id, row.orders.chefProfileId))
                .limit(1)
            ).map((entry) => entry.userId)
          : []
        : row.delivery_jobs?.courierUserId
          ? [row.delivery_jobs.courierUserId]
          : [];

    if (recipientUserIds.length > 0) {
      await notifyUsers({
        userIds: recipientUserIds,
        type: "message",
        title: "Nouveau message de support",
        message: text,
        orderId,
        data: {
          screen: "support-thread",
          threadId: String(thread.id),
          orderId: String(orderId),
          targetRole,
        },
      });
    }

    res.status(201).json({
      thread: {
        id: String(thread.id),
        orderId: String(thread.orderId),
        targetRole: thread.targetRole,
        subject: thread.subject,
      },
      message: {
        id: String(message.id),
        threadId: String(message.threadId),
        senderId: String(message.senderId),
        isMe: true,
        text: message.text,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("open support thread error:", error);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/support/threads/:threadId/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const threadId = Number(req.params.threadId);
    if (!Number.isInteger(threadId) || threadId <= 0) {
      res.status(400).json({ error: "BadRequest", message: "Conversation invalide" });
      return;
    }

    const parsed = parseWithSchema(supportMessageSchema, req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "BadRequest", message: parsed.message });
      return;
    }

    const authorizedThread = await getThreadForRequest(threadId, req);
    if (!authorizedThread) {
      res.status(403).json({ error: "Forbidden", message: "Accès refusé" });
      return;
    }

    const [message] = await db
      .insert(supportMessagesTable)
      .values({
        threadId,
        senderId: req.userId!,
        text: parsed.data.text,
      })
      .returning();

    await db.update(supportThreadsTable).set({ updatedAt: new Date() }).where(eq(supportThreadsTable.id, threadId));

    const recipientUserIds = new Set<number>();
    if (authorizedThread.thread.clientUserId !== req.userId) {
      recipientUserIds.add(authorizedThread.thread.clientUserId);
    }
    if (authorizedThread.chefProfile?.userId && authorizedThread.chefProfile.userId !== req.userId) {
      recipientUserIds.add(authorizedThread.chefProfile.userId);
    }
    if (authorizedThread.thread.courierUserId && authorizedThread.thread.courierUserId !== req.userId) {
      recipientUserIds.add(authorizedThread.thread.courierUserId);
    }

    if (recipientUserIds.size > 0) {
      await notifyUsers({
        userIds: Array.from(recipientUserIds),
        type: "message",
        title: "Nouveau message de support",
        message: parsed.data.text,
        orderId: authorizedThread.thread.orderId,
        data: {
          screen: "support-thread",
          threadId: String(threadId),
          orderId: String(authorizedThread.thread.orderId),
          targetRole: authorizedThread.thread.targetRole,
        },
      });
    }

    res.status(201).json({
      id: String(message.id),
      threadId: String(message.threadId),
      senderId: String(message.senderId),
      isMe: true,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("send support message error:", error);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

export default router;
