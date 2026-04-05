import rateLimit from "express-rate-limit";
import type { Request } from "express";
import type { AuthRequest } from "../middlewares/auth.js";

function resolveRateLimitKey(req: Request) {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  if (typeof userId === "number" && Number.isInteger(userId) && userId > 0) {
    return `user:${userId}`;
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0];
  const ip = forwardedIp?.trim() || req.ip || "unknown";
  return `ip:${ip}`;
}

type RateLimitKeyGenerator = (req: Request, baseKey: string) => string;

export function buildApiRateLimiter({
  windowMs,
  max,
  message,
  keyGenerator,
}: {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: RateLimitKeyGenerator;
}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator(req) {
      const baseKey = resolveRateLimitKey(req);
      return keyGenerator ? keyGenerator(req, baseKey) : baseKey;
    },
    message: {
      error: "TooManyRequests",
      message,
    },
  });
}