import type { Express } from "express";
import { type Server } from "http";
import { z } from "zod";
import { db } from "./db";
import { hashOpaqueToken, hashPassword, verifyPassword } from "./auth";
import {
  annonceCreateSchema,
  eventCreateSchema,
  eventRegistrationCreateSchema,
  eventRegistrations,
  events,
  eventUpdateSchema,
  profiles,
  profileMedia,
  signupSchema,
  storyCreateSchema,
  stories,
  users,
  annonces,
  salons,
  adultProductsTable,
  insertSalonSchema,
  insertAdultProductSchema,
  ipLogs,
  ipBans,
  payments,
  tokenTransactions,
} from "@shared/schema";
import { PUBLISHING_CONFIG } from "@shared/publishing-config";
import {
  STORY_FREE_STORY_LIMIT,
  STORY_PRIVATE_MAX_SECONDS,
  STORY_PUBLIC_MAX_SECONDS,
  STORY_PUBLIC_TTL_HOURS,
  STORY_PUBLISH_TOKEN_COST,
} from "@shared/story-config";
import { and, desc, eq, inArray, or, sql, gt, isNull } from "drizzle-orm";
import { createPresignedRead, createPresignedUpload, hasObjectInR2 } from "./uploads";
import { uploadBufferToR2 } from "./uploads";
import multer from "multer";
import {
  hasAnnoncesPromotionColumn,
  hasAnnoncesTable,
  hasProfilesAccountTypeColumn,
  hasProfilesAttributesColumns,
  hasProfilesBusinessColumns,
  hasProfilesContactFields,
  hasProfilesContactPreferenceColumn,
  hasProfilesGeoFields,
  hasProfileMediaTable,
  hasProfilesProFields,
  hasProfilesShowLocationColumn,
  hasStoriesTable,
  hasProfilesVisibilityColumn,
  hasSalonsTable,
  hasProfilesVipColumn,
  hasUsersEmailColumn,
  hasUsersEmailVerificationColumns,
  hasEventsVideoUrlColumn,
} from "./db-capabilities";
import { getEnv } from "./env";
import { Resend } from "resend";
import crypto from "crypto";
import {
  getPaystackAmountForPackage,
  TOKEN_PACKAGES,
  findTokenPackage,
  getDefaultPaymentProvider,
  getEnabledPaymentProviders,
  getPaystackSecretKey,
  type PaymentProvider,
  toPaystackAmount,
} from "./payments";
import { getOrSet, invalidateTag, peek } from "./cache";

function isPlaceholderUrl(url: string | null | undefined) {
  if (!url) return false;
  return url.startsWith("https://via.placeholder.com/");
}

function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (isPlaceholderUrl(url)) return null;
  return url;
}

function sanitizeUrls(urls: string[] | null | undefined): string[] {
  return (urls ?? []).map((u) => sanitizeUrl(u)).filter((u): u is string => Boolean(u));
}

function inferKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const key = u.pathname.replace(/^\/+/, "");
    return key.length ? key : null;
  } catch {
    return null;
  }
}

function parseBoolQuery(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  const s = Array.isArray(v) ? String(v[0]) : String(v);
  if (s === "1" || s === "true") return true;
  if (s === "0" || s === "false") return false;
  return undefined;
}

function parseServicesQuery(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : v === undefined ? [] : [v];
  const parts: string[] = [];
  for (const item of raw) {
    const s = String(item ?? "").trim();
    if (!s) continue;
    // Support comma-separated list
    for (const p of s.split(",")) {
      const t = p.trim();
      if (t) parts.push(t);
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    if (p.length > 80) continue;
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.slice(0, 20);
}

function sqlTextArray(values: string[]) {
  return sql`ARRAY[${sql.join(values.map((v) => sql`${v}`), sql`, `)}]::text[]`;
}

function hoursToMs(h: number): number {
  return h * 60 * 60 * 1000;
}
function daysToMs(d: number): number {
  return d * 24 * 60 * 60 * 1000;
}

function computePromotionMeta(opts: {
  annonceCreatedAt: Date;
  promotion: any | null | undefined;
}): {
  badges: Array<"VIP" | "PREMIUM" | "TOP" | "URGENT" | "PROLONGATION">;
  expiresAt: string | null;
  remainingDays: number | null;
  topLastBumpAt: string | null;
  topEveryHours: number | null;
  featuredActive: boolean;
  urgentActive: boolean;
  topActive: boolean;
} {
  const createdAtMs = new Date(opts.annonceCreatedAt).getTime();
  const nowMs = Date.now();
  const promo = opts.promotion ?? {};
  const badges: Array<"VIP" | "PREMIUM" | "TOP" | "URGENT" | "PROLONGATION"> = [];

  const promoteCfg = PUBLISHING_CONFIG.promote;
  const find = (arr: any[], id: number) =>
    Array.isArray(arr) ? arr.find((o) => Number(o.id) === Number(id)) : undefined;

  const durations: number[] = [];

  // Extended prolongation (duration)
  if (promo.extended?.optionId) {
    const opt = find(promoteCfg.extended.options as any, Number(promo.extended.optionId));
    if (opt?.days) {
      badges.push("PROLONGATION");
      durations.push(Number(opt.days));
    }
  }

  // Featured premium (visibility)
  let featuredActive = false;
  if (promo.featured?.optionId) {
    const opt = find(promoteCfg.featured.options as any, Number(promo.featured.optionId));
    if (opt?.days) {
      const end = createdAtMs + daysToMs(Number(opt.days));
      if (nowMs <= end) {
        featuredActive = true;
        badges.push("PREMIUM");
      }
      durations.push(Number(opt.days));
    }
  }

  // Autoreneew top (boost)
  let topActive = false;
  let topLastBumpAt: string | null = null;
  let topEveryHours: number | null = null;
  if (promo.autorenew?.optionId) {
    const opt = find(promoteCfg.autorenew.options as any, Number(promo.autorenew.optionId));
    if (opt?.days && opt?.everyHours) {
      const days = Number(opt.days);
      const everyHours = Number(opt.everyHours);
      topEveryHours = everyHours;
      const end = createdAtMs + daysToMs(days);
      durations.push(days);
      if (nowMs <= end) {
        topActive = true;
        badges.push("TOP");
        const cappedNow = Math.min(nowMs, end);
        const elapsedHours = Math.max(0, (cappedNow - createdAtMs) / hoursToMs(1));
        const bumps = Math.floor(elapsedHours / Math.max(1, everyHours));
        const bumpAtMs = createdAtMs + bumps * hoursToMs(Math.max(1, everyHours));
        topLastBumpAt = new Date(bumpAtMs).toISOString();
      }
    }
  }

  // Urgent
  let urgentActive = false;
  if (promo.urgent?.optionId) {
    const opt = find(promoteCfg.urgent.options as any, Number(promo.urgent.optionId));
    if (opt?.days) {
      const end = createdAtMs + daysToMs(Number(opt.days));
      if (nowMs <= end) {
        urgentActive = true;
        badges.push("URGENT");
      }
      durations.push(Number(opt.days));
    }
  }

  // Expiry = max of durations (simple, consistent with dashboard estimate)
  const maxDays = durations.length ? Math.max(...durations) : null;
  const expiresAt = maxDays ? new Date(createdAtMs + daysToMs(maxDays)).toISOString() : null;
  const remainingDays =
    expiresAt === null ? null : Math.ceil((new Date(expiresAt).getTime() - nowMs) / daysToMs(1));

  return {
    badges,
    expiresAt,
    remainingDays,
    topLastBumpAt,
    topEveryHours,
    featuredActive,
    urgentActive,
    topActive,
  };
}

const PROFILES_CACHE_TTL_MS = 30 * 1000;
const PROFILES_CACHE_TAG = "profiles:list";
const ANNONCES_CACHE_TTL_MS = 5 * 60 * 1000;
const ANNONCES_CACHE_TAG = "annonces:list";

function invalidateProfilesCache() {
  invalidateTag(PROFILES_CACHE_TAG);
}

function invalidateAnnoncesCache() {
  invalidateTag(ANNONCES_CACHE_TAG);
}

function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>,
): (req: any, res: any, next: any) => void {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      if (err?.name === "ZodError") {
        const firstMessage =
          Array.isArray(err?.errors) && typeof err.errors[0]?.message === "string"
            ? err.errors[0].message
            : "Invalid request";
        return res.status(400).json({ message: firstMessage, details: err.errors });
      }
      next(err);
    });
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // All API routes are prefixed with /api
  const hasContactPref = await hasProfilesContactPreferenceColumn();
  const hasVip = await hasProfilesVipColumn();
  const hasUsersEmail = await hasUsersEmailColumn();
  const hasProfileAttrs = await hasProfilesAttributesColumns();
  const hasUsersEmailVerified = await hasUsersEmailVerificationColumns();
  const hasProfilesBusiness = await hasProfilesBusinessColumns();
  const hasAccountType = await hasProfilesAccountTypeColumn();
  const hasProfilesPro = await hasProfilesProFields();
  const hasProfilesVisibility = await hasProfilesVisibilityColumn();
  const hasProfilesContact = await hasProfilesContactFields();
  const hasProfilesGeo = await hasProfilesGeoFields();
  const hasProfilesShowLocation = await hasProfilesShowLocationColumn();
  const hasSalons = await hasSalonsTable();
  const hasProfileMedia = await hasProfileMediaTable();
  const hasAnnonces = await hasAnnoncesTable();
  const hasAnnoncesPromotion = await hasAnnoncesPromotionColumn();
  const hasStories = await hasStoriesTable();
  const hasEventsVideoUrl = await hasEventsVideoUrlColumn();
  const env = getEnv();

  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  const resendFrom = env.RESEND_FROM ?? "NIXYAH <no-reply@nixyah.com>";

  const googleClientId = (env as any).GOOGLE_CLIENT_ID as string | undefined;
  const googleClientSecret = (env as any).GOOGLE_CLIENT_SECRET as string | undefined;
  const googleRedirectUri = (env as any).GOOGLE_REDIRECT_URI as string | undefined;

  function isLocalFrontend(input: string): boolean {
    try {
      const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
      const host = new URL(withScheme).hostname.toLowerCase();
      return host === "localhost" || host === "127.0.0.1";
    } catch {
      return false;
    }
  }

  function normalizeFrontendBase(input: string): string {
    const fallback = process.env.NODE_ENV === "production" ? "https://www.nixyah.com" : "http://localhost:5000";
    const base = String(input || "").trim() || fallback;
    const withScheme = /^https?:\/\//i.test(base) ? base : `https://${base}`;
    const clean = withScheme.replace(/\/+$/, "");
    // Safety: if someone mistakenly sets APP_BASE_URL to the API host, convert api.* -> root.
    // Example: https://api.example.com -> https://example.com
    return clean.replace(/^https?:\/\/api\./i, (m) => m.replace(/api\./i, ""));
  }

  function frontendBaseFromRequest(req: any): string | undefined {
    const origin = String(req.get?.("origin") ?? "")
      .split(",")[0]
      .trim();
    if (origin && !isLocalFrontend(origin)) {
      return normalizeFrontendBase(origin);
    }

    const forwardedProto = String(req.get?.("x-forwarded-proto") ?? "")
      .split(",")[0]
      .trim() || "https";
    const forwardedHost = String(req.get?.("x-forwarded-host") ?? "")
      .split(",")[0]
      .trim();
    if (forwardedHost && !/\.onrender\.com$/i.test(forwardedHost) && !isLocalFrontend(`${forwardedProto}://${forwardedHost}`)) {
      return normalizeFrontendBase(`${forwardedProto}://${forwardedHost}`);
    }

    const host = String(req.get?.("host") ?? "").trim();
    if (host && !/\.onrender\.com$/i.test(host) && !isLocalFrontend(`${forwardedProto}://${host}`)) {
      return normalizeFrontendBase(`${forwardedProto}://${host}`);
    }

    return undefined;
  }

  function extractOrigin(value: string | undefined | null): string | null {
    const raw = String(value ?? "")
      .split(",")[0]
      .trim();
    if (!raw) return null;
    try {
      return new URL(raw).origin.replace(/\/+$/, "");
    } catch {
      return null;
    }
  }

  function allowedCsrfOrigins(req: any): Set<string> {
    const origins = new Set<string>(["http://localhost:5000", "http://127.0.0.1:5000"]);

    const envOrigins = [env.APP_BASE_URL, ...(env.CORS_ORIGINS ? env.CORS_ORIGINS.split(",") : [])];
    for (const value of envOrigins) {
      const origin = extractOrigin(value);
      if (origin) origins.add(origin);
    }

    const derivedOrigin = extractOrigin(frontendBaseFromRequest(req));
    if (derivedOrigin) origins.add(derivedOrigin);

    return origins;
  }

  function hasTrustedCsrfOrigin(req: any): boolean {
    const requestOrigin = extractOrigin(req.get?.("origin")) || extractOrigin(req.get?.("referer"));
    if (!requestOrigin) return false;
    return allowedCsrfOrigins(req).has(requestOrigin);
  }

  function appUrl(path: string, req?: any): string {
    let base = String(env.APP_BASE_URL || "").trim();
    if ((!base || isLocalFrontend(base)) && req) {
      base = frontendBaseFromRequest(req) || base;
    }
    const normalizedBase = normalizeFrontendBase(base);
    const finalBase = process.env.NODE_ENV === "production" && isLocalFrontend(normalizedBase)
      ? "https://www.nixyah.com"
      : normalizedBase;
    return `${finalBase}${path.startsWith("/") ? path : `/${path}`}`;
  }

  function getDefaultProfilePhotoUrl(
    accountType: "profile" | "residence" | "salon" | "adult_shop",
    req?: any,
  ): string | undefined {
    if (accountType === "residence") {
      return appUrl("/default-avatars/residence.png", req);
    }
    if (accountType === "salon") {
      return appUrl("/default-avatars/salon.png", req);
    }
    if (accountType === "adult_shop") {
      return appUrl("/default-avatars/adult-shop.png", req);
    }
    return undefined;
  }

  function apiBaseUrl(req: any): string {
    const forwardedProto = String(req.get?.("x-forwarded-proto") ?? "")
      .split(",")[0]
      .trim();
    const forwardedHost = String(req.get?.("x-forwarded-host") ?? "")
      .split(",")[0]
      .trim();
    const host = forwardedHost || String(req.get?.("host") ?? "").trim();
    const protocol = forwardedProto || String(req.protocol || "").trim() || "https";
    if (host) return `${protocol}://${host.replace(/\/+$/, "")}`;
    return normalizeFrontendBase(env.APP_BASE_URL || "http://localhost:5000");
  }

  function apiUrl(req: any, path: string): string {
    const base = apiBaseUrl(req);
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }

  function mediaUrl(req: any, params: { key?: string | null; sourceUrl?: string | null }): string | null {
    const sourceUrl = sanitizeUrl(params.sourceUrl ?? null);
    const key = String(params.key ?? "").trim();
    if (!key && !sourceUrl) return null;
    const searchParams = new URLSearchParams();
    if (key) searchParams.set("key", key);
    if (sourceUrl) searchParams.set("fallbackUrl", sourceUrl);
    return apiUrl(req, `/api/media?${searchParams.toString()}`);
  }

  function resolveStoryMedia(req: any, row: { mediaUrl?: string | null; mediaKey?: string | null }): string | null {
    return mediaUrl(req, {
      key: row.mediaKey ?? inferKeyFromUrl(sanitizeUrl(row.mediaUrl ?? null)),
      sourceUrl: sanitizeUrl(row.mediaUrl ?? null),
    });
  }

  function getLegacyDerivedCookieDomain(): string | undefined {
    try {
      const raw = String(env.APP_BASE_URL || "").trim();
      if (!raw) return undefined;
      const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const host = new URL(withScheme).hostname.replace(/^www\./i, "");
      if (!host || host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return undefined;
      if (!host.includes(".")) return undefined;
      return `.${host}`;
    } catch {
      return undefined;
    }
  }

  function getConfiguredCookieDomain(): string | undefined {
    const domain = String(process.env.SESSION_COOKIE_DOMAIN || "").trim();
    return domain || undefined;
  }

  function saveSession(req: any): Promise<void> {
    return new Promise((resolve) => {
      if (!req.session) return resolve();
      req.session.save(() => resolve());
    });
  }

  function regenerateSession(req: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!req.session) return resolve();
      req.session.regenerate((err: unknown) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  function getSessionCookieOptions(domain?: string) {
    const isProd = process.env.NODE_ENV === "production";
    const sameSite = ((process.env.SESSION_COOKIE_SAMESITE as any) || (isProd ? "none" : "lax")) as
      | "lax"
      | "strict"
      | "none";

    return {
      path: "/",
      httpOnly: true,
      sameSite,
      secure: isProd,
      ...(domain ? { domain } : {}),
    };
  }

  const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const SESSION_TOKEN_TTL_MS = SESSION_COOKIE_MAX_AGE_MS;

  function getSessionSecret(): string {
    return process.env.SECRET_TOKEN || process.env.SESSION_SECRET || "dev-secret";
  }

  function formatSameSite(value: "lax" | "strict" | "none"): string {
    if (value === "none") return "None";
    if (value === "strict") return "Strict";
    return "Lax";
  }

  function buildSessionCookieString(sessionId: string, domain?: string): string {
    const options = getSessionCookieOptions(domain);
    const signature = crypto
      .createHmac("sha256", getSessionSecret())
      .update(sessionId)
      .digest("base64")
      .replace(/=+$/g, "");
    const value = encodeURIComponent(`s:${sessionId}.${signature}`);
    const expires = new Date(Date.now() + SESSION_COOKIE_MAX_AGE_MS).toUTCString();

    return [
      `connect.sid=${value}`,
      "Path=/",
      `Expires=${expires}`,
      "HttpOnly",
      options.secure ? "Secure" : "",
      `SameSite=${formatSameSite(options.sameSite)}`,
      options.domain ? `Domain=${options.domain}` : "",
    ]
      .filter(Boolean)
      .join("; ");
  }

  function buildClearedSessionCookieString(domain?: string): string {
    const options = getSessionCookieOptions(domain);
    return [
      "connect.sid=",
      "Path=/",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "Max-Age=0",
      "HttpOnly",
      options.secure ? "Secure" : "",
      `SameSite=${formatSameSite(options.sameSite)}`,
      options.domain ? `Domain=${options.domain}` : "",
    ]
      .filter(Boolean)
      .join("; ");
  }

  function mirrorSetCookies(res: any, cookieStrings: string[]) {
    if (cookieStrings.length === 0) return;
    res.setHeader("x-session-bridge", Buffer.from(JSON.stringify(cookieStrings), "utf8").toString("base64"));
  }

  function mirrorSessionCookie(res: any, sessionId: string) {
    const configuredDomain = getConfiguredCookieDomain();
    mirrorSetCookies(res, [buildSessionCookieString(sessionId, configuredDomain)]);
  }

  function createSessionToken(auth: { userId: string; profileId: string }): string {
    const payload = Buffer.from(
      JSON.stringify({
        userId: auth.userId,
        profileId: auth.profileId,
        exp: Date.now() + SESSION_TOKEN_TTL_MS,
      }),
      "utf8",
    ).toString("base64url");
    const signature = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }

  function readSessionToken(token: string | null | undefined): { userId: string; profileId: string } | null {
    const raw = String(token ?? "").trim();
    if (!raw) return null;
    const [payload, signature] = raw.split(".");
    if (!payload || !signature) return null;
    const expected = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      return null;
    }
    try {
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
        userId?: string;
        profileId?: string;
        exp?: number;
      };
      if (!decoded?.userId || !decoded?.profileId || !decoded?.exp) return null;
      if (Number(decoded.exp) <= Date.now()) return null;
      return { userId: String(decoded.userId), profileId: String(decoded.profileId) };
    } catch {
      return null;
    }
  }

  function csrfTokenFromSessionToken(token: string): string {
    return crypto.createHmac("sha256", getSessionSecret()).update(`csrf:${token}`).digest("hex");
  }

  function clearSessionCookie(res: any) {
    const configuredDomain = getConfiguredCookieDomain();
    const legacyDomain = getLegacyDerivedCookieDomain();

    res.clearCookie("connect.sid", getSessionCookieOptions());
    if (configuredDomain) {
      res.clearCookie("connect.sid", getSessionCookieOptions(configuredDomain));
    }
    if (legacyDomain && legacyDomain !== configuredDomain) {
      res.clearCookie("connect.sid", getSessionCookieOptions(legacyDomain));
    }
    res.clearCookie("connect.sid", { path: "/" });
    mirrorSetCookies(
      res,
      [
        buildClearedSessionCookieString(),
        ...(configuredDomain ? [buildClearedSessionCookieString(configuredDomain)] : []),
        ...(legacyDomain && legacyDomain !== configuredDomain ? [buildClearedSessionCookieString(legacyDomain)] : []),
      ],
    );
  }

  async function establishAuthenticatedSession(
    req: any,
    res: any,
    auth: { userId: string; profileId: string },
  ) {
    clearSessionCookie(res);
    await regenerateSession(req);
    req.session.userId = auth.userId;
    req.session.profileId = auth.profileId;
    req.session.csrfToken = generateToken();
    await saveSession(req);
    if (req.sessionID) {
      mirrorSessionCookie(res, String(req.sessionID));
    }
  }

  function ensureCsrfToken(req: any): string {
    if (!req.session?.csrfToken) {
      req.session.csrfToken = generateToken();
    }
    return String(req.session.csrfToken);
  }

  function isCsrfExemptPath(path: string): boolean {
    return [
      "/api/login",
      "/api/signup",
      "/api/password/forgot",
      "/api/password/reset",
      "/api/payments/paystack/webhook",
    ].includes(path);
  }

  async function redirectAfterSessionSave(req: any, res: any, url: string): Promise<void> {
    await saveSession(req);
    res.redirect(url);
  }

  app.use((req, _res, next) => {
    if (req.session?.userId && req.session?.profileId) return next();
    const token = String(req.get?.("x-session-token") ?? "").trim();
    const auth = readSessionToken(token);
    if (!auth || !req.session) return next();
    req.session.userId = auth.userId;
    req.session.profileId = auth.profileId;
    req.session.csrfToken = csrfTokenFromSessionToken(token);
    next();
  });

  async function requireTurnstile(req: any, res: any, token: unknown): Promise<boolean> {
    const secret = (env as any).TURNSTILE_SECRET_KEY as string | undefined;
    if (!secret) return true; // disabled / not configured

    const t = typeof token === "string" ? token.trim() : "";
    if (!t) {
      res.status(400).json({ message: "Validation anti-bot requise (Turnstile)." });
      return false;
    }

    try {
      const ip = getClientIp(req);
      const body = new URLSearchParams({ secret, response: t });
      if (ip) body.set("remoteip", ip);

      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });

      const json = (await verifyRes.json().catch(() => null)) as
        | { success?: boolean; "error-codes"?: string[] }
        | null;

      if (!json?.success) {
        await logIpEvent({ req, kind: "turnstile_failed" });
        res.status(400).json({
          message: "Validation anti-bot échouée. Réessaie.",
          codes: Array.isArray((json as any)?.["error-codes"]) ? (json as any)["error-codes"] : undefined,
        });
        return false;
      }

      return true;
    } catch (e) {
      console.error("Turnstile verify failed", e);
      res.status(502).json({ message: "Validation anti-bot indisponible. Réessaie." });
      return false;
    }
  }

  function sanitizeOAuthState(input: string | null | undefined): string {
    const raw = String(input ?? "").trim();
    if (!raw) return "/dashboard";
    // Only allow relative paths. Reject full URLs or host-like inputs.
    if (raw.includes("://") || raw.includes(" ")) return "/dashboard";
    // Common mistake: passing "nixyah.com/dashboard" (no leading slash)
    if (/^[a-z0-9.-]+\.[a-z]{2,}\/?/i.test(raw)) return "/dashboard";
    const s = raw.startsWith("/") ? raw : `/${raw}`;
    // Prevent open redirects / odd paths.
    if (!s.startsWith("/")) return "/dashboard";
    // Allow only a small set of destinations we actually handle.
    if (s.startsWith("/signup")) return "/signup?oauth=google";
    if (s.startsWith("/dashboard")) return "/dashboard";
    if (s.startsWith("/annonce")) return "/dashboard";
    if (s.startsWith("/start")) return "/start";
    return "/dashboard";
  }

  function generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async function getPaystackTransaction(reference: string) {
    const secret = getPaystackSecretKey();
    if (!secret) throw new Error("Paystack non configuré.");

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      },
    );

    const json = (await response.json().catch(() => null)) as
      | {
          status?: boolean;
          message?: string;
          data?: {
            id?: number | string;
            reference?: string;
            status?: string;
            amount?: number;
            currency?: string;
            customer?: { email?: string | null };
            metadata?: Record<string, unknown> | null;
          };
        }
      | null;

    if (!response.ok || !json?.status || !json.data) {
      throw new Error(json?.message || "Échec de vérification Paystack.");
    }

    return json.data;
  }

  async function recordPaymentFailure(input: {
    userId: string;
    provider: Exclude<PaymentProvider, "mobile_money">;
    providerRef: string;
    status?: "failed" | "cancelled";
    rawEventId?: string | null;
    amount?: number | null;
    currency?: string | null;
    packageId?: string | null;
    reason?: string | null;
  }) {
    await db
      .insert(payments)
      .values({
        userId: input.userId,
        provider: input.provider,
        providerRef: input.providerRef,
        status: input.status ?? "failed",
        currency: input.currency ?? null,
        amount: input.amount ?? null,
        tokens: 0,
        items: {
          kind: "tokens",
          packageId: input.packageId ?? null,
          reason: input.reason ?? null,
        } as any,
        ...(input.rawEventId ? { rawEventId: input.rawEventId } : {}),
      } as any)
      .onConflictDoUpdate({
        target: [(payments as any).provider, (payments as any).providerRef],
        set: {
          status: input.status ?? "failed",
          currency: input.currency ?? null,
          amount: input.amount ?? null,
          tokens: 0,
          items: {
            kind: "tokens",
            packageId: input.packageId ?? null,
            reason: input.reason ?? null,
          } as any,
          ...(input.rawEventId ? { rawEventId: input.rawEventId } : {}),
        } as any,
      });
  }

  async function reconcileTokenPurchase(input: {
    userId: string;
    provider: Exclude<PaymentProvider, "mobile_money">;
    providerRef: string;
    pack: NonNullable<ReturnType<typeof findTokenPackage>>;
    amount: number;
    currency: string;
    rawEventId?: string | null;
    meta?: Record<string, unknown>;
  }): Promise<{ credited: boolean }> {
    return db.transaction(async (tx) => {
      const paymentValues = {
        userId: input.userId,
        provider: input.provider,
        providerRef: input.providerRef,
        status: "paid",
        currency: input.currency,
        amount: input.amount,
        tokens: input.pack.tokens,
        items: { packageId: input.pack.id, kind: "tokens", ...(input.meta ?? {}) } as any,
        paidAt: new Date(),
        ...(input.rawEventId ? { rawEventId: input.rawEventId } : {}),
      } as any;

      const inserted = await tx
        .insert(payments)
        .values(paymentValues)
        .onConflictDoNothing({ target: [(payments as any).provider, (payments as any).providerRef] })
        .returning({ id: payments.id });

      let shouldCredit = inserted.length > 0;

      if (!shouldCredit) {
        const updated = await tx
          .update(payments)
          .set(paymentValues)
          .where(
            and(
              eq((payments as any).provider, input.provider),
              eq((payments as any).providerRef, input.providerRef),
              sql`${payments.status} <> 'paid'`,
            ),
          )
          .returning({ id: payments.id });
        shouldCredit = updated.length > 0;
      }

      if (!shouldCredit) {
        return { credited: false };
      }

      await tx
        .update(users)
        .set({ tokensBalance: sql`${users.tokensBalance} + ${input.pack.tokens}` } as any)
        .where(eq(users.id, input.userId));

      await tx.insert(tokenTransactions).values({
        userId: input.userId,
        delta: input.pack.tokens,
        reason: "purchase",
        meta: {
          provider: input.provider,
          providerRef: input.providerRef,
          packageId: input.pack.id,
          ...(input.meta ?? {}),
        } as any,
      } as any);

      return { credited: true };
    });
  }

  function renderEmailLayout(opts: {
    title: string;
    intro: string;
    body?: string;
    buttonLabel?: string;
    buttonUrl?: string;
    footer?: string;
    logoUrl?: string;
  }): string {
    const logo = opts.logoUrl
      ? `
        <div style="margin:0 auto 10px auto;width:52px;height:52px;border-radius:16px;background:#fff5f6;border:1px solid #fecdd3;display:flex;align-items:center;justify-content:center;">
          <img src="${opts.logoUrl}" alt="NIXYAH" width="32" height="32" style="display:block;width:32px;height:32px;border:0;outline:none;" />
        </div>
      `
      : "";

    const button = opts.buttonLabel && opts.buttonUrl
      ? `
        <tr>
          <td style="padding: 8px 32px 0 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:0;">
              <tr>
                <td style="padding:20px 22px;border:1px solid #e5e7eb;border-radius:18px;background:#f8fafc;">
                  <div style="font-size:13px;line-height:1.6;color:#475467;margin:0 0 14px 0;">
                    Utilise le bouton ci-dessous pour continuer en toute sécurité.
                  </div>
                  <a href="${opts.buttonUrl}" target="_blank" rel="noopener"
                    style="
                      display:inline-block;
                      padding:14px 22px;
                      border-radius:14px;
                      background:#d61f45;
                      color:#ffffff;
                      font-size:14px;
                      font-weight:600;
                      text-decoration:none;
                      letter-spacing:0.01em;
                    "
                  >
                    ${opts.buttonLabel}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
      : "";

    const body = opts.body
      ? `<tr>
            <td style="padding: 0 32px 8px 32px; font-size: 15px; line-height: 1.75; color: #475467;">
              ${opts.body}
            </td>
          </tr>`
      : "";

    const footer = opts.footer
      ? `<tr>
            <td style="padding: 18px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:0;">
                <tr>
                  <td style="padding:16px 18px;border-radius:16px;background:#f8fafc;border:1px solid #e5e7eb;font-size:12px;line-height:1.7;color:#667085;">
                    ${opts.footer}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : "";

    return `
      <div style="margin:0;padding:32px 16px;background-color:#f4f6f8;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:separate;border-spacing:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding:0 0 14px 0;">
              ${logo}
              <div style="font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#111827;text-align:center;">
                NIXYAH
              </div>
              <div style="margin-top:8px;font-size:12px;line-height:1.5;color:#667085;text-align:center;">
                Notification de compte
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(17,24,39,0.05);">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:0;">
                <tr>
                  <td style="padding:28px 32px 10px 32px;">
                    <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#f3f4f6;color:#344054;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                      Acces securise
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 8px 32px;">
                    <h1 style="margin:0;font-size:28px;line-height:1.25;font-weight:700;color:#101828;">
                      ${opts.title}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 14px 32px;font-size:15px;line-height:1.75;color:#344054;">
                    ${opts.intro}
                  </td>
                </tr>
                ${body}
                ${button}
                ${footer}
                <tr>
                  <td style="padding:22px 32px 0 32px;">
                    <div style="height:1px;background:#eaecf0;"></div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 32px 30px 32px;font-size:12px;line-height:1.75;color:#667085;">
                    Message automatique. Si tu n'es pas a l'origine de cette demande, tu peux simplement ignorer cet email.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  const EVENT_PUBLISH_TOKEN_COST = 5;

  function escapeHtml(value: unknown): string {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatEventPrice(amount: number | null | undefined, currency: string | null | undefined): string {
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return "Gratuit";
    return `${Number(amount)} ${(currency || "XOF").toUpperCase()}`;
  }

  function normalizeEventImageUrls(imageUrls: string[] | null | undefined, imageUrl?: string | null): string[] {
    const values = [imageUrl ?? null, ...(imageUrls ?? [])]
      .map((value) => sanitizeUrl(value))
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(values)).slice(0, 2);
  }

  async function getCurrentEventPublisher(req: any, executor: any = db) {
    const userId = req.session?.userId as string | undefined;
    const profileId = req.session?.profileId as string | undefined;
    if (!userId || !profileId) {
      throw Object.assign(new Error("Not logged in"), { status: 401 });
    }

    const admin = await isAdmin(req);
    const [profile] = await executor
      .select({
        id: profiles.id,
        userId: profiles.userId,
        pseudo: profiles.pseudo,
        accountType: hasAccountType ? profiles.accountType : (sql<string>`'profile'` as any),
      })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);

    if (!profile) {
      throw Object.assign(new Error("Profil introuvable"), { status: 404 });
    }
    if (profile.userId !== userId) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const accountType = String((profile as any).accountType ?? "profile");
    if (!admin && accountType !== "salon" && accountType !== "residence") {
      throw Object.assign(new Error("Seuls les salons et résidences peuvent publier un évènement."), {
        status: 403,
      });
    }

    const [existingEvents] = await executor
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(eq(events.ownerProfileId, profileId))
      .limit(1);

    return {
      userId,
      profileId,
      admin,
      profile,
      accountType,
      hasFreeEventPublication: Number(existingEvents?.count ?? 0) === 0,
    };
  }

  async function sendEventRegistrationEmail(opts: {
    req?: any;
    to: string;
    eventTitle: string;
    eventDate: string;
    eventCity: string;
    guestName: string;
    priceType: "free" | "paid";
    amount?: number | null;
    currency?: string | null;
  }) {
    if (!resend) return;
    const logoUrl = appUrl("/favicon.png", opts.req);
    const price = opts.priceType === "paid" ? formatEventPrice(opts.amount, opts.currency) : "Gratuit";
    const html = renderEmailLayout({
      title: "Inscription confirmée",
      intro: `Bonjour ${escapeHtml(opts.guestName)}, ta participation à l’évènement ${escapeHtml(opts.eventTitle)} est enregistrée.`,
      body:
        `Date : <strong>${escapeHtml(opts.eventDate)}</strong><br />` +
        `Ville : <strong>${escapeHtml(opts.eventCity)}</strong><br />` +
        `Tarif : <strong>${escapeHtml(price)}</strong><br /><br />` +
        `La plateforme ne garantit pas la véracité de l’évènement. Renseigne-toi avant toute action. Aucun remboursement n’est possible après décision de participation.`,
      logoUrl,
    });

    await resend.emails.send({
      from: resendFrom,
      to: opts.to,
      subject: `Inscription – ${opts.eventTitle}`,
      html,
      text:
        `Bonjour ${opts.guestName},\n\n` +
        `Ta participation à l’évènement ${opts.eventTitle} est enregistrée.\n` +
        `Date: ${opts.eventDate}\nVille: ${opts.eventCity}\nTarif: ${price}\n\n` +
        `La plateforme ne garantit pas la véracité de l’évènement. Aucun remboursement n’est possible.\n`,
    });
  }

  async function sendEventOrganizerNotificationEmail(opts: {
    req?: any;
    organizerEmail: string;
    eventTitle: string;
    eventDate: string;
    guestName: string;
    guestEmail: string;
    guestPhone?: string | null;
    guestWhatsapp?: string | null;
  }) {
    if (!resend) return;
    const html = renderEmailLayout({
      title: "Nouvelle inscription",
      intro: `Un participant vient de s’inscrire à ${escapeHtml(opts.eventTitle)}.`,
      body:
        `Date : <strong>${escapeHtml(opts.eventDate)}</strong><br />` +
        `Nom : <strong>${escapeHtml(opts.guestName)}</strong><br />` +
        `Email : <strong>${escapeHtml(opts.guestEmail)}</strong><br />` +
        `Téléphone : <strong>${escapeHtml(opts.guestPhone || "—")}</strong><br />` +
        `WhatsApp : <strong>${escapeHtml(opts.guestWhatsapp || "—")}</strong><br />` +
        `Statut : <strong>Inscription enregistrée</strong>`,
      logoUrl: appUrl("/favicon.png", opts.req),
    });

    await resend.emails.send({
      from: resendFrom,
      to: opts.organizerEmail,
      subject: `Nouvelle inscription – ${opts.eventTitle}`,
      html,
      text:
        `Nouvelle inscription – ${opts.eventTitle}\n\n` +
        `Date: ${opts.eventDate}\nNom: ${opts.guestName}\nEmail: ${opts.guestEmail}\n` +
        `Téléphone: ${opts.guestPhone || "—"}\nWhatsApp: ${opts.guestWhatsapp || "—"}\n` +
        `Statut: Inscription enregistrée\n`,
    });
  }

  async function sendEventReminderEmails(eventId: string, req?: any): Promise<{ sent: number }> {
    if (!resend) return { sent: 0 };

    const [eventRow] = await db
      .select({
        id: events.id,
        title: events.title,
        city: events.city,
        startsAt: events.startsAt,
      })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    if (!eventRow) return { sent: 0 };

    const registrations = await db
      .select({
        guestName: eventRegistrations.guestName,
        guestEmail: eventRegistrations.guestEmail,
        notifyByEmail: eventRegistrations.notifyByEmail,
      })
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.paymentStatus, "not_required"),
        ),
      )
      .limit(500);

    let sent = 0;
    for (const registration of registrations) {
      if (!registration.notifyByEmail) continue;
      const html = renderEmailLayout({
        title: "Rappel évènement",
        intro: `Bonjour ${escapeHtml(registration.guestName)}, l’évènement ${escapeHtml(eventRow.title)} approche.`,
        body:
          `Date : <strong>${escapeHtml(new Date(eventRow.startsAt).toLocaleString("fr-FR"))}</strong><br />` +
          `Ville : <strong>${escapeHtml(eventRow.city)}</strong><br /><br />` +
          `Renseigne-toi bien avant toute action. Aucun remboursement n’est possible.`,
        logoUrl: appUrl("/favicon.png", req),
      });
      await resend.emails.send({
        from: resendFrom,
        to: registration.guestEmail,
        subject: `Rappel – ${eventRow.title}`,
        html,
        text:
          `Bonjour ${registration.guestName},\n\n` +
          `Rappel pour ${eventRow.title}\nDate: ${new Date(eventRow.startsAt).toLocaleString("fr-FR")}\n` +
          `Ville: ${eventRow.city}\n`,
      });
      sent += 1;
    }

    return { sent };
  }

  async function sendVerificationEmail(
    userId: string,
    email: string,
  ): Promise<{ sent: boolean; token?: string; messageId?: string }> {
    if (!resend) {
      console.warn("RESEND_API_KEY not configured – skipping verification email");
      return { sent: false };
    }

    const token = generateToken();
    const tokenHash = hashOpaqueToken(token);
    const sentAt = new Date();

    // Store token first so the link is valid even if the user clicks quickly.
    await db
      .update(users as any)
      .set({
        emailVerificationToken: tokenHash,
        emailVerificationSentAt: sentAt,
        emailVerified: false,
      })
      .where(eq(users.id, userId));

    const verifyLink = appUrl(`/email/verify?token=${encodeURIComponent(token)}`);
    const logoUrl = appUrl("/favicon.png");

    try {
      const html = renderEmailLayout({
        title: "Confirme ton adresse email",
        intro:
          "Ton inscription est presque terminée. Confirme simplement ton adresse email pour sécuriser ton accès et activer la suite.",
        body:
          "Clique sur le bouton ci-dessous pour valider ton email. Le lien reste disponible pendant quelques jours.",
        buttonLabel: "Confirmer l’adresse email",
        buttonUrl: verifyLink,
        logoUrl,
        footer:
          "Si le bouton ne fonctionne pas, ouvre ce lien dans ton navigateur :<br /><a href=\"${verifyLink}\" target=\"_blank\" rel=\"noopener\" style=\"color:#111827;word-break:break-all;\">${verifyLink}</a>",
      });

      const result = await resend.emails.send({
        from: resendFrom,
        to: email,
        subject: "Confirme ton adresse email",
        html,
        text: `Ton inscription est presque terminée.\n\nConfirme ton adresse email via ce lien : ${verifyLink}\n\nSi tu n'es pas à l'origine de cette demande, ignore simplement ce message.`,
      });

      return { sent: true, token, messageId: (result as any)?.id };
    } catch (e) {
      console.error("Resend failed to send verification email", {
        userId,
        email,
        from: resendFrom,
        appBaseUrl: env.APP_BASE_URL ?? null,
        error: e,
      });

      // Keep the token so we can retry with the same link if needed,
      // but clear sentAt so we don't enforce rate limits on a failed attempt.
      await db
        .update(users as any)
        .set({
          emailVerificationSentAt: null,
        })
        .where(eq(users.id, userId));

      throw e;
    }
  }

  async function sendResetPasswordEmail(userId: string, email: string) {
    if (!resend) {
      console.warn("RESEND_API_KEY not configured – skipping reset password email");
      return;
    }

    const token = generateToken();
    const tokenHash = hashOpaqueToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await db
      .update(users as any)
      .set({
        resetPasswordToken: tokenHash,
        resetPasswordExpiresAt: expiresAt,
      })
      .where(eq(users.id, userId));

    const resetLink = appUrl(`/password/reset?token=${encodeURIComponent(token)}`);
    const logoUrl = appUrl("/favicon.png");

    const html = renderEmailLayout({
      title: "Réinitialisation du mot de passe",
      intro:
        "Une demande de réinitialisation de mot de passe a été reçue pour cette adresse email.",
      body:
        "Pour définir un nouveau mot de passe, clique sur le bouton ci-dessous. Ce lien reste valable pendant <strong>1 heure</strong>.",
      buttonLabel: "Définir un nouveau mot de passe",
      buttonUrl: resetLink,
      logoUrl,
      footer:
        `Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet email.<br /><br />Lien direct : <a href="${resetLink}" target="_blank" rel="noopener" style="color:#111827;word-break:break-all;">${resetLink}</a>`,
    });

    await resend.emails.send({
      from: resendFrom,
      to: email,
      subject: "Réinitialisation du mot de passe",
      html,
      text: `Une demande de réinitialisation de mot de passe a été reçue.\n\nLien valable 1h : ${resetLink}\n\nSi tu n'es pas à l'origine de cette demande, ignore simplement ce message.`,
    });
  }

  async function isAdmin(req: any): Promise<boolean> {
    // 1) Optional token override (useful for scripts)
    const token = String(req.get?.("x-admin-token") ?? "");
    if (env.ADMIN_TOKEN && token && token === env.ADMIN_TOKEN) return true;

    // 2) Session-based admin
    const userId = req.session?.userId as string | undefined;
    if (!userId) return false;
    if (env.ADMIN_USER_ID && userId === env.ADMIN_USER_ID) return true;

    const [u] = await db
      .select({
        id: users.id,
        username: users.username,
        email: hasUsersEmail ? (users as any).email : sql<string | null>`null`,
        emailVerified: hasUsersEmailVerified ? (users as any).emailVerified : sql<boolean>`false`,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!u) return false;
    const email = (u as any).email ? String((u as any).email).toLowerCase() : null;
    const username = String(u.username).toLowerCase();

    if (env.ADMIN_USERNAME && username === env.ADMIN_USERNAME.toLowerCase()) {
      return true;
    }

    if (env.ADMIN_EMAIL) {
      const adminEmail = env.ADMIN_EMAIL.toLowerCase();
      if (email && email === adminEmail) {
        if (hasUsersEmailVerified && !(u as any).emailVerified) return false;
        return true;
      }
      if (username === adminEmail) return true;
    }

    return false;
  }

  function getClientIp(req: any): string | null {
    const xfwd = req.headers?.["x-forwarded-for"];
    if (typeof xfwd === "string" && xfwd.length > 0) {
      const first = xfwd.split(",")[0]?.trim();
      if (first) return first;
    }
    if (Array.isArray(xfwd) && xfwd[0]) {
      return String(xfwd[0]).split(",")[0]?.trim() || null;
    }
    const ip = (req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress) as
      | string
      | undefined;
    if (!ip) return null;
    // Strip IPv6 prefix if contained
    if (ip.startsWith("::ffff:")) return ip.substring(7);
    return ip;
  }

  async function isIpBanned(ip: string | null): Promise<boolean> {
    if (!ip) return false;
    const now = new Date();
    const bans = await db
      .select({
        ipPattern: ipBans.ipPattern,
        bannedUntil: ipBans.bannedUntil,
      })
      .from(ipBans)
      .where(
        or(
          eq(ipBans.ipPattern, ip),
          // simple prefix match for ranges (ex: "102.67." will match "102.67.201.1")
          sql`${ip} like (${ipBans.ipPattern} || '%')`,
        ),
      );

    for (const b of bans) {
      const until = (b as any).bannedUntil as Date | null | undefined;
      if (!until || until > now) return true;
    }
    return false;
  }

  async function ensureIpNotBanned(req: any) {
    const ip = getClientIp(req);
    if (await isIpBanned(ip)) {
      throw Object.assign(new Error("IP bannie"), { status: 403 });
    }
  }

  async function logIpEvent(opts: {
    req: any;
    kind: string;
    userId?: string | null;
    lat?: number | null;
    lng?: number | null;
    accuracy?: number | null;
    country?: string | null;
    city?: string | null;
  }) {
    const ip = getClientIp(opts.req);
    if (!ip) return;

    const userId = opts.userId ?? (opts.req.session?.userId as string | undefined) ?? null;
    const sessionId = (opts.req.sessionID as string | undefined) ?? null;
    const ua = opts.req.get?.("user-agent") ?? opts.req.headers?.["user-agent"] ?? null;

    await db.insert(ipLogs).values({
      ip,
      userId,
      sessionId,
      userAgent: ua ? String(ua) : null,
      method: String(opts.req.method ?? ""),
      path: String(opts.req.path ?? ""),
      kind: opts.kind,
      country: opts.country ?? null,
      city: opts.city ?? null,
      lat: opts.lat ?? null,
      lng: opts.lng ?? null,
      accuracy: opts.accuracy ?? null,
    } as any);
  }

  async function checkGpsMultiAccount(
    req: any,
    profileId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    // Simple bounding-box check (~30-40m radius) to detect clusters of profiles
    const delta = 0.0003;
    const others = await db
      .select({
        id: profiles.id,
        userId: profiles.userId,
      })
      .from(profiles)
      .where(
        and(
          sql`${profiles.id} <> ${profileId}`,
          sql`${profiles.lat} between ${lat - delta} and ${lat + delta}`,
          sql`${profiles.lng} between ${lng - delta} and ${lng + delta}`,
        ),
      );

    const distinctUsers = Array.from(
      new Set(others.map((p) => String((p as any).userId ?? ""))).values(),
    ).filter(Boolean);

    if (distinctUsers.length >= 3) {
      await logIpEvent({
        req,
        kind: "gps_multi_account_alert",
        lat,
        lng,
      });
    }
  }

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  function xmlEscape(value: string): string {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  app.get("/robots.txt", (req, res) => {
    const sitemapUrl = appUrl("/sitemap.xml", req);
    res.type("text/plain");
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.send(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /dashboard",
        "Disallow: /stories/new",
        "Disallow: /signup",
        "Disallow: /login",
        "Disallow: /password/forgot",
        "Disallow: /password/reset",
        "Disallow: /email/verify",
        "Disallow: /settings",
        "Disallow: /post-intent",
        "Disallow: /annonce/new",
        "Disallow: /admin",
        "Disallow: /loader",
        "",
        `Sitemap: ${sitemapUrl}`,
        "",
      ].join("\n"),
    );
  });

  app.get(
    "/sitemap.xml",
    asyncHandler(async (req, res) => {
      const staticEntries = [
        { path: "/", lastmod: null, changefreq: "weekly", priority: "1.0" },
        { path: "/start", lastmod: null, changefreq: "daily", priority: "0.95" },
        { path: "/explore", lastmod: null, changefreq: "daily", priority: "0.9" },
        { path: "/annonces", lastmod: null, changefreq: "daily", priority: "0.9" },
        { path: "/vip", lastmod: null, changefreq: "daily", priority: "0.8" },
        { path: "/events", lastmod: null, changefreq: "weekly", priority: "0.75" },
        { path: "/adult-products", lastmod: null, changefreq: "daily", priority: "0.8" },
        { path: "/conditions", lastmod: null, changefreq: "monthly", priority: "0.3" },
        { path: "/privacy", lastmod: null, changefreq: "monthly", priority: "0.3" },
        { path: "/cookies", lastmod: null, changefreq: "monthly", priority: "0.3" },
      ];

      const profileRows = await db
        .select({
          id: profiles.id,
          updatedAt: profiles.updatedAt,
          createdAt: profiles.createdAt,
        })
        .from(profiles)
        .where(hasProfilesVisibility ? eq(profiles.visible, true) : undefined)
        .orderBy(desc(profiles.updatedAt))
        .limit(5000);

      const productRows = await db
        .select({
          id: adultProductsTable.id,
          updatedAt: (adultProductsTable as any).updatedAt,
          createdAt: adultProductsTable.createdAt,
        })
        .from(adultProductsTable)
        .where(eq(adultProductsTable.active, true))
        .orderBy(desc((adultProductsTable as any).updatedAt))
        .limit(5000);

      const urls = [
        ...staticEntries.map((entry) => ({
          loc: appUrl(entry.path, req),
          lastmod: entry.lastmod,
          changefreq: entry.changefreq,
          priority: entry.priority,
        })),
        ...profileRows.map((row) => ({
          loc: appUrl(`/profile/${row.id}`, req),
          lastmod: new Date(row.updatedAt ?? row.createdAt).toISOString(),
          changefreq: "daily",
          priority: "0.7",
        })),
        ...productRows.map((row) => ({
          loc: appUrl(`/adult-products/${row.id}`, req),
          lastmod: new Date((row as any).updatedAt ?? row.createdAt).toISOString(),
          changefreq: "weekly",
          priority: "0.65",
        })),
      ];

      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map(
          (url) =>
            `  <url>\n    <loc>${xmlEscape(url.loc)}</loc>\n${
              url.lastmod ? `    <lastmod>${xmlEscape(url.lastmod)}</lastmod>\n` : ""
            }    <changefreq>${url.changefreq}</changefreq>\n    <priority>${url.priority}</priority>\n  </url>`,
        )
        .join("\n")}\n</urlset>`;

      res.type("application/xml");
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.send(body);
    }),
  );

  app.get(
    "/api/csrf-token",
    asyncHandler(async (req, res) => {
      const csrfToken = ensureCsrfToken(req);
      await saveSession(req);
      if (req.sessionID) {
        mirrorSessionCookie(res, String(req.sessionID));
      }
      res.setHeader("Cache-Control", "no-store");
      res.json({
        csrfToken,
        sessionToken:
          req.session?.userId && req.session?.profileId
            ? createSessionToken({ userId: String(req.session.userId), profileId: String(req.session.profileId) })
            : null,
      });
    }),
  );

  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (isCsrfExemptPath(req.path)) return next();

    const expected = String(req.session?.csrfToken ?? "").trim();
    const provided = String(req.get("x-csrf-token") ?? "").trim();

    if (expected && provided && expected === provided) {
      return next();
    }

    if (hasTrustedCsrfOrigin(req)) {
      return next();
    }

    if (!expected || !provided || expected !== provided) {
      return res.status(419).json({ message: "Jeton CSRF manquant ou invalide." });
    }

    return next();
  });

  // --- Authentification Google OAuth2 (login uniquement, sans création auto de profil) ---
  app.get(
    "/api/auth/google",
    asyncHandler(async (req, res) => {
      if (!googleClientId || !googleRedirectUri) {
        return res
          .status(500)
          .json({ message: "Google OAuth non configuré (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI manquants)." });
      }

      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", googleClientId);
      url.searchParams.set("redirect_uri", googleRedirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("access_type", "online");
      url.searchParams.set("include_granted_scopes", "true");
      // Force account picker to avoid "instant redirect" when a Google session already exists.
      url.searchParams.set("prompt", "select_account");

      const state = sanitizeOAuthState(typeof req.query.state === "string" ? req.query.state : "");
      if (state) url.searchParams.set("state", state);

      res.redirect(url.toString());
    }),
  );

  // Pending OAuth info (used to prefill signup flow when user doesn't exist yet)
  app.get(
    "/api/auth/pending",
    asyncHandler(async (req, res) => {
      const pending = (req.session as any)?.oauthPending as
        | { provider: "google"; email: string }
        | undefined;
      res.json({ provider: pending?.provider ?? null, email: pending?.email ?? null });
    }),
  );

  app.get(
    "/api/auth/google/callback",
    asyncHandler(async (req, res) => {
      try {
      if (!googleClientId || !googleClientSecret || !googleRedirectUri) {
        return res
          .status(500)
          .send("Google OAuth non configuré. Contacte l’administrateur.");
      }

      const code = typeof req.query.code === "string" ? req.query.code : null;
      const error = typeof req.query.error === "string" ? req.query.error : null;
      const state = sanitizeOAuthState(typeof req.query.state === "string" ? req.query.state : "");

      if (error) {
        console.error("Google OAuth error:", error);
        return res.redirect(appUrl(`/login?oauth=google_error`));
      }
      if (!code) {
        return res.redirect(appUrl(`/login?oauth=missing_code`));
      }

      // 1) Échanger le code contre un access_token
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: googleRedirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const text = await tokenRes.text().catch(() => "");
        console.error("Google token exchange failed", tokenRes.status, text);
        return res.redirect(appUrl(`/login?oauth=token_error`));
      }

      const tokenJson: any = await tokenRes.json();
      const accessToken = tokenJson.access_token as string | undefined;
      if (!accessToken) {
        console.error("Google OAuth: missing access_token", tokenJson);
        return res.redirect(appUrl(`/login?oauth=token_missing`));
      }

      // 2) Récupérer les infos utilisateur (email, etc.)
      const userinfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userinfoRes.ok) {
        const text = await userinfoRes.text().catch(() => "");
        console.error("Google userinfo failed", userinfoRes.status, text);
        return res.redirect(appUrl(`/login?oauth=userinfo_error`));
      }

      const userinfo: any = await userinfoRes.json();
      const email = typeof userinfo.email === "string" ? userinfo.email.toLowerCase() : null;
      const emailVerified = Boolean(userinfo.email_verified);

      if (!email || !emailVerified) {
        return res.redirect(appUrl(`/login?oauth=email_unverified`));
      }

      if (!hasUsersEmail) {
        return res.redirect(appUrl(`/login?oauth=email_column_missing`));
      }

      // 3) Tenter de retrouver un utilisateur existant avec cet email
      const [u] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${(users as any).email}) = ${email}`)
        .limit(1);

      if (!u) {
        // Aucun compte existant: on stocke l'email vérifié en session pour pré-remplir l'inscription.
        (req.session as any).oauthPending = { provider: "google", email };
        return await redirectAfterSessionSave(req, res, appUrl(`/signup?oauth=google`));
      }

      const [p] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.userId, (u as any).id))
        .limit(1);

      if (!p) {
        return res.redirect(appUrl(`/login?oauth=no_profile`));
      }

      await establishAuthenticatedSession(req, res, {
        userId: (u as any).id,
        profileId: p.id,
      });

      await logIpEvent({ req, kind: "login_success_google", userId: (u as any).id });

      // If state points to signup (common mistake), prefer dashboard for existing users.
      return res.redirect(appUrl(state));
      } catch (e) {
        console.error("Google OAuth callback crashed", e);
        return res.redirect(appUrl(`/login?oauth=server_error`));
      }
    }),
  );

  // Backward/typo-tolerant: some clients may hit /api/auth/google/<state> instead of using ?state=
  // IMPORTANT: must NOT capture /api/auth/google/callback (handled above).
  app.get("/api/auth/google/*", (req, res, next) => {
    if (req.path.startsWith("/api/auth/google/callback")) return next();
    const raw = String((req.params as any)[0] ?? "");
    const normalized = raw ? `/${raw}`.replace(/\/{2,}/g, "/") : "/dashboard";
    const state = sanitizeOAuthState(normalized);
    return res.redirect(`/api/auth/google?state=${encodeURIComponent(state)}`);
  });

  // Publishing / promote configuration (tokens + options). Backend remains source of truth.
  app.get(
    "/api/publishing/config",
    asyncHandler(async (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      const PROMO_FACTOR = 0.7; // -30% promotion on money prices
      res.json({
        publication: PUBLISHING_CONFIG.publication,
        promote: {
          ...PUBLISHING_CONFIG.promote,
          extended: {
            ...PUBLISHING_CONFIG.promote.extended,
            options: PUBLISHING_CONFIG.promote.extended.options.map((o) => {
              const supportsMoney = PUBLISHING_CONFIG.promote.extended.paymentMode.includes("money");

              if (!supportsMoney) {
                const { price: _price, ...rest } = o;
                return rest;
              }

              return {
                ...o,
                pricePromo: Math.round(o.price * PROMO_FACTOR),
                promoPercent: 30,
              };
            }),
          },
        },
        // Keep backend-only rules off the public config by default.
      });
    }),
  );

  // Tokens / payments
  app.get(
    "/api/tokens/packages",
    asyncHandler(async (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.json({
        packages: TOKEN_PACKAGES,
        providers: getEnabledPaymentProviders(),
        defaultProvider: getDefaultPaymentProvider(),
      });
    }),
  );

  app.post(
    "/api/tokens/checkout",
    asyncHandler(async (req, res) => {
      const userId = req.session?.userId as string | undefined;
      if (!userId) return res.status(401).json({ message: "Not logged in" });

      const payload = z
        .object({
          packageId: z.string().min(3).max(64),
          provider: z.enum(["paystack", "mobile_money"]).default(getDefaultPaymentProvider()),
        })
        .parse(req.body);

      if (payload.provider === "mobile_money") {
        return res.status(501).json({ message: "Mobile Money: bientôt disponible" });
      }

      const pack = findTokenPackage(payload.packageId);
      if (!pack) return res.status(400).json({ message: "Pack jetons invalide." });

      if (payload.provider === "paystack") {
        const paystackSecret = getPaystackSecretKey();
        if (!paystackSecret) {
          return res.status(500).json({ message: "Paiement indisponible (Paystack non configuré)." });
        }
        if (!hasUsersEmail) {
          return res.status(400).json({ message: "Ajoute un email à ton compte avant de payer." });
        }

        const [u] = await db
          .select({ email: (users as any).email })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const customerEmail = String((u as any)?.email ?? "").trim().toLowerCase();
        if (!customerEmail) {
          return res.status(400).json({ message: "Ajoute un email à ton compte avant de payer." });
        }

        const reference = `paystack_${crypto.randomUUID()}`;
        const callbackUrl = apiUrl(req, "/api/payments/paystack/callback");
        const cancelUrl = appUrl("/dashboard?pay=cancel&provider=paystack", req);
        const paystackAmount = getPaystackAmountForPackage(pack);
        const initializeRes = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: customerEmail,
            amount: String(paystackAmount),
            currency: pack.currency,
            reference,
            callback_url: callbackUrl,
            metadata: {
              cancel_action: cancelUrl,
              userId,
              packageId: pack.id,
              tokens: pack.tokens,
            },
          }),
        });

        const initializeJson = (await initializeRes.json().catch(() => null)) as
          | { status?: boolean; message?: string; data?: { authorization_url?: string | null } }
          | null;

        if (!initializeRes.ok || !initializeJson?.status || !initializeJson.data?.authorization_url) {
          return res.status(502).json({
            message: initializeJson?.message || "Initialisation Paystack impossible.",
          });
        }

        await db
          .insert(payments)
          .values({
            userId,
            provider: "paystack",
            providerRef: reference,
            status: "created",
            currency: pack.currency,
            amount: pack.amount,
            tokens: pack.tokens,
            items: { packageId: pack.id, kind: "tokens" } as any,
          } as any)
          .onConflictDoNothing();

        return res.json({ checkoutUrl: initializeJson.data.authorization_url, provider: "paystack" });
      }

      return res.status(400).json({ message: "Provider de paiement invalide." });
    }),
  );

  app.get(
    "/api/payments/paystack/callback",
    asyncHandler(async (req, res) => {
      const reference = z.string().min(8).max(200).parse(req.query.reference);

      try {
        const transaction = await getPaystackTransaction(reference);
        const metadata = (transaction.metadata ?? {}) as Record<string, unknown>;
        const userId = typeof metadata.userId === "string" ? metadata.userId : "";
        const amount = Number(transaction.amount ?? NaN);
        const currency = String(transaction.currency ?? "").toUpperCase();
        const status = String(transaction.status ?? "").toLowerCase();
        const rawEventId = transaction.id ? String(transaction.id) : null;

        const packageId = typeof metadata.packageId === "string" ? metadata.packageId : "";
        const pack = findTokenPackage(packageId);
        const expectedAmount = pack ? getPaystackAmountForPackage(pack) : NaN;

        if (!userId || !pack || status !== "success" || !Number.isFinite(amount) || amount !== expectedAmount || currency !== pack.currency) {
          if (userId) {
            await recordPaymentFailure({
              userId,
              provider: "paystack",
              providerRef: reference,
              rawEventId,
              amount: Number.isFinite(amount) ? amount : null,
              currency: currency || null,
              packageId,
              reason: "paystack_callback_mismatch",
            });
          }
          return res.redirect(appUrl("/dashboard?pay=cancel&provider=paystack", req));
        }

        await reconcileTokenPurchase({
          userId,
          provider: "paystack",
          providerRef: reference,
          pack,
          amount: pack.amount,
          currency,
          rawEventId,
          meta: { reference, transactionId: transaction.id ?? null },
        });

        return res.redirect(appUrl("/dashboard?pay=success&provider=paystack", req));
      } catch (e) {
        console.error("Paystack callback failed", e);
        return res.redirect(appUrl("/dashboard?pay=cancel&provider=paystack", req));
      }
    }),
  );

  app.post(
    "/api/payments/paystack/webhook",
    asyncHandler(async (req, res) => {
      const secret = getPaystackSecretKey();
      if (!secret) {
        return res.status(500).json({ message: "Paystack webhook not configured" });
      }

      const signature = String(req.get("x-paystack-signature") ?? "").trim();
      const raw = (req as any).rawBody;
      const rawBuf = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw ?? ""));
      const expected = crypto.createHmac("sha512", secret).update(rawBuf).digest("hex");
      if (!signature || signature !== expected) {
        return res.status(400).json({ message: "Invalid signature" });
      }

      const event = JSON.parse(rawBuf.toString("utf8")) as {
        event?: string;
        data?: {
          id?: number | string;
          reference?: string;
          status?: string;
          amount?: number;
          currency?: string;
          metadata?: Record<string, unknown> | null;
        };
      };

      if (event.event !== "charge.success" || !event.data?.reference) {
        return res.json({ ok: true });
      }

      const eventId = event.data.id ? String(event.data.id) : null;
      if (eventId) {
        const already = await db
          .select({ id: payments.id })
          .from(payments)
          .where(and(eq((payments as any).provider, "paystack"), eq((payments as any).rawEventId, eventId)))
          .limit(1);
        if (already.length) return res.json({ ok: true, deduped: true });
      }

      const metadata = (event.data.metadata ?? {}) as Record<string, unknown>;
      const userId = typeof metadata.userId === "string" ? metadata.userId : "";
      const amount = Number(event.data.amount ?? NaN);
      const currency = String(event.data.currency ?? "").toUpperCase();
      const status = String(event.data.status ?? "").toLowerCase();
      const reference = String(event.data.reference);

      const packageId = typeof metadata.packageId === "string" ? metadata.packageId : "";
      const pack = findTokenPackage(packageId);
      const expectedAmount = pack ? getPaystackAmountForPackage(pack) : NaN;

      if (!userId || !pack || status !== "success" || !Number.isFinite(amount) || amount !== expectedAmount || currency !== pack.currency) {
        if (userId) {
          await recordPaymentFailure({
            userId,
            provider: "paystack",
            providerRef: reference,
            rawEventId: eventId,
            amount: Number.isFinite(amount) ? amount : null,
            currency: currency || null,
            packageId,
            reason: "paystack_webhook_mismatch",
          });
        }
        return res.json({ ok: true });
      }

      await reconcileTokenPurchase({
        userId,
        provider: "paystack",
        providerRef: reference,
        pack,
        amount: pack.amount,
        currency,
        rawEventId: eventId,
        meta: { reference, transactionId: event.data.id ?? null },
      });

      return res.json({ ok: true });
    }),
  );

  app.get(
    "/api/healthz",
    asyncHandler(async (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.json({ ok: true, service: "nixyah-api" });
    }),
  );

  app.get(
    "/api/support",
    asyncHandler(async (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.json({
        resetEmail: env.ADMIN_EMAIL ?? "Ra.fils27@hotmail.com",
        telegramUrl: (env as any).SUPPORT_TELEGRAM_URL ?? "https://t.me/+cNj_edHZTyc2YWE0",
        turnstileRequired: Boolean((env as any).TURNSTILE_SECRET_KEY),
      });
    }),
  );

  app.get(
    "/api/events",
    asyncHandler(async (req, res) => {
      const limit = z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : 50))
        .pipe(z.number().int().min(1).max(100))
        .parse(req.query.limit);

      const now = new Date();
      const rows = await db
        .select({
          id: events.id,
          ownerProfileId: events.ownerProfileId,
          title: events.title,
          description: events.description,
          city: events.city,
          venue: events.venue,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
          visibility: events.visibility,
          priceType: events.priceType,
          priceAmount: events.priceAmount,
          priceCurrency: events.priceCurrency,
          capacity: events.capacity,
          contactWhatsapp: events.contactWhatsapp,
          contactEmail: events.contactEmail,
          imageUrl: events.imageUrl,
          imageUrls: events.imageUrls,
          videoUrl: hasEventsVideoUrl ? events.videoUrl : (sql<string | null>`null` as any),
          status: events.status,
          createdAt: events.createdAt,
          organizerPseudo: profiles.pseudo,
          organizerPhotoUrl: profiles.photoUrl,
          organizerAccountType: hasAccountType ? profiles.accountType : (sql<string>`'profile'` as any),
          registrationsCount:
            sql<number>`(
              select count(*)::int
              from event_registrations er
              where er.event_id = ${events.id}
            )`,
        })
        .from(events)
        .innerJoin(profiles, eq(events.ownerProfileId, profiles.id))
        .where(
          and(
            eq(events.status, "published"),
            or(
              gt(events.endsAt, now),
              and(isNull(events.endsAt), gt(events.startsAt, now)),
            ),
          ),
        )
        .orderBy(events.startsAt)
        .limit(limit);

      res.json(
        rows.map((row) => {
          const registrationsCount = Number(row.registrationsCount ?? 0);
          const capacity = row.capacity === null ? null : Number(row.capacity ?? 0);
          return {
            ...row,
            imageUrls: normalizeEventImageUrls(row.imageUrls as string[] | null | undefined, row.imageUrl),
            organizer: {
              profileId: row.ownerProfileId,
              pseudo: row.organizerPseudo,
              accountType: row.organizerAccountType,
              photoUrl: sanitizeUrl(row.organizerPhotoUrl),
            },
            imageUrl: sanitizeUrl(row.imageUrl),
            videoUrl: sanitizeUrl(row.videoUrl),
            registrationsCount,
            spotsLeft: capacity === null ? null : Math.max(0, capacity - registrationsCount),
          };
        }),
      );
    }),
  );

  app.get(
    "/api/events/:id",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);
      const [row] = await db
        .select({
          id: events.id,
          ownerProfileId: events.ownerProfileId,
          title: events.title,
          description: events.description,
          city: events.city,
          venue: events.venue,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
          visibility: events.visibility,
          priceType: events.priceType,
          priceAmount: events.priceAmount,
          priceCurrency: events.priceCurrency,
          capacity: events.capacity,
          contactWhatsapp: events.contactWhatsapp,
          contactEmail: events.contactEmail,
          imageUrl: events.imageUrl,
          imageUrls: events.imageUrls,
          videoUrl: hasEventsVideoUrl ? events.videoUrl : (sql<string | null>`null` as any),
          status: events.status,
          organizerPseudo: profiles.pseudo,
          organizerPhotoUrl: profiles.photoUrl,
          organizerAccountType: hasAccountType ? profiles.accountType : (sql<string>`'profile'` as any),
          registrationsCount:
            sql<number>`(
              select count(*)::int
              from event_registrations er
              where er.event_id = ${events.id}
            )`,
        })
        .from(events)
        .innerJoin(profiles, eq(events.ownerProfileId, profiles.id))
        .where(and(eq(events.id, id), eq(events.status, "published")))
        .limit(1);

      if (!row) return res.status(404).json({ message: "Évènement introuvable" });

      const registrationsCount = Number(row.registrationsCount ?? 0);
      const capacity = row.capacity === null ? null : Number(row.capacity ?? 0);

      res.json({
        ...row,
        imageUrls: normalizeEventImageUrls(row.imageUrls as string[] | null | undefined, row.imageUrl),
        organizer: {
          profileId: row.ownerProfileId,
          pseudo: row.organizerPseudo,
          accountType: row.organizerAccountType,
          photoUrl: sanitizeUrl(row.organizerPhotoUrl),
        },
        imageUrl: sanitizeUrl(row.imageUrl),
        videoUrl: sanitizeUrl(row.videoUrl),
        registrationsCount,
        spotsLeft: capacity === null ? null : Math.max(0, capacity - registrationsCount),
      });
    }),
  );

  app.get(
    "/api/me/events",
    asyncHandler(async (req, res) => {
      const context = await getCurrentEventPublisher(req);
      const rows = await db
        .select({
          id: events.id,
          title: events.title,
          description: events.description,
          city: events.city,
          venue: events.venue,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
          visibility: events.visibility,
          priceType: events.priceType,
          priceAmount: events.priceAmount,
          priceCurrency: events.priceCurrency,
          capacity: events.capacity,
          contactWhatsapp: events.contactWhatsapp,
          contactEmail: events.contactEmail,
          imageUrl: events.imageUrl,
          imageUrls: events.imageUrls,
          videoUrl: hasEventsVideoUrl ? events.videoUrl : (sql<string | null>`null` as any),
          status: events.status,
          publicationCreditsCharged: events.publicationCreditsCharged,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
          registrationsCount:
            sql<number>`(
              select count(*)::int
              from event_registrations er
              where er.event_id = ${events.id}
            )`,
        })
        .from(events)
        .where(eq(events.ownerProfileId, context.profileId))
        .orderBy(desc(events.createdAt))
        .limit(100);

      res.json(
        rows.map((row) => ({
          ...row,
          imageUrls: normalizeEventImageUrls(row.imageUrls as string[] | null | undefined, row.imageUrl),
          videoUrl: sanitizeUrl(row.videoUrl),
          registrationsCount: Number(row.registrationsCount ?? 0),
        })),
      );
    }),
  );

  app.post(
    "/api/me/events",
    asyncHandler(async (req, res) => {
      await ensureIpNotBanned(req);
      const payload = eventCreateSchema.parse(req.body);

      const created = await db.transaction(async (tx) => {
        const context = await getCurrentEventPublisher(req, tx);
        const eventImageUrls = Array.from(new Set((payload.imageUrls ?? []).filter(Boolean))).slice(0, 2);
        const primaryImageUrl = eventImageUrls[0] ?? payload.imageUrl ?? null;

        const publicationCreditsCharged = context.admin || context.hasFreeEventPublication ? 0 : EVENT_PUBLISH_TOKEN_COST;

        if (publicationCreditsCharged > 0) {
          const updated = await tx
            .update(users)
            .set({ tokensBalance: sql`${users.tokensBalance} - ${publicationCreditsCharged}` } as any)
            .where(and(eq(users.id, context.userId), sql`${users.tokensBalance} >= ${publicationCreditsCharged}`))
            .returning({ tokensBalance: users.tokensBalance });

          if (!updated.length) {
            throw Object.assign(new Error("Crédit insuffisant: 5 crédits sont requis pour publier un évènement."), {
              status: 403,
            });
          }

          await tx.insert(tokenTransactions).values({
            userId: context.userId,
            delta: -publicationCreditsCharged,
            reason: "event_publish",
            meta: {
              profileId: context.profileId,
              title: payload.title.trim(),
              visibility: payload.visibility,
              priceType: payload.priceType,
              firstPublicationFree: false,
            } as any,
          } as any);
        }

        const [event] = await tx
          .insert(events)
          .values({
            ownerProfileId: context.profileId,
            title: payload.title.trim(),
            description: payload.description?.trim() || null,
            city: payload.city.trim(),
            venue: payload.venue?.trim() || null,
            startsAt: new Date(payload.startsAt),
            endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
            visibility: payload.visibility,
            priceType: payload.priceType,
            priceAmount: payload.priceType === "paid" ? Number(payload.priceAmount ?? 0) : 0,
            priceCurrency: payload.priceCurrency.toUpperCase(),
            capacity: payload.capacity ?? null,
            contactWhatsapp: payload.contactWhatsapp?.trim() || null,
            contactEmail: payload.contactEmail?.trim().toLowerCase() || null,
            imageUrl: primaryImageUrl,
            imageUrls: eventImageUrls.length ? eventImageUrls : primaryImageUrl ? [primaryImageUrl] : null,
            ...(hasEventsVideoUrl ? { videoUrl: payload.videoUrl ?? null } : {}),
            publicationCreditsCharged,
            legalNoticeAccepted: true,
            status: payload.status ?? "published",
            updatedAt: new Date(),
          })
          .returning({
            id: events.id,
            title: events.title,
            status: events.status,
            startsAt: events.startsAt,
            publicationCreditsCharged: events.publicationCreditsCharged,
          });

        return event;
      });

      await logIpEvent({ req, kind: "event_publish" });
      res.json(created);
    }),
  );

  app.patch(
    "/api/me/events/:id",
    asyncHandler(async (req, res) => {
      const eventId = z.string().uuid().parse(req.params.id);
      const payload = eventUpdateSchema.parse(req.body);
      const context = await getCurrentEventPublisher(req);

      const [existing] = await db
        .select({ id: events.id, ownerProfileId: events.ownerProfileId })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Évènement introuvable" });
      if (!context.admin && existing.ownerProfileId !== context.profileId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const nextValues: Record<string, unknown> = { updatedAt: new Date() };
      const eventImageUrls =
        payload.imageUrls !== undefined
          ? Array.from(new Set((payload.imageUrls ?? []).filter(Boolean))).slice(0, 2)
          : undefined;
      if (payload.title !== undefined) nextValues.title = payload.title.trim();
      if (payload.description !== undefined) nextValues.description = payload.description?.trim() || null;
      if (payload.city !== undefined) nextValues.city = payload.city.trim();
      if (payload.venue !== undefined) nextValues.venue = payload.venue?.trim() || null;
      if (payload.startsAt !== undefined) nextValues.startsAt = new Date(payload.startsAt);
      if (payload.endsAt !== undefined) nextValues.endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
      if (payload.visibility !== undefined) nextValues.visibility = payload.visibility;
      if (payload.priceType !== undefined) nextValues.priceType = payload.priceType;
      if (payload.priceAmount !== undefined) nextValues.priceAmount = payload.priceType === "free" ? 0 : payload.priceAmount ?? 0;
      if (payload.priceCurrency !== undefined) nextValues.priceCurrency = payload.priceCurrency.toUpperCase();
      if (payload.capacity !== undefined) nextValues.capacity = payload.capacity ?? null;
      if (payload.contactWhatsapp !== undefined) nextValues.contactWhatsapp = payload.contactWhatsapp?.trim() || null;
      if (payload.contactEmail !== undefined) nextValues.contactEmail = payload.contactEmail?.trim().toLowerCase() || null;
      if (payload.imageUrl !== undefined) nextValues.imageUrl = payload.imageUrl ?? null;
      if (hasEventsVideoUrl && payload.videoUrl !== undefined) nextValues.videoUrl = payload.videoUrl ?? null;
      if (eventImageUrls !== undefined) {
        nextValues.imageUrls = eventImageUrls.length ? eventImageUrls : null;
        if (payload.imageUrl === undefined) {
          nextValues.imageUrl = eventImageUrls[0] ?? null;
        }
      }
      if (payload.status !== undefined) nextValues.status = payload.status;
      if (payload.legalNoticeAccepted !== undefined) nextValues.legalNoticeAccepted = payload.legalNoticeAccepted;

      const [updated] = await db
        .update(events)
        .set(nextValues as any)
        .where(eq(events.id, eventId))
        .returning({
          id: events.id,
          title: events.title,
          status: events.status,
          updatedAt: events.updatedAt,
        });

      res.json(updated);
    }),
  );

  app.get(
    "/api/me/events/:id/registrations",
    asyncHandler(async (req, res) => {
      const eventId = z.string().uuid().parse(req.params.id);
      const context = await getCurrentEventPublisher(req);

      const [eventRow] = await db
        .select({ id: events.id, ownerProfileId: events.ownerProfileId, title: events.title })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);
      if (!eventRow) return res.status(404).json({ message: "Évènement introuvable" });
      if (!context.admin && eventRow.ownerProfileId !== context.profileId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const rows = await db
        .select({
          id: eventRegistrations.id,
          guestName: eventRegistrations.guestName,
          guestEmail: eventRegistrations.guestEmail,
          guestPhone: eventRegistrations.guestPhone,
          guestWhatsapp: eventRegistrations.guestWhatsapp,
          notifyByEmail: eventRegistrations.notifyByEmail,
          notifyByWhatsapp: eventRegistrations.notifyByWhatsapp,
          createdAt: eventRegistrations.createdAt,
        })
        .from(eventRegistrations)
        .where(eq(eventRegistrations.eventId, eventId))
        .orderBy(desc(eventRegistrations.createdAt))
        .limit(500);

      res.json({
        event: eventRow,
        attendees: rows,
      });
    }),
  );

  app.post(
    "/api/me/events/:id/send-reminders",
    asyncHandler(async (req, res) => {
      const eventId = z.string().uuid().parse(req.params.id);
      const context = await getCurrentEventPublisher(req);
      const [eventRow] = await db
        .select({ id: events.id, ownerProfileId: events.ownerProfileId })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);
      if (!eventRow) return res.status(404).json({ message: "Évènement introuvable" });
      if (!context.admin && eventRow.ownerProfileId !== context.profileId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const result = await sendEventReminderEmails(eventId, req);
      res.json({ ok: true, sent: result.sent });
    }),
  );

  app.post(
    "/api/events/:id/register",
    asyncHandler(async (req, res) => {
      await ensureIpNotBanned(req);
      const eventId = z.string().uuid().parse(req.params.id);
      const payload = eventRegistrationCreateSchema.parse(req.body);
      const sessionUserId = req.session?.userId as string | undefined;
      const guestEmail = payload.email.trim().toLowerCase();
      const guestName = payload.name.trim();
      const guestPhone = payload.phone?.trim() || null;
      const guestWhatsapp = payload.whatsapp?.trim() || null;

      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`select ${events.id} from ${events} where ${events.id} = ${eventId} for update`);

        const [eventRow] = await tx
          .select({
            id: events.id,
            ownerProfileId: events.ownerProfileId,
            title: events.title,
            city: events.city,
            startsAt: events.startsAt,
            endsAt: events.endsAt,
            visibility: events.visibility,
            priceType: events.priceType,
            priceAmount: events.priceAmount,
            priceCurrency: events.priceCurrency,
            capacity: events.capacity,
            status: events.status,
            organizerEmail: sql<string | null>`coalesce(${events.contactEmail}, ${(users as any).email})`,
          })
          .from(events)
          .innerJoin(profiles, eq(events.ownerProfileId, profiles.id))
          .leftJoin(users, eq(profiles.userId, users.id))
          .where(eq(events.id, eventId))
          .limit(1);

        if (!eventRow || eventRow.status !== "published") {
          throw Object.assign(new Error("Évènement introuvable"), { status: 404 });
        }
        if (new Date(eventRow.startsAt).getTime() <= Date.now()) {
          throw Object.assign(new Error("Les inscriptions sont closes pour cet évènement."), { status: 400 });
        }

        const [existing] = await tx
          .select({ id: eventRegistrations.id })
          .from(eventRegistrations)
          .where(
            and(
              eq(eventRegistrations.eventId, eventId),
              sql`lower(${eventRegistrations.guestEmail}) = ${guestEmail}`,
            ),
          )
          .limit(1);

        if (existing) {
          throw Object.assign(new Error("Cette adresse email est déjà inscrite à cet évènement."), { status: 409 });
        }

        const [{ count: registrationsCountRaw }] = await tx
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(eventRegistrations)
          .where(eq(eventRegistrations.eventId, eventId));

        const registrationsCount = Number(registrationsCountRaw ?? 0);
        if (eventRow.capacity !== null && registrationsCount >= Number(eventRow.capacity ?? 0)) {
          throw Object.assign(new Error("Cet évènement est complet."), { status: 400 });
        }

        const [registration] = await tx
          .insert(eventRegistrations)
          .values({
            eventId,
            userId: sessionUserId ?? null,
            guestName,
            guestEmail,
            guestPhone,
            guestWhatsapp,
            paymentStatus: "not_required",
            amount: null,
            currency: null,
            notifyByEmail: payload.notifyByEmail,
            notifyByWhatsapp: payload.notifyByWhatsapp,
            agreedNoRefund: true,
            agreedDisclaimer: true,
            updatedAt: new Date(),
          } as any)
          .returning({ id: eventRegistrations.id });

        return {
          registrationId: registration.id,
          eventTitle: eventRow.title,
          eventCity: eventRow.city,
          eventDateLabel: new Date(eventRow.startsAt).toLocaleString("fr-FR"),
          priceType: eventRow.priceType,
          priceAmount: Number(eventRow.priceAmount ?? 0),
          priceCurrency: eventRow.priceCurrency,
          organizerEmail: eventRow.organizerEmail,
        };
      });

      await sendEventRegistrationEmail({
        req,
        to: guestEmail,
        eventTitle: result.eventTitle,
        eventDate: result.eventDateLabel,
        eventCity: result.eventCity,
        guestName,
        priceType: result.priceType,
        amount: result.priceAmount,
        currency: result.priceCurrency,
      });
      if (result.organizerEmail) {
        await sendEventOrganizerNotificationEmail({
          req,
          organizerEmail: result.organizerEmail,
          eventTitle: result.eventTitle,
          eventDate: result.eventDateLabel,
          guestName,
          guestEmail,
          guestPhone,
          guestWhatsapp,
        });
      }
      await logIpEvent({ req, kind: "event_register", userId: sessionUserId ?? null });
      return res.json({ ok: true, status: "registered", registrationId: result.registrationId });
    }),
  );

  app.get(
    "/api/admin/events",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const rows = await db
        .select({
          id: events.id,
          title: events.title,
          city: events.city,
          startsAt: events.startsAt,
          visibility: events.visibility,
          priceType: events.priceType,
          priceAmount: events.priceAmount,
          status: events.status,
          ownerProfileId: events.ownerProfileId,
          ownerPseudo: profiles.pseudo,
          createdAt: events.createdAt,
        })
        .from(events)
        .innerJoin(profiles, eq(events.ownerProfileId, profiles.id))
        .orderBy(desc(events.createdAt))
        .limit(500);

      res.json(rows);
    }),
  );

  app.patch(
    "/api/admin/events/:id",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const eventId = z.string().uuid().parse(req.params.id);
      const payload = eventUpdateSchema.parse(req.body);
      const nextValues: Record<string, unknown> = { updatedAt: new Date() };
      if (payload.title !== undefined) nextValues.title = payload.title.trim();
      if (payload.description !== undefined) nextValues.description = payload.description?.trim() || null;
      if (payload.city !== undefined) nextValues.city = payload.city.trim();
      if (payload.venue !== undefined) nextValues.venue = payload.venue?.trim() || null;
      if (payload.startsAt !== undefined) nextValues.startsAt = new Date(payload.startsAt);
      if (payload.endsAt !== undefined) nextValues.endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
      if (payload.visibility !== undefined) nextValues.visibility = payload.visibility;
      if (payload.priceType !== undefined) nextValues.priceType = payload.priceType;
      if (payload.priceAmount !== undefined) nextValues.priceAmount = payload.priceType === "free" ? 0 : payload.priceAmount ?? 0;
      if (payload.priceCurrency !== undefined) nextValues.priceCurrency = payload.priceCurrency.toUpperCase();
      if (payload.capacity !== undefined) nextValues.capacity = payload.capacity ?? null;
      if (payload.contactWhatsapp !== undefined) nextValues.contactWhatsapp = payload.contactWhatsapp?.trim() || null;
      if (payload.contactEmail !== undefined) nextValues.contactEmail = payload.contactEmail?.trim().toLowerCase() || null;
      if (payload.imageUrl !== undefined) nextValues.imageUrl = payload.imageUrl ?? null;
      if (payload.status !== undefined) nextValues.status = payload.status;
      if (payload.legalNoticeAccepted !== undefined) nextValues.legalNoticeAccepted = payload.legalNoticeAccepted;

      const [updated] = await db
        .update(events)
        .set(nextValues as any)
        .where(eq(events.id, eventId))
        .returning({ id: events.id, status: events.status, updatedAt: events.updatedAt });

      if (!updated) return res.status(404).json({ message: "Évènement introuvable" });
      res.json(updated);
    }),
  );

  // RSVP / Participation à un évènement (enregistré via email admin, et confirmation si possible)
  app.post(
    "/api/event-rsvp",
    asyncHandler(async (req, res) => {
      const payload = z
        .object({
          eventId: z.string().min(2).max(80),
          eventTitle: z.string().min(2).max(180),
          eventDate: z.string().min(4).max(40),
          name: z.string().min(2).max(80),
          contact: z.string().min(3).max(120),
          message: z.string().max(800).optional().nullable(),
        })
        .parse(req.body);

      const adminEmail = env.ADMIN_EMAIL ?? null;

      // Store: by sending to admin email (persistent).
      if (resend && adminEmail) {
        await resend.emails.send({
          from: resendFrom,
          to: adminEmail,
          subject: `RSVP évènement – ${payload.eventTitle}`,
          html: `
            <p><strong>Nouvelle demande de participation</strong></p>
            <p><strong>Évènement</strong>: ${payload.eventTitle}</p>
            <p><strong>Date</strong>: ${payload.eventDate}</p>
            <p><strong>Nom</strong>: ${payload.name}</p>
            <p><strong>Contact</strong>: ${payload.contact}</p>
            <p><strong>Message</strong>: ${String(payload.message ?? "").replace(/</g, "&lt;") || "—"}</p>
          `,
          text:
            `Nouvelle demande de participation\n\n` +
            `Évènement: ${payload.eventTitle}\n` +
            `Date: ${payload.eventDate}\n` +
            `Nom: ${payload.name}\n` +
            `Contact: ${payload.contact}\n` +
            `Message: ${payload.message ?? "—"}\n`,
        });

        // Optional confirmation to participant if email-like
        const looksLikeEmail = payload.contact.includes("@");
        if (looksLikeEmail) {
          await resend.emails.send({
            from: resendFrom,
            to: payload.contact,
            subject: `Confirmation – ${payload.eventTitle}`,
            html: `
              <p>Bonjour ${payload.name},</p>
              <p>Ta demande de participation est bien enregistrée.</p>
              <p><strong>Évènement</strong>: ${payload.eventTitle}<br/>
              <strong>Date</strong>: ${payload.eventDate}</p>
              <p>Nous te contacterons avant la date pour confirmer les détails.</p>
              <p>— L'équipe NIXYAH</p>
            `,
            text:
              `Bonjour ${payload.name},\n\n` +
              `Ta demande de participation est bien enregistrée.\n` +
              `Évènement: ${payload.eventTitle}\n` +
              `Date: ${payload.eventDate}\n\n` +
              `Nous te contacterons avant la date pour confirmer les détails.\n` +
              `— L'équipe NIXYAH\n`,
          });
        }
      } else {
        console.warn("[event-rsvp] RSVP reçu (Resend/Admin email non configurés):", payload);
      }

      res.json({ ok: true });
    }),
  );

  // Confirmer l'email à partir d'un token de vérification
  app.post(
    "/api/email/verify",
    asyncHandler(async (req, res) => {
      if (!hasUsersEmail || !hasUsersEmailVerified) {
        return res.status(400).json({ message: "Email verification not available" });
      }

      const payload = z
        .object({
          token: z.string().min(10).max(200),
        })
        .parse(req.body);
      const tokenHash = hashOpaqueToken(payload.token);

      // Expire tokens after 7 days to limit long-lived links.
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      const minSentAt = new Date(Date.now() - maxAgeMs);

      const [u] = await db
        .update(users as any)
        .set({
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
        })
        .where(
          and(
            eq((users as any).emailVerificationToken, tokenHash),
            or(
              // Backward-compat: allow older rows where sentAt is null.
              isNull((users as any).emailVerificationSentAt),
              gt((users as any).emailVerificationSentAt, minSentAt),
            ),
          ),
        )
        .returning({
          id: users.id,
          email: (users as any).email,
          emailVerified: (users as any).emailVerified,
        });

      if (!u) {
        return res.status(400).json({ message: "Token invalide ou expiré" });
      }

      res.json({
        ok: true,
        email: (u as any).email ?? null,
        emailVerified: (u as any).emailVerified ?? false,
      });
    }),
  );

  // Demande de réinitialisation de mot de passe (envoie un email via Resend)
  app.post(
    "/api/password/forgot",
    asyncHandler(async (req, res) => {
      if (!hasUsersEmail) {
        return res.status(400).json({ message: "Password reset not available (missing email column)" });
      }

      if (!(await requireTurnstile(req, res, (req.body as any)?.turnstileToken))) return;

      const payload = z
        .object({
          identifier: z.string().min(1).max(160),
        })
        .parse(req.body);

      const ident = payload.identifier.trim();
      const identLower = ident.toLowerCase();

      const [u] = await db
        .select({
          id: users.id,
          email: (users as any).email,
        })
        .from(users)
        .where(
          or(
            sql`lower(${users.username}) = ${identLower}`,
            sql`lower(${(users as any).email}) = ${identLower}`,
          ),
        )
        .limit(1);

      if (!u || !(u as any).email) {
        // Ne pas révéler si l'utilisateur existe ou non
        return res.json({ ok: true });
      }

      try {
        await sendResetPasswordEmail(u.id, (u as any).email as string);
      } catch (e) {
        console.error("Failed to send reset password email", e);
        return res.status(500).json({ message: "Impossible d'envoyer l'email pour le moment" });
      }

      res.json({ ok: true });
    }),
  );

  // Effectuer la réinitialisation du mot de passe à partir du token
  app.post(
    "/api/password/reset",
    asyncHandler(async (req, res) => {
      const payload = z
        .object({
          token: z.string().min(10).max(200),
          password: z.string().min(6).max(200),
        })
        .parse(req.body);
      const tokenHash = hashOpaqueToken(payload.token);

      const now = new Date();

      const [u] = await db
        .select({
          id: users.id,
          resetPasswordExpiresAt: (users as any).resetPasswordExpiresAt,
        })
        .from(users)
        .where(
          or(
            eq((users as any).resetPasswordToken, payload.token),
            eq((users as any).resetPasswordToken, tokenHash),
          ),
        )
        .limit(1);

      if (!u) {
        return res.status(400).json({ message: "Lien invalide ou expiré" });
      }

      const expiresAt = (u as any).resetPasswordExpiresAt as Date | null | undefined;
      if (expiresAt && expiresAt < now) {
        return res.status(400).json({ message: "Lien invalide ou expiré" });
      }

      const newHash = hashPassword(payload.password);

      await db
        .update(users as any)
        .set({
          passwordHash: newHash,
          resetPasswordToken: null,
          resetPasswordExpiresAt: null,
        })
        .where(eq(users.id, u.id));

      res.json({ ok: true });
    }),
  );

  app.get(
    "/api/me/account",
    asyncHandler(async (req, res) => {
      const userId = req.session?.userId as string | undefined;
      if (!userId) return res.status(401).json({ message: "Not logged in" });

      const [u] = await db
        .select({
          username: users.username,
          email: hasUsersEmail ? (users as any).email : sql<string | null>`null`,
          emailVerified:
            hasUsersEmail && hasUsersEmailVerified
              ? ((users as any).emailVerified as any)
              : (sql<boolean>`false` as any),
          tokensBalance: users.tokensBalance,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!u) return res.status(404).json({ message: "User not found" });

      res.json({
        username: u.username,
        email: (u as any).email ?? null,
        emailVerified: (u as any).emailVerified ?? false,
        tokensBalance: Number(u.tokensBalance ?? 0),
        emailVerificationAvailable: Boolean(hasUsersEmail && hasUsersEmailVerified),
        resendConfigured: Boolean(env.RESEND_API_KEY),
      });
    }),
  );

  app.get(
    "/api/tokens/transactions",
    asyncHandler(async (req, res) => {
      const userId = req.session?.userId as string | undefined;
      if (!userId) return res.status(401).json({ message: "Not logged in" });

      const rows = await db
        .select({
          id: tokenTransactions.id,
          delta: tokenTransactions.delta,
          reason: tokenTransactions.reason,
          meta: tokenTransactions.meta,
          createdAt: tokenTransactions.createdAt,
        })
        .from(tokenTransactions)
        .where(eq(tokenTransactions.userId, userId))
        .orderBy(desc(tokenTransactions.createdAt))
        .limit(50);

      res.json({ transactions: rows });
    }),
  );

  // Renvoyer un email de confirmation (utilisable depuis le dashboard)
  app.post(
    "/api/email/resend",
    asyncHandler(async (req, res) => {
      const userId = req.session?.userId as string | undefined;
      if (!userId) return res.status(401).json({ message: "Not logged in" });
      if (!hasUsersEmail || !hasUsersEmailVerified) {
        return res.status(400).json({ message: "Email verification not available" });
      }

      const [u] = await db
        .select({
          email: (users as any).email,
          emailVerified: (users as any).emailVerified,
          emailVerificationSentAt: (users as any).emailVerificationSentAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!u || !(u as any).email) {
        return res.status(400).json({ message: "Aucun email enregistré. Ajoute un email d’abord." });
      }
      if ((u as any).emailVerified) {
        return res.json({ ok: true, sent: false, alreadyVerified: true });
      }

      const lastSentAt = (u as any).emailVerificationSentAt as Date | null | undefined;
      if (lastSentAt && Date.now() - new Date(lastSentAt).getTime() < 60_000) {
        return res.status(429).json({
          message: "Un email vient d’être envoyé. Attends 1 minute avant de réessayer.",
        });
      }

      if (!env.RESEND_API_KEY) {
        return res.status(500).json({
          message: "Emails indisponibles (RESEND_API_KEY manquante). Contacte l’administrateur.",
        });
      }

      try {
        const r = await sendVerificationEmail(userId, String((u as any).email));
        return res.json({ ok: true, sent: r.sent });
      } catch (e: any) {
        return res.status(502).json({
          message:
            e?.message ??
            "Impossible d’envoyer l’email de confirmation pour le moment. Réessaie plus tard.",
        });
      }
    }),
  );

  app.patch(
    "/api/me/account",
    asyncHandler(async (req, res) => {
      const userId = req.session?.userId as string | undefined;
      if (!userId) return res.status(401).json({ message: "Not logged in" });
      if (!hasUsersEmail) return res.status(400).json({ message: "Email not available (run migrations)" });

      const payload = z
        .object({
          email: z.string().email().nullable().optional(),
        })
        .parse(req.body);

      const [u] = await db
        .update(users as any)
        .set({
          email: payload.email ?? null,
          ...(hasUsersEmailVerified ? { emailVerified: false, emailVerificationToken: null } : {}),
        })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          username: users.username,
          email: (users as any).email,
          emailVerified:
            hasUsersEmail && hasUsersEmailVerified
              ? ((users as any).emailVerified as any)
              : (sql<boolean>`false` as any),
        });

      let verificationEmailSent: boolean | null = null;
      let verificationEmailError: string | null = null;
      if (payload.email && hasUsersEmail && hasUsersEmailVerified) {
        try {
          const r = await sendVerificationEmail(u.id, payload.email);
          verificationEmailSent = Boolean(r.sent);
        } catch (e) {
          console.error("Failed to send verification email on /api/me/account", e);
          verificationEmailSent = false;
          verificationEmailError =
            (e as any)?.message ??
            "Impossible d’envoyer l’email de confirmation pour le moment. Vérifie la configuration Resend.";
        }
      }

      res.json({
        username: u.username,
        email: (u as any).email ?? null,
        emailVerified: (u as any).emailVerified ?? false,
        verificationEmailSent,
        verificationEmailError,
      });
    }),
  );

  app.get(
    "/api/geo/ip",
    asyncHandler(async (_req, res) => {
      try {
        const r = await fetch("http://ip-api.com/json/");
        if (!r.ok) {
          return res.status(502).json({ message: "Geo lookup failed" });
        }
        const data = (await r.json()) as any;
        const payload = {
          city: data.city ?? null,
          region: data.regionName ?? null,
          country: data.country ?? null,
          zip: data.zip ?? null,
          lat: typeof data.lat === "number" ? data.lat : null,
          lng: typeof data.lon === "number" ? data.lon : null,
          query: data.query ?? null,
        };

        await logIpEvent({
          req: _req,
          kind: "geo_ip_lookup",
          country: payload.country,
          city: payload.city,
          lat: payload.lat,
          lng: payload.lng,
        });

        res.json(payload);
      } catch {
        res.status(502).json({ message: "Geo lookup failed" });
      }
    }),
  );

  // Reverse geocoding for precise GPS coordinates (city / district only).
  app.get(
    "/api/geo/reverse",
    asyncHandler(async (req, res) => {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ message: "Invalid coordinates" });
      }

      try {
        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("format", "json");
        url.searchParams.set("lat", String(lat));
        url.searchParams.set("lon", String(lng));
        url.searchParams.set("addressdetails", "1");

        const r = await fetch(url.toString(), {
          headers: {
            "User-Agent": "NIXYAH/1.0 (reverse-geocode)",
          },
        });

        if (!r.ok) {
          return res.status(502).json({ message: "Reverse geocoding failed" });
        }

        const data = (await r.json()) as any;
        const addr = data.address ?? {};

        const city =
          addr.city ??
          addr.town ??
          addr.village ??
          addr.state_district ??
          addr.county ??
          null;
        const district =
          addr.suburb ?? addr.city_district ?? addr.neighbourhood ?? null;
        const road = addr.road ?? null;
        const country = addr.country ?? null;

        res.json({
          country,
          city,
          district,
          road,
        });
      } catch {
        return res.status(502).json({ message: "Reverse geocoding failed" });
      }
    }),
  );

  app.get(
    "/api/me",
    asyncHandler(async (req, res) => {
      const hasAuthenticatedSession = Boolean(req.session?.userId && req.session?.profileId);
      const csrfToken = hasAuthenticatedSession ? ensureCsrfToken(req) : null;
      if (hasAuthenticatedSession) {
        await saveSession(req);
      } else {
        clearSessionCookie(res);
      }
      res.setHeader("Cache-Control", "no-store");
      res.json({
        userId: req.session?.userId ?? null,
        profileId: req.session?.profileId ?? null,
        csrfToken,
        sessionToken:
          req.session?.userId && req.session?.profileId
            ? createSessionToken({ userId: String(req.session.userId), profileId: String(req.session.profileId) })
            : null,
      });
    }),
  );

  app.patch(
    "/api/me/profile",
    asyncHandler(async (req, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ message: "Not logged in" });

      const payload = z
        .object({
          visible: z.boolean().optional(),
          phone: z.string().max(32).nullable().optional(),
          showPhone: z.boolean().optional(),
          telegram: z.string().max(64).nullable().optional(),
          showTelegram: z.boolean().optional(),
          contactPreference: z.enum(["whatsapp", "telegram"]).optional(),
          ville: z.string().trim().min(1).max(120).optional(),
          lieu: z.string().trim().max(160).nullable().optional(),
          lat: z.number().min(-90).max(90).optional(),
          lng: z.number().min(-180).max(180).optional(),
          accuracy: z.number().min(0).max(5000).optional(),
          showLocation: z.boolean().optional(),
          businessName: z.string().max(160).nullable().optional(),
          address: z.string().max(255).nullable().optional(),
          openingHours: z.string().max(128).nullable().optional(),
          roomsCount: z.number().int().min(0).max(999).nullable().optional(),
        })
        .parse(req.body);

      const [updated] = await db
        .update(profiles)
        .set({
          ...(hasProfilesVisibility && payload.visible !== undefined ? { visible: payload.visible } : {}),
          ...(hasProfilesContact && payload.phone !== undefined ? { phone: payload.phone } : {}),
          ...(hasProfilesContact && payload.showPhone !== undefined ? { showPhone: payload.showPhone } : {}),
          ...(hasProfilesContact && payload.telegram !== undefined ? { telegram: payload.telegram } : {}),
          ...(hasProfilesContact && payload.showTelegram !== undefined ? { showTelegram: payload.showTelegram } : {}),
          ...(hasContactPref && payload.contactPreference !== undefined
            ? { contactPreference: payload.contactPreference }
            : {}),
          ...(payload.ville !== undefined ? { ville: payload.ville } : {}),
          ...(hasProfilesPro && payload.lieu !== undefined ? { lieu: payload.lieu } : {}),
          ...(hasProfilesGeo && payload.lat !== undefined ? { lat: payload.lat } : {}),
          ...(hasProfilesGeo && payload.lng !== undefined ? { lng: payload.lng } : {}),
          ...(hasProfilesShowLocation && payload.showLocation !== undefined ? { showLocation: payload.showLocation } : {}),
          ...(hasProfilesBusiness && payload.businessName !== undefined ? { businessName: payload.businessName } : {}),
          ...(hasProfilesBusiness && payload.address !== undefined ? { address: payload.address } : {}),
          ...(hasProfilesBusiness && payload.openingHours !== undefined ? { openingHours: payload.openingHours } : {}),
          ...(hasProfilesBusiness && payload.roomsCount !== undefined ? { roomsCount: payload.roomsCount } : {}),
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, profileId))
        .returning({
          id: profiles.id,
          ville: profiles.ville,
          lieu: hasProfilesPro ? profiles.lieu : (sql<string | null>`null` as any),
          visible: hasProfilesVisibility ? profiles.visible : (sql<boolean>`true` as any),
          phone: hasProfilesContact ? profiles.phone : (sql<string | null>`null` as any),
          showPhone: hasProfilesContact ? profiles.showPhone : (sql<boolean>`false` as any),
          telegram: hasProfilesContact ? profiles.telegram : (sql<string | null>`null` as any),
          showTelegram: hasProfilesContact ? profiles.showTelegram : (sql<boolean>`false` as any),
          ...(hasContactPref ? { contactPreference: profiles.contactPreference } : {}),
          lat: hasProfilesGeo ? profiles.lat : (sql<number | null>`null` as any),
          lng: hasProfilesGeo ? profiles.lng : (sql<number | null>`null` as any),
          businessName: hasProfilesBusiness ? (profiles as any).businessName : (sql<string | null>`null` as any),
          address: hasProfilesBusiness ? (profiles as any).address : (sql<string | null>`null` as any),
          openingHours: hasProfilesBusiness ? (profiles as any).openingHours : (sql<string | null>`null` as any),
          roomsCount: hasProfilesBusiness ? (profiles as any).roomsCount : (sql<number | null>`null` as any),
        });

      if (payload.lat !== undefined && payload.lng !== undefined) {
        await logIpEvent({
          req,
          kind: "gps_update",
          lat: payload.lat,
          lng: payload.lng,
          accuracy: payload.accuracy ?? null,
        });
        await checkGpsMultiAccount(req, profileId, payload.lat, payload.lng);
      }

      invalidateProfilesCache();
      res.json(updated ?? { id: profileId, visible: payload.visible ?? true });
    }),
  );

  app.post("/api/logout", (req, res) => {
    req.session?.destroy(() => {
      clearSessionCookie(res);
      res.setHeader("Cache-Control", "no-store");
      res.json({ ok: true });
    });
  });

  app.post(
    "/api/uploads/presign",
    asyncHandler(async (req, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ message: "Not logged in" });

      const payload = z
        .object({
          contentType: z.string().min(1),
          filename: z.string().min(1),
          kind: z.enum(["photo", "video"]),
        })
        .parse(req.body);

      // Basic validation to prevent arbitrary uploads
      const ct = payload.contentType.toLowerCase();
      if (payload.kind === "photo" && !ct.startsWith("image/")) {
        return res.status(400).json({ message: "Invalid content type for photo" });
      }
      if (payload.kind === "video" && !(ct.startsWith("video/") || ct === "application/octet-stream")) {
        return res.status(400).json({ message: "Invalid content type for video" });
      }

      const ext = payload.filename.split(".").pop()?.toLowerCase() || "bin";
      const { key, uploadUrl, publicUrl, viewUrl } = await createPresignedUpload({
        contentType: payload.contentType,
        ext,
        kind: payload.kind,
      });

      res.json({ key, uploadUrl, publicUrl, viewUrl });
    }),
  );

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
  });

  app.post(
    "/api/uploads/direct",
    upload.single("file"),
    asyncHandler(async (req, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ message: "Not logged in" });
      if (!req.file) return res.status(400).json({ message: "Missing file" });

      const kind = z.enum(["photo", "video"]).parse(req.body?.kind);
      const ct = String(req.file.mimetype || "").toLowerCase();
      if (kind === "photo" && !ct.startsWith("image/")) {
        return res.status(400).json({ message: "Invalid file type for photo" });
      }
      if (kind === "video" && !(ct.startsWith("video/") || ct === "application/octet-stream")) {
        return res.status(400).json({ message: "Invalid file type for video" });
      }
      const { key, publicUrl, viewUrl } = await uploadBufferToR2({
        buffer: req.file.buffer,
        contentType: req.file.mimetype || "application/octet-stream",
        filename: req.file.originalname || "file.bin",
        kind,
      });

      res.json({ key, publicUrl, viewUrl });
    }),
  );

  app.get(
    "/api/media",
    asyncHandler(async (req, res) => {
      const key = z
        .string()
        .optional()
        .transform((value) => value?.trim() || "")
        .parse(req.query.key);
      const fallbackUrl = sanitizeUrl(
        z
          .string()
          .optional()
          .transform((value) => value?.trim() || "")
          .parse(req.query.fallbackUrl),
      );

      if (!key && !fallbackUrl) {
        return res.status(400).json({ message: "Missing media reference" });
      }

      if (key && (await hasObjectInR2(key))) {
        const signedUrl = await createPresignedRead(key, 60 * 60);
        return res.redirect(signedUrl);
      }

      if (fallbackUrl) {
        return res.redirect(fallbackUrl);
      }

      return res.status(404).json({ message: "Media not found" });
    }),
  );

  app.post(
    "/api/login",
    asyncHandler(async (req, res) => {
      await ensureIpNotBanned(req);

      const payload = z
        .object({
          username: z.string().min(1),
          password: z.string().min(1),
          turnstileToken: z.string().nullable().optional(),
        })
        .parse(req.body);

      const turnstileToken = typeof payload.turnstileToken === "string" ? payload.turnstileToken : undefined;

      if (!(await requireTurnstile(req, res, turnstileToken))) return;

      const identifier = payload.username.trim();
      const identLower = identifier.toLowerCase();
      const [u] = await db
        .select({
          id: users.id,
          username: users.username,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(
          hasUsersEmail
            ? or(
                sql`lower(${users.username}) = ${identLower}`,
                sql`lower(${(users as any).email}) = ${identLower}`,
              )
            : sql`lower(${users.username}) = ${identLower}`,
        )
        .limit(1);

      if (!u || !verifyPassword(payload.password, u.passwordHash)) {
        await logIpEvent({ req, kind: "login_failed" });
        // If the user exists and has an email, after 3 failed attempts we send a reset link (throttled).
        // This is intentionally conservative to avoid spamming.
        if (u && hasUsersEmail && env.RESEND_API_KEY) {
          try {
            const [meta] = await db
              .select({
                email: (users as any).email,
              })
              .from(users)
              .where(eq(users.id, u.id))
              .limit(1);
            const email = (meta as any)?.email ? String((meta as any).email) : null;

            if (email) {
              const sess: any = req.session as any;
              sess.loginFail = sess.loginFail || {};
              const key = String(u.id);
              const now = Date.now();
              const item = sess.loginFail[key] || { count: 0, lastResetSentAt: 0 };
              item.count = Number(item.count || 0) + 1;

              // Send at most once every 30 minutes per user/session.
              const canSendReset = now - Number(item.lastResetSentAt || 0) > 30 * 60_000;
              if (item.count >= 3 && canSendReset) {
                await sendResetPasswordEmail(u.id, email);
                item.lastResetSentAt = now;
                item.count = 0; // reset counter after sending
              }

              sess.loginFail[key] = item;
            }
          } catch (e) {
            // don't block login response on email failures
            console.error("Failed to send auto reset email after failed logins", e);
          }
        }
        return res.status(401).json({ message: "Identifiants invalides" });
      }

      const [p] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.userId, u.id))
        .limit(1);

      if (!p) return res.status(404).json({ message: "Profil introuvable" });

      await establishAuthenticatedSession(req, res, { userId: u.id, profileId: p.id });

      await logIpEvent({ req, kind: "login_success", userId: u.id });

      res.setHeader("Cache-Control", "no-store");
      res.json({
        userId: u.id,
        profileId: p.id,
        csrfToken: req.session.csrfToken,
        sessionToken: createSessionToken({ userId: u.id, profileId: p.id }),
      });
    }),
  );

  app.post(
    "/api/signup",
    asyncHandler(async (req, res) => {
      await ensureIpNotBanned(req);
      if (!(await requireTurnstile(req, res, (req.body as any)?.turnstileToken))) return;
      // Never let signup continue on top of an already-linked session.
      if (req.session?.userId || req.session?.profileId) {
        return res.status(409).json({ message: "Une session est déjà active. Déconnecte-toi d'abord." });
      }
      const payload = signupSchema.parse(req.body);

      const username = payload.username.trim();
      const pending = (req.session as any)?.oauthPending as
        | { provider: "google"; email: string }
        | undefined;
      const pendingEmail = pending?.provider === "google" ? pending.email : null;
      const requestedEmail = hasUsersEmail
        ? payload.email.trim()
          ? payload.email.trim().toLowerCase()
          : null
        : null;
      const emailToUse = requestedEmail ?? pendingEmail;

      if (hasUsersEmail && !emailToUse) {
        return res.status(400).json({ message: "Email requis pour créer un compte" });
      }

      const isGoogleVerifiedSignup = Boolean(pendingEmail && emailToUse && emailToUse === pendingEmail);
      if (hasUsersEmail && hasUsersEmailVerified && !isGoogleVerifiedSignup && !env.RESEND_API_KEY) {
        return res.status(503).json({
          message: "Inscription indisponible pour le moment: la validation email n'est pas configurée.",
        });
      }

      // Basic uniqueness check (we also have DB uniques)
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      if (existing.length) {
        return res.status(409).json({ message: "Identifiant déjà utilisé" });
      }

      if (hasUsersEmail && emailToUse) {
        const existingEmail = await db
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(${(users as any).email}) = ${emailToUse}`)
          .limit(1);
        if (existingEmail.length) {
          return res.status(409).json({ message: "Email déjà utilisé" });
        }
      }

      const passwordHash = hashPassword(payload.password);

      // Limit number of accounts created from the same IP
      const ip = getClientIp(req);
      if (ip) {
        const existingFromIp = await db
          .select({ count: sql<number>`count(distinct ${ipLogs.userId})` })
          .from(ipLogs)
          .where(and(eq(ipLogs.ip, ip), eq(ipLogs.kind, "signup_success")))
          .limit(1);
        const count = existingFromIp[0]?.count ?? 0;
        if (count >= 5) {
          await logIpEvent({ req, kind: "signup_blocked_ip_limit" });
          return res.status(429).json({
            message:
              "Cette adresse IP a déjà créé plusieurs comptes. Pour des raisons de sécurité, contacte l’administrateur pour continuer.",
          });
        }
      }

      let created;
      try {
        created = await db.transaction(async (tx) => {
          const accountType = payload.accountType ?? "profile";
          const defaultPhotoUrl = payload.photoUrl ?? getDefaultProfilePhotoUrl(accountType, req);
          const userValues: any = { username, passwordHash };
          if (hasUsersEmail && emailToUse) {
            userValues.email = emailToUse;
            // If coming from verified Google OAuth, mark email as verified immediately.
            if (hasUsersEmailVerified && isGoogleVerifiedSignup) {
              userValues.emailVerified = true;
              userValues.emailVerificationToken = null;
              userValues.emailVerificationSentAt = null;
            }
          }

          const [u] = await tx
            .insert(users)
            .values(userValues)
            .returning({ id: users.id, createdAt: users.createdAt, email: (users as any).email });

          const [p] = await tx
            .insert(profiles)
            .values({
              userId: u.id,
              pseudo: payload.pseudo.trim(),
              gender: payload.gender,
              age: payload.age,
              ville: payload.ville.trim(),
              ...(hasProfilesPro && payload.lieu !== undefined ? { lieu: payload.lieu } : {}),
              photoUrl: defaultPhotoUrl,
              photoKey: payload.photoKey,
              ...(hasProfilesVisibility ? { visible: true } : {}),
              ...(hasProfilesPro ? { isPro: accountType !== "profile" } : {}),
              ...(hasAccountType ? { accountType } : {}),
              // default availability shown in UI
              ...(hasProfilesPro
                ? { disponibilite: { date: "Aujourd'hui", heureDebut: "18:00", duree: "2h" } }
                : {}),
            })
            .returning({
              id: profiles.id,
              pseudo: profiles.pseudo,
              age: profiles.age,
              ville: profiles.ville,
              verified: profiles.verified,
              photoUrl: profiles.photoUrl,
              isPro: hasProfilesPro ? profiles.isPro : (sql<boolean>`false` as any),
              visible: hasProfilesVisibility ? profiles.visible : (sql<boolean>`true` as any),
            });

          // Optional: seed first photo into media table (for gallery)
          if (hasProfileMedia && defaultPhotoUrl) {
            await tx.insert(profileMedia).values({
              profileId: p.id,
              type: "photo",
              url: defaultPhotoUrl,
              key: payload.photoKey,
              sortOrder: 0,
            });
          }

          return { userId: u.id, userEmail: (u as any).email as string | null, profile: p };
        });
      } catch (error: any) {
        if (String(error?.code ?? "") === "23505") {
          const detail = String(error?.detail ?? "");
          if (detail.includes("(email)=")) {
            return res.status(409).json({ message: "Email déjà utilisé" });
          }
          if (detail.includes("(username)=")) {
            return res.status(409).json({ message: "Identifiant déjà utilisé" });
          }
        }
        throw error;
      }

      await establishAuthenticatedSession(req, res, {
        userId: created.userId,
        profileId: created.profile.id,
      });

      await logIpEvent({ req, kind: "signup_success", userId: created.userId });

      let verificationEmailSent: boolean | null = null;
      let verificationEmailError: string | null = null;
      if (hasUsersEmail && hasUsersEmailVerified) {
        const email = (created as any).userEmail as string | null | undefined;
        if (email) {
          try {
            if (!env.RESEND_API_KEY) {
              verificationEmailSent = false;
              verificationEmailError =
                "Emails indisponibles (RESEND_API_KEY manquante). Contacte l’administrateur.";
            } else {
              // If user was created via Google verified email, do not send verification email.
              if (isGoogleVerifiedSignup) {
                verificationEmailSent = null;
              } else {
                const r = await sendVerificationEmail(created.userId, email);
                verificationEmailSent = Boolean(r.sent);
              }
            }
          } catch (e) {
            console.error("Failed to send verification email on signup", e);
            verificationEmailSent = false;
            verificationEmailError =
              (e as any)?.message ??
              "Impossible d’envoyer l’email de confirmation pour le moment. Vérifie la configuration Resend.";
          }
        }
      }

      invalidateProfilesCache();
      return res.json({
        ...created,
        csrfToken: req.session.csrfToken,
        sessionToken: createSessionToken({ userId: created.userId, profileId: created.profile.id }),
        verificationEmailSent,
        verificationEmailError,
      });
    }),
  );

  app.post(
    "/api/adult-orders",
    asyncHandler(async (req, res) => {
      await ensureIpNotBanned(req);

      const payload = z
        .object({
          productId: z.string().min(1),
          productName: z.string().min(1),
          price: z.string().min(1),
          size: z.string().min(1),
          phone: z.string().min(6).max(32),
          address: z.string().min(4).max(256),
          deliveryTime: z.string().min(2).max(64),
          paymentMethod: z.enum(["delivery", "direct"]),
        })
        .parse(req.body);

      const userId = req.session?.userId as string | undefined;
      if (payload.paymentMethod === "direct" && !userId) {
        return res.status(401).json({ message: "Signup required for direct payment" });
      }

      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        return res.status(500).json({ message: "Commande indisponible (configuration Telegram manquante)" });
      }

      const profileId = req.session?.profileId as string | undefined;

      const textLines = [
        "🧾 *Nouvelle commande produit adulte*",
        "",
        `• Produit: ${payload.productName} (${payload.productId})`,
        `• Prix: ${payload.price} — ${payload.size}`,
        "",
        `• Téléphone: ${payload.phone}`,
        `• Adresse: ${payload.address}`,
        `• Heure de livraison souhaitée: ${payload.deliveryTime}`,
        `• Paiement: ${payload.paymentMethod === "delivery" ? "À la livraison" : "Direct (inscrit)"}`,
        "",
        userId ? `• userId: ${userId}` : "• userId: anonyme",
        profileId ? `• profileId: " + profileId` : "• profileId: inconnu",
        "",
        `• Créé à: ${new Date().toISOString()}`,
      ];

      const text = textLines.join("\n");

      const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      const body = new URLSearchParams({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      });

      const tgRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!tgRes.ok) {
        const errText = await tgRes.text().catch(() => "");
        console.error("Telegram sendMessage failed", tgRes.status, errText);
        return res.status(502).json({ message: "Impossible d’envoyer la commande pour le moment" });
      }

      await logIpEvent({ req, kind: "adult_order", userId });

      return res.json({ ok: true });
    }),
  );

  app.get(
    "/api/salons",
    asyncHandler(async (req, res) => {
      if (!hasSalons) {
        return res.json([]);
      }

      const types =
        typeof req.query.types === "string" && req.query.types.length
          ? String(req.query.types)
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [];

      const limit = z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : 12))
        .pipe(z.number().int().min(1).max(100))
        .parse(req.query.limit);

      const where = and(
        eq(salons.active, true),
        types.length
          ? inArray(salons.type, types as any)
          : undefined,
      );

      const rows = await db
        .select({
          id: salons.id,
          type: salons.type,
          name: salons.name,
          ville: salons.ville,
          address: salons.address,
          description: salons.description,
          openingHours: salons.openingHours,
          mediaUrls: salons.mediaUrls,
          lat: salons.lat,
          lng: salons.lng,
          createdAt: salons.createdAt,
        })
        .from(salons)
        .where(where)
        .orderBy(desc(salons.createdAt))
        .limit(limit);

      res.json(rows);
    }),
  );

  app.get(
    "/api/adult-products",
    asyncHandler(async (req, res) => {
      const ownerProfileId = z
        .string()
        .uuid()
        .optional()
        .parse(req.query.ownerProfileId);
      const salonId = z.string().uuid().optional().parse(req.query.salonId);
      const limit = z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : 100))
        .pipe(z.number().int().min(1).max(200))
        .parse(req.query.limit);

      const rows = await db
        .select({
          id: adultProductsTable.id,
          salonId: adultProductsTable.salonId,
          ownerProfileId: (adultProductsTable as any).ownerProfileId,
          name: adultProductsTable.name,
          subtitle: adultProductsTable.subtitle,
          price: adultProductsTable.price,
          size: adultProductsTable.size,
          description: adultProductsTable.description,
          imageUrl: adultProductsTable.imageUrl,
          tag: adultProductsTable.tag,
          stockQty: (adultProductsTable as any).stockQty,
          placeType: (adultProductsTable as any).placeType,
          createdAt: adultProductsTable.createdAt,
          updatedAt: (adultProductsTable as any).updatedAt,
        })
        .from(adultProductsTable)
        .where(
          and(
            eq(adultProductsTable.active, true),
            ownerProfileId ? eq((adultProductsTable as any).ownerProfileId, ownerProfileId) : undefined,
            salonId ? eq(adultProductsTable.salonId, salonId) : undefined,
          ),
        )
        .orderBy(desc(adultProductsTable.createdAt))
        .limit(limit);

      res.json(rows);
    }),
  );

  app.get(
    "/api/adult-products/:id",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);

      const [row] = await db
        .select({
          id: adultProductsTable.id,
          salonId: adultProductsTable.salonId,
          ownerProfileId: (adultProductsTable as any).ownerProfileId,
          name: adultProductsTable.name,
          subtitle: adultProductsTable.subtitle,
          price: adultProductsTable.price,
          size: adultProductsTable.size,
          description: adultProductsTable.description,
          imageUrl: adultProductsTable.imageUrl,
          tag: adultProductsTable.tag,
          stockQty: (adultProductsTable as any).stockQty,
          placeType: (adultProductsTable as any).placeType,
          createdAt: adultProductsTable.createdAt,
          updatedAt: (adultProductsTable as any).updatedAt,
          active: adultProductsTable.active,
        })
        .from(adultProductsTable)
        .where(and(eq(adultProductsTable.id, id), eq(adultProductsTable.active, true)))
        .limit(1);

      if (!row) return res.status(404).json({ message: "Produit introuvable" });

      res.json(row);
    }),
  );

  // Boutique: manage own products (owner-only)
  app.get(
    "/api/me/adult-products",
    asyncHandler(async (req, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ message: "Not logged in" });

      const rows = await db
        .select({
          id: adultProductsTable.id,
          name: adultProductsTable.name,
          subtitle: adultProductsTable.subtitle,
          price: adultProductsTable.price,
          size: adultProductsTable.size,
          description: adultProductsTable.description,
          imageUrl: adultProductsTable.imageUrl,
          stockQty: (adultProductsTable as any).stockQty,
          placeType: (adultProductsTable as any).placeType,
          active: adultProductsTable.active,
          createdAt: adultProductsTable.createdAt,
        })
        .from(adultProductsTable)
        .where(eq((adultProductsTable as any).ownerProfileId, profileId))
        .orderBy(desc(adultProductsTable.createdAt))
        .limit(200);

      res.json(rows);
    }),
  );

  app.post(
    "/api/me/adult-products",
    asyncHandler(async (req, res) => {
      await ensureIpNotBanned(req);
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ message: "Not logged in" });

      const payload = insertAdultProductSchema
        .pick({
          name: true,
          subtitle: true,
          price: true,
          size: true,
          description: true,
          imageUrl: true,
          stockQty: true,
          placeType: true,
          active: true,
        })
        .parse(req.body);

      const [created] = await db
        .insert(adultProductsTable)
        .values({
          ...(payload as any),
          ownerProfileId: profileId,
          // Avoid categories on public UI
          tag: null,
          updatedAt: new Date(),
        } as any)
        .returning({
          id: adultProductsTable.id,
          name: adultProductsTable.name,
          price: adultProductsTable.price,
          active: adultProductsTable.active,
          createdAt: adultProductsTable.createdAt,
        });

      res.json(created);
    }),
  );

  app.patch(
    "/api/me/adult-products/:id",
    asyncHandler(async (req, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ message: "Not logged in" });
      const id = z.string().uuid().parse(req.params.id);

      const payload = z
        .object({
          name: z.string().min(2).max(160).optional(),
          subtitle: z.string().max(200).nullable().optional(),
          price: z.string().min(1).max(64).optional(),
          size: z.string().max(64).nullable().optional(),
          description: z.string().max(5000).nullable().optional(),
          imageUrl: z.string().url().nullable().optional(),
          stockQty: z.number().int().min(0).max(100000).optional(),
          placeType: z.string().max(32).nullable().optional(),
          active: z.boolean().optional(),
        })
        .parse(req.body);

      const [p] = await db
        .select({ id: adultProductsTable.id, ownerProfileId: (adultProductsTable as any).ownerProfileId })
        .from(adultProductsTable)
        .where(eq(adultProductsTable.id, id))
        .limit(1);
      if (!p) return res.status(404).json({ message: "Not found" });
      if ((p as any).ownerProfileId !== profileId) return res.status(403).json({ message: "Forbidden" });

      const [updated] = await db
        .update(adultProductsTable)
        .set({ ...(payload as any), updatedAt: new Date() } as any)
        .where(eq(adultProductsTable.id, id))
        .returning({
          id: adultProductsTable.id,
          active: adultProductsTable.active,
        });

      res.json(updated);
    }),
  );

  app.get(
    "/api/profiles",
    asyncHandler(async (req, res) => {
    const limit = z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : 50))
      .pipe(z.number().int().min(1).max(200))
      .parse(req.query.limit);

    const verifiedOnly = parseBoolQuery(req.query.verifiedOnly);
    const proOnly = parseBoolQuery(req.query.proOnly);
    const vipOnly = parseBoolQuery(req.query.vipOnly);
    const includeLatestAnnonce = parseBoolQuery(req.query.includeLatestAnnonce) ?? false;
    const servicesFilter = parseServicesQuery(req.query.services);
    const maxDistanceKm = z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : undefined))
      .pipe(z.number().min(0).max(500).optional())
      .parse(req.query.maxDistanceKm);

    const userLat = z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : undefined))
      .pipe(z.number().min(-90).max(90).optional())
      .parse(req.query.lat);
    const userLng = z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : undefined))
      .pipe(z.number().min(-180).max(180).optional())
      .parse(req.query.lng);

    const vipOnlyChoice = vipOnly === undefined ? false : vipOnly;
    const q = {
      verifiedOnly: verifiedOnly === undefined ? false : verifiedOnly,
      proOnly: proOnly === undefined ? false : proOnly,
      limit,
      maxDistanceKm,
      userLat,
      userLng,
      servicesFilter,
    };

    const normalizedServices = [...servicesFilter].sort((a, b) => a.localeCompare(b));
    const cacheKeyParams = {
      limit: q.limit,
      verifiedOnly: q.verifiedOnly,
      proOnly: q.proOnly,
      vipOnly: hasVip ? vipOnlyChoice : false,
      includeLatestAnnonce,
      services: normalizedServices,
      maxDistanceKm: q.maxDistanceKm ?? null,
      userLat: q.userLat ?? null,
      userLng: q.userLng ?? null,
    };
    const cacheKey = `profiles:${JSON.stringify(cacheKeyParams)}`;

    const payload = await getOrSet(
      cacheKey,
      PROFILES_CACHE_TTL_MS,
      async () => {
        const where = and(
          hasProfilesVisibility ? eq(profiles.visible, true) : undefined,
          q.verifiedOnly ? eq(profiles.verified, true) : undefined,
          hasProfilesPro && q.proOnly ? eq(profiles.isPro, true) : undefined,
          hasVip && vipOnlyChoice ? eq((profiles as any).isVip, true) : undefined,
          hasProfilesPro && q.servicesFilter.length
            ? sql`coalesce(${profiles.services}, ARRAY[]::text[]) && ${sqlTextArray(q.servicesFilter)}`
            : undefined,
        );

        const distanceKm =
          hasProfilesGeo && q.userLat !== undefined && q.userLng !== undefined
            ? sql<number>`(6371 * acos(
                cos(radians(${q.userLat})) * cos(radians(${profiles.lat})) *
                cos(radians(${profiles.lng}) - radians(${q.userLng})) +
                sin(radians(${q.userLat})) * sin(radians(${profiles.lat}))
              ))`
            : null;

        const selectFields: any = {
          id: profiles.id,
          pseudo: profiles.pseudo,
          age: profiles.age,
          ville: profiles.ville,
          verified: profiles.verified,
          photoUrl: profiles.photoUrl,
          isPro: hasProfilesPro ? profiles.isPro : (sql<boolean>`false` as any),
          accountType: hasAccountType ? profiles.accountType : (sql<string>`'profile'` as any),
          ...(hasProfilesBusiness
            ? {
                businessName: (profiles as any).businessName,
                address: (profiles as any).address,
                openingHours: (profiles as any).openingHours,
                roomsCount: (profiles as any).roomsCount,
              }
            : {
                businessName: sql<string | null>`null`,
                address: sql<string | null>`null`,
                openingHours: sql<string | null>`null`,
                roomsCount: sql<number | null>`null`,
              }),
          ...(hasVip ? { isVip: (profiles as any).isVip } : {}),
          visible: hasProfilesVisibility ? profiles.visible : (sql<boolean>`true` as any),
          phone: hasProfilesContact ? profiles.phone : (sql<string | null>`null` as any),
          showPhone: hasProfilesContact ? profiles.showPhone : (sql<boolean>`false` as any),
          telegram: hasProfilesContact ? profiles.telegram : (sql<string | null>`null` as any),
          showTelegram: hasProfilesContact ? profiles.showTelegram : (sql<boolean>`false` as any),
          lat: hasProfilesGeo ? profiles.lat : (sql<number | null>`null` as any),
          lng: hasProfilesGeo ? profiles.lng : (sql<number | null>`null` as any),
          tarif: hasProfilesPro ? profiles.tarif : (sql<string | null>`null` as any),
          lieu: hasProfilesPro ? profiles.lieu : (sql<string | null>`null` as any),
          services: hasProfilesPro ? profiles.services : (sql<any>`null` as any),
          disponibilite: hasProfilesPro ? profiles.disponibilite : (sql<any>`null` as any),
          description: hasProfilesPro ? profiles.description : (sql<string | null>`null` as any),
          ...(hasProfileAttrs
            ? {
                corpulence: (profiles as any).corpulence,
                poids: (profiles as any).poids,
                attitude: (profiles as any).attitude,
                boireUnVerre: (profiles as any).boireUnVerre,
                fume: (profiles as any).fume,
                teintePeau: (profiles as any).teintePeau,
                traits: (profiles as any).traits,
                poitrine: (profiles as any).poitrine,
                positions: (profiles as any).positions,
                selfDescriptions: (profiles as any).selfDescriptions,
              }
            : {}),
          distanceKm: distanceKm ?? sql<number>`null`,
        };
        if (hasContactPref) selectFields.contactPreference = profiles.contactPreference;

        const list = await db
          .select(selectFields)
          .from(profiles)
          .where(where)
          .orderBy(distanceKm ? distanceKm : desc(profiles.createdAt))
          .limit(q.limit);

        const filtered =
          distanceKm && q.maxDistanceKm !== undefined
            ? list.filter((p) => p.distanceKm !== null && p.distanceKm <= q.maxDistanceKm!)
            : list;

        const ids = list.map((p) => p.id);
        const latestAnnonceByProfile = new Map<
          string,
          { id: string; title: string; createdAt: string; badges: string[] }
        >();
        const latestAnnonceSortMetaByProfile = new Map<
          string,
          {
            createdAtMs: number;
            topActive: boolean;
            featuredActive: boolean;
            urgentActive: boolean;
            topLastBumpAtMs: number | null;
          }
        >();

        if (hasAnnonces && ids.length) {
          const annonceRows = await db
            .select({
              profileId: annonces.profileId,
              id: annonces.id,
              title: annonces.title,
              createdAt: annonces.createdAt,
              promotion: hasAnnoncesPromotion ? (annonces as any).promotion : (sql<any>`null` as any),
            })
            .from(annonces)
            .where(and(inArray(annonces.profileId, ids), eq(annonces.active, true)))
            .orderBy(annonces.profileId, desc(annonces.createdAt));

          for (const a of annonceRows) {
            if (!latestAnnonceByProfile.has(a.profileId)) {
              const meta = computePromotionMeta({
                annonceCreatedAt: a.createdAt,
                promotion: (a as any).promotion,
              });
              latestAnnonceSortMetaByProfile.set(a.profileId, {
                createdAtMs: new Date(a.createdAt).getTime(),
                topActive: meta.topActive,
                featuredActive: meta.featuredActive,
                urgentActive: meta.urgentActive,
                topLastBumpAtMs: meta.topLastBumpAt ? new Date(meta.topLastBumpAt).getTime() : null,
              });
              latestAnnonceByProfile.set(a.profileId, {
                id: a.id,
                title: a.title,
                createdAt: new Date(a.createdAt).toISOString(),
                badges: meta.badges,
              });
            }
          }
        }

        const sortedProfiles = distanceKm
          ? filtered
          : [...filtered].sort((a: any, b: any) => {
              const aMeta = latestAnnonceSortMetaByProfile.get(a.id) ?? null;
              const bMeta = latestAnnonceSortMetaByProfile.get(b.id) ?? null;

              const aTop = Boolean(aMeta?.topActive);
              const bTop = Boolean(bMeta?.topActive);
              if (aTop !== bTop) return aTop ? -1 : 1;

              const aTopBump = aMeta?.topLastBumpAtMs ?? aMeta?.createdAtMs ?? new Date(a.createdAt).getTime();
              const bTopBump = bMeta?.topLastBumpAtMs ?? bMeta?.createdAtMs ?? new Date(b.createdAt).getTime();
              if (aTopBump !== bTopBump) return bTopBump - aTopBump;

              const aFeatured = Boolean(aMeta?.featuredActive);
              const bFeatured = Boolean(bMeta?.featuredActive);
              if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;

              const aUrgent = Boolean(aMeta?.urgentActive);
              const bUrgent = Boolean(bMeta?.urgentActive);
              if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;

              const aAnnonceCreatedAt = aMeta?.createdAtMs ?? 0;
              const bAnnonceCreatedAt = bMeta?.createdAtMs ?? 0;
              if (aAnnonceCreatedAt !== bAnnonceCreatedAt) return bAnnonceCreatedAt - aAnnonceCreatedAt;

              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

        const mediaRows =
          !hasProfileMedia || ids.length === 0
            ? []
            : await db
                .select({
                  profileId: profileMedia.profileId,
                  type: profileMedia.type,
                  url: profileMedia.url,
                  key: profileMedia.key,
                  sortOrder: profileMedia.sortOrder,
                })
                .from(profileMedia)
                .where(inArray(profileMedia.profileId, ids))
                .orderBy(profileMedia.profileId, profileMedia.sortOrder);

        const mediaByProfile = new Map<
          string,
          {
            photos: Array<{ url: string; key?: string | null }>;
            video: { url: string; key?: string | null } | null;
            cover: { url: string; key?: string | null } | null;
          }
        >();
        for (const id of ids) mediaByProfile.set(id, { photos: [], video: null, cover: null });
        for (const m of mediaRows) {
          const bucket = mediaByProfile.get(m.profileId) ?? { photos: [], video: null, cover: null };
          if (m.type === "photo") {
            bucket.photos.push({ url: m.url, key: m.key });
            if (!bucket.cover) bucket.cover = { url: m.url, key: m.key };
          }
          if (m.type === "video" && !bucket.video) bucket.video = { url: m.url, key: m.key };
          mediaByProfile.set(m.profileId, bucket);
        }

        const payload = await Promise.all(
          sortedProfiles.map(async (p) => {
            const { phone, showPhone, telegram, showTelegram, ...safe } = p as any;
            const preference = (p as any).contactPreference ?? "whatsapp";
            const media = mediaByProfile.get(p.id);
            const sanitizedProfilePhotoUrl = sanitizeUrl(p.photoUrl ?? null);

            const coverUrl = sanitizeUrl(media?.cover?.url ?? null) ?? sanitizedProfilePhotoUrl ?? null;
            const coverKey = media?.cover?.key ?? inferKeyFromUrl(coverUrl);
            const resolvedCover = mediaUrl(req, { key: coverKey, sourceUrl: coverUrl });

            const photoItems = (media?.photos ?? []).slice(0, 12);
            const resolvedPhotos = photoItems.map((ph) => {
              const u = sanitizeUrl(ph.url);
              const key = ph.key ?? inferKeyFromUrl(u);
              return mediaUrl(req, { key, sourceUrl: u });
            });

            const rawVideoUrl = sanitizeUrl(media?.video?.url ?? null);
            const videoKey = media?.video?.key ?? inferKeyFromUrl(rawVideoUrl);
            const resolvedVideo = mediaUrl(req, { key: videoKey, sourceUrl: rawVideoUrl });

            return {
              ...safe,
              latestAnnonce:
                includeLatestAnnonce && latestAnnonceByProfile.has(p.id)
                  ? latestAnnonceByProfile.get(p.id)
                  : null,
              contact: {
                phone: showPhone ? phone ?? null : null,
                telegram: showTelegram ? telegram ?? null : null,
                preference,
              },
              photoUrl: resolvedCover,
              photos: resolvedPhotos.filter((x): x is string => Boolean(x)),
              videoUrl: resolvedVideo,
            };
          }),
        );

        return payload;
      },
      [PROFILES_CACHE_TAG],
    );

    res.json(payload);
    }),
  );

  app.get(
    "/api/annonces",
    asyncHandler(async (req, res) => {
      if (!hasAnnonces) {
        return res.json([]);
      }

      const limit = z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : 20))
        .pipe(z.number().int().min(1).max(50))
        .parse(req.query.limit);

      const verifiedOnly = parseBoolQuery(req.query.verifiedOnly);
      const proOnly = parseBoolQuery(req.query.proOnly);
      const vipOnly = parseBoolQuery(req.query.vipOnly);
      const servicesFilter = parseServicesQuery(req.query.services);
      const maxDistanceKm = z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : undefined))
        .pipe(z.number().min(0).max(500).optional())
        .parse(req.query.maxDistanceKm);

      const userLat = z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : undefined))
        .pipe(z.number().min(-90).max(90).optional())
        .parse(req.query.lat);
      const userLng = z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : undefined))
        .pipe(z.number().min(-180).max(180).optional())
        .parse(req.query.lng);

      const q = {
        verifiedOnly: verifiedOnly === undefined ? false : verifiedOnly,
        proOnly: proOnly === undefined ? false : proOnly,
        limit,
        maxDistanceKm,
        userLat,
        userLng,
        servicesFilter,
      };

      const normalizedServices = [...servicesFilter].sort((a, b) => a.localeCompare(b));
      const cacheKey = `annonces:${JSON.stringify({
        limit: q.limit,
        verifiedOnly: q.verifiedOnly,
        proOnly: q.proOnly,
        vipOnly: vipOnly === undefined ? false : vipOnly,
        services: normalizedServices,
        maxDistanceKm: q.maxDistanceKm ?? null,
        userLat: q.userLat ?? null,
        userLng: q.userLng ?? null,
      })}`;

      const cachedPayload = peek<any[]>(cacheKey);
      if (cachedPayload) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cachedPayload);
      }

      const where = and(
        eq(annonces.active, true),
        hasProfilesVisibility ? eq(profiles.visible, true) : undefined,
        q.verifiedOnly ? eq(profiles.verified, true) : undefined,
        hasProfilesPro && q.proOnly ? eq(profiles.isPro, true) : undefined,
        hasVip && (vipOnly === undefined ? false : vipOnly) ? eq((profiles as any).isVip, true) : undefined,
        hasProfilesPro && q.servicesFilter.length
          ? sql`coalesce(${profiles.services}, ARRAY[]::text[]) && ${sqlTextArray(q.servicesFilter)}`
          : undefined,
      );

      const distanceKm =
        hasProfilesGeo && q.userLat !== undefined && q.userLng !== undefined
          ? sql<number>`(6371 * acos(
              cos(radians(${q.userLat})) * cos(radians(${profiles.lat})) *
              cos(radians(${profiles.lng}) - radians(${q.userLng})) +
              sin(radians(${q.userLat})) * sin(radians(${profiles.lat}))
            ))`
          : null;

      const payload = await getOrSet(
        cacheKey,
        ANNONCES_CACHE_TTL_MS,
        async () => {
      const list = await db
        .select({
          id: annonces.id,
          title: annonces.title,
          body: annonces.body,
          active: annonces.active,
          createdAt: annonces.createdAt,
          promotion: hasAnnoncesPromotion ? (annonces as any).promotion : (sql<any>`null` as any),

          profileId: profiles.id,
          pseudo: profiles.pseudo,
          age: profiles.age,
          ville: profiles.ville,
          verified: profiles.verified,
          isPro: hasProfilesPro ? profiles.isPro : (sql<boolean>`false` as any),
          accountType: hasAccountType ? profiles.accountType : (sql<string>`'profile'` as any),
          ...(hasVip ? { isVip: (profiles as any).isVip } : {}),
          photoUrl: profiles.photoUrl,
          tarif: hasProfilesPro ? profiles.tarif : (sql<string | null>`null` as any),
          lieu: hasProfilesPro ? profiles.lieu : (sql<string | null>`null` as any),
          services: hasProfilesPro ? profiles.services : (sql<any>`null` as any),
          disponibilite: hasProfilesPro ? profiles.disponibilite : (sql<any>`null` as any),
          description: hasProfilesPro ? profiles.description : (sql<string | null>`null` as any),
          ...(hasProfileAttrs
            ? {
                corpulence: (profiles as any).corpulence,
                poids: (profiles as any).poids,
                attitude: (profiles as any).attitude,
                boireUnVerre: (profiles as any).boireUnVerre,
                fume: (profiles as any).fume,
                teintePeau: (profiles as any).teintePeau,
                traits: (profiles as any).traits,
                poitrine: (profiles as any).poitrine,
                positions: (profiles as any).positions,
                selfDescriptions: (profiles as any).selfDescriptions,
              }
            : {}),
          distanceKm: distanceKm ?? sql<number>`null`,
        })
        .from(annonces)
        .innerJoin(profiles, eq(annonces.profileId, profiles.id))
        .where(where)
        .orderBy(distanceKm ? distanceKm : desc(annonces.createdAt))
        .limit(q.limit);

      const filtered =
        distanceKm && q.maxDistanceKm !== undefined
          ? list.filter((a) => a.distanceKm !== null && a.distanceKm <= q.maxDistanceKm!)
          : list;

      // Persistence & ordering: apply "TOP / PREMIUM / URGENT" promotion logic on the feed (non-distance mode).
      // When distance is used, keep distance as primary sort key (we don't want to distort nearby results).
      const sorted = distanceKm
        ? filtered
        : [...filtered].sort((a: any, b: any) => {
            const aMeta = computePromotionMeta({ annonceCreatedAt: a.createdAt, promotion: a.promotion });
            const bMeta = computePromotionMeta({ annonceCreatedAt: b.createdAt, promotion: b.promotion });
            const aBump = aMeta.topLastBumpAt ? new Date(aMeta.topLastBumpAt).getTime() : new Date(a.createdAt).getTime();
            const bBump = bMeta.topLastBumpAt ? new Date(bMeta.topLastBumpAt).getTime() : new Date(b.createdAt).getTime();

            // TOP first
            if (aMeta.topActive !== bMeta.topActive) return aMeta.topActive ? -1 : 1;
            // last bump (or createdAt)
            if (aBump !== bBump) return bBump - aBump;
            // PREMIUM then URGENT
            if (aMeta.featuredActive !== bMeta.featuredActive) return aMeta.featuredActive ? -1 : 1;
            if (aMeta.urgentActive !== bMeta.urgentActive) return aMeta.urgentActive ? -1 : 1;
            // fallback by createdAt
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });

      const ids = sorted.map((a) => a.profileId);
      const mediaRows =
        !hasProfileMedia || ids.length === 0
          ? []
          : await db
              .select({
                profileId: profileMedia.profileId,
                type: profileMedia.type,
                url: profileMedia.url,
                key: profileMedia.key,
                sortOrder: profileMedia.sortOrder,
              })
              .from(profileMedia)
              .where(inArray(profileMedia.profileId, ids))
              .orderBy(profileMedia.profileId, profileMedia.sortOrder);

      const mediaByProfile = new Map<
        string,
        {
          photos: Array<{ url: string; key?: string | null }>;
          video: { url: string; key?: string | null } | null;
          cover: { url: string; key?: string | null } | null;
        }
      >();
      for (const id of ids) mediaByProfile.set(id, { photos: [], video: null, cover: null });
      for (const m of mediaRows) {
        const bucket = mediaByProfile.get(m.profileId) ?? { photos: [], video: null, cover: null };
        if (m.type === "photo") {
          bucket.photos.push({ url: m.url, key: m.key });
          if (!bucket.cover) bucket.cover = { url: m.url, key: m.key };
        }
        if (m.type === "video" && !bucket.video) bucket.video = { url: m.url, key: m.key };
        mediaByProfile.set(m.profileId, bucket);
      }

      const payload = await Promise.all(
        sorted.map(async (a) => {
          const media = mediaByProfile.get(a.profileId);
          const sanitizedProfilePhotoUrl = sanitizeUrl(a.photoUrl ?? null);

          const coverUrl = sanitizeUrl(media?.cover?.url ?? null) ?? sanitizedProfilePhotoUrl ?? null;
          const coverKey = media?.cover?.key ?? inferKeyFromUrl(coverUrl);
          const resolvedCover = mediaUrl(req, { key: coverKey, sourceUrl: coverUrl });

          const photoItems = (media?.photos ?? []).slice(0, 12);
          const resolvedPhotos = photoItems.map((ph) => {
            const u = sanitizeUrl(ph.url);
            const key = ph.key ?? inferKeyFromUrl(u);
            return mediaUrl(req, { key, sourceUrl: u });
          });

          const rawVideoUrl = sanitizeUrl(media?.video?.url ?? null);
          const videoKey = media?.video?.key ?? inferKeyFromUrl(rawVideoUrl);
          const resolvedVideo = mediaUrl(req, { key: videoKey, sourceUrl: rawVideoUrl });

          return {
            id: a.id,
            title: a.title,
            body: a.body,
            active: a.active,
            createdAt: a.createdAt,
            distanceKm: a.distanceKm,
            promotion: (a as any).promotion ?? null,
            promotionMeta: computePromotionMeta({ annonceCreatedAt: a.createdAt, promotion: (a as any).promotion }),
            profile: {
              id: a.profileId,
              pseudo: a.pseudo,
              age: a.age,
              ville: a.ville,
              verified: a.verified,
              isPro: a.isPro,
              accountType: a.accountType,
              ...(hasVip ? { isVip: (a as any).isVip } : {}),
              tarif: a.tarif,
              lieu: a.lieu,
              services: a.services,
              disponibilite: (a as any).disponibilite ?? null,
              description: a.description,
              ...(hasProfileAttrs
                ? ({
                    corpulence: (a as any).corpulence ?? null,
                    poids: (a as any).poids ?? null,
                    attitude: (a as any).attitude ?? null,
                    boireUnVerre: (a as any).boireUnVerre ?? null,
                    fume: (a as any).fume ?? null,
                    teintePeau: (a as any).teintePeau ?? null,
                    traits: (a as any).traits ?? null,
                    poitrine: (a as any).poitrine ?? null,
                    positions: (a as any).positions ?? null,
                    selfDescriptions: (a as any).selfDescriptions ?? null,
                  } as any)
                : {}),
              photoUrl: resolvedCover,
              photos: resolvedPhotos.filter((x): x is string => Boolean(x)),
              videoUrl: resolvedVideo,
            },
          };
        }),
      );

      return payload;
        },
        [ANNONCES_CACHE_TAG],
      );

      res.setHeader("X-Cache", "MISS");
      res.json(payload);
    }),
  );

  // Admin API (VIP + moderation)
  app.get(
    "/api/admin/me",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });
      res.json({ ok: true });
    }),
  );

  // IP bans (used by ensureIpNotBanned)
  app.get(
    "/api/admin/ip-bans",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const rows = await db
        .select({
          id: ipBans.id,
          ipPattern: ipBans.ipPattern,
          reason: ipBans.reason,
          bannedUntil: ipBans.bannedUntil,
          createdAt: ipBans.createdAt,
        })
        .from(ipBans)
        .orderBy(desc(ipBans.createdAt))
        .limit(500);

      res.json(rows);
    }),
  );

  app.post(
    "/api/admin/ip-bans",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const payload = z
        .object({
          ipPattern: z.string().min(3).max(64),
          reason: z.string().max(500).optional().nullable(),
          minutes: z.number().int().min(1).max(60 * 24 * 365).optional().nullable(),
        })
        .parse(req.body);

      const ipPattern = payload.ipPattern.trim();
      const bannedUntil =
        typeof payload.minutes === "number" ? new Date(Date.now() + payload.minutes * 60_000) : null;

      const [created] = await db
        .insert(ipBans)
        .values({
          ipPattern,
          reason: payload.reason ?? null,
          bannedUntil,
        })
        .returning({
          id: ipBans.id,
          ipPattern: ipBans.ipPattern,
          reason: ipBans.reason,
          bannedUntil: ipBans.bannedUntil,
          createdAt: ipBans.createdAt,
        });

      res.json(created);
    }),
  );

  app.delete(
    "/api/admin/ip-bans/:id",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const id = z.string().uuid().parse(req.params.id);
      const [deleted] = await db
        .delete(ipBans)
        .where(eq(ipBans.id, id))
        .returning({ id: ipBans.id });

      res.json(deleted ?? { id });
    }),
  );

  // Ban a user by their most recent IP (from ip_logs)
  app.post(
    "/api/admin/users/:id/ban",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const userId = z.string().uuid().parse(req.params.id);
      const payload = z
        .object({
          reason: z.string().max(500).optional().nullable(),
          minutes: z.number().int().min(1).max(60 * 24 * 365).optional().nullable(),
          ipPattern: z.string().min(3).max(64).optional().nullable(),
        })
        .parse(req.body);

      let ipPattern = payload.ipPattern?.trim() || null;
      if (!ipPattern) {
        const [log] = await db
          .select({ ip: ipLogs.ip })
          .from(ipLogs)
          .where(eq(ipLogs.userId, userId))
          .orderBy(desc(ipLogs.createdAt))
          .limit(1);
        ipPattern = log?.ip ? String(log.ip) : null;
      }

      if (!ipPattern) {
        return res.status(404).json({ message: "No IP found for this user (no logs yet)." });
      }

      const bannedUntil =
        typeof payload.minutes === "number" ? new Date(Date.now() + payload.minutes * 60_000) : null;

      const [created] = await db
        .insert(ipBans)
        .values({
          ipPattern,
          reason: payload.reason ?? `Banned by admin for user ${userId}`,
          bannedUntil,
        })
        .returning({
          id: ipBans.id,
          ipPattern: ipBans.ipPattern,
          reason: ipBans.reason,
          bannedUntil: ipBans.bannedUntil,
          createdAt: ipBans.createdAt,
        });

      res.json({ ok: true, userId, ban: created });
    }),
  );

  app.get(
    "/api/admin/users",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const rows = await db
        .select({
          id: users.id,
          username: users.username,
          email: hasUsersEmail ? (users as any).email : sql<string | null>`null`,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(500);

      res.json(rows);
    }),
  );

  app.post(
    "/api/admin/users/:id/credit",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const userId = z.string().uuid().parse(req.params.id);
      const payload = z
        .object({
          tokens: z.number().int().min(1).max(100000),
          reason: z.string().max(200).optional().nullable(),
        })
        .parse(req.body);

      const updated = await db.transaction(async (tx) => {
        const [u] = await tx
          .update(users)
          .set({
            tokensBalance: sql`coalesce(${users.tokensBalance}, 0) + ${payload.tokens}`,
          } as any)
          .where(eq(users.id, userId))
          .returning({ tokensBalance: users.tokensBalance });

        if (!u) {
          throw Object.assign(new Error("Utilisateur introuvable"), { status: 404 });
        }

        await tx.insert(tokenTransactions).values({
          userId,
          delta: payload.tokens,
          reason: payload.reason ?? "Crédit administrateur",
          meta: {
            grantedBy: req.session?.userId ?? null,
            reason: payload.reason ?? null,
          },
        } as any);

        return u;
      });

      res.json({ ok: true, tokensBalance: Number((updated as any)?.tokensBalance ?? 0) });
    }),
  );

  app.get(
    "/api/admin/profiles",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const rows = await db
        .select({
          id: profiles.id,
          pseudo: profiles.pseudo,
          ville: profiles.ville,
          isPro: profiles.isPro,
          visible: profiles.visible,
          isVip: hasVip ? (profiles as any).isVip : sql<boolean>`false`,
          createdAt: profiles.createdAt,
        })
        .from(profiles)
        .orderBy(desc(profiles.createdAt))
        .limit(500);

      res.json(rows);
    }),
  );

  app.patch(
    "/api/admin/profiles/:id",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });
      if (!hasVip) return res.status(400).json({ message: "VIP not available (run migrations)" });

      const id = z.string().uuid().parse(req.params.id);
      const payload = z.object({ isVip: z.boolean() }).parse(req.body);

      const [updated] = await db
        .update(profiles)
        .set({ isVip: payload.isVip, updatedAt: new Date() } as any)
        .where(eq(profiles.id, id))
        .returning({ id: profiles.id, isVip: (profiles as any).isVip });

      invalidateProfilesCache();
      invalidateAnnoncesCache();
      res.json(updated);
    }),
  );

  app.get(
    "/api/admin/annonces",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const rows = await db
        .select({
          id: annonces.id,
          title: annonces.title,
          active: annonces.active,
          createdAt: annonces.createdAt,
          profileId: annonces.profileId,
          pseudo: profiles.pseudo,
        })
        .from(annonces)
        .innerJoin(profiles, eq(annonces.profileId, profiles.id))
        .orderBy(desc(annonces.createdAt))
        .limit(500);

      res.json(rows);
    }),
  );

  app.patch(
    "/api/admin/annonces/:id",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const annonceId = z.string().uuid().parse(req.params.id);
      const payload = z.object({ active: z.boolean() }).parse(req.body);

      const [updated] = await db
        .update(annonces)
        .set({ active: payload.active })
        .where(eq(annonces.id, annonceId))
        .returning({ id: annonces.id, active: annonces.active });

      invalidateProfilesCache();
      invalidateAnnoncesCache();
      res.json(updated);
    }),
  );

  app.get(
    "/api/admin/salons",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const rows = await db
        .select({
          id: salons.id,
          type: salons.type,
          name: salons.name,
          ville: salons.ville,
          active: salons.active,
          createdAt: salons.createdAt,
        })
        .from(salons)
        .orderBy(desc(salons.createdAt))
        .limit(500);

      res.json(rows);
    }),
  );

  app.post(
    "/api/admin/salons",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const payload = insertSalonSchema.parse(req.body);

      const [created] = await db
        .insert(salons)
        .values({
          ...payload,
          updatedAt: new Date(),
        })
        .returning({
          id: salons.id,
          type: salons.type,
          name: salons.name,
          ville: salons.ville,
          active: salons.active,
          createdAt: salons.createdAt,
        });

      res.json(created);
    }),
  );

  app.get(
    "/api/admin/adult-products",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const rows = await db
        .select({
          id: adultProductsTable.id,
          salonId: adultProductsTable.salonId,
          name: adultProductsTable.name,
          price: adultProductsTable.price,
          active: adultProductsTable.active,
          createdAt: adultProductsTable.createdAt,
        })
        .from(adultProductsTable)
        .orderBy(desc(adultProductsTable.createdAt))
        .limit(500);

      res.json(rows);
    }),
  );

  app.post(
    "/api/admin/adult-products",
    asyncHandler(async (req, res) => {
      const ok = await isAdmin(req);
      if (!ok) return res.status(403).json({ message: "Forbidden" });

      const payload = insertAdultProductSchema.parse(req.body);

      const [created] = await db
        .insert(adultProductsTable)
        .values(payload)
        .returning({
          id: adultProductsTable.id,
          salonId: adultProductsTable.salonId,
          name: adultProductsTable.name,
          price: adultProductsTable.price,
          active: adultProductsTable.active,
          createdAt: adultProductsTable.createdAt,
        });

      res.json(created);
    }),
  );

  app.get(
    "/api/profiles/:id",
    asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);

    const profileSelect: any = {
        id: profiles.id,
        pseudo: profiles.pseudo,
        age: profiles.age,
        ville: profiles.ville,
        verified: profiles.verified,
        photoUrl: profiles.photoUrl,
      isPro: hasProfilesPro ? profiles.isPro : (sql<boolean>`false` as any),
        isVip: hasVip ? (profiles as any).isVip : (sql<boolean>`false` as any),
        accountType: hasAccountType ? profiles.accountType : (sql<string>`'profile'` as any),
        businessName: hasProfilesBusiness ? (profiles as any).businessName : (sql<string | null>`null` as any),
        address: hasProfilesBusiness ? (profiles as any).address : (sql<string | null>`null` as any),
        openingHours: hasProfilesBusiness ? (profiles as any).openingHours : (sql<string | null>`null` as any),
        roomsCount: hasProfilesBusiness ? (profiles as any).roomsCount : (sql<number | null>`null` as any),
      visible: hasProfilesVisibility ? profiles.visible : (sql<boolean>`true` as any),
      phone: hasProfilesContact ? profiles.phone : (sql<string | null>`null` as any),
      showPhone: hasProfilesContact ? profiles.showPhone : (sql<boolean>`false` as any),
      telegram: hasProfilesContact ? profiles.telegram : (sql<string | null>`null` as any),
      showTelegram: hasProfilesContact ? profiles.showTelegram : (sql<boolean>`false` as any),
      tarif: hasProfilesPro ? profiles.tarif : (sql<string | null>`null` as any),
      lieu: hasProfilesPro ? profiles.lieu : (sql<string | null>`null` as any),
      services: hasProfilesPro ? profiles.services : (sql<any>`null` as any),
      disponibilite: hasProfilesPro ? profiles.disponibilite : (sql<any>`null` as any),
      description: hasProfilesPro ? profiles.description : (sql<string | null>`null` as any),
      showLocation: hasProfilesShowLocation ? (profiles as any).showLocation : (sql<boolean>`false` as any),
        ...(hasProfileAttrs
          ? {
              corpulence: (profiles as any).corpulence,
              poids: (profiles as any).poids,
              attitude: (profiles as any).attitude,
              boireUnVerre: (profiles as any).boireUnVerre,
              fume: (profiles as any).fume,
              teintePeau: (profiles as any).teintePeau,
              traits: (profiles as any).traits,
              poitrine: (profiles as any).poitrine,
              positions: (profiles as any).positions,
              selfDescriptions: (profiles as any).selfDescriptions,
            }
          : {}),
      };
    if (hasContactPref) profileSelect.contactPreference = profiles.contactPreference;

    const [p] = await db
      .select(profileSelect)
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);

    if (!p) return res.status(404).json({ message: "Profil introuvable" });

    const media =
      !hasProfileMedia
        ? []
        : await db
            .select({
              id: profileMedia.id,
              type: profileMedia.type,
              url: profileMedia.url,
              key: profileMedia.key,
              sortOrder: profileMedia.sortOrder,
            })
            .from(profileMedia)
            .where(eq(profileMedia.profileId, id))
            .orderBy(profileMedia.sortOrder);

    const photoItems = media.filter((m) => m.type === "photo");
    const resolvedPhotos = photoItems.map((m) => {
      const u = sanitizeUrl(m.url);
      const key = m.key ?? inferKeyFromUrl(u);
      return mediaUrl(req, { key, sourceUrl: u });
    });
    const photos = resolvedPhotos.filter((x): x is string => Boolean(x));

    const video = media.find((m) => m.type === "video") ?? null;
    const rawVideoUrl = sanitizeUrl(video?.url ?? null);
    const videoKey = video?.key ?? inferKeyFromUrl(rawVideoUrl);
    const videoUrl = mediaUrl(req, { key: videoKey, sourceUrl: rawVideoUrl });

    const latestAnnonce =
      !hasAnnonces
        ? []
        : await db
            .select({
              id: annonces.id,
              title: annonces.title,
              body: annonces.body,
              active: annonces.active,
              createdAt: annonces.createdAt,
              promotion: hasAnnoncesPromotion ? (annonces as any).promotion : (sql<any>`null` as any),
            })
            .from(annonces)
            .where(and(eq(annonces.profileId, id), eq(annonces.active, true)))
            .orderBy(desc(annonces.createdAt))
            .limit(1);

    const activeStories =
      !hasStories
        ? []
        : await db
            .select({
              id: stories.id,
              visibility: stories.visibility,
              mediaUrl: stories.mediaUrl,
              mediaKey: stories.mediaKey,
              durationSeconds: stories.durationSeconds,
              caption: stories.caption,
              createdAt: stories.createdAt,
              expiresAt: stories.expiresAt,
            })
            .from(stories)
            .where(
              and(
                eq(stories.profileId, id),
                eq(stories.active, true),
                eq(stories.visibility, "public"),
                or(gt(stories.expiresAt, new Date()), isNull(stories.expiresAt)),
              ),
            )
            .orderBy(desc(stories.createdAt))
            .limit(12);

    const privateVideos =
      !hasStories
        ? []
        : await db
            .select({
              id: stories.id,
              visibility: stories.visibility,
              mediaUrl: stories.mediaUrl,
              mediaKey: stories.mediaKey,
              durationSeconds: stories.durationSeconds,
              caption: stories.caption,
              saleKind: stories.saleKind,
              saleTitle: stories.saleTitle,
              salePrice: stories.salePrice,
              saleDescription: stories.saleDescription,
              createdAt: stories.createdAt,
              active: stories.active,
            })
            .from(stories)
            .where(and(eq(stories.profileId, id), eq(stories.active, true), eq(stories.visibility, "private")))
            .orderBy(desc(stories.createdAt))
            .limit(24);

    const isOwner = req.session?.profileId === id;

    const userLat = z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : undefined))
      .pipe(z.number().min(-90).max(90).optional())
      .parse(req.query.lat);
    const userLng = z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : undefined))
      .pipe(z.number().min(-180).max(180).optional())
      .parse(req.query.lng);

    let distanceKm: number | null = null;
    if (
      hasProfilesGeo &&
      userLat !== undefined &&
      userLng !== undefined &&
      (p as any).lat !== null &&
      (p as any).lng !== null
    ) {
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad((p as any).lat - userLat);
      const dLng = toRad((p as any).lng - userLng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(userLat)) *
          Math.cos(toRad((p as any).lat)) *
          Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distanceKm = Math.round(R * c * 10) / 10;
    }

    let mapUrl: string | null = null;
    const showLocation = hasProfilesShowLocation ? ((p as any).showLocation ?? false) : false;
    const canRevealLocation = isOwner || showLocation;
    if (canRevealLocation) {
      if (
        hasProfilesGeo &&
        (p as any).lat !== null &&
        (p as any).lng !== null &&
        (p as any).lat !== undefined &&
        (p as any).lng !== undefined
      ) {
        const dest = `${(p as any).lat},${(p as any).lng}`;
        mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
      } else {
        const destinationLabel = [
          hasProfilesBusiness ? ((p as any).address ?? null) : null,
          (p as any).lieu ?? null,
          p.ville ?? null,
        ]
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean)
          .join(", ");
        if (destinationLabel) {
          mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationLabel)}`;
        }
      }
    }

    res.json({
      ...p,
      photoUrl:
        photos[0] ??
        mediaUrl(req, {
          key: (p as any).photoKey ?? inferKeyFromUrl(sanitizeUrl(p.photoUrl ?? null)),
          sourceUrl: sanitizeUrl(p.photoUrl ?? null),
        }) ??
        null,
      photos,
      videoUrl,
      distanceKm,
      showLocation,
      mapUrl,
      contact: {
        phone: isOwner ? p.phone ?? null : p.showPhone ? p.phone ?? null : null,
        telegram: isOwner ? p.telegram ?? null : p.showTelegram ? p.telegram ?? null : null,
        showPhone: isOwner ? p.showPhone : undefined,
        showTelegram: isOwner ? p.showTelegram : undefined,
        preference: (p as any).contactPreference ?? "whatsapp",
      },
      stories: activeStories.map((story) => ({
        id: story.id,
        visibility: story.visibility,
        mediaUrl: resolveStoryMedia(req, story),
        durationSeconds: Number(story.durationSeconds ?? 0),
        caption: story.caption ?? null,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
      })),
      privateVideos: privateVideos.map((story) => ({
        id: story.id,
        visibility: story.visibility,
        mediaUrl: isOwner ? resolveStoryMedia(req, story) : null,
        durationSeconds: Number(story.durationSeconds ?? 0),
        caption: story.caption ?? null,
        saleKind: story.saleKind,
        saleTitle: story.saleTitle ?? null,
        salePrice: story.salePrice ?? null,
        saleDescription: story.saleDescription ?? null,
        createdAt: story.createdAt,
        active: story.active,
      })),
      annonce: latestAnnonce[0] ?? null,
    });
    }),
  );

  app.post(
    "/api/annonces",
    asyncHandler(async (req, res) => {
    await ensureIpNotBanned(req);

    const payload = annonceCreateSchema.parse(req.body);
    if (req.session?.profileId !== payload.profileId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const userId = req.session?.userId as string | undefined;
    if (!userId) return res.status(401).json({ message: "Not logged in" });
    if (userId && hasUsersEmail && hasUsersEmailVerified) {
      const [u] = await db
        .select({
          email: (users as any).email,
          emailVerified: (users as any).emailVerified,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!u || !(u as any).email || !(u as any).emailVerified) {
        return res.status(403).json({
          message:
            "Confirme ton email avant de pouvoir publier une annonce (WhatsApp / visibilité). Vérifie ta boîte mail ou ajoute un email dans ton tableau de bord.",
        });
      }
    }

    function findById<T extends { id: number }>(opts: T[], id: number): T | undefined {
      return opts.find((o) => o.id === id);
    }

    function computeTotalTokens(input: {
      promote?: any;
      isVip: boolean;
    }): { totalTokens: number; breakdown: Record<string, number> } {
      const breakdown: Record<string, number> = {};
      let total = 0;

      if (PUBLISHING_CONFIG.publication.enabled) {
        const pub = Math.max(0, Number(PUBLISHING_CONFIG.publication.tokenRequired ?? 0));
        breakdown.publication = pub;
        total += pub;
      }

      const promote = input.promote ?? {};

      if (promote.extended?.optionId) {
        const opt = findById(PUBLISHING_CONFIG.promote.extended.options, Number(promote.extended.optionId));
        if (!opt) {
          throw Object.assign(new Error("Option 'extended' invalide."), { status: 400 });
        }
        const mode = String(promote.extended.paymentMode ?? "tokens");
        if (mode !== "tokens") {
          throw Object.assign(new Error("Paiement en argent non disponible pour la prolongation (utilise des jetons)."), {
            status: 400,
          });
        }
        if (mode === "tokens") {
          breakdown.extended = opt.tokens;
          total += opt.tokens;
        }
      }
      if (promote.featured?.optionId) {
        const opt = findById(PUBLISHING_CONFIG.promote.featured.options, Number(promote.featured.optionId));
        if (!opt) {
          throw Object.assign(new Error("Option 'featured' invalide."), { status: 400 });
        }
        breakdown.featured = opt.tokens;
        total += opt.tokens;
      }
      if (promote.autorenew?.optionId) {
        const opt = findById(PUBLISHING_CONFIG.promote.autorenew.options, Number(promote.autorenew.optionId));
        if (!opt) {
          throw Object.assign(new Error("Option 'autorenew' invalide."), { status: 400 });
        }
        breakdown.autorenew = opt.tokens;
        total += opt.tokens;
      }
      if (promote.urgent?.optionId) {
        const opt = findById(PUBLISHING_CONFIG.promote.urgent.options, Number(promote.urgent.optionId));
        if (!opt) {
          throw Object.assign(new Error("Option 'urgent' invalide."), { status: 400 });
        }
        breakdown.urgent = opt.tokens;
        total += opt.tokens;
      }

      // VIP rule: if both featured + autorenew are selected, discount 1 token (server-side).
      if (
        input.isVip &&
        promote.featured?.optionId &&
        promote.autorenew?.optionId &&
        PUBLISHING_CONFIG.rules?.vip?.discountTokens
      ) {
        const disc = Math.max(0, Number(PUBLISHING_CONFIG.rules.vip.discountTokens));
        breakdown.vipDiscount = -disc;
        total -= disc;
      }

      total = Math.max(0, total);

      const maxTotal = Number(PUBLISHING_CONFIG.rules?.stacking?.maxTotalTokens ?? 20);
      if (Number.isFinite(maxTotal) && total > maxTotal) {
        throw Object.assign(new Error("Trop d’options sélectionnées (limite jetons dépassée)."), { status: 400 });
      }

      return { totalTokens: total, breakdown };
    }

    // Create annonce and update profile with "pro" fields to make it visible/highlighted.
    const created = await db.transaction(async (tx) => {
      const [pMeta] = await tx
        .select({
          userId: profiles.userId,
          isVip: (profiles as any).isVip ?? sql<boolean>`false`,
        })
        .from(profiles)
        .where(eq(profiles.id, payload.profileId))
        .limit(1);

      if (!pMeta) {
        throw Object.assign(new Error("Profil introuvable"), { status: 404 });
      }
      if (pMeta.userId !== userId) {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
      }

      const { totalTokens } = computeTotalTokens({
        promote: payload.promote,
        isVip: Boolean((pMeta as any).isVip),
      });

      // Hard block: no tokens => no publication (when enabled).
      if (PUBLISHING_CONFIG.publication.enabled && totalTokens > 0) {
        const updated = await tx
          .update(users)
          .set({ tokensBalance: sql`${users.tokensBalance} - ${totalTokens}` } as any)
          .where(and(eq(users.id, userId), sql`${users.tokensBalance} >= ${totalTokens}`))
          .returning({ tokensBalance: (users as any).tokensBalance });
        if (!updated.length) {
          throw Object.assign(new Error("Crédit insuffisant, veuillez recharger vos jetons."), { status: 403 });
        }

        await tx.insert(tokenTransactions).values({
          userId,
          delta: -totalTokens,
          reason: "annonce_publish",
          meta: {
            profileId: payload.profileId,
            totalTokens,
            promote: payload.promote ?? null,
          } as any,
        } as any);
      }

      const existing = await tx
        .select({ id: annonces.id })
        .from(annonces)
        .where(and(eq(annonces.profileId, payload.profileId), eq(annonces.active, true)))
        .orderBy(desc(annonces.createdAt))
        .limit(1);

      const shouldCreateNew = payload.forceNew !== false;

      const a = !shouldCreateNew && existing[0]
        ? (
            await tx
              .update(annonces)
              .set({
                title: payload.title.trim(),
                body: payload.body?.trim(),
                active: true,
                promotion: payload.promote ?? null,
              })
              .where(eq(annonces.id, existing[0].id))
              .returning({
                id: annonces.id,
                profileId: annonces.profileId,
                title: annonces.title,
                body: annonces.body,
                createdAt: annonces.createdAt,
              })
          )[0]
        : (
            await tx
              .insert(annonces)
              .values({
                profileId: payload.profileId,
                title: payload.title.trim(),
                body: payload.body?.trim(),
                promotion: payload.promote ?? null,
              })
              .returning({
                id: annonces.id,
                profileId: annonces.profileId,
                title: annonces.title,
                body: annonces.body,
                createdAt: annonces.createdAt,
              })
          )[0];

      await tx
        .update(profiles)
        .set({
          isPro: true,
          tarif: payload.tarif,
          lieu: payload.lieu,
          services: payload.services,
          description: payload.description,
          ...(hasProfileAttrs
            ? ({
                corpulence: payload.corpulence,
                poids: payload.poids,
                attitude: payload.attitude,
                boireUnVerre: payload.boireUnVerre,
                fume: payload.fume,
                teintePeau: payload.teintePeau,
                traits: payload.traits,
                poitrine: payload.poitrine,
                positions: payload.positions,
                selfDescriptions: payload.selfDescriptions,
              } as any)
            : {}),
          disponibilite: payload.disponibilite,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, payload.profileId));

      if (payload.media?.length) {
        // Replace existing media with the one provided by the annonce form (highlight)
        await tx.delete(profileMedia).where(eq(profileMedia.profileId, payload.profileId));

        await tx.insert(profileMedia).values(
          payload.media.map((m, idx) => ({
            profileId: payload.profileId,
            type: m.type,
            url: m.url,
            key: m.key,
            sortOrder: m.sortOrder ?? idx,
          })),
        );
      }

      return a;
    });

    await logIpEvent({ req, kind: "annonce_publish", userId });
    invalidateProfilesCache();
    invalidateAnnoncesCache();
    res.json(created);
    }),
  );

  app.patch(
    "/api/annonces/:id",
    asyncHandler(async (req, res) => {
      const annonceId = z.string().uuid().parse(req.params.id);
      const payload = z.object({ active: z.boolean() }).parse(req.body);
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ message: "Not logged in" });

      const [a] = await db
        .select({ id: annonces.id, profileId: annonces.profileId })
        .from(annonces)
        .where(eq(annonces.id, annonceId))
        .limit(1);
      if (!a) return res.status(404).json({ message: "Not found" });
      if (a.profileId !== profileId) return res.status(403).json({ message: "Forbidden" });

      const [updated] = await db
        .update(annonces)
        .set({ active: payload.active })
        .where(eq(annonces.id, annonceId))
        .returning({ id: annonces.id, active: annonces.active });

      invalidateProfilesCache();
      invalidateAnnoncesCache();
      res.json(updated);
    }),
  );

  app.get(
    "/api/stories",
    asyncHandler(async (req, res) => {
      if (!hasStories) return res.json([]);

      const rows = await db
        .select({
          id: stories.id,
          profileId: stories.profileId,
          visibility: stories.visibility,
          mediaUrl: stories.mediaUrl,
          mediaKey: stories.mediaKey,
          durationSeconds: stories.durationSeconds,
          caption: stories.caption,
          createdAt: stories.createdAt,
          expiresAt: stories.expiresAt,
          pseudo: profiles.pseudo,
          ville: profiles.ville,
          profilePhotoUrl: profiles.photoUrl,
          accountType: hasAccountType ? profiles.accountType : (sql<string>`'profile'` as any),
          visible: hasProfilesVisibility ? profiles.visible : (sql<boolean>`true` as any),
          phone: hasProfilesContact ? profiles.phone : (sql<string | null>`null` as any),
          showPhone: hasProfilesContact ? profiles.showPhone : (sql<boolean>`false` as any),
          telegram: hasProfilesContact ? profiles.telegram : (sql<string | null>`null` as any),
          showTelegram: hasProfilesContact ? profiles.showTelegram : (sql<boolean>`false` as any),
          contactPreference: hasContactPref ? profiles.contactPreference : (sql<string | null>`null` as any),
        })
        .from(stories)
        .innerJoin(profiles, eq(stories.profileId, profiles.id))
        .where(
          and(
            eq(stories.active, true),
            or(
              and(eq(stories.visibility, "public"), or(gt(stories.expiresAt, new Date()), isNull(stories.expiresAt))),
              eq(stories.visibility, "private"),
            ),
          ),
        )
        .orderBy(desc(stories.createdAt))
        .limit(80);

      const fallbackVideoRows =
        hasProfileMedia && rows.length < 20
          ? await db
              .select({
                profileId: profileMedia.profileId,
                mediaUrl: profileMedia.url,
                mediaKey: profileMedia.key,
                createdAt: profileMedia.createdAt,
                pseudo: profiles.pseudo,
                ville: profiles.ville,
                profilePhotoUrl: profiles.photoUrl,
                accountType: hasAccountType ? profiles.accountType : (sql<string>`'profile'` as any),
                phone: hasProfilesContact ? profiles.phone : (sql<string | null>`null` as any),
                showPhone: hasProfilesContact ? profiles.showPhone : (sql<boolean>`false` as any),
                telegram: hasProfilesContact ? profiles.telegram : (sql<string | null>`null` as any),
                showTelegram: hasProfilesContact ? profiles.showTelegram : (sql<boolean>`false` as any),
                contactPreference: hasContactPref ? profiles.contactPreference : (sql<string | null>`null` as any),
              })
              .from(profileMedia)
              .innerJoin(profiles, eq(profileMedia.profileId, profiles.id))
              .where(and(eq(profileMedia.type, "video")))
              .orderBy(desc(profileMedia.createdAt))
              .limit(80)
          : [];

      const grouped = new Map<string, any>();
      for (const row of rows) {
        if (!grouped.has(row.profileId)) {
          grouped.set(row.profileId, {
            profile: {
              id: row.profileId,
              pseudo: row.pseudo,
              ville: row.ville,
              accountType: row.accountType,
              photoUrl: sanitizeUrl(row.profilePhotoUrl ?? null),
              contact: {
                phone: row.showPhone ? row.phone ?? null : null,
                telegram: row.showTelegram ? row.telegram ?? null : null,
                preference: row.contactPreference ?? null,
              },
            },
            items: [],
            latestCreatedAt: row.createdAt,
          });
        }

        const entry = grouped.get(row.profileId);
        entry.items.push({
          id: row.id,
          mediaUrl: row.visibility === "private" ? null : resolveStoryMedia(req, row),
          visibility: row.visibility,
          isLocked: row.visibility === "private",
          durationSeconds: Number(row.durationSeconds ?? 0),
          caption: row.caption ?? null,
          createdAt: row.createdAt,
          expiresAt: row.expiresAt,
        });
      }

      for (const row of fallbackVideoRows) {
        if (grouped.has(row.profileId)) continue;
        grouped.set(row.profileId, {
          profile: {
            id: row.profileId,
            pseudo: row.pseudo,
            ville: row.ville,
            accountType: row.accountType,
            photoUrl: sanitizeUrl(row.profilePhotoUrl ?? null),
            contact: {
              phone: row.showPhone ? row.phone ?? null : null,
              telegram: row.showTelegram ? row.telegram ?? null : null,
              preference: row.contactPreference ?? null,
            },
          },
          items: [
            {
              id: `profile-video-${row.profileId}`,
              mediaUrl: null,
              visibility: "private",
              isLocked: true,
              durationSeconds: 0,
              caption: "Vidéo privée",
              createdAt: row.createdAt,
            },
          ],
          latestCreatedAt: row.createdAt,
        });
      }

      res.json(Array.from(grouped.values()).slice(0, 20));
    }),
  );

  app.get(
    "/api/me/stories",
    asyncHandler(async (req, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ message: "Not logged in" });
      if (!hasStories) return res.json([]);

      const rows = await db
        .select({
          id: stories.id,
          visibility: stories.visibility,
          mediaUrl: stories.mediaUrl,
          mediaKey: stories.mediaKey,
          durationSeconds: stories.durationSeconds,
          caption: stories.caption,
          saleKind: stories.saleKind,
          saleTitle: stories.saleTitle,
          salePrice: stories.salePrice,
          saleDescription: stories.saleDescription,
          active: stories.active,
          expiresAt: stories.expiresAt,
          createdAt: stories.createdAt,
        })
        .from(stories)
        .where(eq(stories.profileId, profileId))
        .orderBy(desc(stories.createdAt))
        .limit(50);

      res.json(
        rows.map((story) => ({
          ...story,
          mediaUrl: resolveStoryMedia(req, story),
          durationSeconds: Number(story.durationSeconds ?? 0),
          caption: story.caption ?? null,
          saleTitle: story.saleTitle ?? null,
          salePrice: story.salePrice ?? null,
          saleDescription: story.saleDescription ?? null,
        })),
      );
    }),
  );

  app.post(
    "/api/me/stories",
    asyncHandler(async (req, res) => {
      const userId = req.session?.userId as string | undefined;
      const profileId = req.session?.profileId as string | undefined;
      if (!userId || !profileId) return res.status(401).json({ message: "Not logged in" });
      if (!hasStories) {
        return res.status(503).json({ message: "Stories indisponibles tant que la migration base de données n'est pas appliquée." });
      }

      const payload = storyCreateSchema.parse(req.body);
      const effectiveVisibility = payload.durationSeconds > STORY_PUBLIC_MAX_SECONDS ? "private" : payload.visibility;
      const saleKind = effectiveVisibility === "private" ? payload.saleKind ?? "none" : "none";

      if (payload.durationSeconds > STORY_PRIVATE_MAX_SECONDS) {
        return res.status(400).json({ message: `La vidéo dépasse la limite de ${STORY_PRIVATE_MAX_SECONDS} secondes.` });
      }

      const [created] = await db.transaction(async (tx) => {
        const [profileMeta] = await tx
          .select({ userId: profiles.userId })
          .from(profiles)
          .where(eq(profiles.id, profileId))
          .limit(1);

        if (!profileMeta) {
          throw Object.assign(new Error("Profil introuvable"), { status: 404 });
        }
        if (profileMeta.userId !== userId) {
          throw Object.assign(new Error("Forbidden"), { status: 403 });
        }

        const [{ count: storiesCountRaw }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(stories)
          .where(eq(stories.profileId, profileId));

        const storiesCount = Number(storiesCountRaw ?? 0);
        const isFirstFreeStory =
          storiesCount < STORY_FREE_STORY_LIMIT &&
          effectiveVisibility === "public" &&
          payload.durationSeconds <= STORY_PUBLIC_MAX_SECONDS;

        if (isFirstFreeStory) {
          await tx.insert(tokenTransactions).values({
            userId,
            delta: 0,
            reason: "story_publish_free",
            meta: {
              profileId,
              visibility: effectiveVisibility,
              durationSeconds: payload.durationSeconds,
              saleKind,
              freeStory: true,
            } as any,
          } as any);
        } else {
          const updated = await tx
            .update(users)
            .set({ tokensBalance: sql`${users.tokensBalance} - ${STORY_PUBLISH_TOKEN_COST}` } as any)
            .where(and(eq(users.id, userId), sql`${users.tokensBalance} >= ${STORY_PUBLISH_TOKEN_COST}`))
            .returning({ tokensBalance: users.tokensBalance });

          if (!updated.length) {
            throw Object.assign(new Error("Crédit insuffisant, veuillez recharger vos jetons."), {
              status: 403,
            });
          }

          await tx.insert(tokenTransactions).values({
            userId,
            delta: -STORY_PUBLISH_TOKEN_COST,
            reason: "story_publish",
            meta: {
              profileId,
              visibility: effectiveVisibility,
              durationSeconds: payload.durationSeconds,
              saleKind,
            } as any,
          } as any);
        }

        const expiresAt =
          effectiveVisibility === "public"
            ? new Date(Date.now() + STORY_PUBLIC_TTL_HOURS * 60 * 60 * 1000)
            : null;

        return await tx
          .insert(stories)
          .values({
            profileId,
            visibility: effectiveVisibility,
            mediaUrl: payload.mediaUrl,
            mediaKey: payload.mediaKey,
            durationSeconds: payload.durationSeconds,
            caption: payload.caption?.trim() || null,
            saleKind,
            saleTitle: effectiveVisibility === "private" ? payload.saleTitle?.trim() || null : null,
            salePrice: effectiveVisibility === "private" ? payload.salePrice?.trim() || null : null,
            saleDescription: effectiveVisibility === "private" ? payload.saleDescription?.trim() || null : null,
            expiresAt,
          })
          .returning({
            id: stories.id,
            visibility: stories.visibility,
            mediaUrl: stories.mediaUrl,
            mediaKey: stories.mediaKey,
            durationSeconds: stories.durationSeconds,
            caption: stories.caption,
            saleKind: stories.saleKind,
            saleTitle: stories.saleTitle,
            salePrice: stories.salePrice,
            saleDescription: stories.saleDescription,
            active: stories.active,
            expiresAt: stories.expiresAt,
            createdAt: stories.createdAt,
          });
      });

      res.json({
        ...created,
        mediaUrl: resolveStoryMedia(req, created),
        durationSeconds: Number(created.durationSeconds ?? 0),
      });
    }),
  );

  app.patch(
    "/api/me/stories/:id",
    asyncHandler(async (req, res) => {
      const storyId = z.string().uuid().parse(req.params.id);
      const profileId = req.session?.profileId as string | undefined;
      if (!profileId) return res.status(401).json({ message: "Not logged in" });
      if (!hasStories) return res.status(404).json({ message: "Stories indisponibles" });

      const payload = z.object({ active: z.boolean() }).parse(req.body);
      const [current] = await db
        .select({ id: stories.id, profileId: stories.profileId })
        .from(stories)
        .where(eq(stories.id, storyId))
        .limit(1);

      if (!current) return res.status(404).json({ message: "Story introuvable" });
      if (current.profileId !== profileId) return res.status(403).json({ message: "Forbidden" });

      const [updated] = await db
        .update(stories)
        .set({ active: payload.active })
        .where(eq(stories.id, storyId))
        .returning({ id: stories.id, active: stories.active });

      res.json(updated);
    }),
  );

  app.get(
    "/api/me/annonces",
    asyncHandler(async (req, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ message: "Not logged in" });

      const rows = await db
        .select({
          id: annonces.id,
          title: annonces.title,
          body: annonces.body,
          active: annonces.active,
          createdAt: annonces.createdAt,
          promotion: annonces.promotion,
        })
        .from(annonces)
        .where(eq(annonces.profileId, profileId))
        .orderBy(desc(annonces.createdAt))
        .limit(50);

      res.json(rows);
    }),
  );

  return httpServer;
}
