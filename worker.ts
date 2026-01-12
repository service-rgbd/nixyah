export default {
  async fetch(request: Request, env: any): Promise<Response> {
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
        const url = new URL(request.url);
        url.pathname = "/";
        response = await env.ASSETS.fetch(url.toString());
      }
    }

    return response;
  },
};


