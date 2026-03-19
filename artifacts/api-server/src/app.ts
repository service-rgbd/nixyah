import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";

const app: Express = express();

function getAllowedOrigins(): string[] {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.EXPO_PUBLIC_APP_URL,
    process.env.EXPO_PUBLIC_WEB_URL,
    ...(process.env.CORS_ORIGINS?.split(",") ?? []),
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin));

  const defaults = [
    "http://localhost:19006",
    "http://localhost:8081",
    "http://127.0.0.1:19006",
    "http://127.0.0.1:8081",
  ];

  return Array.from(new Set([...defaults, ...configuredOrigins]));
}

const allowedOrigins = getAllowedOrigins();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
        /^https?:\/\/192\.168\.\d+\.\d+(?::\d+)?$/i.test(origin) ||
        /^https?:\/\/10\.\d+\.\d+\.\d+(?::\d+)?$/i.test(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Global rate limiter (lenient)
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use(globalLimiter as any);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply a stricter limiter for auth routes (prevent brute-force)
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 6, standardHeaders: true, legacyHeaders: false, message: { error: "TooManyRequests", message: "Trop de requêtes, réessayez plus tard" } });
app.use("/api/auth", authLimiter as any);

app.use("/api", router);

export default app;
