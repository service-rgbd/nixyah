import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

declare module "express-session" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface SessionData {
    userId?: string;
    profileId?: string;
  }
}

const MemoryStore = createMemoryStore(session);
const PgStore = connectPgSimple(session);

let pgPool: pg.Pool | null = null;
let store: session.Store | null = null;

export function sessionMiddleware() {
  const secret = process.env.SECRET_TOKEN || process.env.SESSION_SECRET || "dev-secret";
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && secret === "dev-secret") {
    throw new Error("Missing SECRET_TOKEN (or SESSION_SECRET) in production.");
  }

  // Prefer a persistent Postgres-backed store so sessions survive server restarts.
  // Falls back to MemoryStore if DATABASE_URL is not configured.
  if (!store) {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      pgPool = new pg.Pool({ connectionString, max: 10 });
      store = new PgStore({
        pool: pgPool,
        tableName: "user_sessions",
        createTableIfMissing: true,
      });
    } else {
      store = new MemoryStore({
        checkPeriod: 24 * 60 * 60 * 1000, // prune expired entries every 24h
      });
    }
  }

  // When frontend and API are on different origins (e.g. nixyah.com vs api.nixyah.com),
  // cookies can be rejected or not sent depending on SameSite/Domain rules and browser policies.
  // We default to a robust production setup:
  // - SameSite=None (allows credentialed cross-origin XHR)
  // - Secure=true (required by browsers when SameSite=None)
  // - Domain=.nixyah.com (share cookie across subdomains) derived from APP_BASE_URL when possible.
  const sameSite =
    (process.env.SESSION_COOKIE_SAMESITE as any) || (isProd ? "none" : "lax");

  let derivedDomain: string | undefined = undefined;
  try {
    const raw = String(process.env.APP_BASE_URL || "").trim();
    if (raw) {
      const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const host = new URL(withScheme).hostname.replace(/^www\./i, "");
      if (host && host.includes(".") && host !== "localhost" && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        derivedDomain = `.${host}`;
      }
    }
  } catch {
    // ignore
  }

  const cookieDomain =
    (process.env.SESSION_COOKIE_DOMAIN || "").trim() ||
    (isProd ? derivedDomain : undefined);

  return session({
    store,
    secret,
    resave: false,
    saveUninitialized: false,
    proxy: isProd,
    cookie: {
      httpOnly: true,
      sameSite,
      secure: isProd,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  });
}



