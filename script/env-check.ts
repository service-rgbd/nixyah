import { getEnv } from "../server/env";

function isSet(v: unknown) {
  return typeof v === "string" && v.trim().length > 0;
}

function mask(v: string) {
  if (v.length <= 8) return "***";
  return `${v.slice(0, 3)}***${v.slice(-3)}`;
}

const env = getEnv();

const required = [
  "DATABASE_URL",
  "ADMIN_TOKEN",
  "SECRET_TOKEN",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

const missing = required.filter((k) => !isSet(env[k]));

console.log("Env check:");
for (const k of required) {
  const v = env[k];
  if (!isSet(v)) {
    console.log(`- ${k}: MISSING`);
  } else if (k === "DATABASE_URL") {
    // Keep URL readable-ish but not fully exposed
    console.log(`- ${k}: SET (${mask(String(v))})`);
  } else {
    console.log(`- ${k}: SET (${mask(String(v))})`);
  }
}

if (missing.length) {
  console.error(`\nMissing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// Quick sanity check for DATABASE_URL hostname format (not exhaustive)
try {
  const url = new URL(env.DATABASE_URL!);
  if (!url.hostname || url.hostname === "base") {
    console.error(
      `\nDATABASE_URL hostname looks wrong (${JSON.stringify(url.hostname)}). ` +
        "For Neon it should look like: *.neon.tech (or your Neon host).",
    );
    process.exit(1);
  }
} catch {
  console.error("\nDATABASE_URL is not a valid URL.");
  process.exit(1);
}

console.log("\n✅ Env looks OK.");



