import "dotenv/config";
import { z } from "zod";

function normalizeDatabaseUrl(raw: string): string {
  let v = String(raw ?? "").trim();
  // Render/UI copy-paste sometimes includes surrounding quotes
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1).trim();
  }

  // Some Neon snippets include `channel_binding=require` which isn't supported everywhere.
  // Removing it improves compatibility and avoids confusing auth failures.
  try {
    const u = new URL(v);
    if (u.searchParams.has("channel_binding")) u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return v;
  }
}

function nonEmpty(name: string) {
  return z
    .string()
    .min(1, `${name} is required`)
    .transform((v) => v.trim());
}

// Support both DATABASE_URL and database_url (user mentioned lowercase)
if (!process.env.DATABASE_URL && process.env.database_url) {
  process.env.DATABASE_URL = process.env.database_url;
}

// Support common lowercase variants for tokens / R2 / Telegram config
const envAliases: Record<string, string[]> = {
  ADMIN_TOKEN: ["ADMIN_TOKEN", "admin_token", "adminToken"],
  SECRET_TOKEN: ["SECRET_TOKEN", "secret_token", "secretToken"],
  ADMIN_EMAIL: ["ADMIN_EMAIL", "admin_email", "adminEmail"],

  R2_ACCOUNT_ID: ["R2_ACCOUNT_ID", "r2_account_id", "R2AccountId", "r2AccountId"],
  R2_ACCESS_KEY_ID: ["R2_ACCESS_KEY_ID", "r2_access_key_id", "r2AccessKeyId"],
  R2_SECRET_ACCESS_KEY: ["R2_SECRET_ACCESS_KEY", "r2_secret_access_key", "r2SecretAccessKey"],
  R2_BUCKET: ["R2_BUCKET", "r2_bucket", "r2Bucket"],
  R2_PUBLIC_BASE_URL: ["R2_PUBLIC_BASE_URL", "r2_public_base_url", "r2PublicBaseUrl"],
  R2_ENDPOINT: ["R2_ENDPOINT", "r2_endpoint", "r2Endpoint"],

  TELEGRAM_BOT_TOKEN: ["TELEGRAM_BOT_TOKEN", "telegram_bot_token", "telegramBotToken"],
  TELEGRAM_CHAT_ID: ["TELEGRAM_CHAT_ID", "telegram_chat_id", "telegramChatId"],
  SUPPORT_TELEGRAM_URL: ["SUPPORT_TELEGRAM_URL", "support_telegram_url", "supportTelegramUrl"],

  RESEND_API_KEY: ["RESEND_API_KEY", "resend_api_key", "resendApiKey"],
  RESEND_FROM: ["RESEND_FROM", "resend_from", "resendFrom"],
  APP_BASE_URL: ["APP_BASE_URL", "app_base_url", "appBaseUrl"],

  GOOGLE_CLIENT_ID: ["GOOGLE_CLIENT_ID", "google_client_id", "googleClientId"],
  GOOGLE_CLIENT_SECRET: ["GOOGLE_CLIENT_SECRET", "google_client_secret", "googleClientSecret"],
  GOOGLE_REDIRECT_URI: ["GOOGLE_REDIRECT_URI", "google_redirect_uri", "googleRedirectUri"],

  TURNSTILE_SECRET_KEY: ["TURNSTILE_SECRET_KEY", "turnstile_secret_key", "turnstileSecretKey"],

  // Stripe
  STRIPE_SECRET_KEY: ["STRIPE_SECRET_KEY", "stripe_secret_key", "stripeSecretKey"],
  STRIPE_WEBHOOK_SECRET: ["STRIPE_WEBHOOK_SECRET", "stripe_webhook_secret", "stripeWebhookSecret"],

  // CORS (comma-separated list of allowed origins for API when frontend is deployed separately)
  CORS_ORIGINS: ["CORS_ORIGINS", "cors_origins", "corsOrigins", "CORS_ORIGIN", "cors_origin"],

  // Session cookie tweaks (advanced)
  SESSION_COOKIE_SAMESITE: ["SESSION_COOKIE_SAMESITE", "session_cookie_samesite"],
};

for (const [canonical, aliases] of Object.entries(envAliases)) {
  if (process.env[canonical]) continue;
  for (const a of aliases) {
    const v = process.env[a];
    if (typeof v === "string" && v.trim().length > 0) {
      process.env[canonical] = v;
      break;
    }
  }
}

const envSchema = z.object({
  NODE_ENV: z.string().optional(),

  DATABASE_URL: nonEmpty("DATABASE_URL").transform(normalizeDatabaseUrl).optional(),

  ADMIN_TOKEN: nonEmpty("ADMIN_TOKEN").optional(),
  SECRET_TOKEN: nonEmpty("SECRET_TOKEN").optional(),
  ADMIN_EMAIL: z.string().email().optional(),

  R2_ACCOUNT_ID: nonEmpty("R2_ACCOUNT_ID").optional(),
  R2_ACCESS_KEY_ID: nonEmpty("R2_ACCESS_KEY_ID").optional(),
  R2_SECRET_ACCESS_KEY: nonEmpty("R2_SECRET_ACCESS_KEY").optional(),
  R2_BUCKET: nonEmpty("R2_BUCKET").optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),

  TELEGRAM_BOT_TOKEN: nonEmpty("TELEGRAM_BOT_TOKEN").optional(),
  TELEGRAM_CHAT_ID: nonEmpty("TELEGRAM_CHAT_ID").optional(),
  SUPPORT_TELEGRAM_URL: z.string().optional(),

  RESEND_API_KEY: nonEmpty("RESEND_API_KEY").optional(),
  RESEND_FROM: z.string().optional(),
  APP_BASE_URL: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  TURNSTILE_SECRET_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  CORS_ORIGINS: z.string().optional(),
  SESSION_COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return envSchema.parse(process.env);
}

export function requireDatabaseUrl(): string {
  const env = getEnv();
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. Add it to your .env (see docs/env.example.txt).",
    );
  }
  return env.DATABASE_URL;
}


