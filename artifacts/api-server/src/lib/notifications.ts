import webpush from "web-push";
import { db } from "@workspace/db";
import { notificationsTable, pushSubscriptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

interface NotifyUsersInput {
  userIds: number[];
  type?: "order" | "review" | "message" | "payment" | "system";
  title: string;
  message: string;
  orderId?: number | null;
  deliveryJobId?: number | null;
  data?: Record<string, unknown>;
}

type StoredPushSubscription = typeof pushSubscriptionsTable.$inferSelect;

async function sendExpoPushNotifications(subscriptions: StoredPushSubscription[], payload: {
  title: string;
  message: string;
  data?: Record<string, unknown>;
  orderId?: number | null;
  deliveryJobId?: number | null;
}) {
  if (subscriptions.length === 0) {
    return [] as Array<{ endpoint: string; status: string }>;
  }

  const messages = subscriptions.map((subscription) => ({
    to: subscription.endpoint,
    sound: "default",
    title: payload.title,
    body: payload.message,
    data: {
      ...payload.data,
      orderId: payload.orderId ?? null,
      deliveryJobId: payload.deliveryJobId ?? null,
    },
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    console.warn("expo push send failed", response.status, body);
    return subscriptions.map((subscription) => ({ endpoint: subscription.endpoint, status: "error" }));
  }

  return subscriptions.map((subscription) => ({ endpoint: subscription.endpoint, status: "ok" }));
}

export async function notifyUsers({
  userIds,
  type = "system",
  title,
  message,
  orderId = null,
  deliveryJobId = null,
  data,
}: NotifyUsersInput) {
  const uniqueUserIds = Array.from(new Set(userIds.filter((value) => Number.isInteger(value) && value > 0)));
  if (uniqueUserIds.length === 0) {
    return [];
  }

  await db.insert(notificationsTable).values(
    uniqueUserIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      orderId,
      deliveryJobId,
    })),
  );

  const subscriptions = [];
  for (const userId of uniqueUserIds) {
    const subs = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
    subscriptions.push(...subs);
  }

  const payload = JSON.stringify({ title, message, data, orderId, deliveryJobId });
  const results: Array<{ endpoint: string; status: string }> = [];

  const expoSubscriptions = subscriptions.filter((subscription) => subscription.platform === "expo");
  const webSubscriptions = subscriptions.filter((subscription) => subscription.platform !== "expo");

  if (expoSubscriptions.length > 0) {
    const expoResults = await sendExpoPushNotifications(expoSubscriptions, {
      title,
      message,
      data,
      orderId,
      deliveryJobId,
    });
    results.push(...expoResults);
  }

  for (const subscription of webSubscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload,
      );
      results.push({ endpoint: subscription.endpoint, status: "ok" });
    } catch (error: any) {
      console.warn("push send failed", subscription.endpoint, error?.statusCode ?? error?.message);
      results.push({ endpoint: subscription.endpoint, status: "error" });
    }
  }

  return results;
}
