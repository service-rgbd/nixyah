import Stripe from "stripe";
import { getEnv } from "./env";

export type TokenPackage = {
  id: string;
  label: string;
  tokens: number;
  currency: "XOF" | "EUR" | "USD";
  amount: number; // integer, smallest unit (XOF has 0 decimals)
};

// Server-side list (source of truth). Adjust amounts as needed.
export const TOKEN_PACKAGES: TokenPackage[] = [
  { id: "pack_5", label: "5 jetons", tokens: 5, currency: "XOF", amount: 2000 },
  { id: "pack_15", label: "15 jetons", tokens: 15, currency: "XOF", amount: 5000 },
  { id: "pack_40", label: "40 jetons", tokens: 40, currency: "XOF", amount: 12000 },
];

export function getStripe(): Stripe | null {
  const env = getEnv();
  const key = (env as any).STRIPE_SECRET_KEY as string | undefined;
  if (!key) return null;
  // Keep in sync with the Stripe SDK bundled types.
  return new Stripe(key, { apiVersion: "2025-12-15.clover" });
}

export function getStripeWebhookSecret(): string | null {
  const env = getEnv();
  return ((env as any).STRIPE_WEBHOOK_SECRET as string | undefined) ?? null;
}

export function findTokenPackage(id: string): TokenPackage | null {
  const p = TOKEN_PACKAGES.find((x) => x.id === id);
  return p ?? null;
}


