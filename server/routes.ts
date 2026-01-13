import type { Express } from "express";
import { type Server } from "http";
import { z } from "zod";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./auth";
import {
  annonceCreateSchema,
  profiles,
  profileMedia,
  signupSchema,
  users,
  annonces,
  salons,
  adultProductsTable,
  insertSalonSchema,
  insertAdultProductSchema,
  ipLogs,
  ipBans,
} from "@shared/schema";
import { PUBLISHING_CONFIG } from "@shared/publishing-config";
import { and, desc, eq, inArray, or, sql, gt, isNull } from "drizzle-orm";
import { createPresignedRead, createPresignedUpload } from "./uploads";
import { uploadBufferToR2 } from "./uploads";
import multer from "multer";
import {
  hasProfilesAttributesColumns,
  hasProfilesBusinessColumns,
  hasProfilesContactPreferenceColumn,
  hasProfilesVipColumn,
  hasUsersEmailColumn,
  hasUsersEmailVerificationColumns,
} from "./db-capabilities";
import { getEnv } from "./env";
import { Resend } from "resend";
import crypto from "crypto";

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

function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>,
): (req: any, res: any, next: any) => void {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      if (err?.name === "ZodError") {
        return res.status(400).json({ message: "Invalid request", details: err.errors });
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
  const env = getEnv();

  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  const resendFrom = env.RESEND_FROM ?? "NIXYAH <no-reply@nixyah.com>";

  const googleClientId = (env as any).GOOGLE_CLIENT_ID as string | undefined;
  const googleClientSecret = (env as any).GOOGLE_CLIENT_SECRET as string | undefined;
  const googleRedirectUri = (env as any).GOOGLE_REDIRECT_URI as string | undefined;

  function normalizeFrontendBase(input: string): string {
    const base = String(input || "").trim() || "http://localhost:5000";
    const withScheme = /^https?:\/\//i.test(base) ? base : `https://${base}`;
    const clean = withScheme.replace(/\/+$/, "");
    // Safety: if someone mistakenly sets APP_BASE_URL to the API host, convert api.* -> root.
    // Example: https://api.nixyah.com -> https://nixyah.com
    return clean.replace(/^https?:\/\/api\./i, (m) => m.replace(/api\./i, ""));
  }

  function appUrl(path: string): string {
    const base = normalizeFrontendBase(env.APP_BASE_URL || "http://localhost:5000");
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }

  function deriveCookieDomainFromAppBase(): string | undefined {
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

  function saveSession(req: any): Promise<void> {
    return new Promise((resolve) => {
      if (!req.session) return resolve();
      req.session.save(() => resolve());
    });
  }

  async function redirectAfterSessionSave(req: any, res: any, url: string): Promise<void> {
    await saveSession(req);
    res.redirect(url);
  }

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

  function renderEmailLayout(opts: {
    title: string;
    intro: string;
    body?: string;
    buttonLabel?: string;
    buttonUrl?: string;
    footer?: string;
  }): string {
    const button = opts.buttonLabel && opts.buttonUrl
      ? `
        <tr>
          <td align="center" style="padding: 24px 24px 8px 24px;">
            <a href="${opts.buttonUrl}" target="_blank" rel="noopener"
              style="
                display: inline-block;
                padding: 12px 24px;
                border-radius: 999px;
                background: linear-gradient(135deg,#ec4899,#8b5cf6);
                color: #ffffff;
                font-size: 14px;
                font-weight: 600;
                text-decoration: none;
                letter-spacing: 0.02em;
              "
            >
              ${opts.buttonLabel}
            </a>
          </td>
        </tr>
      `
      : "";

    const body = opts.body
      ? `<tr>
            <td style="padding: 0 24px 8px 24px; font-size: 14px; line-height: 1.6; color: #4b5563;">
              ${opts.body}
            </td>
          </tr>`
      : "";

    const footer = opts.footer
      ? `<tr>
            <td style="padding: 16px 24px 0 24px; font-size: 11px; line-height: 1.5; color: #9ca3af;">
              ${opts.footer}
            </td>
          </tr>`
      : "";

    return `
      <div style="background-color:#0b0b10;padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background-color:#0f172a;border-radius:24px;border:1px solid rgba(148,163,184,0.35);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <tr>
            <td style="padding:20px 24px 8px 24px;border-bottom:1px solid rgba(148,163,184,0.25);">
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:32px;height:32px;border-radius:999px;background:linear-gradient(135deg,#ec4899,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;">N</div>
                <div style="font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">NIXYAH</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 4px 24px;">
              <h1 style="margin:0;font-size:18px;line-height:1.4;font-weight:600;color:#e5e7eb;">
                ${opts.title}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 8px 24px;font-size:14px;line-height:1.6;color:#9ca3af;">
              ${opts.intro}
            </td>
          </tr>
          ${body}
          ${button}
          ${footer}
          <tr>
            <td style="padding:24px 24px 24px 24px;font-size:11px;line-height:1.6;color:#6b7280;border-top:1px solid rgba(31,41,55,0.8);">
              Cet email est envoyé automatiquement par la plateforme NIXYAH. Merci de ne pas y répondre directement.
            </td>
          </tr>
        </table>
      </div>
    `;
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
    const sentAt = new Date();

    // Store token first so the link is valid even if the user clicks quickly.
    await db
      .update(users as any)
      .set({
        emailVerificationToken: token,
        emailVerificationSentAt: sentAt,
        emailVerified: false,
      })
      .where(eq(users.id, userId));

    const verifyLink = appUrl(`/email/verify?token=${encodeURIComponent(token)}`);

    try {
      const html = renderEmailLayout({
        title: "Confirme ton email pour activer ton espace",
        intro:
          "Merci d'avoir créé un compte sur <strong>NIXYAH</strong>. Nous te demandons de confirmer ton adresse email pour sécuriser ton espace et activer la publication d'annonces.",
        body:
          "Clique sur le bouton ci‑dessous pour confirmer ton email. Si tu n'es pas à l'origine de cette demande, tu peux ignorer ce message.",
        buttonLabel: "Confirmer mon email",
        buttonUrl: verifyLink,
        footer:
          "Après confirmation, tu pourras publier des annonces, gérer ta visibilité et mettre à jour tes informations en quelques clics.",
      });

      const result = await resend.emails.send({
        from: resendFrom,
        to: email,
        subject: "Confirme ton email – NIXYAH",
        html,
        text: `Merci d'avoir créé un compte sur NIXYAH.\n\nClique sur ce lien pour confirmer ton email : ${verifyLink}\n\nSi tu n'es pas à l'origine de cette demande, ignore ce message.`,
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
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await db
      .update(users as any)
      .set({
        resetPasswordToken: token,
        resetPasswordExpiresAt: expiresAt,
      })
      .where(eq(users.id, userId));

    const resetLink = appUrl(`/password/reset?token=${encodeURIComponent(token)}`);

    const html = renderEmailLayout({
      title: "Réinitialise ton mot de passe",
      intro:
        "Tu as demandé à réinitialiser ton mot de passe sur <strong>NIXYAH</strong>.",
      body:
        "Pour choisir un nouveau mot de passe, clique sur le bouton ci‑dessous. Ce lien est valable pendant <strong>1 heure</strong> pour des raisons de sécurité.",
      buttonLabel: "Choisir un nouveau mot de passe",
      buttonUrl: resetLink,
      footer:
        "Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet email. Ton mot de passe actuel restera valide.",
    });

    await resend.emails.send({
      from: resendFrom,
      to: email,
      subject: "Réinitialise ton mot de passe – NIXYAH",
      html,
      text: `Tu as demandé à réinitialiser ton mot de passe sur NIXYAH.\n\nLien (valable 1h) : ${resetLink}\n\nSi tu n'es pas à l'origine de cette demande, ignore ce message.`,
    });
  }

  async function isAdmin(req: any): Promise<boolean> {
    // 1) Optional token override (useful for scripts)
    const token = String(req.get?.("x-admin-token") ?? "");
    if (env.ADMIN_TOKEN && token && token === env.ADMIN_TOKEN) return true;

    // 2) Session-based admin (preferred): compare email (or fallback to username for backward-compat)
    const userId = req.session?.userId as string | undefined;
    if (!userId) return false;
    if (!env.ADMIN_EMAIL) return false;

    const [u] = await db
      .select({
        username: users.username,
        email: hasUsersEmail ? (users as any).email : sql<string | null>`null`,
        emailVerified: hasUsersEmailVerified ? (users as any).emailVerified : sql<boolean>`false`,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!u) return false;
    const adminEmail = env.ADMIN_EMAIL.toLowerCase();
    const email = (u as any).email ? String((u as any).email).toLowerCase() : null;
    const username = String(u.username).toLowerCase();
    // If email-based admin is used, require verified email (when column exists).
    if (email && email === adminEmail) {
      if (hasUsersEmailVerified && !(u as any).emailVerified) return false;
      return true;
    }
    return username === adminEmail;
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

      req.session.userId = (u as any).id;
      req.session.profileId = p.id;

      await logIpEvent({ req, kind: "login_success_google", userId: (u as any).id });

      // If state points to signup (common mistake), prefer dashboard for existing users.
      return await redirectAfterSessionSave(req, res, appUrl(state));
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
            options: PUBLISHING_CONFIG.promote.extended.options.map((o) => ({
              ...o,
              pricePromo: Math.round(o.price * PROMO_FACTOR),
              promoPercent: 30,
            })),
          },
        },
        // Keep backend-only rules off the public config by default.
      });
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
            eq((users as any).emailVerificationToken, payload.token),
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

      const now = new Date();

      const [u] = await db
        .select({
          id: users.id,
          resetPasswordExpiresAt: (users as any).resetPasswordExpiresAt,
        })
        .from(users)
        .where(eq((users as any).resetPasswordToken, payload.token))
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

  app.get("/api/me", (req, res) => {
    res.json({
      userId: req.session?.userId ?? null,
      profileId: req.session?.profileId ?? null,
    });
  });

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
          ...(payload.visible === undefined ? {} : { visible: payload.visible }),
          ...(payload.phone === undefined ? {} : { phone: payload.phone }),
          ...(payload.showPhone === undefined ? {} : { showPhone: payload.showPhone }),
          ...(payload.telegram === undefined ? {} : { telegram: payload.telegram }),
          ...(payload.showTelegram === undefined ? {} : { showTelegram: payload.showTelegram }),
          ...(hasContactPref && payload.contactPreference !== undefined
            ? { contactPreference: payload.contactPreference }
            : {}),
          ...(payload.lat === undefined ? {} : { lat: payload.lat }),
          ...(payload.lng === undefined ? {} : { lng: payload.lng }),
          ...(payload.showLocation === undefined ? {} : { showLocation: payload.showLocation }),
          ...(hasProfilesBusiness && payload.businessName !== undefined ? { businessName: payload.businessName } : {}),
          ...(hasProfilesBusiness && payload.address !== undefined ? { address: payload.address } : {}),
          ...(hasProfilesBusiness && payload.openingHours !== undefined ? { openingHours: payload.openingHours } : {}),
          ...(hasProfilesBusiness && payload.roomsCount !== undefined ? { roomsCount: payload.roomsCount } : {}),
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, profileId))
        .returning({
          id: profiles.id,
          visible: profiles.visible,
          phone: profiles.phone,
          showPhone: profiles.showPhone,
          telegram: profiles.telegram,
          showTelegram: profiles.showTelegram,
          ...(hasContactPref ? { contactPreference: profiles.contactPreference } : {}),
          lat: profiles.lat,
          lng: profiles.lng,
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

      res.json(updated ?? { id: profileId, visible: payload.visible ?? true });
    }),
  );

  app.post("/api/logout", (req, res) => {
    req.session?.destroy(() => {
      // Best-effort cookie clear (default cookie name used by express-session)
      res.clearCookie("connect.sid");
      const domain = deriveCookieDomainFromAppBase();
      if (domain) {
        res.clearCookie("connect.sid", { path: "/", domain });
      }
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

  app.post(
    "/api/login",
    asyncHandler(async (req, res) => {
      await ensureIpNotBanned(req);

      const payload = z
        .object({
          username: z.string().min(1),
          password: z.string().min(1),
          turnstileToken: z.string().optional(),
        })
        .parse(req.body);

      if (!(await requireTurnstile(req, res, (payload as any).turnstileToken))) return;

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

      req.session.userId = u.id;
      req.session.profileId = p.id;

      await logIpEvent({ req, kind: "login_success", userId: u.id });

      res.json({ userId: u.id, profileId: p.id });
    }),
  );

  app.post(
    "/api/signup",
    asyncHandler(async (req, res) => {
      await ensureIpNotBanned(req);
      if (!(await requireTurnstile(req, res, (req.body as any)?.turnstileToken))) return;
      // User can only create one profile per session
      if (req.session?.profileId) {
        return res.status(409).json({ message: "Profil déjà créé" });
      }
      const payload = signupSchema.parse(req.body);

      const username = payload.username.trim();
      const pending = (req.session as any)?.oauthPending as
        | { provider: "google"; email: string }
        | undefined;
      const pendingEmail = pending?.provider === "google" ? pending.email : null;

      // Basic uniqueness check (we also have DB uniques)
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      if (existing.length) {
        return res.status(409).json({ message: "Identifiant déjà utilisé" });
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

      const created = await db.transaction(async (tx) => {
        const accountType = payload.accountType ?? "profile";
        const userValues: any = { username, passwordHash };
        if (hasUsersEmail) {
          const rawEmail = payload.email?.trim() ? payload.email.trim().toLowerCase() : null;
          const emailToUse = rawEmail ?? pendingEmail;
          if (emailToUse) {
            userValues.email = emailToUse;
            // If coming from verified Google OAuth, mark email as verified immediately.
            if (hasUsersEmailVerified && pendingEmail && emailToUse === pendingEmail) {
              userValues.emailVerified = true;
              userValues.emailVerificationToken = null;
              userValues.emailVerificationSentAt = null;
            }
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
            lieu: payload.lieu,
            photoUrl: payload.photoUrl,
            photoKey: payload.photoKey,
            visible: true,
            isPro: accountType !== "profile",
            accountType,
            // default availability shown in UI
            disponibilite: { date: "Aujourd'hui", heureDebut: "18:00", duree: "2h" },
          })
          .returning({
            id: profiles.id,
            pseudo: profiles.pseudo,
            age: profiles.age,
            ville: profiles.ville,
            verified: profiles.verified,
            photoUrl: profiles.photoUrl,
            isPro: profiles.isPro,
            visible: profiles.visible,
          });

        // Optional: seed first photo into media table (for gallery)
        if (payload.photoUrl) {
          await tx.insert(profileMedia).values({
            profileId: p.id,
            type: "photo",
            url: payload.photoUrl,
            key: payload.photoKey,
            sortOrder: 0,
          });
        }

        return { userId: u.id, userEmail: (u as any).email as string | null, profile: p };
      });

      req.session.userId = created.userId;
      req.session.profileId = created.profile.id;
      // Clear pending OAuth if we just created a profile (avoid reusing on next signup).
      if ((req.session as any)?.oauthPending) {
        (req.session as any).oauthPending = null;
      }

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
              const wasGoogleVerified = Boolean(pendingEmail && email.toLowerCase() === pendingEmail.toLowerCase());
              if (wasGoogleVerified) {
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

      return res.json({
        ...created,
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

    const q = {
      verifiedOnly: verifiedOnly === undefined ? false : verifiedOnly,
      proOnly: proOnly === undefined ? false : proOnly,
      limit,
      maxDistanceKm,
      userLat,
      userLng,
      servicesFilter,
    };

    const where = and(
      eq(profiles.visible, true),
      q.verifiedOnly ? eq(profiles.verified, true) : undefined,
      q.proOnly ? eq(profiles.isPro, true) : undefined,
      hasVip && (vipOnly === undefined ? false : vipOnly) ? eq((profiles as any).isVip, true) : undefined,
      q.servicesFilter.length
        ? sql`coalesce(${profiles.services}, ARRAY[]::text[]) && ${sqlTextArray(q.servicesFilter)}`
        : undefined,
    );

    const distanceKm =
      q.userLat !== undefined && q.userLng !== undefined
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
        isPro: profiles.isPro,
        accountType: profiles.accountType,
        businessName: hasProfilesBusiness ? (profiles as any).businessName : (sql<string | null>`null` as any),
        address: hasProfilesBusiness ? (profiles as any).address : (sql<string | null>`null` as any),
        openingHours: hasProfilesBusiness ? (profiles as any).openingHours : (sql<string | null>`null` as any),
        roomsCount: hasProfilesBusiness ? (profiles as any).roomsCount : (sql<number | null>`null` as any),
        ...(hasVip ? { isVip: (profiles as any).isVip } : {}),
        visible: profiles.visible,
        phone: profiles.phone,
        showPhone: profiles.showPhone,
        telegram: profiles.telegram,
        showTelegram: profiles.showTelegram,
        lat: profiles.lat,
        lng: profiles.lng,
        tarif: profiles.tarif,
        lieu: profiles.lieu,
        services: profiles.services,
        disponibilite: profiles.disponibilite,
        description: profiles.description,
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

    // Media: keep it light for list view (first photo + first video)
    const ids = list.map((p) => p.id);
    const latestAnnonceByProfile = new Map<
      string,
      { id: string; title: string; createdAt: string; badges: string[] }
    >();

    if (includeLatestAnnonce && ids.length) {
      const annonceRows = await db
        .select({
          profileId: annonces.profileId,
          id: annonces.id,
          title: annonces.title,
          createdAt: annonces.createdAt,
          promotion: (annonces as any).promotion,
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
          latestAnnonceByProfile.set(a.profileId, {
            id: a.id,
            title: a.title,
            createdAt: new Date(a.createdAt).toISOString(),
            badges: meta.badges,
          });
        }
      }
    }
    const mediaRows =
      ids.length === 0
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
      filtered.map(async (p) => {
        const { phone, showPhone, telegram, showTelegram, ...safe } = p as any;
        const preference = (p as any).contactPreference ?? "whatsapp";
        const media = mediaByProfile.get(p.id);
        const sanitizedProfilePhotoUrl = sanitizeUrl(p.photoUrl ?? null);

        const coverUrl = sanitizeUrl(media?.cover?.url ?? null) ?? sanitizedProfilePhotoUrl ?? null;
        const coverKey = media?.cover?.key ?? inferKeyFromUrl(coverUrl);

        let resolvedCover = coverUrl;
        if (coverKey) {
          try {
            resolvedCover = await createPresignedRead(coverKey, 60 * 60 * 24 * 7);
          } catch {
            // fallback to url if signing fails
          }
        }

        const photoItems = (media?.photos ?? []).slice(0, 12);
        const resolvedPhotos = await Promise.all(
          photoItems.map(async (ph) => {
            const u = sanitizeUrl(ph.url);
            const key = ph.key ?? inferKeyFromUrl(u);
            if (key) {
              try {
                return await createPresignedRead(key, 60 * 60 * 24 * 7);
              } catch {
                return u;
              }
            }
            return u;
          }),
        );

        let resolvedVideo = sanitizeUrl(media?.video?.url ?? null);
        const videoKey = media?.video?.key ?? inferKeyFromUrl(resolvedVideo);
        if (videoKey) {
          try {
            resolvedVideo = await createPresignedRead(videoKey, 60 * 60 * 24 * 7);
          } catch {
            // keep url
          }
        }

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

    res.json(payload);
    }),
  );

  app.get(
    "/api/annonces",
    asyncHandler(async (req, res) => {
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

      const where = and(
        eq(annonces.active, true),
        eq(profiles.visible, true),
        q.verifiedOnly ? eq(profiles.verified, true) : undefined,
        q.proOnly ? eq(profiles.isPro, true) : undefined,
        hasVip && (vipOnly === undefined ? false : vipOnly) ? eq((profiles as any).isVip, true) : undefined,
        q.servicesFilter.length
          ? sql`coalesce(${profiles.services}, ARRAY[]::text[]) && ${sqlTextArray(q.servicesFilter)}`
          : undefined,
      );

      const distanceKm =
        q.userLat !== undefined && q.userLng !== undefined
          ? sql<number>`(6371 * acos(
              cos(radians(${q.userLat})) * cos(radians(${profiles.lat})) *
              cos(radians(${profiles.lng}) - radians(${q.userLng})) +
              sin(radians(${q.userLat})) * sin(radians(${profiles.lat}))
            ))`
          : null;

      const list = await db
        .select({
          id: annonces.id,
          title: annonces.title,
          body: annonces.body,
          active: annonces.active,
          createdAt: annonces.createdAt,
          promotion: (annonces as any).promotion,

          profileId: profiles.id,
          pseudo: profiles.pseudo,
          age: profiles.age,
          ville: profiles.ville,
          verified: profiles.verified,
          isPro: profiles.isPro,
          accountType: profiles.accountType,
          ...(hasVip ? { isVip: (profiles as any).isVip } : {}),
          photoUrl: profiles.photoUrl,
          tarif: profiles.tarif,
          lieu: profiles.lieu,
          services: profiles.services,
          description: profiles.description,
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
        ids.length === 0
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

          let resolvedCover = coverUrl;
          if (coverKey) {
            try {
              resolvedCover = await createPresignedRead(coverKey, 60 * 60 * 24 * 7);
            } catch {
              // keep url
            }
          }

          const photoItems = (media?.photos ?? []).slice(0, 12);
          const resolvedPhotos = await Promise.all(
            photoItems.map(async (ph) => {
              const u = sanitizeUrl(ph.url);
              const key = ph.key ?? inferKeyFromUrl(u);
              if (key) {
                try {
                  return await createPresignedRead(key, 60 * 60 * 24 * 7);
                } catch {
                  return u;
                }
              }
              return u;
            }),
          );

          let resolvedVideo = sanitizeUrl(media?.video?.url ?? null);
          const videoKey = media?.video?.key ?? inferKeyFromUrl(resolvedVideo);
          if (videoKey) {
            try {
              resolvedVideo = await createPresignedRead(videoKey, 60 * 60 * 24 * 7);
            } catch {
              // keep url
            }
          }

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
              ...(hasVip ? { isVip: (a as any).isVip } : {}),
              tarif: a.tarif,
              lieu: a.lieu,
              services: a.services,
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
        isPro: profiles.isPro,
        isVip: (profiles as any).isVip ?? sql<boolean>`false`,
        accountType: profiles.accountType,
        businessName: hasProfilesBusiness ? (profiles as any).businessName : (sql<string | null>`null` as any),
        address: hasProfilesBusiness ? (profiles as any).address : (sql<string | null>`null` as any),
        openingHours: hasProfilesBusiness ? (profiles as any).openingHours : (sql<string | null>`null` as any),
        roomsCount: hasProfilesBusiness ? (profiles as any).roomsCount : (sql<number | null>`null` as any),
        visible: profiles.visible,
        phone: profiles.phone,
        showPhone: profiles.showPhone,
        telegram: profiles.telegram,
        showTelegram: profiles.showTelegram,
        tarif: profiles.tarif,
        lieu: profiles.lieu,
        services: profiles.services,
        disponibilite: profiles.disponibilite,
        description: profiles.description,
        showLocation: (profiles as any).showLocation,
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

    const media = await db
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
    const resolvedPhotos = await Promise.all(
      photoItems.map(async (m) => {
        const u = sanitizeUrl(m.url);
        const key = m.key ?? inferKeyFromUrl(u);
        if (key) {
          try {
            return await createPresignedRead(key, 60 * 60 * 24 * 7);
          } catch {
            return u;
          }
        }
        return u;
      }),
    );
    const photos = resolvedPhotos.filter((x): x is string => Boolean(x));

    const video = media.find((m) => m.type === "video") ?? null;
    let videoUrl = sanitizeUrl(video?.url ?? null);
    const videoKey = video?.key ?? inferKeyFromUrl(videoUrl);
    if (videoKey) {
      try {
        videoUrl = await createPresignedRead(videoKey, 60 * 60 * 24 * 7);
      } catch {
        // keep url
      }
    }

    const latestAnnonce = await db
      .select({
        id: annonces.id,
        title: annonces.title,
        body: annonces.body,
        active: annonces.active,
        createdAt: annonces.createdAt,
        promotion: (annonces as any).promotion,
      })
      .from(annonces)
      .where(and(eq(annonces.profileId, id), eq(annonces.active, true)))
      .orderBy(desc(annonces.createdAt))
      .limit(1);

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
    const showLocation = (p as any).showLocation ?? false;
    if (
      (p as any).lat !== null &&
      (p as any).lng !== null &&
      (p as any).lat !== undefined &&
      (p as any).lng !== undefined
    ) {
      const dest = `${(p as any).lat},${(p as any).lng}`;
      mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
    }

    res.json({
      ...p,
      photoUrl: photos[0] ?? sanitizeUrl(p.photoUrl ?? null) ?? null,
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
        if (mode === "tokens") {
          breakdown.extended = opt.tokens;
          total += opt.tokens;
        } else {
          breakdown.extended = 0;
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
          throw Object.assign(new Error("Solde de jetons insuffisant : publication refusée."), { status: 403 });
        }
      }

      const existing = await tx
        .select({ id: annonces.id })
        .from(annonces)
        .where(and(eq(annonces.profileId, payload.profileId), eq(annonces.active, true)))
        .orderBy(desc(annonces.createdAt))
        .limit(1);

      const a = existing[0]
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

      res.json(updated);
    }),
  );

  return httpServer;
}
