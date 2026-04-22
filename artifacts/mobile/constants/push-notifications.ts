import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { apiFetch } from "@/constants/api";

const PUSH_NOTIFICATIONS_ENABLED_KEY = "nixyah_push_notifications_enabled";
const PUSH_TOKEN_KEY = "nixyah_push_token";
const PUSH_PLATFORM_KEY = "nixyah_push_platform";

type PushPermissionStatus = "undetermined" | "denied" | "granted" | "unsupported";
type PushPlatform = "expo" | "android-fcm";

export type PushRegistrationResult =
  | { ok: true; permissionStatus: PushPermissionStatus; pushToken: string; platform: PushPlatform }
  | { ok: false; permissionStatus: PushPermissionStatus; reason: "unsupported-runtime" | "permission-denied" | "missing-project-id" | "missing-token" };

export function isRemotePushSupportedInCurrentRuntime(): boolean {
  if (Platform.OS === "web") {
    return false;
  }

  const appOwnership = (Constants as any).appOwnership;
  const executionEnvironment = (Constants as any).executionEnvironment;
  const isExpoGo = appOwnership === "expo" || executionEnvironment === "storeClient";

  return !isExpoGo;
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

async function getStoredPushRegistration(): Promise<{ token: string; platform: PushPlatform } | null> {
  const [token, platform] = await Promise.all([
    AsyncStorage.getItem(PUSH_TOKEN_KEY),
    AsyncStorage.getItem(PUSH_PLATFORM_KEY),
  ]);
  if (!token || (platform !== "expo" && platform !== "android-fcm")) {
    return null;
  }
  return { token, platform };
}

async function setStoredPushRegistration(token: string, platform: PushPlatform): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(PUSH_TOKEN_KEY, token),
    AsyncStorage.setItem(PUSH_PLATFORM_KEY, platform),
  ]);
}

export async function clearStoredPushRegistration(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(PUSH_TOKEN_KEY),
    AsyncStorage.removeItem(PUSH_PLATFORM_KEY),
  ]);
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

  let pushToken = "";
  let platform: PushPlatform = "expo";

  if (Platform.OS === "android") {
    const devicePushToken = await Notifications.getDevicePushTokenAsync();
    pushToken = typeof devicePushToken.data === "string" ? devicePushToken.data : "";
    platform = "android-fcm";
  } else {
    const projectId = getExpoProjectId();
    if (!projectId) {
      return { ok: false, permissionStatus: finalStatus, reason: "missing-project-id" };
    }

    pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    platform = "expo";
  }

  if (!pushToken) {
    return { ok: false, permissionStatus: finalStatus, reason: "missing-token" };
  }

  await apiFetch("/push/subscribe", {
    method: "POST",
    token: authToken,
    body: JSON.stringify({
      platform,
      token: pushToken,
    }),
  });

  await setStoredPushRegistration(pushToken, platform);
  await setPushNotificationsEnabled(true);

  return { ok: true, permissionStatus: finalStatus, pushToken, platform };
}

export async function unregisterExpoPushSubscription(authToken?: string | null): Promise<void> {
  const registration = await getStoredPushRegistration();

  if (authToken && registration) {
    try {
      await apiFetch("/push/unsubscribe", {
        method: "POST",
        token: authToken,
        body: JSON.stringify({ endpoint: registration.token, platform: registration.platform }),
      });
    } catch (error) {
      console.warn("push unsubscribe failed", error);
    }
  }

  await clearStoredPushRegistration();
  await setPushNotificationsEnabled(false);
}