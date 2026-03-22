const CATEGORY_LOOKUP = new Map<string, string>([
  ["grillades", "Grillades"],
  ["snacks", "Snacks"],
  ["desserts", "Desserts"],
  ["gateaux", "Gateaux"],
  ["dioula", "Dioula"],
  ["menu europeen", "Menu europeen"],
  ["menu europeen", "Menu europeen"],
  ["europeen", "Menu europeen"],
  ["fast food", "Fast food"],
  ["fastfood", "Fast food"],
  ["evenements", "Evenements"],
  ["evenement", "Evenements"],
]);

export const CHEF_MENU_CATEGORIES = [
  "Grillades",
  "Snacks",
  "Desserts",
  "Gateaux",
  "Dioula",
  "Menu europeen",
  "Fast food",
  "Evenements",
] as const;

export type ChefMenuCategory = (typeof CHEF_MENU_CATEGORIES)[number];

function normalizeCategoryKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeChefMenuCategory(input: unknown): ChefMenuCategory {
  if (typeof input !== "string") {
    return "Grillades";
  }

  const matched = CATEGORY_LOOKUP.get(normalizeCategoryKey(input));
  return (matched ?? "Grillades") as ChefMenuCategory;
}

export function normalizeDiscountPercent(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(80, Math.round(parsed)));
}

export function sanitizeDiscountLabel(input: unknown): string {
  return typeof input === "string" ? input.trim().slice(0, 48) : "";
}

export function getDishEffectivePrice(input: { price: number; discountPercent?: number | null }): number {
  const basePrice = Number(input.price ?? 0);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return 0;
  }

  const discountPercent = normalizeDiscountPercent(input.discountPercent ?? 0);
  if (discountPercent <= 0) {
    return basePrice;
  }

  return Math.round(basePrice * (100 - discountPercent)) / 100;
}

export function getDishSavingsAmount(input: { price: number; discountPercent?: number | null }): number {
  const effectivePrice = getDishEffectivePrice(input);
  const basePrice = Number(input.price ?? 0);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return 0;
  }

  return Math.max(0, Math.round((basePrice - effectivePrice) * 100) / 100);
}