import { Platform } from "react-native";
import Constants from "expo-constants";

export class ApiError extends Error {
  code?: string;
  body?: any;
}

const EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL;

function hostFromExpoConstants(): string | null {
  const manifest: any = (Constants as any).manifest || (Constants as any).expoConfig || null;
  const dbg = manifest?.debuggerHost ?? manifest?.developer?.tool ?? null;
  if (!dbg) return null;
  const host = String(dbg).split(":")[0];
  return host || null;
}

const API_BASE_URL = (() => {
  if (EXPO_PUBLIC_API_URL) return EXPO_PUBLIC_API_URL;
  if (Platform.OS === "web") return "/api";

  const envDomain = process.env.EXPO_PUBLIC_DOMAIN;
  if (envDomain && envDomain !== "localhost") return `http://${envDomain}:3333/api`;

  const constantHost = hostFromExpoConstants();
  if (constantHost) return `http://${constantHost}:3333/api`;

  return `http://localhost:3333/api`;
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
    const body = await res.json().catch(() => ({ message: "Erreur réseau" }));
    const error = new ApiError(body.message ?? `HTTP ${res.status}`);
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
  try {
    presign = await apiFetch<{ url: string; key: string; publicUrl?: string }>("/uploads/presign", {
      method: "POST",
      token,
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
  return { key: presign.key, publicUrl: presign.publicUrl ?? null };
}
