import { getEnv } from "./env";

export type PaymentProvider = "paystack" | "mobile_money";

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

export function getPaystackSecretKey(): string | null {
  const env = getEnv();
  return ((env as any).PAYSTACK_SECRET_KEY as string | undefined) ?? null;
}

export function getEnabledPaymentProviders(): PaymentProvider[] {
  const providers: PaymentProvider[] = [];
  if (getPaystackSecretKey()) providers.push("paystack");
  providers.push("mobile_money");
  return providers;
}

export function getDefaultPaymentProvider(): PaymentProvider {
  return getPaystackSecretKey() ? "paystack" : "mobile_money";
}

export function findTokenPackage(id: string): TokenPackage | null {
  const p = TOKEN_PACKAGES.find((x) => x.id === id);
  return p ?? null;
}


