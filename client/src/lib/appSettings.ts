import { useLocalStorageState } from "@/hooks/use-local-storage";

export type AppSettings = {
  maxDistanceKm: number;
  verifiedOnly: boolean;
  proOnly: boolean;
  vipOnly: boolean;
  selectedServices: string[];
  reduceMotion: boolean;
  language: "fr" | "en";
  theme: "light" | "dark";
  exploreMode: "stack" | "feed";
};

export const defaultAppSettings: AppSettings = {
  maxDistanceKm: 10,
  verifiedOnly: false,
  proOnly: true,
  vipOnly: false,
  selectedServices: [],
  reduceMotion: false,
  language: "fr",
  theme: "dark",
  exploreMode: "feed",
};

export function useAppSettings() {
  // Bump version when adding new fields to ensure defaults are present.
  return useLocalStorageState<AppSettings>("djantrah.settings.v4", defaultAppSettings);
}



