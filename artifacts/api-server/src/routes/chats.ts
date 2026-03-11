import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { chatsTable, messagesTable, chefProfilesTable, usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/chats", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(chatsTable)
      .innerJoin(chefProfilesTable, eq(chatsTable.chefProfileId, chefProfilesTable.id))
      .innerJoin(usersTable, eq(chefProfilesTable.userId, usersTable.id))
      .where(eq(chatsTable.clientId, req.userId!))
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

        return {
          id: String(c.id),
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
    const chatId = parseInt(req.params.chatId);
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
    const rawChatId = req.params.chatId;

    if (rawChatId === "new" || isNaN(parseInt(rawChatId))) {
      if (!chefId) {
        res.status(400).json({ error: "BadRequest", message: "chefId requis pour nouveau chat" });
        return;
      }
      const [cp] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.id, parseInt(chefId)));
      if (!cp) {
        res.status(404).json({ error: "NotFound", message: "Cuisinière introuvable" });
        return;
      }

      const existing = await db
        .select()
        .from(chatsTable)
        .where(eq(chatsTable.clientId, req.userId!));
      const existingChat = existing.find((c) => c.chefProfileId === cp.id);

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
