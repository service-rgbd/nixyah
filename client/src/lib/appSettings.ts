import * as React from "react";
import { useLocalStorageState } from "@/hooks/use-local-storage";

export type AppThemePreference = "auto" | "light" | "dark";

export type AppSettings = {
  maxDistanceKm: number;
  verifiedOnly: boolean;
  proOnly: boolean;
  vipOnly: boolean;
  selectedServices: string[];
  reduceMotion: boolean;
  language: "fr" | "en";
  theme: AppThemePreference;
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
  theme: "auto",
  exploreMode: "feed",
};

function normalizeSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    ...defaultAppSettings,
    ...value,
    selectedServices: Array.isArray(value?.selectedServices) ? value.selectedServices : defaultAppSettings.selectedServices,
    theme:
      value?.theme === "light" || value?.theme === "dark" || value?.theme === "auto"
        ? value.theme
        : defaultAppSettings.theme,
    exploreMode: value?.exploreMode === "stack" || value?.exploreMode === "feed" ? value.exploreMode : defaultAppSettings.exploreMode,
  };
}

export function resolveThemePreference(theme: AppThemePreference, now = new Date()): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= 390 && minutes < 1110 ? "light" : "dark";
}

export function useAppSettings() {
  const [rawSettings, setRawSettings] = useLocalStorageState<Partial<AppSettings>>("djantrah.settings.v4", defaultAppSettings);
  const settings = React.useMemo(() => normalizeSettings(rawSettings), [rawSettings]);

  const setSettings = React.useCallback(
    (next: React.SetStateAction<AppSettings>) => {
      setRawSettings((prev) => {
        const normalizedPrev = normalizeSettings(prev);
        const computed = typeof next === "function" ? (next as (value: AppSettings) => AppSettings)(normalizedPrev) : next;
        return normalizeSettings(computed);
      });
    },
    [setRawSettings],
  );

  return [settings, setSettings] as const;
}



