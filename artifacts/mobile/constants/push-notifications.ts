import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { apiFetch } from "@/constants/api";

const PUSH_NOTIFICATIONS_ENABLED_KEY = "nixyah_push_notifications_enabled";
const EXPO_PUSH_TOKEN_KEY = "nixyah_expo_push_token";

type PushPermissionStatus = "undetermined" | "denied" | "granted" | "unsupported";

export type PushRegistrationResult =
  | { ok: true; permissionStatus: PushPermissionStatus; expoPushToken: string }
  | { ok: false; permissionStatus: PushPermissionStatus; reason: "unsupported-runtime" | "permission-denied" | "missing-project-id" | "missing-token" };

export function isRemotePushSupportedInCurrentRuntime(): boolean {
  if (Platform.OS === "web") {
    return false;
  }

  const appOwnership = (Constants as any).appOwnership;
  const executionEnvironment = (Constants as any).executionEnvironment;
  const isExpoGo = appOwnership === "expo" || executionEnvironment === "storeClient";

  return !(Platform.OS === "android" && isExpoGo);
}

export function getExpoProjectId(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof fromExpoConfig === "string" && fromExpoConfig.trim()) {
    return fromExpoConfig;
  }

  const fromEasConfig = Constants.easConfig?.projectId;
  if (typeof fromEasConfig === "string" && fromEasConfig.trim()) {
    return fromEasConfig;
  }

  return undefined;
}

export async function getPushNotificationsEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(PUSH_NOTIFICATIONS_ENABLED_KEY);
  return stored !== "false";
}

export async function setPushNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PUSH_NOTIFICATIONS_ENABLED_KEY, enabled ? "true" : "false");
}

export async function getStoredExpoPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY);
}

async function setStoredExpoPushToken(token: string): Promise<void> {
  await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, token);
}

export async function clearStoredExpoPushToken(): Promise<void> {
  await AsyncStorage.removeItem(EXPO_PUSH_TOKEN_KEY);
}

export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (!isRemotePushSupportedInCurrentRuntime()) {
    return "unsupported";
  }

  const Notifications = await import("expo-notifications");
  const permissions = await Notifications.getPermissionsAsync();
  return permissions.status as PushPermissionStatus;
}

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  const Notifications = await import("expo-notifications");
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#D4611A",
  });
}

export async function registerExpoPushSubscription(authToken: string): Promise<PushRegistrationResult> {
  if (!isRemotePushSupportedInCurrentRuntime()) {
    return { ok: false, permissionStatus: "unsupported", reason: "unsupported-runtime" };
  }

  const Notifications = await import("expo-notifications");
  await ensureAndroidNotificationChannel();

  const currentPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = currentPermissions.status as PushPermissionStatus;

  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status as PushPermissionStatus;
  }

  if (finalStatus !== "granted") {
    return { ok: false, permissionStatus: finalStatus, reason: "permission-denied" };
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    return { ok: false, permissionStatus: finalStatus, reason: "missing-project-id" };
  }

  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (!expoPushToken) {
    return { ok: false, permissionStatus: finalStatus, reason: "missing-token" };
  }

  await apiFetch("/push/subscribe", {
    method: "POST",
    token: authToken,
    body: JSON.stringify({
      platform: "expo",
      token: expoPushToken,
    }),
  });

  await setStoredExpoPushToken(expoPushToken);
  await setPushNotificationsEnabled(true);

  return { ok: true, permissionStatus: finalStatus, expoPushToken };
}

export async function unregisterExpoPushSubscription(authToken?: string | null): Promise<void> {
  const endpoint = await getStoredExpoPushToken();

  if (authToken && endpoint) {
    try {
      await apiFetch("/push/unsubscribe", {
        method: "POST",
        token: authToken,
        body: JSON.stringify({ endpoint }),
      });
    } catch (error) {
      console.warn("push unsubscribe failed", error);
    }
  }

  await clearStoredExpoPushToken();
  await setPushNotificationsEnabled(false);
}