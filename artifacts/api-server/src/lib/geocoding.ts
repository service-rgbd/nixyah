type GeocodedPoint = {
  latitude: number;
  longitude: number;
};

function buildQuery(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.toLowerCase();
  if (
    normalized.includes("cote d'ivoire") ||
    normalized.includes("cote d’ivoire") ||
    normalized.includes("ivory coast")
  ) {
    return trimmed;
  }

  return `${trimmed}, Cote d'Ivoire`;
}

export async function geocodeAddress(address?: string | null): Promise<GeocodedPoint | null> {
  if (!address?.trim()) {
    return null;
  }

  try {
    const query = buildQuery(address);
    if (!query) {
      return null;
    }

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "0");
    url.searchParams.set("q", query);

    const response = await fetch(url.toString(), {
      headers: {
        "accept-language": "fr",
        "user-agent": "IvoryDiasporaDelivery/1.0",
      },
    });

    if (!response.ok) {
      return null;
    }

    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const first = results[0];
    const latitude = Number(first?.lat ?? NaN);
    const longitude = Number(first?.lon ?? NaN);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  } catch (error) {
    console.warn("geocode address failed", error);
    return null;
  }
}