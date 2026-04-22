import { db } from "@workspace/db";
import * as dbSchema from "../../../../lib/db/src/schema/index.js";
import { desc, eq, inArray } from "drizzle-orm";

import { notifyUsers } from "./notifications.js";

const {
  chefFollowersTable,
  chefProfilesTable,
  deliveryJobsTable,
  ordersTable,
  usersTable,
} = dbSchema;

export async function getChefFollowerUserIds(chefProfileId: number) {
  const followers = await db
    .select({ userId: chefFollowersTable.clientUserId })
    .from(chefFollowersTable)
    .where(eq(chefFollowersTable.chefProfileId, chefProfileId));

  return followers.map((row) => row.userId);
}

export async function notifyChefFollowersAboutPublication(input: {
  chefProfileId: number;
  title: string;
  message: string;
  data: Record<string, unknown>;
}) {
  const userIds = await getChefFollowerUserIds(input.chefProfileId);
  if (userIds.length === 0) {
    return;
  }

  await notifyUsers({
    userIds,
    type: "system",
    title: input.title,
    message: input.message,
    data: input.data,
    pushOptions: {
      channelId: "default",
      priority: "high",
    },
  });
}

export async function getOrderSupportRecipients(orderId: number) {
  const rows = await db
    .select({
      clientUserId: ordersTable.clientId,
      chefUserId: chefProfilesTable.userId,
      courierUserId: deliveryJobsTable.courierUserId,
    })
    .from(ordersTable)
    .innerJoin(chefProfilesTable, eq(ordersTable.chefProfileId, chefProfilesTable.id))
    .leftJoin(deliveryJobsTable, eq(deliveryJobsTable.orderId, ordersTable.id))
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  return rows[0] ?? null;
}

export async function notifyExpiredOrders(orderIds: number[]) {
  if (orderIds.length === 0) {
    return;
  }

  const rows = await db
    .select({
      orderId: ordersTable.id,
      clientUserId: ordersTable.clientId,
      chefUserId: chefProfilesTable.userId,
    })
    .from(ordersTable)
    .innerJoin(chefProfilesTable, eq(ordersTable.chefProfileId, chefProfilesTable.id))
    .where(inArray(ordersTable.id, orderIds))
    .orderBy(desc(ordersTable.id));

  await Promise.all(
    rows.map(async (row) => {
      await notifyUsers({
        userIds: [row.clientUserId, row.chefUserId],
        type: "order",
        title: "Commande annulée automatiquement",
        message: "Le délai de 5 minutes pour accepter la commande est dépassé.",
        orderId: row.orderId,
        data: {
          screen: "orders",
          orderId: String(row.orderId),
          orderStatus: "cancelled",
          reason: "acceptance-window-expired",
        },
      });
    }),
  );
}

export async function getSupportParticipantLabel(input: {
  chefProfileId?: number | null;
  courierUserId?: number | null;
}) {
  if (input.courierUserId) {
    const [courier] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, input.courierUserId)).limit(1);
    return courier?.name ?? "Livreur";
  }

  if (input.chefProfileId) {
    const [chef] = await db
      .select({ name: usersTable.name })
      .from(chefProfilesTable)
      .innerJoin(usersTable, eq(chefProfilesTable.userId, usersTable.id))
      .where(eq(chefProfilesTable.id, input.chefProfileId))
      .limit(1);
    return chef?.name ?? "Cuisinière";
  }

  return "Support";
}
