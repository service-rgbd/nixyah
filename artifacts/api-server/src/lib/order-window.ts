import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export const ORDER_PENDING_WINDOW_MS = 5 * 60 * 1000;

export function getOrderPendingDeadline(createdAt: Date) {
  return new Date(createdAt.getTime() + ORDER_PENDING_WINDOW_MS);
}

export function hasOrderPendingWindowExpired(createdAt: Date, now = Date.now()) {
  return now > createdAt.getTime() + ORDER_PENDING_WINDOW_MS;
}

export async function expirePendingMealOrders(filters?: {
  clientId?: number;
  chefProfileId?: number;
  orderIds?: number[];
}) {
  const whereClauses = [eq(ordersTable.status, "pending")];

  if (typeof filters?.clientId === "number") {
    whereClauses.push(eq(ordersTable.clientId, filters.clientId));
  }

  if (typeof filters?.chefProfileId === "number") {
    whereClauses.push(eq(ordersTable.chefProfileId, filters.chefProfileId));
  }

  if (filters?.orderIds?.length) {
    whereClauses.push(inArray(ordersTable.id, filters.orderIds));
  }

  const pendingOrders = await db
    .select({ id: ordersTable.id, createdAt: ordersTable.createdAt })
    .from(ordersTable)
    .where(and(...whereClauses));

  const expiredOrderIds = pendingOrders
    .filter((order) => hasOrderPendingWindowExpired(order.createdAt))
    .map((order) => order.id);

  if (expiredOrderIds.length === 0) {
    return [] as number[];
  }

  await db
    .update(ordersTable)
    .set({ status: "cancelled" })
    .where(inArray(ordersTable.id, expiredOrderIds));

  return expiredOrderIds;
}
