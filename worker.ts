import { injectSeoIntoHtml, isNoIndexPath } from "./shared/seo";

function copySetCookieHeaders(source: Response, target: Headers) {
  const mirroredCookies = source.headers.get("x-session-bridge");
  if (mirroredCookies) {
    try {
      const decoded = atob(mirroredCookies);
      const parsed = JSON.parse(decoded) as unknown;
      if (Array.isArray(parsed)) {
        for (const value of parsed) {
          if (typeof value === "string" && value.length > 0) {
            target.append("set-cookie", value);
          }
        }
        return;
      }
    } catch {
      // fall through to runtime-specific Set-Cookie readers
    }
  }

  const responseHeaders = source.headers as Headers & {
    getSetCookie?: () => string[];
    getAll?: (name: string) => string[];
  };
  const setCookies =
    typeof responseHeaders.getAll === "function"
      ? responseHeaders.getAll("Set-Cookie")
      : typeof responseHeaders.getSetCookie === "function"
        ? responseHeaders.getSetCookie()
        : [];

  if (setCookies.length > 0) {
    for (const value of setCookies) {
      target.append("set-cookie", value);
    }
    return;
  }

  const fallback = source.headers.get("set-cookie");
  if (fallback) {
    target.append("set-cookie", fallback);
  }
}

function proxyResponse(source: Response, headers?: Headers): Response {
  const nextHeaders = headers ? new Headers(headers) : new Headers(source.headers);
  nextHeaders.delete("x-session-bridge");
  nextHeaders.delete("x-proxy-set-cookies");
  copySetCookieHeaders(source, nextHeaders);
  return new Response(source.body, {
    status: source.status,
    statusText: source.statusText,
    headers: nextHeaders,
  });
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const isMediaRequest = request.method === "GET" && url.pathname === "/api/media";

    if (url.pathname === "/robots.txt" || url.pathname === "/sitemap.xml") {
      const backendUrl = new URL(request.url);
      backendUrl.hostname = "nixyah.onrender.com";
      backendUrl.protocol = "https:";
      const backendResponse = await fetch(backendUrl.toString(), {
        method: request.method,
        headers: request.headers,
        redirect: "manual",
        cf: { cacheTtl: 3600, cacheEverything: false },
      });
      return proxyResponse(backendResponse);
    }

    // Proxy API calls to the backend instead of redirecting the browser.
    // This keeps `/api/*` same-origin from the browser's point of view,
    // which avoids CORS issues and lets session cookies work reliably.
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const target = new URL(request.url);
      target.hostname = "nixyah.onrender.com";
      target.protocol = "https:";
      const headers = new Headers(request.headers);
      headers.set("x-forwarded-host", url.host);
      headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
      headers.set("x-forwarded-port", url.port || (url.protocol === "https:" ? "443" : "80"));

      const backendResponse = await fetch(target.toString(), {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
        cf: isMediaRequest ? { cacheTtl: 300, cacheEverything: false } : { cacheTtl: 0, cacheEverything: false },
      });

      const location = backendResponse.headers.get("location");
      if (!location) {
        if (isMediaRequest) {
          const mediaHeaders = new Headers(backendResponse.headers);
          mediaHeaders.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
          return proxyResponse(backendResponse, mediaHeaders);
        }
        return proxyResponse(backendResponse);
      }

      let parsedLocation: URL;
      try {
        parsedLocation = new URL(location, target);
      } catch {
        return proxyResponse(backendResponse);
      }

      const shouldRewriteLocation =
        parsedLocation.hostname === "localhost" ||
        parsedLocation.hostname === "127.0.0.1" ||
        parsedLocation.hostname === target.hostname;

      if (!shouldRewriteLocation) return proxyResponse(backendResponse);

      const rewrittenLocation = new URL(parsedLocation.pathname + parsedLocation.search + parsedLocation.hash, url.origin);
      const rewrittenHeaders = new Headers(backendResponse.headers);
      rewrittenHeaders.set("location", rewrittenLocation.toString());
      if (isMediaRequest) {
        rewrittenHeaders.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
      }

      return proxyResponse(backendResponse, rewrittenHeaders);
    }

    // First try to serve the static asset (if binding is available).
    if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response("ASSETS binding is not configured on this Worker.", { status: 500 });
    }

    let response = await env.ASSETS.fetch(request);

    // SPA fallback: if the asset is not found and the client expects HTML,
    // serve index.html so that the React router (wouter) handles the route.
    if (response.status === 404) {
      const accept = request.headers.get("Accept") || "";
      if (accept.includes("text/html")) {
        url.pathname = "/";
        response = await env.ASSETS.fetch(url.toString());
      }
    }

    // Cache control: never cache HTML (prevents old index.html referencing old bundles).
    const accept = request.headers.get("Accept") || "";
    const isHtml = accept.includes("text/html") || url.pathname.endsWith(".html") || url.pathname === "/";
    if (isHtml) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");
      if (isNoIndexPath(url.pathname)) {
        headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      }
      const html = injectSeoIntoHtml(await response.text(), url.pathname, url.origin);
      response = new Response(html, { ...response, headers });
    } else {
      const headers = new Headers(response.headers);
      if (url.pathname.startsWith("/assets/")) {
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
      } else if (/\.(png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|otf|json)$/i.test(url.pathname)) {
        headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      }
      response = new Response(response.body, { ...response, headers });
    }

    return response;
  },
};


