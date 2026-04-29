import { QueryClient, QueryFunction } from "@tanstack/react-query";

const envApiBaseUrl =
  typeof import.meta !== "undefined" &&
  import.meta.env?.DEV &&
  typeof import.meta.env?.VITE_API_BASE_URL === "string"
    ? import.meta.env.VITE_API_BASE_URL.trim()
    : "";

// Prefer same-origin API calls so the Cloudflare worker can proxy `/api/*`
// and session cookies remain first-party for the browser.
export const API_BASE_URL = envApiBaseUrl || "";
const SESSION_TOKEN_KEY = "djantrah.session.token.v1";

let csrfTokenPromise: Promise<string | null> | null = null;

export function resetCsrfTokenCache() {
  csrfTokenPromise = null;
}

export function setCsrfToken(token: string | null | undefined) {
  const value = typeof token === "string" ? token.trim() : "";
  csrfTokenPromise = Promise.resolve(value.length > 0 ? value : null);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function withApiBase(url: string): string {
  if (!url.startsWith("/")) return url;
  if (!API_BASE_URL) return url;
  const base = API_BASE_URL.replace(/\/+$/, "");
  return `${base}${url}`;
}

async function getCsrfToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!csrfTokenPromise) {
    csrfTokenPromise = (async () => {
      try {
        const headers = new Headers();
        const sessionToken = window.localStorage.getItem(SESSION_TOKEN_KEY);
        if (sessionToken) {
          headers.set("x-session-token", sessionToken);
        }
        const res = await fetch(withApiBase("/api/csrf-token"), {
          cache: "no-store",
          headers,
          credentials: "include",
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { csrfToken?: string | null; sessionToken?: string | null };
        if (typeof data?.sessionToken === "string" && data.sessionToken.trim().length > 0) {
          window.localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
        }
        return typeof data?.csrfToken === "string" && data.csrfToken.trim().length > 0
          ? data.csrfToken
          : null;
      } catch {
        return null;
      }
    })();
  }
  return csrfTokenPromise;
}

async function buildHeaders(
  initHeaders: HeadersInit | undefined,
  needsCsrf: boolean,
): Promise<Headers> {
  const headers = new Headers(initHeaders ?? {});
  if (typeof window !== "undefined" && !headers.has("x-session-token")) {
    const sessionToken = window.localStorage.getItem(SESSION_TOKEN_KEY);
    if (sessionToken) headers.set("x-session-token", sessionToken);
  }
  if (needsCsrf && !headers.has("x-csrf-token")) {
    const csrfToken = await getCsrfToken();
    if (csrfToken) headers.set("x-csrf-token", csrfToken);
  }
  return headers;
}

async function performApiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = String(init.method ?? "GET").toUpperCase();
  const headers = await buildHeaders(init.headers, !["GET", "HEAD", "OPTIONS"].includes(method));
  return fetch(withApiBase(input), {
    ...init,
    cache: "no-store",
    headers,
    credentials: init.credentials ?? "include",
  });
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = String(init.method ?? "GET").toUpperCase();
  let res = await performApiFetch(input, init);

  if (!["GET", "HEAD", "OPTIONS"].includes(method) && res.status === 419) {
    resetCsrfTokenCache();
    res = await performApiFetch(input, init);
  }

  return res;
}

export async function apiGetJson<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  await throwIfResNotOk(res);
  return (await res.json()) as T;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText || "Une erreur est survenue.";
    try {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data && typeof (data as any).message === "string") {
          message = (data as any).message;
        }
        if (
          data &&
          Array.isArray((data as any).details) &&
          typeof (data as any).details[0]?.message === "string"
        ) {
          message = (data as any).details[0].message;
        }
      } else {
        const text = await res.text();
        if (text) message = text;
      }
    } catch {
      // ignore parse errors, fall back to generic message
    }
    throw new ApiError(res.status, message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const makeRequest = async () => {
    const headers = await buildHeaders(data ? { "Content-Type": "application/json" } : {}, true);
    return fetch(withApiBase(url), {
      method,
      cache: "no-store",
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  };

  let res = await makeRequest();

  if (res.status === 419) {
    resetCsrfTokenCache();
    res = await makeRequest();
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await apiFetch(queryKey.join("/") as string);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
