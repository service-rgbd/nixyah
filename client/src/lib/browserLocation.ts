export type BrowserCoords = { lat: number; lng: number };

const BROWSER_LOCATION_KEY = "djantrah.browser.location.v1";

export function getStoredBrowserCoords(): BrowserCoords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BROWSER_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BrowserCoords> | null;
    if (
      !parsed ||
      typeof parsed.lat !== "number" ||
      !Number.isFinite(parsed.lat) ||
      typeof parsed.lng !== "number" ||
      !Number.isFinite(parsed.lng)
    ) {
      return null;
    }
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

export function setStoredBrowserCoords(coords: BrowserCoords | null) {
  if (typeof window === "undefined") return;
  if (!coords) {
    window.localStorage.removeItem(BROWSER_LOCATION_KEY);
    return;
  }
  window.localStorage.setItem(BROWSER_LOCATION_KEY, JSON.stringify(coords));
}

export async function requestBrowserCoords(options?: PositionOptions): Promise<BrowserCoords | null> {
  if (typeof window === "undefined" || !navigator.geolocation) return null;
  return await new Promise<BrowserCoords | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setStoredBrowserCoords(coords);
        resolve(coords);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, ...(options ?? {}) },
    );
  });
}
