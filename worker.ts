export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    // Redirect API calls to the backend API host.
    // Proxy them instead of redirecting so the browser stays same-origin and avoids CORS.
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const target = new URL(request.url);
      target.hostname = "nixyah.onrender.com";
      target.protocol = "https:";
      const headers = new Headers(request.headers);
      headers.set("x-forwarded-host", url.host);
      headers.set("x-forwarded-proto", url.protocol.replace(/:$/, ""));
      return fetch(new Request(target.toString(), {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
      }));
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
      response = new Response(response.body, { ...response, headers });
    }

    return response;
  },
};


