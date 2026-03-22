import type { Dish } from "@/contexts/AppContext";

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

export const PREP_TIME_OPTIONS = [
  "10 min",
  "15 min",
  "20 min",
  "25 min",
  "30 min",
  "45 min",
  "60 min",
  "90 min",
] as const;

export const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20, 25, 30] as const;

export function getDishPrimaryImage(dish: Dish): string | null {
  return dish.imageUrls?.[0] ?? dish.imageUrl ?? null;
}

export function getDishBasePrice(dish: Dish): number {
  return Number(dish.basePrice ?? dish.price ?? 0);
}

export function getDishCurrentPrice(dish: Dish): number {
  return Number(dish.price ?? 0);
}

export function getDishDiscountPercent(dish: Dish): number {
  return Number(dish.discountPercent ?? 0);
}

export function getDishSavingsAmount(dish: Dish): number {
  return Math.max(0, Number(dish.savingsAmount ?? getDishBasePrice(dish) - getDishCurrentPrice(dish)));
}

export function formatPrice(value: number): string {
  return `${Math.round(Number(value) || 0).toLocaleString("fr-FR")} FCFA`;
}