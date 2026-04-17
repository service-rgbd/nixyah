import { QueryClient, QueryFunction } from "@tanstack/react-query";

// En dev : même origine (backend local sur le même port).
// En production : API déployée (ex. Render).
export const API_BASE_URL =
  typeof import.meta !== "undefined" && import.meta.env?.DEV
    ? ""
    : "https://nixyah.onrender.com";

let csrfTokenPromise: Promise<string | null> | null = null;

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
        const res = await fetch(withApiBase("/api/csrf-token"), {
          credentials: "include",
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { csrfToken?: string | null };
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
  if (needsCsrf && !headers.has("x-csrf-token")) {
    const csrfToken = await getCsrfToken();
    if (csrfToken) headers.set("x-csrf-token", csrfToken);
  }
  return headers;
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = String(init.method ?? "GET").toUpperCase();
  const headers = await buildHeaders(init.headers, !["GET", "HEAD", "OPTIONS"].includes(method));
  return fetch(withApiBase(input), {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });
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
  const headers = await buildHeaders(data ? { "Content-Type": "application/json" } : {}, true);
  const res = await fetch(withApiBase(url), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

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
