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

  // When frontend is on a different site (nixyah.com) than the API (api.nixyah.com),
  // cookies must be SameSite=None to be sent with cross-site fetch() + credentials: "include".
  const sameSite =
    (process.env.SESSION_COOKIE_SAMESITE as any) || (isProd ? "none" : "lax");

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
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  });
}



