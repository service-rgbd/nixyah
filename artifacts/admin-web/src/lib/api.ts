export type UserType = "client" | "chef" | "courier" | "merchant" | "admin";
export type StoreUniverse = "courses" | "supermarkets" | "boutiques";
export type StoreStatus = "draft" | "pending_review" | "approved" | "suspended" | "rejected";

export interface MerchantProfile {
  id: string;
  userId: string;
  businessName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  bio: string;
  isVerified: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: UserType;
  location: string | null;
  coverColor: string | null;
  avatarUrl: string | null;
  referralCode: string | null;
  freeDeliveryCredits: number;
  merchantProfile: MerchantProfile | null;
}

export interface SessionState {
  token: string;
  user: AuthUser;
}

export interface ApiErrorPayload {
  error?: string;
  message?: string;
  email?: string;
}

export class ApiRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface RegisterMerchantResponse {
  token?: string;
  requiresEmailConfirmation?: boolean;
  message?: string;
  email?: string;
  user: AuthUser;
}

export interface MerchantStore {
  id: number;
  merchantProfileId: number | null;
  universe: StoreUniverse;
  name: string;
  tagline: string;
  description: string;
  location: string;
  zone: string;
  accentColor: string;
  visualKey: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  isActive: boolean;
  status: StoreStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface MerchantProduct {
  id: number;
  storeId: number;
  name: string;
  description: string;
  category: string;
  price: number;
  originalPrice: number | null;
  badge: string | null;
  unitLabel: string;
  visualKey: string;
  inStock: boolean;
}

export interface ChefDish {
  id: string;
  name: string;
  description: string;
  price: number;
  basePrice?: number;
  category: string;
  prepTime: string;
  isPopular?: boolean;
  discountPercent?: number;
  discountLabel?: string;
  savingsAmount?: number;
  imageUrl?: string | null;
  imageUrls?: string[];
}

export interface MerchantOrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productName: string;
}

export interface MerchantOrder {
  id: number;
  storeId: number;
  status: string;
  totalAmount: number;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  createdAt: string;
  items: MerchantOrderItem[];
}

export interface AdminUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  type: UserType;
  location: string | null;
  isOnline: boolean | null;
  createdAt: string | null;
  hasChefProfile: boolean;
  hasCourierProfile: boolean;
  hasMerchantProfile: boolean;
}

export interface AdminStore extends MerchantStore {
  merchantProfile: MerchantProfile | null;
  merchantUser: AuthUser | null;
}

export interface CommerceCatalogStore {
  id: string;
  universe: StoreUniverse;
  name: string;
  tagline: string;
  description: string;
  location: string;
  zone: string;
  accentColor: string;
  visualKey: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  etaMinMinutes: number;
  etaMaxMinutes: number;
}

export interface CommerceCatalogProduct {
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

export interface AdminDashboardOverview {
  totalOrders: number;
  inProgressOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  activeCouriers: number;
  activeChefs: number;
  totalRevenue: number;
  averageBasket: number;
  conversionRate: number;
  ordersPerUser: number;
  peakHour: string;
  quietHour: string;
}

export interface AdminDashboardZone {
  zone: string;
  orders: number;
  revenue: number;
}

export interface AdminDashboardAlert {
  id: string;
  tone: "success" | "warning" | "danger";
  title: string;
  detail: string;
}

export interface AdminDashboardOrder {
  id: string;
  client: string;
  chef: string;
  courier: string;
  status: string;
  amount: number;
  date: string;
  etaMinutes: number;
  isDelayed: boolean;
  zone: string;
  orderId: number;
}

export interface AdminDashboardChef {
  id: number;
  name: string;
  ordersHandled: number;
  averageMinutes: number;
  satisfaction: number;
  score: number;
  isOnline: boolean;
}

export interface AdminDashboardCourier {
  id: number;
  name: string;
  status: string;
  zone: string;
  averageMinutes: number;
  reliability: number;
  rating: number;
}

export interface AdminDashboardRoute {
  id: number;
  from: string;
  to: string;
  estimatedMinutes: number;
  actualMinutes: number;
  distanceKm: number | null;
  optimizationPercent: number;
  status: string;
}

export interface AdminDashboardPartner {
  id: number;
  name: string;
  universe: StoreUniverse;
  zone: string;
  revenue: number;
  orders: number;
  performanceScore: number;
}

export type ChefStatus = "active" | "suspended" | "pending_verification" | "rejected";
export type CourierStatus = "active" | "suspended" | "pending_verification" | "rejected";

export interface AdminChef {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string;
  zone: string | null;
  avatarUrl: string | null;
  coverColor: string | null;
  specialty: string;
  bio: string | null;
  isVerified: boolean;
  isOnline: boolean;
  rating: number;
  reviewCount: number;
  stars: number | null;
  status: ChefStatus;
  createdAt: string | null;
}

export interface AdminCourier {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  zone: string | null;
  vehicleType: string;
  isVerified: boolean;
  isAvailable: boolean;
  rating: number;
  reviewCount: number;
  stars: number | null;
  complaintCount: number;
  activeInvestigationCount: number;
  bonusEarnedAmount: number;
  isDossierComplete: boolean;
  rejectionReason: string | null;
  rejectionReasonUpdatedAt: string | null;
  dossierSubmittedAt: string | null;
  lastLocationAt: string | null;
  verificationDocuments: {
    identityDocumentUrl: string | null;
    driverLicenseUrl: string | null;
    vehicleRegistrationUrl: string | null;
    vehiclePhotoUrl: string | null;
    selfiePhotoUrl: string | null;
  };
  status: CourierStatus;
  createdAt: string | null;
}

export interface AdminDashboardPayload {
  overview: AdminDashboardOverview;
  chart: {
    labels: string[];
    current: number[];
    previous: number[];
  };
  zones: AdminDashboardZone[];
  alerts: AdminDashboardAlert[];
  orders: AdminDashboardOrder[];
  chefs: AdminDashboardChef[];
  couriers: AdminDashboardCourier[];
  routes: AdminDashboardRoute[];
  partners: {
    supermarkets: AdminDashboardPartner[];
    boutiques: AdminDashboardPartner[];
  };
}

export interface MerchantStoreInput {
  universe: StoreUniverse;
  name: string;
  tagline: string;
  description: string;
  location: string;
  zone: string;
  accentColor: string;
  visualKey: string;
  logoUrl: string;
  bannerUrl: string;
  etaMinMinutes: number;
  etaMaxMinutes: number;
}

export interface MerchantProductInput {
  name: string;
  description: string;
  category: string;
  price: number;
  originalPrice: number | null;
  badge: string;
  unitLabel: string;
  visualKey: string;
  inStock: boolean;
}

export interface MerchantRegistrationInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  location: string;
  businessName: string;
  bio: string;
}

const explicitApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const isLocalDev = Boolean(import.meta.env.DEV && typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname));
const API_BASE_URL = explicitApiBaseUrl || (isLocalDev ? "/api" : "https://api.nixyah.com/api");
const SESSION_STORAGE_KEY = "nixyah.admin.session";

function normalizeUrl(path: string) {
  return `${API_BASE_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function tryParseJson(rawText: string, contentType: string | null) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }

  const looksLikeJson =
    contentType?.includes("application/json") ||
    contentType?.includes("application/problem+json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");

  if (!looksLikeJson) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  const contentType = response.headers.get("content-type");
  const payload = tryParseJson(rawText, contentType);
  const fallbackBody = rawText.trim();

  if (!response.ok) {
    const errorPayload = (payload ?? {}) as ApiErrorPayload;
    const message =
      errorPayload.message ||
      errorPayload.error ||
      (fallbackBody && !fallbackBody.startsWith("<") ? fallbackBody : "") ||
      `Request failed with status ${response.status}`;
    throw new ApiRequestError(message, response.status, payload ?? (fallbackBody || null));
  }

  if (!rawText.trim()) {
    return null as T;
  }

  return (payload ?? rawText) as T;
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(normalizeUrl(path), {
    ...init,
    headers,
  });

  return parseResponse<T>(response);
}

export function loadStoredSession(): SessionState | null {
  const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as SessionState;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function persistSession(session: SessionState | null) {
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export const apiClient = {
  login(emailOrPhone: string, password: string) {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ emailOrPhone, password }),
    });
  },

  registerMerchant(input: MerchantRegistrationInput) {
    return request<RegisterMerchantResponse>("/auth/register/merchant", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getCurrentUser(token: string) {
    return request<AuthUser>("/auth/me", undefined, token);
  },

  getMerchantProfile(token: string) {
    return request<{ merchantProfile: MerchantProfile | null }>("/merchant/me", undefined, token);
  },

  getMerchantStores(token: string) {
    return request<{ stores: MerchantStore[] }>("/merchant/stores", undefined, token);
  },

  createMerchantStore(token: string, input: MerchantStoreInput) {
    return request<{ store: MerchantStore }>("/merchant/stores", {
      method: "POST",
      body: JSON.stringify(input),
    }, token);
  },

  updateMerchantStore(token: string, storeId: number, input: Partial<MerchantStoreInput>) {
    return request<{ store: MerchantStore }>(`/merchant/stores/${storeId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }, token);
  },

  getMerchantProducts(token: string, storeId: number) {
    return request<{ store: MerchantStore; products: MerchantProduct[] }>(`/merchant/stores/${storeId}/products`, undefined, token);
  },

  createMerchantProduct(token: string, storeId: number, input: MerchantProductInput) {
    return request<{ product: MerchantProduct }>(`/merchant/stores/${storeId}/products`, {
      method: "POST",
      body: JSON.stringify(input),
    }, token);
  },

  updateMerchantProduct(token: string, productId: number, input: Partial<MerchantProductInput>) {
    return request<{ product: MerchantProduct }>(`/merchant/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }, token);
  },

  getMerchantOrders(token: string, storeId: number) {
    return request<{ store: MerchantStore; orders: MerchantOrder[] }>(`/merchant/stores/${storeId}/orders`, undefined, token);
  },

  getChefDishes(chefId: string | number) {
    return request<{ dishes: ChefDish[] }>(`/chef/${encodeURIComponent(String(chefId))}/dishes`);
  },

  getCommerceCatalog(universe?: StoreUniverse | "all") {
    const query = universe && universe !== "all" ? `?universe=${encodeURIComponent(universe)}` : "";
    return request<{ stores: CommerceCatalogStore[]; products: CommerceCatalogProduct[] }>(`/commerce/catalog${query}`);
  },

  getAdminStores(token: string, status?: StoreStatus | "all") {
    const query = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
    return request<{ stores: AdminStore[] }>(`/admin/commerce/stores${query}`, undefined, token);
  },

  getAdminDashboard(
    token: string,
    options?: {
      scale?: "hour" | "day" | "week";
      zone?: string;
      universe?: StoreUniverse | "all";
      status?: StoreStatus | "all";
    },
  ) {
    const search = new URLSearchParams();
    if (options?.scale) search.set("scale", options.scale);
    if (options?.zone && options.zone !== "all") search.set("zone", options.zone);
    if (options?.universe && options.universe !== "all") search.set("universe", options.universe);
    if (options?.status && options.status !== "all") search.set("status", options.status);
    const query = search.toString();
    return request<AdminDashboardPayload>(`/admin/dashboard/overview${query ? `?${query}` : ""}`, undefined, token);
  },

  updateAdminStoreStatus(token: string, storeId: number, status: StoreStatus, isActive?: boolean) {
    return request<{ store: MerchantStore }>(`/admin/commerce/stores/${storeId}/status`, {
      method: "POST",
      body: JSON.stringify({ status, isActive }),
    }, token);
  },

  getAdminChefs(token: string, params?: { status?: ChefStatus | "all"; zone?: string }) {
    const search = new URLSearchParams();
    if (params?.status && params.status !== "all") search.set("status", params.status);
    if (params?.zone && params.zone !== "all") search.set("zone", params.zone);
    const query = search.toString();
    return request<{ chefs: AdminChef[] }>(`/admin/chefs${query ? `?${query}` : ""}`, undefined, token);
  },

  updateAdminChefStatus(token: string, chefId: string, status: ChefStatus) {
    return request<{ chef: AdminChef }>(`/admin/chefs/${chefId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }, token);
  },

  verifyAdminChef(token: string, chefId: string, isVerified: boolean) {
    return request<{ chef: AdminChef }>(`/admin/chefs/${chefId}/verify`, {
      method: "POST",
      body: JSON.stringify({ isVerified }),
    }, token);
  },

  getAdminCouriers(token: string, params?: { status?: CourierStatus | "all"; zone?: string }) {
    const search = new URLSearchParams();
    if (params?.status && params.status !== "all") search.set("status", params.status);
    if (params?.zone && params.zone !== "all") search.set("zone", params.zone);
    const query = search.toString();
    return request<{ couriers: AdminCourier[] }>(`/admin/couriers${query ? `?${query}` : ""}`, undefined, token);
  },

  updateAdminCourierStatus(token: string, courierId: number, status: CourierStatus, rejectionReason?: string | null) {
    return request<{ courier: AdminCourier }>(`/admin/couriers/${courierId}/status`, {
      method: "POST",
      body: JSON.stringify({ status, rejectionReason }),
    }, token);
  },

  verifyAdminCourier(token: string, courierId: number, isVerified: boolean, rejectionReason?: string | null) {
    return request<{ courier: AdminCourier }>(`/admin/couriers/${courierId}/verify`, {
      method: "POST",
      body: JSON.stringify({ isVerified, rejectionReason }),
    }, token);
  },

  getAdminUsers(token: string) {
    return request<{ users: AdminUser[] }>("/admin/users", undefined, token);
  },
};