import { type ImageSourcePropType } from "react-native";

const imageMarketFresh = require("@/assets/images/en-ce-moment.jpg");
const imageComfort = require("@/assets/images/confort-ivoirien.jpg");
const imageGrill = require("@/assets/images/grillades-soiree.jpg");
const imageSweet = require("@/assets/images/douceur-dessert.jpg");
const imageCashier = require("@/assets/images/login-cashier-illustration.png");
const imageCourier = require("@/assets/images/courier-delivery-illustration.png");

export type CommerceUniverse = "courses" | "supermarkets" | "boutiques";

export interface CommerceStore {
  id: string;
  universe: CommerceUniverse;
  name: string;
  tagline: string;
  location: string;
  deliveryEta: string;
  accentColor: string;
  image: ImageSourcePropType;
  categories: string[];
}

export interface CommerceProduct {
  id: string;
  universe: CommerceUniverse;
  storeId: string;
  name: string;
  category: string;
  description: string;
  price: number;
  originalPrice?: number;
  badge?: string;
  unitLabel: string;
  inStock: boolean;
  image: ImageSourcePropType;
}

export interface CommerceApiStore {
  id: string;
  universe: CommerceUniverse;
  name: string;
  tagline: string;
  description: string;
  location: string;
  zone: string;
  accentColor: string;
  visualKey: string;
  etaMinMinutes: number;
  etaMaxMinutes: number;
}

export interface CommerceApiProduct {
  id: string;
  storeId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  originalPrice?: number | null;
  badge?: string | null;
  unitLabel: string;
  visualKey: string;
  inStock: boolean;
}

export interface CommerceCatalogResponse {
  stores: CommerceApiStore[];
  products: CommerceApiProduct[];
}

export interface CommerceCartItem {
  id: string;
  storeId: string;
  productId: string;
  productName: string;
  category: string;
  unitLabel: string;
  quantity: number;
  price: number;
  visualKey: string;
}

export interface CommerceCartPayload {
  cartId: string;
  store: CommerceApiStore | null;
  subtotal: number;
  itemCount: number;
  items: CommerceCartItem[];
}

export interface CommerceCartResponse {
  cart: CommerceCartPayload;
}

const VISUAL_MAP: Record<string, ImageSourcePropType> = {
  "market-fresh": imageMarketFresh,
  comfort: imageComfort,
  grill: imageGrill,
  sweet: imageSweet,
  cashier: imageCashier,
  courier: imageCourier,
  "course-express": imageCashier,
  "minute-plateau": imageCourier,
  "super-riviera": imageMarketFresh,
  "fresh-abi": imageComfort,
  "atelier-cadeaux": imageSweet,
  "select-store": imageGrill,
};

export const COMMERCE_STORES: CommerceStore[] = [
  {
    id: "course-express-cocody",
    universe: "courses",
    name: "Course Express Cocody",
    tagline: "Essentiels rapides, retrait et depannage du quotidien.",
    location: "Cocody Angre",
    deliveryEta: "18-25 min",
    accentColor: "#C4522A",
    image: imageCashier,
    categories: ["Depannage", "Boissons", "Snacks", "Maison"],
  },
  {
    id: "course-minute-plateau",
    universe: "courses",
    name: "Minute Plateau",
    tagline: "Petites courses urbaines et paniers express.",
    location: "Plateau",
    deliveryEta: "20-28 min",
    accentColor: "#D97706",
    image: imageCourier,
    categories: ["Boissons", "Pause bureau", "Hygiene"],
  },
  {
    id: "supermarche-riviera",
    universe: "supermarkets",
    name: "Marche Riviera",
    tagline: "Rayons frais, epicerie et maison sous un meme panier.",
    location: "Riviera 2",
    deliveryEta: "35-45 min",
    accentColor: "#0F766E",
    image: imageMarketFresh,
    categories: ["Fruits & legumes", "Epicerie", "Boissons", "Maison"],
  },
  {
    id: "fresh-abi",
    universe: "supermarkets",
    name: "Fresh Abi",
    tagline: "Produits frais et paniers famille avec suivi propre.",
    location: "Marcory",
    deliveryEta: "30-40 min",
    accentColor: "#047857",
    image: imageComfort,
    categories: ["Frais", "Laitier", "Entretien", "Bebe"],
  },
  {
    id: "atelier-cadeaux",
    universe: "boutiques",
    name: "Atelier Cadeaux",
    tagline: "Coffrets, senteurs et idees a offrir sans perdre du temps.",
    location: "Deux Plateaux",
    deliveryEta: "40-55 min",
    accentColor: "#8B5E3C",
    image: imageSweet,
    categories: ["Cadeaux", "Maison", "Bien-etre", "Lifestyle"],
  },
  {
    id: "select-store",
    universe: "boutiques",
    name: "Select Store",
    tagline: "Achats specialises, vitrine plus premium et plus discrete.",
    location: "Zone 4",
    deliveryEta: "45-60 min",
    accentColor: "#7C3F1D",
    image: imageGrill,
    categories: ["Lifestyle", "Beaute", "Prive", "Maison"],
  },
];

export const COMMERCE_PRODUCTS: CommerceProduct[] = [
  {
    id: "course-water-pack",
    universe: "courses",
    storeId: "course-express-cocody",
    name: "Pack eau minerale",
    category: "Boissons",
    description: "Lot express pour maison ou bureau.",
    price: 2500,
    originalPrice: 2900,
    badge: "Express",
    unitLabel: "6 x 1,5L",
    inStock: true,
    image: imageCashier,
  },
  {
    id: "course-bread-eggs",
    universe: "courses",
    storeId: "course-express-cocody",
    name: "Pain + oeufs",
    category: "Depannage",
    description: "Le basique du matin en une seule course.",
    price: 1800,
    unitLabel: "kit",
    inStock: true,
    image: imageMarketFresh,
  },
  {
    id: "course-office-snack",
    universe: "courses",
    storeId: "course-minute-plateau",
    name: "Pause bureau",
    category: "Pause bureau",
    description: "Biscuits, jus et encas pour l'apres-midi.",
    price: 3200,
    badge: "Top demande",
    unitLabel: "box",
    inStock: true,
    image: imageSweet,
  },
  {
    id: "course-care-kit",
    universe: "courses",
    storeId: "course-minute-plateau",
    name: "Kit hygiene",
    category: "Hygiene",
    description: "Savon, dentifrice et lingettes pour depannage rapide.",
    price: 4100,
    unitLabel: "kit",
    inStock: true,
    image: imageCourier,
  },
  {
    id: "super-banana",
    universe: "supermarkets",
    storeId: "supermarche-riviera",
    name: "Bananes plantain fraiches",
    category: "Fruits & legumes",
    description: "Selection du jour pour alloco, foutou ou accompagnement.",
    price: 2200,
    unitLabel: "kg",
    inStock: true,
    image: imageMarketFresh,
  },
  {
    id: "super-rice-family",
    universe: "supermarkets",
    storeId: "supermarche-riviera",
    name: "Riz parfumé famille",
    category: "Epicerie",
    description: "Sac pratique pour la semaine, cuisson reguliere.",
    price: 8900,
    originalPrice: 9500,
    badge: "Promo",
    unitLabel: "5 kg",
    inStock: true,
    image: imageComfort,
  },
  {
    id: "super-juice-pack",
    universe: "supermarkets",
    storeId: "fresh-abi",
    name: "Jus multi-fruits",
    category: "Boissons",
    description: "Pack familial refrigere, ideal petit-dejeuner.",
    price: 5400,
    unitLabel: "6 bouteilles",
    inStock: true,
    image: imageSweet,
  },
  {
    id: "super-baby-care",
    universe: "supermarkets",
    storeId: "fresh-abi",
    name: "Pack bebe essentiel",
    category: "Bebe",
    description: "Couches, lingettes et creme pour la semaine.",
    price: 12800,
    badge: "Famille",
    unitLabel: "pack",
    inStock: true,
    image: imageCourier,
  },
  {
    id: "boutique-candle-box",
    universe: "boutiques",
    storeId: "atelier-cadeaux",
    name: "Coffret bougie & senteur",
    category: "Maison",
    description: "Petit coffret cadeau pour ambiance chic a la maison.",
    price: 9600,
    badge: "Cadeau",
    unitLabel: "coffret",
    inStock: true,
    image: imageSweet,
  },
  {
    id: "boutique-selfcare",
    universe: "boutiques",
    storeId: "atelier-cadeaux",
    name: "Box self-care",
    category: "Bien-etre",
    description: "Selection bien-etre avec savon, creme et tisane.",
    price: 14500,
    unitLabel: "box",
    inStock: true,
    image: imageComfort,
  },
  {
    id: "boutique-premium-wrap",
    universe: "boutiques",
    storeId: "select-store",
    name: "Emballage premium",
    category: "Lifestyle",
    description: "Presentation soignee pour achats personnels ou cadeaux.",
    price: 3900,
    unitLabel: "service",
    inStock: true,
    image: imageGrill,
  },
  {
    id: "boutique-private-order",
    universe: "boutiques",
    storeId: "select-store",
    name: "Commande privee",
    category: "Prive",
    description: "Traitement discret pour produits sensibles et retrait controle.",
    price: 17500,
    badge: "Discret",
    unitLabel: "selection",
    inStock: true,
    image: imageCashier,
  },
];

export function getStoresByUniverse(universe: CommerceUniverse) {
  return COMMERCE_STORES.filter((store) => store.universe === universe);
}

export function getProductsByUniverse(universe: CommerceUniverse) {
  return COMMERCE_PRODUCTS.filter((product) => product.universe === universe);
}

export function getUniverseCategories(universe: CommerceUniverse) {
  return Array.from(new Set(getProductsByUniverse(universe).map((product) => product.category)));
}

export function resolveCommerceVisual(visualKey?: string | null, fallbackUniverse?: CommerceUniverse): ImageSourcePropType {
  if (visualKey && VISUAL_MAP[visualKey]) {
    return VISUAL_MAP[visualKey];
  }

  if (fallbackUniverse === "courses") {
    return imageCashier;
  }

  if (fallbackUniverse === "supermarkets") {
    return imageMarketFresh;
  }

  if (fallbackUniverse === "boutiques") {
    return imageSweet;
  }

  return imageComfort;
}

export function formatCommerceEta(minMinutes?: number | null, maxMinutes?: number | null) {
  if (minMinutes == null || maxMinutes == null) {
    return "ETA a confirmer";
  }

  return `${minMinutes}-${maxMinutes} min`;
}