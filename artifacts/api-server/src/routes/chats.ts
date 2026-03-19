import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { chatsTable, messagesTable, chefProfilesTable, usersTable } from "@workspace/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

async function getChatForUser(chatId: number, req: AuthRequest) {
  if (!Number.isInteger(chatId) || chatId <= 0 || !req.userId || !req.userType) {
    return null;
  }

  const chatRows = await db
    .select()
    .from(chatsTable)
    .innerJoin(chefProfilesTable, eq(chatsTable.chefProfileId, chefProfilesTable.id))
    .where(eq(chatsTable.id, chatId))
    .limit(1);

  const row = chatRows[0];
  if (!row) {
    return null;
  }

  const { chats: chat, chef_profiles: chefProfile } = row;
  const isClientMember = req.userType === "client" && chat.clientId === req.userId;
  const isChefMember = req.userType === "chef" && chefProfile.userId === req.userId;

  if (!isClientMember && !isChefMember) {
    return null;
  }

  return { chat, chefProfile };
}

router.get("/chats", requireAuth, async (req: AuthRequest, res) => {
  try {
    const baseQuery = db
      .select()
      .from(chatsTable)
      .innerJoin(chefProfilesTable, eq(chatsTable.chefProfileId, chefProfilesTable.id))
      .innerJoin(usersTable, eq(chefProfilesTable.userId, usersTable.id));

    const rows = await (req.userType === "chef"
      ? baseQuery.where(eq(chefProfilesTable.userId, req.userId!))
      : baseQuery.where(eq(chatsTable.clientId, req.userId!)))
      .orderBy(desc(chatsTable.updatedAt));

    const chats = await Promise.all(
      rows.map(async ({ chats: c, chef_profiles: cp, users: u }) => {
        const [lastMsg] = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.chatId, c.id))
          .orderBy(desc(messagesTable.createdAt))
          .limit(1);

        const allMsgs = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.chatId, c.id));
        const unread = allMsgs.filter((m) => m.senderId !== req.userId).length;

        let clientName = null;
        if (req.userType === "chef") {
          const [client] = await db.select().from(usersTable).where(eq(usersTable.id, c.clientId)).limit(1);
          clientName = client?.name ?? null;
        }

        return {
          id: String(c.id),
          clientId: String(c.clientId),
          clientName,
          chefId: String(cp.id),
          chefName: u.name,
          chefSpecialty: cp.specialty,
          chefCoverColor: u.coverColor,
          lastMessage: lastMsg?.text || "",
          lastMessageAt: lastMsg?.createdAt.toISOString() || c.createdAt.toISOString(),
          unreadCount: unread,
        };
      })
    );

    res.json({ chats });
  } catch (err) {
    console.error("list chats error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.get("/chats/:chatId/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const chatId = parseInt(String(req.params.chatId));
    const authorizedChat = await getChatForUser(chatId, req);
    if (!authorizedChat) {
      res.status(403).json({ error: "Forbidden", message: "Accès refusé à cette conversation" });
      return;
    }

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.chatId, chatId))
      .orderBy(desc(messagesTable.createdAt));

    res.json({
      messages: messages.map((m) => ({
        id: String(m.id),
        chatId: String(m.chatId),
        senderId: String(m.senderId),
        text: m.text,
        isMe: m.senderId === req.userId,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("get messages error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/chats/:chatId/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { text, chefId } = req.body;
    if (!text) {
      res.status(400).json({ error: "BadRequest", message: "Message vide" });
      return;
    }

    let chatId: number;
    const rawChatId = String(req.params.chatId ?? "");

    if (rawChatId === "new" || isNaN(parseInt(rawChatId))) {
      if (req.userType !== "client") {
        res.status(403).json({ error: "Forbidden", message: "Seules les clientes peuvent initier un nouveau chat" });
        return;
      }
      if (!chefId) {
        res.status(400).json({ error: "BadRequest", message: "chefId requis pour nouveau chat" });
        return;
      }
      const [cp] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, parseInt(String(chefId))));
      if (!cp) {
        res.status(404).json({ error: "NotFound", message: "Cuisinière introuvable" });
        return;
      }

      const existing = await db
        .select()
        .from(chatsTable)
        .where(and(eq(chatsTable.clientId, req.userId!), eq(chatsTable.chefProfileId, cp.id)))
        .limit(1);
      const existingChat = existing[0];

      if (existingChat) {
        chatId = existingChat.id;
      } else {
        const [newChat] = await db.insert(chatsTable).values({
          clientId: req.userId!,
          chefProfileId: cp.id,
        }).returning();
        chatId = newChat.id;
      }
    } else {
      chatId = parseInt(rawChatId);
      const authorizedChat = await getChatForUser(chatId, req);
      if (!authorizedChat) {
        res.status(403).json({ error: "Forbidden", message: "Accès refusé à cette conversation" });
        return;
      }
    }

    const [message] = await db.insert(messagesTable).values({
      chatId,
      senderId: req.userId!,
      text,
    }).returning();

    await db.update(chatsTable).set({ updatedAt: new Date() }).where(eq(chatsTable.id, chatId));

    res.status(201).json({
      id: String(message.id),
      chatId: String(chatId),
      senderId: String(message.senderId),
      text: message.text,
      isMe: true,
      createdAt: message.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("send message error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

export default router;
