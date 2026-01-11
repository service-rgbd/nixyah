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
import { and, desc, eq, inArray, or, sql, gt, isNull } from "drizzle-orm";
import { createPresignedRead, createPresignedUpload } from "./uploads";
import { uploadBufferToR2 } from "./uploads";
import multer from "multer";
import {
  hasProfilesAttributesColumns,
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
  const env = getEnv();

  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  const resendFrom = env.RESEND_FROM ?? "NIXYAH <no-reply@nixyah.com>";

  function appUrl(path: string): string {
    const base = env.APP_BASE_URL || "http://localhost:5000";
    return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  }

  function generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async function sendVerificationEmail(userId: string, email: string) {
    if (!resend) {
      console.warn("RESEND_API_KEY not configured – skipping verification email");
      return;
    }

    const token = generateToken();
    const sentAt = new Date();

    await db
      .update(users as any)
      .set({
        emailVerificationToken: token,
        emailVerificationSentAt: sentAt,
        emailVerified: false,
      })
      .where(eq(users.id, userId));

    const verifyLink = appUrl(`/email/verify?token=${encodeURIComponent(token)}`);

    await resend.emails.send({
      from: resendFrom,
      to: email,
      subject: "Confirme ton email – NIXYAH",
      html: `
        <p>Bonjour,</p>
        <p>Merci d'avoir créé un compte sur <strong>NIXYAH</strong>.</p>
        <p>Pour sécuriser ton espace et pouvoir publier des annonces (WhatsApp / visibilité), clique sur le lien ci-dessous&nbsp;:</p>
        <p><a href="${verifyLink}" target="_blank" rel="noopener">Confirmer mon email</a></p>
        <p>Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet email.</p>
        <p>— L'équipe NIXYAH</p>
      `,
      text: `Merci d'avoir créé un compte sur NIXYAH.\n\nClique sur ce lien pour confirmer ton email : ${verifyLink}\n\nSi tu n'es pas à l'origine de cette demande, ignore ce message.`,
    });
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

    await resend.emails.send({
      from: resendFrom,
      to: email,
      subject: "Réinitialise ton mot de passe – NIXYAH",
      html: `
        <p>Bonjour,</p>
        <p>Tu as demandé à réinitialiser ton mot de passe sur <strong>NIXYAH</strong>.</p>
        <p>Clique sur le lien suivant pour choisir un nouveau mot de passe (valable 1 heure)&nbsp;:</p>
        <p><a href="${resetLink}" target="_blank" rel="noopener">Réinitialiser mon mot de passe</a></p>
        <p>Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet email.</p>
        <p>— L'équipe NIXYAH</p>
      `,
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
      .select({ username: users.username, email: hasUsersEmail ? (users as any).email : sql<string | null>`null` })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!u) return false;
    const adminEmail = env.ADMIN_EMAIL.toLowerCase();
    const email = (u as any).email ? String((u as any).email).toLowerCase() : null;
    const username = String(u.username).toLowerCase();
    return (email && email === adminEmail) || username === adminEmail;
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

  app.get(
    "/api/support",
    asyncHandler(async (_req, res) => {
      res.json({
        resetEmail: env.ADMIN_EMAIL ?? "Ra.fils27@hotmail.com",
        telegramUrl: (env as any).SUPPORT_TELEGRAM_URL ?? "https://t.me/+cNj_edHZTyc2YWE0",
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

      const [u] = await db
        .update(users as any)
        .set({
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
        })
        .where(eq((users as any).emailVerificationToken, payload.token))
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
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!u) return res.status(404).json({ message: "User not found" });

      res.json({
        username: u.username,
        email: (u as any).email ?? null,
        emailVerified: (u as any).emailVerified ?? false,
      });
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

      if (payload.email && hasUsersEmail && hasUsersEmailVerified) {
        try {
          await sendVerificationEmail(u.id, payload.email);
        } catch (e) {
          console.error("Failed to send verification email on /api/me/account", e);
        }
      }

      res.json({
        username: u.username,
        email: (u as any).email ?? null,
        emailVerified: (u as any).emailVerified ?? false,
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
        })
        .parse(req.body);

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
      // User can only create one profile per session
      if (req.session?.profileId) {
        return res.status(409).json({ message: "Profil déjà créé" });
      }
      const payload = signupSchema.parse(req.body);

      const username = payload.username.trim();

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
        if (hasUsersEmail && payload.email) {
          userValues.email = payload.email.trim().toLowerCase();
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

      await logIpEvent({ req, kind: "signup_success", userId: created.userId });

      if (hasUsersEmail && hasUsersEmailVerified) {
        const email = (created as any).userEmail as string | null | undefined;
        if (email) {
          try {
            await sendVerificationEmail(created.userId, email);
          } catch (e) {
            console.error("Failed to send verification email on signup", e);
          }
        }
      }

      return res.json(created);
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
    asyncHandler(async (_req, res) => {
      const rows = await db
        .select({
          id: adultProductsTable.id,
          salonId: adultProductsTable.salonId,
          name: adultProductsTable.name,
          subtitle: adultProductsTable.subtitle,
          price: adultProductsTable.price,
          size: adultProductsTable.size,
          description: adultProductsTable.description,
          imageUrl: adultProductsTable.imageUrl,
          tag: adultProductsTable.tag,
          createdAt: adultProductsTable.createdAt,
        })
        .from(adultProductsTable)
        .where(eq(adultProductsTable.active, true))
        .orderBy(desc(adultProductsTable.createdAt))
        .limit(100);

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
          name: adultProductsTable.name,
          subtitle: adultProductsTable.subtitle,
          price: adultProductsTable.price,
          size: adultProductsTable.size,
          description: adultProductsTable.description,
          imageUrl: adultProductsTable.imageUrl,
          tag: adultProductsTable.tag,
          createdAt: adultProductsTable.createdAt,
          active: adultProductsTable.active,
        })
        .from(adultProductsTable)
        .where(and(eq(adultProductsTable.id, id), eq(adultProductsTable.active, true)))
        .limit(1);

      if (!row) return res.status(404).json({ message: "Produit introuvable" });

      res.json(row);
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
      { id: string; title: string; createdAt: string }
    >();

    if (includeLatestAnnonce && ids.length) {
      const annonceRows = await db
        .select({
          profileId: annonces.profileId,
          id: annonces.id,
          title: annonces.title,
          createdAt: annonces.createdAt,
        })
        .from(annonces)
        .where(and(inArray(annonces.profileId, ids), eq(annonces.active, true)))
        .orderBy(annonces.profileId, desc(annonces.createdAt));

      for (const a of annonceRows) {
        if (!latestAnnonceByProfile.has(a.profileId)) {
          latestAnnonceByProfile.set(a.profileId, {
            id: a.id,
            title: a.title,
            createdAt: new Date(a.createdAt).toISOString(),
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

      const ids = filtered.map((a) => a.profileId);
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
        filtered.map(async (a) => {
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
        accountType: profiles.accountType,
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
      showLocation &&
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

    // Create annonce and update profile with "pro" fields to make it visible/highlighted.
    const created = await db.transaction(async (tx) => {
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
