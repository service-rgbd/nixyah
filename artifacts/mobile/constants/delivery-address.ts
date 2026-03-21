import AsyncStorage from "@react-native-async-storage/async-storage";

export const DELIVERY_ADDRESS_STORAGE_KEY = "nixyah_delivery_address";

export interface SavedDeliveryAddress {
  label: string;
  latitude?: number | null;
  longitude?: number | null;
  updatedAt: string;
}

export async function loadSavedDeliveryAddress(): Promise<SavedDeliveryAddress | null> {
  const rawValue = await AsyncStorage.getItem(DELIVERY_ADDRESS_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as SavedDeliveryAddress;
    if (!parsed?.label || typeof parsed.label !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveDeliveryAddress(address: SavedDeliveryAddress): Promise<void> {
  await AsyncStorage.setItem(DELIVERY_ADDRESS_STORAGE_KEY, JSON.stringify(address));
}

export function formatAddressTimestamp(value?: string | null): string {
  if (!value) {
    return "Adresse non enregistrée";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Adresse enregistrée";
  }

  return `Mis a jour le ${date.toLocaleDateString("fr-FR")} a ${date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
