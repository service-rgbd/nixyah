import * as Device from "expo-device";
import { Platform } from "react-native";
import type { create, get } from "react-native-passkeys";

export type PasskeySummary = {
  id: string;
  deviceName: string;
  transports: string[];
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  credentialIdPreview: string;
};

type CreatePasskeyOptions = Parameters<typeof create>[0];
type CreatePasskeyResult = Awaited<ReturnType<typeof create>>;
type GetPasskeyOptions = Parameters<typeof get>[0];
type GetPasskeyResult = Awaited<ReturnType<typeof get>>;
type PasskeysModule = typeof import("react-native-passkeys");

const PASSKEYS_UNAVAILABLE_MESSAGE = "Les passkeys demandent un build natif. Expo Go ne contient pas le module react-native-passkeys.";

function loadPasskeysModule(): PasskeysModule | null {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    return require("react-native-passkeys") as PasskeysModule;
  } catch {
    return null;
  }
}

export function isPasskeySupportedOnDevice() {
  const passkeysModule = loadPasskeysModule();
  if (!passkeysModule) {
    return false;
  }

  try {
    return passkeysModule.isSupported();
  } catch {
    return false;
  }
}

export function getDefaultPasskeyDeviceName() {
  const model = Device.modelName?.trim();
  if (model) {
    return model;
  }

  return Platform.OS === "ios" ? "iPhone" : Platform.OS === "android" ? "Android" : "Appareil mobile";
}

export async function createNativePasskey(options: CreatePasskeyOptions): Promise<CreatePasskeyResult> {
  const passkeysModule = loadPasskeysModule();
  if (!passkeysModule) {
    throw new Error(PASSKEYS_UNAVAILABLE_MESSAGE);
  }

  return passkeysModule.create(options);
}

export async function getNativePasskey(options: GetPasskeyOptions): Promise<GetPasskeyResult> {
  const passkeysModule = loadPasskeysModule();
  if (!passkeysModule) {
    throw new Error(PASSKEYS_UNAVAILABLE_MESSAGE);
  }

  return passkeysModule.get(options);
}
