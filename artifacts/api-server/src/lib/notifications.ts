import fs from "node:fs";
import path from "node:path";
import { createSign } from "node:crypto";
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
  pushOptions?: {
    channelId?: string;
    priority?: "default" | "normal" | "high";
  };
}

type StoredPushSubscription = typeof pushSubscriptionsTable.$inferSelect;
type StoredNotification = typeof notificationsTable.$inferSelect;

type FirebaseServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

let cachedFirebaseServiceAccount: FirebaseServiceAccount | null | undefined;
let cachedFirebaseAccessToken: { value: string; expiresAtMs: number } | null = null;

function toBase64Url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getFirebaseServiceAccount(): FirebaseServiceAccount | null {
  if (typeof cachedFirebaseServiceAccount !== "undefined") {
    return cachedFirebaseServiceAccount;
  }

  const rawJson = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim();
  if (rawJson) {
    try {
      cachedFirebaseServiceAccount = JSON.parse(rawJson) as FirebaseServiceAccount;
      return cachedFirebaseServiceAccount;
    } catch (error) {
      console.warn("invalid FCM_SERVICE_ACCOUNT_JSON", error);
    }
  }

  const candidatePaths = [
    process.env.FCM_SERVICE_ACCOUNT_PATH,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PATH,
    path.resolve(process.cwd(), "keys/google-play-service-account.json"),
    path.resolve(process.cwd(), "../mobile/keys/google-play-service-account.json"),
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const candidatePath of candidatePaths) {
    try {
      if (!fs.existsSync(candidatePath)) {
        continue;
      }

      cachedFirebaseServiceAccount = JSON.parse(fs.readFileSync(candidatePath, "utf8")) as FirebaseServiceAccount;
      return cachedFirebaseServiceAccount;
    } catch (error) {
      console.warn("failed to read firebase service account", candidatePath, error);
    }
  }

  cachedFirebaseServiceAccount = null;
  return cachedFirebaseServiceAccount;
}

function normalizeFcmData(data?: Record<string, unknown>, notification?: StoredNotification, orderId?: number | null, deliveryJobId?: number | null) {
  const payloadEntries = Object.entries({
    ...data,
    notificationId: notification ? String(notification.id) : undefined,
    orderId: orderId != null ? String(orderId) : undefined,
    deliveryJobId: deliveryJobId != null ? String(deliveryJobId) : undefined,
  }).filter(([, value]) => value != null);

  return Object.fromEntries(payloadEntries.map(([key, value]) => [key, String(value)]));
}

async function getFirebaseAccessToken(serviceAccount: FirebaseServiceAccount): Promise<string | null> {
  const nowMs = Date.now();
  if (cachedFirebaseAccessToken && cachedFirebaseAccessToken.expiresAtMs - nowMs > 60_000) {
    return cachedFirebaseAccessToken.value;
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    return null;
  }

  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = issuedAt + 3600;
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: expiresAt,
  };

  const unsignedToken = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(claims))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer
    .sign(serviceAccount.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const assertion = `${unsignedToken}.${signature}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    console.warn("firebase oauth token request failed", response.status, await response.text().catch(() => ""));
    return null;
  }

  const body = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!body?.access_token) {
    return null;
  }

  cachedFirebaseAccessToken = {
    value: body.access_token,
    expiresAtMs: nowMs + Math.max(300, Number(body.expires_in ?? 3600)) * 1000,
  };
  return body.access_token;
}

async function sendExpoPushNotifications(subscriptions: StoredPushSubscription[], payload: {
  title: string;
  message: string;
  data?: Record<string, unknown>;
  orderId?: number | null;
  deliveryJobId?: number | null;
  pushOptions?: NotifyUsersInput["pushOptions"];
  notificationsByUserId: Map<number, StoredNotification>;
}) {
  if (subscriptions.length === 0) {
    return [] as Array<{ endpoint: string; status: string }>;
  }

  const messages = subscriptions.map((subscription) => {
    const notification = payload.notificationsByUserId.get(subscription.userId);

    return {
      to: subscription.endpoint,
      sound: "default",
      channelId: payload.pushOptions?.channelId,
      priority: payload.pushOptions?.priority,
      title: payload.title,
      body: payload.message,
      data: {
        ...payload.data,
        notificationId: notification ? String(notification.id) : null,
        orderId: payload.orderId ?? null,
        deliveryJobId: payload.deliveryJobId ?? null,
      },
    };
  });

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

  let parsedBody: any = null;
  try {
    parsedBody = body ? JSON.parse(body) : null;
  } catch {
    parsedBody = null;
  }

  const tickets = Array.isArray(parsedBody?.data) ? parsedBody.data : [];
  return subscriptions.map((subscription, index) => {
    const ticket = tickets[index];
    if (ticket?.status === "ok") {
      return { endpoint: subscription.endpoint, status: "ok" };
    }

    if (ticket?.status === "error") {
      console.warn("expo push ticket error", subscription.endpoint, ticket?.message ?? "unknown", ticket?.details ?? null);
    }

    return { endpoint: subscription.endpoint, status: ticket?.status === "ok" ? "ok" : "error" };
  });
}

async function sendAndroidFcmNotifications(subscriptions: StoredPushSubscription[], payload: {
  title: string;
  message: string;
  data?: Record<string, unknown>;
  orderId?: number | null;
  deliveryJobId?: number | null;
  pushOptions?: NotifyUsersInput["pushOptions"];
  notificationsByUserId: Map<number, StoredNotification>;
}) {
  if (subscriptions.length === 0) {
    return [] as Array<{ endpoint: string; status: string }>;
  }

  const serviceAccount = getFirebaseServiceAccount();
  const projectId = process.env.FCM_PROJECT_ID?.trim() || serviceAccount?.project_id?.trim();
  if (!serviceAccount?.client_email || !serviceAccount?.private_key || !projectId) {
    console.warn("android fcm credentials are missing");
    return subscriptions.map((subscription) => ({ endpoint: subscription.endpoint, status: "error" }));
  }

  const accessToken = await getFirebaseAccessToken(serviceAccount);
  if (!accessToken) {
    console.warn("android fcm access token could not be obtained");
    return subscriptions.map((subscription) => ({ endpoint: subscription.endpoint, status: "error" }));
  }

  const results: Array<{ endpoint: string; status: string }> = [];
  for (const subscription of subscriptions) {
    const notification = payload.notificationsByUserId.get(subscription.userId);
    try {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: subscription.endpoint,
            notification: {
              title: payload.title,
              body: payload.message,
            },
            data: normalizeFcmData(payload.data, notification, payload.orderId, payload.deliveryJobId),
            android: {
              priority: payload.pushOptions?.priority === "high" ? "HIGH" : "NORMAL",
              notification: payload.pushOptions?.channelId
                ? {
                    channelId: payload.pushOptions.channelId,
                  }
                : undefined,
            },
          },
        }),
      });

      if (!response.ok) {
        console.warn("android fcm send failed", response.status, await response.text().catch(() => ""));
        results.push({ endpoint: subscription.endpoint, status: "error" });
        continue;
      }

      results.push({ endpoint: subscription.endpoint, status: "ok" });
    } catch (error: any) {
      console.warn("android fcm send failed", subscription.endpoint, error?.message ?? error);
      results.push({ endpoint: subscription.endpoint, status: "error" });
    }
  }

  return results;
}

export async function notifyUsers({
  userIds,
  type = "system",
  title,
  message,
  orderId = null,
  deliveryJobId = null,
  data,
  pushOptions,
}: NotifyUsersInput) {
  const uniqueUserIds = Array.from(new Set(userIds.filter((value) => Number.isInteger(value) && value > 0)));
  if (uniqueUserIds.length === 0) {
    return [];
  }

  const insertedNotifications = await db.insert(notificationsTable).values(
    uniqueUserIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      orderId,
      deliveryJobId,
    })),
  ).returning();
  const notificationsByUserId = new Map(insertedNotifications.map((notification) => [notification.userId, notification]));

  const subscriptions = [];
  for (const userId of uniqueUserIds) {
    const subs = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
    subscriptions.push(...subs);
  }

  const results: Array<{ endpoint: string; status: string }> = [];

  const expoSubscriptions = subscriptions.filter((subscription) => subscription.platform === "expo");
  const androidFcmSubscriptions = subscriptions.filter((subscription) => subscription.platform === "android-fcm");
  const webSubscriptions = subscriptions.filter((subscription) => !["expo", "android-fcm"].includes(subscription.platform));

  if (expoSubscriptions.length > 0) {
    const expoResults = await sendExpoPushNotifications(expoSubscriptions, {
      title,
      message,
      data,
      orderId,
      deliveryJobId,
      pushOptions,
      notificationsByUserId,
    });
    results.push(...expoResults);
  }

  if (androidFcmSubscriptions.length > 0) {
    const androidFcmResults = await sendAndroidFcmNotifications(androidFcmSubscriptions, {
      title,
      message,
      data,
      orderId,
      deliveryJobId,
      pushOptions,
      notificationsByUserId,
    });
    results.push(...androidFcmResults);
  }

  const payload = JSON.stringify({ title, message, data, orderId, deliveryJobId });

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
