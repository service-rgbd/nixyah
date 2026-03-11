import { Platform } from "react-native";

const DEV_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "localhost";

export const API_BASE_URL = Platform.OS === "web"
  ? "/api-server/api"
  : `https://${DEV_DOMAIN}/api-server/api`;

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...rest } = options ?? {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Erreur réseau" }));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}
