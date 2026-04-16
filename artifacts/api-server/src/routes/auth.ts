import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, chefProfilesTable, courierProfilesTable, merchantProfilesTable } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken } from "../lib/auth.js";
import crypto from "crypto";
import { isOwnedUploadUrl } from "../lib/uploads.js";
import { buildReferralCode } from "../lib/commerce.js";
import { resolveReferralCode } from "../lib/fulfillment.js";
import { buildApiRateLimiter } from "../lib/rate-limit.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM ?? "no-reply@example.com";
const RESEND_USER_AGENT = "Ivory-Diaspora/1.0";
const MOBILE_APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? "mobile://";

function normalizeApiBaseUrl(rawValue: string | undefined): string | null {
  if (!rawValue) {
    return null;
  }

  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const url = new URL(withProtocol);
    const normalizedPath = url.pathname.replace(/\/+$/, "");
    url.pathname = normalizedPath.endsWith("/api") ? normalizedPath : `${normalizedPath}/api`;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const API_BASE_URL =
  normalizeApiBaseUrl(process.env.API_PUBLIC_URL) ??
  normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL) ??
  "https://api.nixyah.com/api";

function hashRateLimitSegment(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function joinUrl(base: string, path: string) {
  const normalizedPath = path.replace(/^\/+/, "");
  if (base.endsWith("/")) {
    return `${base}${normalizedPath}`;
  }
  return `${base}/${normalizedPath}`;
}

function withQuery(base: string, params: Record<string, string | undefined>) {
  const query = Object.entries(params)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
    .join("&");
  return query ? `${base}?${query}` : base;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderConfirmationPage({
  title,
  message,
  tone,
  openAppUrl,
}: {
  title: string;
  message: string;
  tone: "success" | "error";
  openAppUrl: string;
}) {
  const accent = tone === "success" ? "#0F766E" : "#B45309";
  const button = tone === "success" ? "Ouvrir Nixyah" : "Retourner a Nixyah";
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(openAppUrl)}" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #FFF7ED; color: #1F2937; }
      .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .card { width: 100%; max-width: 520px; background: #ffffff; border-radius: 28px; padding: 28px; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12); border: 1px solid rgba(217, 119, 6, 0.14); }
      .badge { display: inline-block; padding: 8px 14px; border-radius: 999px; background: rgba(212, 97, 26, 0.10); color: ${accent}; font-weight: 700; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
      h1 { margin: 18px 0 10px; font-size: 28px; line-height: 1.2; }
      p { margin: 0; font-size: 15px; line-height: 1.7; color: #4B5563; }
      .actions { margin-top: 24px; }
      .button { display: inline-block; padding: 14px 20px; border-radius: 16px; background: ${accent}; color: #ffffff; text-decoration: none; font-weight: 700; }
      .note { margin-top: 16px; font-size: 13px; color: #6B7280; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <span class="badge">Nixyah</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <div class="actions">
          <a class="button" href="${escapeHtml(openAppUrl)}">${button}</a>
        </div>
        <p class="note">Si l'application ne s'ouvre pas automatiquement, appuyez de nouveau sur le bouton.</p>
      </div>
    </div>
  </body>
</html>`;
}

async function sendConfirmationEmail(to: string, name: string, token: string) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping email send");
    return;
  }
  const appConfirmUrl = withQuery(joinUrl(MOBILE_APP_URL, "/auth/confirm"), { token });
  const browserConfirmUrl = withQuery(joinUrl(API_BASE_URL, "/auth/confirm"), { token });
  const body = {
    from: RESEND_FROM,
    to,
    subject: "Confirmez votre adresse email — Nixyah",
    html: `<!doctype html>
      <html lang="fr">
        <body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;color:#1F2937;">
          <div style="padding:24px 12px;">
            <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #E5E7EB;">
              <div style="padding:28px 28px 18px;background:#C4522A;color:#ffffff;">
                <div style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Nixyah</div>
                <h1 style="margin:16px 0 8px;font-size:28px;line-height:1.25;color:#ffffff;">Confirmez votre adresse email</h1>
                <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.92);">Bonjour ${escapeHtml(name)}, validez votre adresse email pour finaliser l'activation de votre compte.</p>
              </div>
              <div style="padding:28px;">
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#4B5563;">Utilisez le bouton ci-dessous pour ouvrir Nixyah et confirmer votre email.</p>
                <a href="${appConfirmUrl}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#C4522A;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">Confirmer mon email</a>
                <p style="margin:22px 0 8px;font-size:13px;line-height:1.7;color:#6B7280;">Si le bouton ne fonctionne pas, utilisez ce lien de secours :</p>
                <a href="${browserConfirmUrl}" style="font-size:13px;line-height:1.7;color:#C4522A;word-break:break-word;text-decoration:none;">${browserConfirmUrl}</a>
                <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E5E7EB;">
                  <p style="margin:0;font-size:12px;line-height:1.7;color:#9CA3AF;">Si vous n'etes pas a l'origine de cette demande, ignorez simplement cet email.</p>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>`,
  };

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "User-Agent": RESEND_USER_AGENT,
    },
    body: JSON.stringify(body),
  }).then(async (r) => {
    if (!r.ok) {
      const errorText = await r.text().catch(() => "");
      console.warn("Resend send failed", r.status, errorText || r.statusText);
    }
  }).catch((e) => console.warn("Resend error", e));
}
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { parseWithSchema } from "../lib/validation.js";
import { courierVerificationDossierSchema } from "../lib/request-schemas.js";

const router: IRouter = Router();

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function hashConfirmationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizePassword(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return value.length > 0 ? value : null;
}

function buildIdentityKey(baseKey: string, value: string | null, prefix: string) {
  if (!value) {
    return `${prefix}:${baseKey}`;
  }

  return `${prefix}:${hashRateLimitSegment(value)}:${baseKey}`;
}

const authLoginLimiter = buildApiRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: "Trop de tentatives de connexion. Reessayez plus tard.",
  keyGenerator(req, baseKey) {
    const rawIdentifier = typeof req.body?.emailOrPhone === "string" ? req.body.emailOrPhone.trim() : "";
    const normalizedIdentifier = normalizeEmail(rawIdentifier) ?? normalizePhone(rawIdentifier) ?? null;
    return buildIdentityKey(baseKey, normalizedIdentifier, "auth-login");
  },
});

const resendConfirmationLimiter = buildApiRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 4,
  message: "Trop de demandes de renvoi. Reessayez plus tard.",
  keyGenerator(req, baseKey) {
    return buildIdentityKey(baseKey, normalizeEmail(req.body?.email), "auth-resend-confirmation");
  },
});

const changeEmailLimiter = buildApiRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 4,
  message: "Trop de tentatives de changement d'email. Reessayez plus tard.",
  keyGenerator(req, baseKey) {
    return buildIdentityKey(baseKey, normalizeEmail(req.body?.newEmail), "auth-change-email");
  },
});

const confirmEmailLimiter = buildApiRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: "Trop de tentatives de confirmation. Reessayez plus tard.",
  keyGenerator(req, baseKey) {
    const token = typeof req.query?.token === "string" ? req.query.token.trim() : "";
    return buildIdentityKey(baseKey, token || null, "auth-confirm");
  },
});

function getPasswordPolicyError(password: string): string | null {
  if (password.length < 10) {
    return "Le mot de passe doit contenir au moins 10 caracteres";
  }

  if (password.length > 72) {
    return "Le mot de passe depasse la longueur maximale autorisee";
  }

  return null;
}

function buildChefProfile(user: any, profile: any) {
  return {
    id: String(profile.id),
    userId: String(profile.userId),
    name: user.name,
    specialty: profile.specialty,
    location: profile.location,
    zone: profile.zone,
    bio: profile.bio,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    stars: profile.stars ?? 0,
    complaintCount: profile.complaintCount ?? 0,
    activeInvestigationCount: profile.activeInvestigationCount ?? 0,
    isFeatured: Boolean(profile.isFeatured),
    priceRange: profile.priceRange,
    isVerified: profile.isVerified,
    isOnline: profile.isOnline,
    coverColor: user.coverColor,
    responseTime: profile.responseTime,
  };
}

function buildCourierProfile(profile: any) {
  const verificationDocuments = {
    identityDocumentUrl: profile.identityDocumentUrl ?? null,
    driverLicenseUrl: profile.driverLicenseUrl ?? null,
    vehicleRegistrationUrl: profile.vehicleRegistrationUrl ?? null,
    vehiclePhotoUrl: profile.vehiclePhotoUrl ?? null,
    selfiePhotoUrl: profile.selfiePhotoUrl ?? null,
  };
  const missingDocuments = Object.entries(verificationDocuments)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    id: String(profile.id),
    userId: String(profile.userId),
    zone: profile.zone,
    vehicleType: profile.vehicleType,
    verificationDocuments,
    isDossierComplete: missingDocuments.length === 0,
    missingDocuments,
    dossierSubmittedAt: profile.dossierSubmittedAt ? profile.dossierSubmittedAt.toISOString() : null,
    isAvailable: profile.isAvailable,
    isVerified: profile.isVerified,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    stars: profile.stars ?? 0,
    complaintCount: profile.complaintCount ?? 0,
    activeInvestigationCount: profile.activeInvestigationCount ?? 0,
    bonusEarnedAmount: profile.bonusEarnedAmount ?? 0,
    bonusUnlockedAt: profile.bonusUnlockedAt ? profile.bonusUnlockedAt.toISOString() : null,
    currentLatitude: profile.currentLatitude ?? null,
    currentLongitude: profile.currentLongitude ?? null,
    lastLocationAt: profile.lastLocationAt ? profile.lastLocationAt.toISOString() : null,
  };
}

function buildMerchantProfile(profile: any) {
  return {
    id: String(profile.id),
    userId: String(profile.userId),
    businessName: profile.businessName,
    contactEmail: profile.contactEmail ?? null,
    contactPhone: profile.contactPhone ?? null,
    bio: profile.bio ?? "",
    isVerified: Boolean(profile.isVerified),
  };
}

function toSafeUser(user: any, extraProfiles?: { chefProfile?: any; courierProfile?: any; merchantProfile?: any }) {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    type: user.type,
    location: user.location,
    coverColor: user.coverColor,
    avatarUrl: user.avatarUrl ?? null,
    referralCode: user.referralCode ?? null,
    freeDeliveryCredits: user.freeDeliveryCredits ?? 0,
    chefProfile: extraProfiles?.chefProfile ?? null,
    courierProfile: extraProfiles?.courierProfile ?? null,
    merchantProfile: extraProfiles?.merchantProfile ?? null,
  };
}

async function resolveReferrerUserId(input: unknown) {
  if (typeof input !== "string" || !input.trim()) {
    return null;
  }

  const referrer = await resolveReferralCode(input.trim().toUpperCase());
  return referrer?.id ?? null;
}

async function assignReferralCode(userId: number, name: string) {
  const referralCode = buildReferralCode(name, userId);
  await db.update(usersTable).set({ referralCode }).where(eq(usersTable.id, userId));
  return referralCode;
}

async function createEmailConfirmation(userId: number, email: string, name: string) {
  const confirmToken = crypto.randomBytes(32).toString("hex");
  const confirmTokenHash = hashConfirmationToken(confirmToken);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db
    .update(usersTable)
    .set({ emailConfirmToken: confirmTokenHash, emailConfirmExpires: expires, emailConfirmed: false, email })
    .where(eq(usersTable.id, userId));
  await sendConfirmationEmail(email, name, confirmToken).catch(console.warn);
}

router.post("/auth/register/client", async (req, res) => {
  try {
    const { name, location, preferences } = req.body;
    const password = normalizePassword(req.body.password);
    const referredByUserId = await resolveReferrerUserId(req.body.referralCode);
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);

    if (!name || !password) {
      res.status(400).json({ error: "BadRequest", message: "Nom et mot de passe requis" });
      return;
    }
    if (!email && !phone) {
      res.status(400).json({ error: "BadRequest", message: "Email ou téléphone requis" });
      return;
    }
    const passwordPolicyError = password ? getPasswordPolicyError(password) : null;
    if (passwordPolicyError) {
      res.status(400).json({ error: "BadRequest", message: passwordPolicyError });
      return;
    }

    const existing = await db.select().from(usersTable).where(
      or(
        email ? eq(usersTable.email, email) : undefined,
        phone ? eq(usersTable.phone, phone) : undefined,
      )
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "Email ou téléphone déjà utilisé" });
      return;
    }
    if (typeof req.body.referralCode === "string" && req.body.referralCode.trim() && !referredByUserId) {
      res.status(400).json({ error: "BadRequest", message: "Code de parrainage invalide" });
      return;
    }

    const COLORS = ["#C4522A", "#8B5CF6", "#059669", "#D97706", "#DC2626", "#BE185D"];
    const coverColor = COLORS[Math.floor(Math.random() * COLORS.length)];

    const [user] = await db.insert(usersTable).values({
      name,
      email: email || null,
      phone: phone || null,
      passwordHash: hashPassword(password),
      type: "client",
      referredByUserId,
      location: location || "Abidjan",
      coverColor,
      preferences: preferences || [],
      emailConfirmed: false,
      emailConfirmToken: null,
      emailConfirmExpires: null,
    }).returning();
    const referralCode = await assignReferralCode(user.id, name);
    user.referralCode = referralCode;

    if (email) {
      await createEmailConfirmation(user.id, email, name);
      res.status(201).json({
        requiresEmailConfirmation: true,
        message: "Compte créé. Confirmez votre adresse email pour vous connecter.",
        email,
        user: toSafeUser(user),
      });
      return;
    }

    const token = signToken({ userId: user.id, type: "client" });
    res.status(201).json({
      token,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error("register client error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/auth/register/chef", async (req, res) => {
  try {
    const { name, specialty, location, zone, bio, priceRange, coverColor, specialties } = req.body;
    const password = normalizePassword(req.body.password);
    const referredByUserId = await resolveReferrerUserId(req.body.referralCode);
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);

    if (!name || !password || !specialty || !location || !zone || !bio || !priceRange) {
      res.status(400).json({ error: "BadRequest", message: "Champs requis manquants" });
      return;
    }
    const passwordPolicyError = getPasswordPolicyError(password);
    if (passwordPolicyError) {
      res.status(400).json({ error: "BadRequest", message: passwordPolicyError });
      return;
    }
    if (!email && !phone) {
      res.status(400).json({ error: "BadRequest", message: "Email ou téléphone requis" });
      return;
    }

    const existing = await db.select().from(usersTable).where(
      or(
        email ? eq(usersTable.email, email) : undefined,
        phone ? eq(usersTable.phone, phone) : undefined,
      )
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "Email ou téléphone déjà utilisé" });
      return;
    }
    if (typeof req.body.referralCode === "string" && req.body.referralCode.trim() && !referredByUserId) {
      res.status(400).json({ error: "BadRequest", message: "Code de parrainage invalide" });
      return;
    }

    const COLORS = ["#C4522A", "#8B5CF6", "#059669", "#D97706", "#DC2626", "#BE185D"];
    const chefColor = coverColor || COLORS[Math.floor(Math.random() * COLORS.length)];

    const [user] = await db.insert(usersTable).values({
      name,
      email: email || null,
      phone: phone || null,
      passwordHash: hashPassword(password),
      type: "chef",
      referredByUserId,
      location,
      coverColor: chefColor,
      emailConfirmed: false,
      emailConfirmToken: null,
      emailConfirmExpires: null,
    }).returning();
    const referralCode = await assignReferralCode(user.id, name);
    user.referralCode = referralCode;

    const [profile] = await db.insert(chefProfilesTable).values({
      userId: user.id,
      specialty,
      location,
      zone,
      bio,
      priceRange,
      specialties: specialties || [],
      isOnline: true,
      rating: 5.0,
      reviewCount: 0,
    }).returning();

    const safeChefProfile = buildChefProfile(user, profile);

    if (email) {
      await createEmailConfirmation(user.id, email, name);
      res.status(201).json({
        requiresEmailConfirmation: true,
        message: "Compte créé. Confirmez votre adresse email pour activer votre espace cuisinière.",
        email,
        user: toSafeUser(user, { chefProfile: safeChefProfile }),
      });
      return;
    }

    const token = signToken({ userId: user.id, type: "chef" });
    res.status(201).json({
      token,
      user: toSafeUser(user, { chefProfile: safeChefProfile }),
    });
  } catch (err) {
    console.error("register chef error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/auth/register/courier", async (req, res) => {
  try {
    const { name, location, zone, vehicleType } = req.body;
    const password = normalizePassword(req.body.password);
    const referredByUserId = await resolveReferrerUserId(req.body.referralCode);
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);

    if (!name || !password || !location) {
      res.status(400).json({ error: "BadRequest", message: "Nom, mot de passe et localisation requis" });
      return;
    }
    const passwordPolicyError = getPasswordPolicyError(password);
    if (passwordPolicyError) {
      res.status(400).json({ error: "BadRequest", message: passwordPolicyError });
      return;
    }
    if (!email && !phone) {
      res.status(400).json({ error: "BadRequest", message: "Email ou téléphone requis" });
      return;
    }

    const existing = await db.select().from(usersTable).where(
      or(
        email ? eq(usersTable.email, email) : undefined,
        phone ? eq(usersTable.phone, phone) : undefined,
      )
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "Email ou téléphone déjà utilisé" });
      return;
    }
    if (typeof req.body.referralCode === "string" && req.body.referralCode.trim() && !referredByUserId) {
      res.status(400).json({ error: "BadRequest", message: "Code de parrainage invalide" });
      return;
    }

    const [user] = await db.insert(usersTable).values({
      name,
      email: email || null,
      phone: phone || null,
      passwordHash: hashPassword(password),
      type: "courier",
      referredByUserId,
      location,
      coverColor: "#0F766E",
      emailConfirmed: false,
      emailConfirmToken: null,
      emailConfirmExpires: null,
    }).returning();
    const referralCode = await assignReferralCode(user.id, name);
    user.referralCode = referralCode;

    const [courierProfile] = await db.insert(courierProfilesTable).values({
      userId: user.id,
      zone: String(zone ?? ""),
      vehicleType: String(vehicleType ?? "moto"),
      isAvailable: true,
      isVerified: false,
    }).returning();

    const safeCourierProfile = buildCourierProfile(courierProfile);

    if (email) {
      await createEmailConfirmation(user.id, email, name);
      res.status(201).json({
        requiresEmailConfirmation: true,
        message: "Compte créé. Confirmez votre adresse email pour activer votre espace livreur.",
        email,
        user: toSafeUser(user, { courierProfile: safeCourierProfile }),
      });
      return;
    }

    const token = signToken({ userId: user.id, type: "courier" });
    res.status(201).json({
      token,
      user: toSafeUser(user, { courierProfile: safeCourierProfile }),
    });
  } catch (err) {
    console.error("register courier error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/auth/register/merchant", async (req, res) => {
  try {
    const { name, location, businessName, bio } = req.body;
    const password = normalizePassword(req.body.password);
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);

    if (!name || !password || !businessName) {
      res.status(400).json({ error: "BadRequest", message: "Nom, mot de passe et nom commercial requis" });
      return;
    }
    const passwordPolicyError = getPasswordPolicyError(password);
    if (passwordPolicyError) {
      res.status(400).json({ error: "BadRequest", message: passwordPolicyError });
      return;
    }
    if (!email && !phone) {
      res.status(400).json({ error: "BadRequest", message: "Email ou téléphone requis" });
      return;
    }

    const existing = await db.select().from(usersTable).where(
      or(
        email ? eq(usersTable.email, email) : undefined,
        phone ? eq(usersTable.phone, phone) : undefined,
      )
    );
    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "Email ou téléphone déjà utilisé" });
      return;
    }

    const [user] = await db.insert(usersTable).values({
      name,
      email: email || null,
      phone: phone || null,
      passwordHash: hashPassword(password),
      type: "merchant",
      location: location || "Abidjan",
      coverColor: "#0F766E",
      emailConfirmed: false,
      emailConfirmToken: null,
      emailConfirmExpires: null,
    }).returning();
    const referralCode = await assignReferralCode(user.id, name);
    user.referralCode = referralCode;

    const [merchantProfile] = await db.insert(merchantProfilesTable).values({
      userId: user.id,
      businessName,
      contactEmail: email || null,
      contactPhone: phone || null,
      bio: typeof bio === "string" ? bio : "",
      isVerified: false,
    }).returning();

    const safeMerchantProfile = buildMerchantProfile(merchantProfile);

    if (email) {
      await createEmailConfirmation(user.id, email, name);
      res.status(201).json({
        requiresEmailConfirmation: true,
        message: "Compte créé. Confirmez votre adresse email pour activer votre espace marchand.",
        email,
        user: toSafeUser(user, { merchantProfile: safeMerchantProfile }),
      });
      return;
    }

    const token = signToken({ userId: user.id, type: "merchant" });
    res.status(201).json({
      token,
      user: toSafeUser(user, { merchantProfile: safeMerchantProfile }),
    });
  } catch (err) {
    console.error("register merchant error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.post("/auth/login", authLoginLimiter, async (req, res) => {
  try {
    const emailOrPhone = typeof req.body.emailOrPhone === "string" ? req.body.emailOrPhone.trim() : "";
    const password = normalizePassword(req.body.password);
    if (!emailOrPhone || !password) {
      res.status(400).json({ error: "BadRequest", message: "Identifiants requis" });
      return;
    }

    const normalizedEmail = normalizeEmail(emailOrPhone);
    const normalizedPhone = normalizePhone(emailOrPhone);

    const [user] = await db.select().from(usersTable).where(
      or(
        normalizedEmail ? eq(usersTable.email, normalizedEmail) : undefined,
        normalizedPhone ? eq(usersTable.phone, normalizedPhone) : undefined,
      )
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Unauthorized", message: "Identifiants incorrects" });
      return;
    }

    if (user.email && user.emailConfirmed === false) {
      res.status(403).json({
        error: "EmailUnconfirmed",
        message: "Veuillez confirmer votre adresse email avant de vous connecter",
        email: user.email,
      });
      return;
    }

    let chefProfile = null;
    let courierProfile = null;
    let merchantProfile = null;
    if (user.type === "chef") {
      const [cp] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.userId, user.id));
      if (cp) {
        chefProfile = buildChefProfile(user, cp);
      }
    }
    if (user.type === "courier") {
      const [cp] = await db.select().from(courierProfilesTable).where(eq(courierProfilesTable.userId, user.id));
      if (cp) {
        courierProfile = buildCourierProfile(cp);
      }
    }
    if (user.type === "merchant") {
      const [mp] = await db.select().from(merchantProfilesTable).where(eq(merchantProfilesTable.userId, user.id));
      if (mp) {
        merchantProfile = buildMerchantProfile(mp);
      }
    }

    const token = signToken({ userId: user.id, type: user.type });
    res.json({
      token,
      user: toSafeUser(user, { chefProfile, courierProfile, merchantProfile }),
    });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

// POST /auth/resend-confirmation { email }
router.post("/auth/resend-confirmation", resendConfirmationLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      res.status(400).json({ error: "BadRequest", message: "Email requis" });
      return;
    }
    const [u] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!u || u.emailConfirmed) {
      res.json({ ok: true });
      return;
    }
    await createEmailConfirmation(u.id, email, u.name);
    res.json({ ok: true });
    return;
  } catch (err) {
    console.error("resend confirmation error", err);
    res.status(500).json({ error: "InternalError" });
  }
});

router.get("/auth/confirmation-status", async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    if (!email) {
      res.status(400).json({ error: "BadRequest", message: "Email requis" });
      return;
    }

    // Do not disclose whether an email exists or whether it is already confirmed.
    res.json({ ok: true });
  } catch (err) {
    console.error("confirmation status error", err);
    res.status(500).json({ error: "InternalError" });
  }
});

// POST /auth/change-email { password, newEmail }
router.post("/auth/change-email", requireAuth, changeEmailLimiter, async (req: AuthRequest, res) => {
  try {
    const password = normalizePassword(req.body.password);
    const newEmail = normalizeEmail(req.body.newEmail);
    if (!password || !newEmail) {
      res.status(400).json({ error: "BadRequest", message: "Mot de passe et nouvel email requis" });
      return;
    }
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!u) {
      res.status(401).json({ error: "Unauthorized", message: "Utilisateur introuvable" });
      return;
    }
    if (!verifyPassword(password, u.passwordHash)) {
      res.status(401).json({ error: "Unauthorized", message: "Identifiants incorrects" });
      return;
    }
    if (u.email === newEmail) {
      res.status(409).json({ error: "Conflict", message: "Le nouvel email doit etre different de l email actuel" });
      return;
    }
    // ensure new email not used
    const exists = await db.select().from(usersTable).where(eq(usersTable.email, newEmail));
    if (exists.some((existingUser) => existingUser.id !== u.id)) {
      res.status(409).json({ error: "Conflict", message: "Nouvel email déjà utilisé" });
      return;
    }
    // update email and reset confirmation
    await createEmailConfirmation(u.id, newEmail, u.name);
    res.json({ ok: true });
    return;
  } catch (err) {
    console.error("change email error", err);
    res.status(500).json({ error: "InternalError" });
  }
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Utilisateur introuvable" });
      return;
    }

    let chefProfile = null;
    let courierProfile = null;
    let merchantProfile = null;
    if (user.type === "chef") {
      const [cp] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.userId, user.id));
      if (cp) {
        chefProfile = buildChefProfile(user, cp);
      }
    }
    if (user.type === "courier") {
      const [cp] = await db.select().from(courierProfilesTable).where(eq(courierProfilesTable.userId, user.id));
      if (cp) {
        courierProfile = buildCourierProfile(cp);
      }
    }
    if (user.type === "merchant") {
      const [mp] = await db.select().from(merchantProfilesTable).where(eq(merchantProfilesTable.userId, user.id));
      if (mp) {
        merchantProfile = buildMerchantProfile(mp);
      }
    }

    res.json({
      ...toSafeUser(user, { chefProfile, courierProfile, merchantProfile }),
    });
    return;
  } catch (err) {
    console.error("me error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

// PATCH /api/auth/me - update current user fields (avatarUrl, coverColor, location)
router.patch("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { avatarUrl, coverColor, location } = req.body;
    const updates: any = {};
    if (typeof avatarUrl !== "undefined") {
      if (avatarUrl !== null && (typeof avatarUrl !== "string" || !isOwnedUploadUrl(avatarUrl, "avatar", userId))) {
        res.status(400).json({ error: "BadRequest", message: "Avatar invalide ou non autorisé" });
        return;
      }
      updates.avatarUrl = avatarUrl;
    }
    if (typeof coverColor !== "undefined") updates.coverColor = String(coverColor);
    if (typeof location !== "undefined") updates.location = String(location);
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "BadRequest", message: "No fields to update" });
      return;
    }

    await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    let chefProfile = null;
    let courierProfile = null;
    let merchantProfile = null;
    if (u.type === "chef") {
      const [cp] = await db.select().from(chefProfilesTable).where(eq(chefProfilesTable.userId, u.id));
      if (cp) {
        chefProfile = buildChefProfile(u, cp);
      }
    }
    if (u.type === "courier") {
      const [cp] = await db.select().from(courierProfilesTable).where(eq(courierProfilesTable.userId, u.id));
      if (cp) {
        courierProfile = buildCourierProfile(cp);
      }
    }
    if (u.type === "merchant") {
      const [mp] = await db.select().from(merchantProfilesTable).where(eq(merchantProfilesTable.userId, u.id));
      if (mp) {
        merchantProfile = buildMerchantProfile(mp);
      }
    }
    res.json({
      ...toSafeUser(u, { chefProfile, courierProfile, merchantProfile }),
    });
  } catch (err) {
    console.error("update me error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

router.patch("/auth/me/courier-dossier", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user || user.type !== "courier") {
      res.status(403).json({ error: "Forbidden", message: "Réservé aux livreurs" });
      return;
    }

    const parsedBody = parseWithSchema(courierVerificationDossierSchema, req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "BadRequest", message: parsedBody.message });
      return;
    }

    const payload = parsedBody.data;
    const updates: Record<string, string | Date | null> = {};
    const documentFields = [
      "identityDocumentUrl",
      "driverLicenseUrl",
      "vehicleRegistrationUrl",
      "vehiclePhotoUrl",
      "selfiePhotoUrl",
    ] as const;

    for (const field of documentFields) {
      if (typeof payload[field] === "undefined") {
        continue;
      }
      const value = payload[field];
      if (value !== null && !isOwnedUploadUrl(value, "courier-document", userId)) {
        res.status(400).json({ error: "BadRequest", message: "Document invalide ou non autorisé" });
        return;
      }
      updates[field] = value ?? null;
    }

    const [currentProfile] = await db.select().from(courierProfilesTable).where(eq(courierProfilesTable.userId, userId)).limit(1);
    if (!currentProfile) {
      res.status(404).json({ error: "NotFound", message: "Profil livreur introuvable" });
      return;
    }

    const nextProfileShape = {
      identityDocumentUrl: Object.prototype.hasOwnProperty.call(updates, "identityDocumentUrl") ? updates.identityDocumentUrl : currentProfile.identityDocumentUrl,
      driverLicenseUrl: Object.prototype.hasOwnProperty.call(updates, "driverLicenseUrl") ? updates.driverLicenseUrl : currentProfile.driverLicenseUrl,
      vehicleRegistrationUrl: Object.prototype.hasOwnProperty.call(updates, "vehicleRegistrationUrl") ? updates.vehicleRegistrationUrl : currentProfile.vehicleRegistrationUrl,
      vehiclePhotoUrl: Object.prototype.hasOwnProperty.call(updates, "vehiclePhotoUrl") ? updates.vehiclePhotoUrl : currentProfile.vehiclePhotoUrl,
      selfiePhotoUrl: Object.prototype.hasOwnProperty.call(updates, "selfiePhotoUrl") ? updates.selfiePhotoUrl : currentProfile.selfiePhotoUrl,
    };
    const isDossierComplete = Object.values(nextProfileShape).every((value) => Boolean(value));
    if (Object.keys(updates).length === 0 && !isDossierComplete) {
      res.status(400).json({ error: "BadRequest", message: "Aucun document à mettre à jour" });
      return;
    }
    updates.dossierSubmittedAt = isDossierComplete ? new Date() : null;

    const [updatedProfile] = await db
      .update(courierProfilesTable)
      .set(updates)
      .where(eq(courierProfilesTable.userId, userId))
      .returning();

    res.json({ courierProfile: buildCourierProfile(updatedProfile) });
  } catch (err) {
    console.error("update courier dossier error:", err);
    res.status(500).json({ error: "InternalError", message: "Erreur serveur" });
  }
});

// GET /auth/confirm?token=...  or /auth/confirm/:token
router.get("/auth/confirm", confirmEmailLimiter, async (req, res) => {
  const wantsHtml = req.accepts(["html", "json"]) === "html";
  const successOpenAppUrl = withQuery(joinUrl(MOBILE_APP_URL, "/auth/confirm"), {
    status: "success",
    message: "Votre adresse email a ete confirmee avec succes.",
  });
  const errorOpenAppUrl = (message: string) =>
    withQuery(joinUrl(MOBILE_APP_URL, "/auth/confirm"), {
      status: "error",
      message,
    });

  try {
    const token = String(req.query.token ?? "");
    if (!token) {
      if (wantsHtml) {
        res.status(400).type("html").send(
          renderConfirmationPage({
            title: "Lien invalide",
            message: "Le lien de confirmation est incomplet.",
            tone: "error",
            openAppUrl: errorOpenAppUrl("Le lien de confirmation est incomplet."),
          })
        );
        return;
      }
      res.status(400).json({ error: "BadRequest" });
      return;
    }
    const hashedToken = hashConfirmationToken(token);
    const [u] = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.emailConfirmToken, hashedToken), eq(usersTable.emailConfirmToken, token)));
    if (!u) {
      if (wantsHtml) {
        res.status(404).type("html").send(
          renderConfirmationPage({
            title: "Lien invalide",
            message: "Ce lien de confirmation est introuvable ou a deja ete utilise.",
            tone: "error",
            openAppUrl: errorOpenAppUrl("Ce lien de confirmation est introuvable ou a deja ete utilise."),
          })
        );
        return;
      }
      res.status(404).json({ error: "NotFound" });
      return;
    }
    if (u.emailConfirmExpires && new Date(u.emailConfirmExpires) < new Date()) {
      if (wantsHtml) {
        res.status(400).type("html").send(
          renderConfirmationPage({
            title: "Lien expire",
            message: "Votre lien de confirmation a expire. Renvoyez-en un nouveau depuis l'application.",
            tone: "error",
            openAppUrl: errorOpenAppUrl("Votre lien de confirmation a expire."),
          })
        );
        return;
      }
      res.status(400).json({ error: "Expired" });
      return;
    }
    await db.update(usersTable).set({ emailConfirmed: true, emailConfirmToken: null, emailConfirmExpires: null }).where(eq(usersTable.id, u.id));
    if (wantsHtml) {
      res.status(200).type("html").send(
        renderConfirmationPage({
          title: "Adresse email verifiee",
          message: "Votre compte est active. Vous pouvez maintenant revenir dans Nixyah et vous connecter.",
          tone: "success",
          openAppUrl: successOpenAppUrl,
        })
      );
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("confirm error", err);
    if (wantsHtml) {
      res.status(500).type("html").send(
        renderConfirmationPage({
          title: "Verification impossible",
          message: "Une erreur est survenue pendant la confirmation. Reessayez depuis l'application.",
          tone: "error",
          openAppUrl: errorOpenAppUrl("La confirmation a echoue."),
        })
      );
      return;
    }
    res.status(500).json({ error: "InternalError" });
  }
});

export default router;
