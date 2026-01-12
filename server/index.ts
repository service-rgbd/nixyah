import "dotenv/config";
import express, { type Request, type RequestHandler, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { getEnv } from "./env";
import { sessionMiddleware } from "./session";

const app = express();
const httpServer = createServer(app);
const env = getEnv();
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  // Render/Cloudflare sit behind proxies (needed for secure cookies + correct client IP)
  app.set("trust proxy", 1);
}

// Support common env var naming used in some .env files
if (!process.env.DATABASE_URL && process.env.database_url) {
  process.env.DATABASE_URL = process.env.database_url;
}

// Parse env early (prints clearer errors if env values are malformed)
// (already done above)

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Basic security headers (disable CSP here because Vite/Cloudflare pages handle frontend)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  }),
);

// CORS (needed when frontend is on Cloudflare Pages and API is on Render)
const allowedOrigins = new Set<string>();
if (env.APP_BASE_URL) allowedOrigins.add(env.APP_BASE_URL.replace(/\/+$/, ""));
if (env.CORS_ORIGINS) {
  for (const o of env.CORS_ORIGINS.split(",")) {
    const v = o.trim();
    if (v) allowedOrigins.add(v.replace(/\/+$/, ""));
  }
}
app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      // same-origin / server-to-server requests (no Origin header)
      if (!origin) return cb(null, true);
      const normalized = origin.replace(/\/+$/, "");
      if (allowedOrigins.size === 0) {
        // Default: lock down in production, allow in dev for local testing
        return cb(null, !isProd);
      }
      return cb(null, allowedOrigins.has(normalized));
    },
  }),
);

// Rate limits (basic anti-abuse)
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }) as unknown as RequestHandler,
);
app.use(
  ["/api/login", "/api/signup", "/api/password/forgot", "/api/password/reset"],
  rateLimit({
    windowMs: 15 * 60_000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
  }) as unknown as RequestHandler,
);
app.use(
  ["/api/uploads/presign", "/api/uploads/direct", "/api/event-rsvp"],
  rateLimit({
    windowMs: 15 * 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  }) as unknown as RequestHandler,
);

// Extra hardening for upload endpoints (larger payloads, higher abuse potential)
app.use(
  ["/api/uploads/direct", "/api/uploads/presign"],
  rateLimit({
    windowMs: 10 * 60_000,
    max: 12,
    standardHeaders: true,
    legacyHeaders: false,
  }) as unknown as RequestHandler,
);

// Sessions (used to ensure one profile per user/session + logout)
app.use(sessionMiddleware());

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && !isProd) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // Do not crash the dev server on request errors.
    // In production, you may want to log/monitor these errors.
    log(String(message), "error");
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  // `reusePort` is not supported on Windows (can throw ENOTSUP).
  const listenOptions: Parameters<typeof httpServer.listen>[0] = {
      port,
    host: process.env.HOST || "0.0.0.0",
    ...(process.platform === "win32" ? {} : { reusePort: true }),
  };

  httpServer.listen(listenOptions, () => {
      log(`serving on port ${port}`);
  });
})();
