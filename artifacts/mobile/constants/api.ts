import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";

export class ApiError extends Error {
  code?: string;
  body?: any;
}

const DEFAULT_PRODUCTION_API_URL = "https://api.nixyah.com/api";

function readPublicEnv(name: string): string | null {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const fromProcess = processEnv?.[name];
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return fromProcess;
  }

  const extra = ((Constants as any).expoConfig?.extra ?? (Constants as any).manifest?.extra ?? {}) as Record<string, unknown>;
  const fromExtra = extra[name];
  return typeof fromExtra === "string" && fromExtra.trim() ? fromExtra : null;
}

function normalizeApiBaseUrl(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
  const parsed = new URL(withProtocol);
  const normalizedPath = parsed.pathname === "/" ? "/api" : parsed.pathname.replace(/\/$/, "");
  parsed.pathname = normalizedPath.endsWith("/api") ? normalizedPath : `${normalizedPath}/api`.replace(/\/api\/api$/, "/api");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function isLocalApiUrl(value?: string | null): boolean {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return /^(localhost|127\.0\.0\.1|192\.168\.|10\.)/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function normalizeRemoteUrl(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(https?:|file:|data:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function hostFromExpoConstants(): string | null {
  const manifest: any = (Constants as any).manifest || (Constants as any).expoConfig || null;
  const dbg = manifest?.debuggerHost ?? manifest?.developer?.tool ?? null;
  if (!dbg) return null;
  const host = String(dbg).split(":")[0];
  return host || null;
}

const API_BASE_URL = (() => {
  const explicitApiUrl = normalizeApiBaseUrl(readPublicEnv("EXPO_PUBLIC_API_URL"));
  const allowLocalApi = readPublicEnv("EXPO_PUBLIC_USE_LOCAL_API") === "1";

  if (explicitApiUrl) {
    if (Platform.OS !== "web" && isLocalApiUrl(explicitApiUrl) && !allowLocalApi) {
      return DEFAULT_PRODUCTION_API_URL;
    }
    return explicitApiUrl;
  }
  const envDomain = readPublicEnv("EXPO_PUBLIC_DOMAIN");
  if (envDomain && envDomain !== "localhost" && allowLocalApi) return `http://${envDomain}:3333/api`;

  const constantHost = hostFromExpoConstants();
  if (constantHost && allowLocalApi) return `http://${constantHost}:3333/api`;
  if (allowLocalApi) return "http://127.0.0.1:3333/api";

  return DEFAULT_PRODUCTION_API_URL;
})();

export { API_BASE_URL };

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
    const rawBody = await res.text().catch(() => "");
    let body: any = null;
    try {
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      body = rawBody ? { message: rawBody } : null;
    }

    const fallbackMessage = res.status === 0
      ? "Erreur réseau"
      : body?.message ?? body?.error ?? `${res.status} ${res.statusText}`.trim();

    const error = new ApiError(fallbackMessage || `HTTP ${res.status}`);
    error.code = body.error;
    error.body = body;
    throw error;
  }
  return res.json();
}

// Upload helper: presign -> PUT -> return publicUrl (or key)
export async function uploadFile({
  fileUri,
  filename,
  contentType,
  purpose,
  token,
}: {
  fileUri: string;
  filename: string;
  contentType: string;
  purpose: "avatar" | "story" | "dish";
  token?: string;
}) {
  // 1) get presigned url from backend
  let presign;
  const fileRes = await fetch(fileUri);
  const blob = await fileRes.blob();
  const authToken = token ?? (await AsyncStorage.getItem("nixyah_token")) ?? undefined;
  try {
    presign = await apiFetch<{ url: string; key: string; publicUrl?: string }>("/uploads/presign", {
      method: "POST",
      token: authToken,
      body: JSON.stringify({ filename, contentType, purpose, fileSize: blob.size }),
    });
  } catch (err: any) {
    // provide clearer error for UI
    throw new Error(`Upload presign failed: ${err?.message ?? String(err)}`);
  }

  // 3) upload to presigned URL
  const putRes = await fetch(presign.url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => null);
    throw new Error(`Upload PUT failed: ${putRes.status} ${putRes.statusText} ${text ?? ""}`);
  }

  // 4) return public URL (preferred) or key
  return { key: presign.key, publicUrl: normalizeRemoteUrl(presign.publicUrl) };
}
