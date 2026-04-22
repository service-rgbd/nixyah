import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch, invalidateApiCache, normalizeRemoteUrl, readApiCache, type ApiCacheConfig } from "@/constants/api";
import {
  createNativePasskey,
  getDefaultPasskeyDeviceName,
  getNativePasskey,
  type PasskeySummary,
} from "@/constants/passkeys";

const FAVORITES_STORAGE_KEY = "nixyah_favorites";
const ORDERS_STORAGE_KEY = "nixyah_orders";
const CHATS_STORAGE_KEY = "nixyah_chats";
const PUBLIC_CHEFS_CACHE = { key: "public-chefs", scope: "public", ttlMs: 10 * 60 * 1000 } satisfies ApiCacheConfig;
const PUBLIC_STORIES_CACHE = { key: "public-stories", scope: "public", ttlMs: 2 * 60 * 1000 } satisfies ApiCacheConfig;

function buildUserScopedApiCache(key: string, ttlMs: number, userId?: string | null): ApiCacheConfig {
  return {
    key,
    ttlMs,
    scope: userId ? `user:${userId}` : "anonymous",
  };
}

function getStorageScope(userId?: string | null) {
  return userId ? `user:${userId}` : "guest";
}

function getScopedStorageKey(baseKey: string, userId?: string | null) {
  return `${baseKey}:${getStorageScope(userId)}`;
}

export interface Chef {
  id: string;
  name: string;
  specialty: string;
  location: string;
  zone?: string;
  specialties?: string[];
  avatarUrl?: string | null;
  heroImageUrl?: string | null;
  rating: number;
  reviewCount: number;
  stars?: number;
  complaintCount?: number;
  activeInvestigationCount?: number;
  isFeatured?: boolean;
  priceRange: string;
  isVerified: boolean;
  isOnline: boolean;
  coverColor: string;
  bio: string;
  dishes: Dish[];
  responseTime: string;
  stories?: Story[];
}

export interface Dish {
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
  visualKey?: string | null;
}

export interface Notification {
  id: string;
  type: "order" | "review" | "message" | "payment" | "system";
  title: string;
  message: string;
  orderId?: string | null;
  deliveryJobId?: string | null;
  isRead: boolean;
  timestamp: string;
}

export interface ChefStats {
  totalOrders: number;
  totalRevenue: number;
  averageRating: number;
  completionRate: number;
  activeOrders: number;
  averageBasket: number;
  breakdown: {
    pending: number;
    accepted: number;
    preparing: number;
    ready: number;
    delivered: number;
  };
  thisMonth: {
    orders: number;
    revenue: number;
  };
  reviews: number;
  stars?: number;
  complaintCount?: number;
  activeInvestigations?: number;
  isFeatured?: boolean;
  featureThreshold?: number;
  deliveryRevenue?: number;
  promoOrders?: number;
  referralOrders?: number;
  complaintBreakdown?: Record<string, number>;
}

export interface Story {
  id: string;
  chefId: string;
  chefName: string;
  chefCoverColor: string;
  caption: string;
  dishName?: string | null;
  price?: number | null;
  emoji?: string | null;
  bgColor?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  videoDurationSeconds?: number | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  comments: StoryComment[];
  createdAt: string;
  expiresAt: string;
}

export interface StoryComment {
  id: string;
  storyId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string | null;
  userCoverColor?: string | null;
  body: string;
  createdAt: string;
}

export interface Order {
  id: string;
  kind?: "meal" | "commerce";
  commerceUniverse?: "courses" | "supermarkets" | "boutiques" | null;
  merchantVisualKey?: string | null;
  chefId: string;
  chefName: string;
  dishes: { dish: Dish; quantity: number }[];
  total: number;
  deliveryFee?: number;
  totalWithDelivery?: number;
  deliveryDistanceKm?: number | null;
  deliveryDemandMultiplier?: number;
  freeDeliveryApplied?: boolean;
  referralCreditUsed?: boolean;
  status: "pending" | "accepted" | "preparing" | "ready" | "delivered" | "cancelled";
  createdAt: string;
  cancelAvailableUntil?: string | null;
  occasion?: string;
  persons?: number;
  review?: {
    restaurantRating: number;
    restaurantComment?: string;
    deliveryRating?: number | null;
    deliveryComment?: string;
    submittedAt?: string;
  } | null;
  canReview?: boolean;
  delivery?: {
    id: string;
    status: "broadcasting" | "available" | "accepted" | "picked_up" | "on_the_way" | "delivered" | "cancelled";
    courierUserId?: string | null;
    deliveryAddress?: string;
    restaurantAddress?: string;
    restaurantLatitude?: number | null;
    restaurantLongitude?: number | null;
    deliveryLatitude?: number | null;
    deliveryLongitude?: number | null;
    broadcastedAt?: string | null;
    broadcastEndsAt?: string | null;
    broadcastRemainingMinutes?: number | null;
    canCancelSearch?: boolean;
    canRebroadcast?: boolean;
    latestLocation?: {
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
      createdAt: string;
    } | null;
  } | null;
}

export interface CustomRequest {
  id: string;
  chefId: string;
  chefName: string;
  chefLocation: string;
  packageDishId?: string | null;
  packageName: string;
  packageDescription: string;
  unitPrice: number;
  estimatedPersons: number;
  estimatedTotal: number;
  occasion?: string;
  budget?: string;
  preferences: string[];
  storyReference?: string;
  deliveryAddress?: string;
  notes?: string;
  chefResponse?: string;
  status: "pending" | "quoted" | "accepted" | "rejected" | "cancelled";
  respondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivedCustomRequest {
  id: string;
  clientId: string;
  clientName: string;
  clientLocation: string;
  packageDishId?: string | null;
  packageName: string;
  packageDescription: string;
  unitPrice: number;
  estimatedPersons: number;
  estimatedTotal: number;
  occasion?: string;
  budget?: string;
  preferences: string[];
  storyReference?: string;
  deliveryAddress?: string;
  notes?: string;
  chefResponse?: string;
  status: "pending" | "quoted" | "accepted" | "rejected" | "cancelled";
  respondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivedOrder {
  id: string;
  clientId: string;
  clientName: string;
  clientLocation: string;
  items: { dishId?: string | null; dishName: string; quantity: number; price: number }[];
  total: number;
  status: "pending" | "accepted" | "preparing" | "ready" | "delivered" | "cancelled";
  createdAt: string;
  occasion?: string | null;
  persons?: number | null;
  notes?: string | null;
  delivery?: Order["delivery"];
}

export interface ChatMessage {
  id: string;
  text: string;
  isMe: boolean;
  timestamp: string;
}

export interface Chat {
  id: string;
  chefId: string;
  chefName: string;
  chefSpecialty: string;
  coverColor: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  messages: ChatMessage[];
}

export interface AuthUser {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  type: "client" | "chef" | "courier" | "merchant" | "admin";
  location: string;
  coverColor: string;
  avatarUrl?: string | null;
  referralCode?: string | null;
  freeDeliveryCredits?: number;
  chefProfile?: {
    id: string;
    specialty: string;
    location: string;
    zone: string;
    bio: string;
    rating: number;
    reviewCount: number;
    stars?: number;
    complaintCount?: number;
    activeInvestigationCount?: number;
    isFeatured?: boolean;
    priceRange: string;
    isVerified: boolean;
    isOnline: boolean;
    responseTime: string;
  } | null;
  courierProfile?: {
    id: string;
    userId: string;
    zone: string;
    vehicleType: string;
    rejectionReason?: string | null;
    rejectionReasonUpdatedAt?: string | null;
    verificationDocuments?: {
      identityDocumentUrl?: string | null;
      driverLicenseUrl?: string | null;
      vehicleRegistrationUrl?: string | null;
      vehiclePhotoUrl?: string | null;
      selfiePhotoUrl?: string | null;
    };
    isDossierComplete?: boolean;
    missingDocuments?: string[];
    dossierSubmittedAt?: string | null;
    isAvailable: boolean;
    isVerified: boolean;
    rating?: number;
    reviewCount?: number;
    stars?: number;
    complaintCount?: number;
    activeInvestigationCount?: number;
    bonusEarnedAmount?: number;
    bonusUnlockedAt?: string | null;
    currentLatitude?: number | null;
    currentLongitude?: number | null;
    lastLocationAt?: string | null;
  } | null;
  merchantProfile?: {
    id: string;
    userId: string;
    businessName: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
    bio?: string;
    isVerified: boolean;
  } | null;
}

interface AppContextValue {
  chefs: Chef[];
  stories: Story[];
  orders: Order[];
  customRequests: CustomRequest[];
  chefOrders: ReceivedOrder[];
  chefCustomRequests: ReceivedCustomRequest[];
  chats: Chat[];
  notifications: Notification[];
  chefStats: ChefStats | null;
  chefDishes: Dish[];
  favorites: string[];
  isLoadingChefs: boolean;
  isLoadingChefOrders: boolean;
  isLoadingNotifications: boolean;
  user: AuthUser | null;
  token: string | null;
  isLoadingAuth: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  loginWithPasskey: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  registerClient: (data: RegisterClientData) => Promise<AuthRegistrationResult>;
  registerChef: (data: RegisterChefData) => Promise<AuthRegistrationResult>;
  registerCourier: (data: RegisterCourierData) => Promise<AuthRegistrationResult>;
  registerPasskey: (deviceName?: string) => Promise<PasskeySummary[]>;
  listPasskeys: () => Promise<PasskeySummary[]>;
  deletePasskey: (id: string) => Promise<void>;
  updateCourierVerificationDossier: (data: {
    identityDocumentUrl?: string | null;
    driverLicenseUrl?: string | null;
    vehicleRegistrationUrl?: string | null;
    vehiclePhotoUrl?: string | null;
    selfiePhotoUrl?: string | null;
  }) => Promise<AuthUser["courierProfile"]>;
  addOrder: (order: Order) => void;
  createOrder: (data: {
    chefId: string;
    items: Array<{ dishId: string; quantity: number }>;
    occasion?: string;
    persons?: number;
    budget?: string;
    notes?: string;
    deliveryAddress?: string;
  }) => Promise<Order>;
  createCustomRequest: (data: {
    chefId: string;
    packageDishId: string;
    estimatedPersons: number;
    estimatedTotal: number;
    occasion?: string;
    budget?: string;
    preferences?: string[];
    storyReference?: string;
    notes?: string;
    deliveryAddress?: string;
  }) => Promise<CustomRequest>;
  toggleFavorite: (chefId: string) => Promise<void>;
  sendMessage: (chatId: string, chefId: string, text: string, chefName: string, chefSpecialty: string, coverColor: string) => void;
  getChef: (id: string) => Chef | undefined;
  updateCurrentUser: (data: { avatarUrl?: string | null; coverColor?: string; location?: string }) => Promise<AuthUser>;
  refreshChefs: () => Promise<void>;
  refreshStories: () => Promise<void>;
  likeStory: (storyId: string) => Promise<void>;
  addStoryComment: (storyId: string, body: string) => Promise<void>;
  deleteStoryComment: (storyId: string, commentId: string) => Promise<void>;
  postStory: (data: { caption: string; dishName?: string; price?: number; emoji?: string; bgColor?: string; imageUrl?: string | null; videoUrl?: string | null; videoDurationSeconds?: number | null }) => Promise<void>;
  fetchChefStats: (chefId: string) => Promise<void>;
  fetchChefDishes: (chefId: string) => Promise<void>;
  updateChefDish: (dishId: string, data: { name: string; description: string; category: string; prepTime: string; imageUrls: string[]; isPopular?: boolean; discountPercent?: number; discountLabel?: string }) => Promise<void>;
  deleteChefDish: (dishId: string) => Promise<void>;
  fetchChefOrders: () => Promise<void>;
  fetchCustomRequests: () => Promise<void>;
  fetchChefCustomRequests: () => Promise<void>;
  updateChefCustomRequestStatus: (requestId: string, data: { status: ReceivedCustomRequest["status"]; chefResponse?: string }) => Promise<void>;
  updateChefOrderStatus: (orderId: string, status: ReceivedOrder["status"]) => Promise<void>;
  requestDeliveryForOrder: (orderId: string) => Promise<void>;
  cancelDeliverySearchForOrder: (deliveryJobId: string) => Promise<void>;
  fetchNotifications: (options?: { silent?: boolean }) => Promise<void>;
  refreshOrders: () => Promise<void>;
}

export interface RegisterClientData {
  name: string;
  email: string;
  phone?: string;
  referralCode?: string;
  password: string;
  location: string;
  preferences?: string[];
}

export interface RegisterChefData {
  name: string;
  email: string;
  phone?: string;
  referralCode?: string;
  password: string;
  specialty: string;
  location: string;
  zone: string;
  bio: string;
  priceRange: string;
  coverColor?: string;
  specialties?: string[];
}

export interface RegisterCourierData {
  name: string;
  email: string;
  phone?: string;
  referralCode?: string;
  password: string;
  location: string;
  zone?: string;
  vehicleType?: string;
}

export interface AuthRegistrationResult {
  requiresEmailConfirmation: boolean;
  email?: string | null;
}

const AppContext = createContext<AppContextValue | null>(null);

// Do not expose example chats/orders to unauthenticated users.
const MOCK_CHATS: Chat[] = [];

function normalizeImageUrlList(input: unknown, fallback?: string | null): string[] {
  const values = Array.isArray(input) ? input : [];
  const normalized = values
    .map((value) => normalizeRemoteUrl(typeof value === "string" ? value : null))
    .filter((value): value is string => Boolean(value));

  const normalizedFallback = normalizeRemoteUrl(fallback);
  if (normalizedFallback) {
    normalized.unshift(normalizedFallback);
  }

  return Array.from(new Set(normalized));
}

function mapApiStory(s: any): Story {
  return {
    id: String(s.id),
    chefId: String(s.chefId ?? s.chef_profile_id ?? s.chef_id ?? ""),
    chefName: s.chefName ?? s.chef_name ?? s.chef_name_display ?? "",
    chefCoverColor: s.chefCoverColor ?? s.chef_cover_color ?? s.chefCoverColor ?? "#C4522A",
    caption: s.caption ?? "",
    dishName: s.dishName ?? s.dish_name ?? null,
    price: s.price ?? null,
    emoji: s.emoji ?? null,
    bgColor: s.bgColor ?? s.bg_color ?? null,
    imageUrl: normalizeRemoteUrl(s.imageUrl ?? s.image_url ?? null),
    videoUrl: normalizeRemoteUrl(s.videoUrl ?? s.video_url ?? null),
    videoDurationSeconds: s.videoDurationSeconds ?? s.video_duration_seconds ?? null,
    likeCount: Number(s.likeCount ?? s.like_count ?? 0),
    commentCount: Number(s.commentCount ?? s.comment_count ?? 0),
    likedByMe: Boolean(s.likedByMe ?? s.liked_by_me ?? false),
    comments: (s.comments ?? []).map((comment: any) => ({
      id: String(comment.id),
      storyId: String(comment.storyId ?? comment.story_id ?? s.id),
      userId: String(comment.userId ?? comment.user_id ?? ""),
      userName: String(comment.userName ?? comment.user_name ?? "Utilisateur"),
      userAvatarUrl: normalizeRemoteUrl(comment.userAvatarUrl ?? comment.user_avatar_url ?? null),
      userCoverColor: comment.userCoverColor ?? comment.user_cover_color ?? null,
      body: String(comment.body ?? ""),
      createdAt: String(comment.createdAt ?? comment.created_at ?? new Date().toISOString()),
    })),
    createdAt: s.createdAt ?? s.created_at ?? new Date().toISOString(),
    expiresAt: s.expiresAt ?? s.expires_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function mapApiDish(d: any): Dish {
  return {
    id: String(d.id),
    name: d.name,
    description: d.description,
    price: Number(d.price ?? 0),
    basePrice: Number(d.basePrice ?? d.price ?? 0),
    category: d.category,
    prepTime: d.prepTime,
    isPopular: d.isPopular,
    discountPercent: Number(d.discountPercent ?? 0),
    discountLabel: d.discountLabel ?? "",
    savingsAmount: Number(d.savingsAmount ?? 0),
    imageUrl: normalizeRemoteUrl(d.imageUrl ?? null),
    imageUrls: normalizeImageUrlList(d.imageUrls, d.imageUrl ?? null),
  };
}

function mapApiChef(c: any): Chef {
  const mappedDishes = (c.dishes ?? []).map(mapApiDish);
  const mappedStories = (c.stories ?? []).map((s: any) => mapApiStory({
    ...s,
    chefId: s.chefId ?? s.chef_profile_id ?? c.id,
    chefName: s.chefName ?? s.chef_name ?? c.name,
    chefCoverColor: s.chefCoverColor ?? s.chef_cover_color ?? c.coverColor ?? "#C4522A",
  }));
  const heroImageUrl =
    mappedDishes.find((dish: Dish) => dish.imageUrls?.[0])?.imageUrls?.[0] ??
    mappedDishes.find((dish: Dish) => dish.imageUrl)?.imageUrl ??
    mappedStories.find((story: Story) => story.imageUrl)?.imageUrl ??
    normalizeRemoteUrl(c.avatarUrl ?? null);

  return {
    id: c.id,
    name: c.name,
    specialty: c.specialty,
    location: c.location,
    zone: c.zone,
    specialties: c.specialties ?? [],
    avatarUrl: normalizeRemoteUrl(c.avatarUrl ?? null),
    heroImageUrl,
    rating: c.rating ?? 5.0,
    reviewCount: c.reviewCount ?? 0,
    stars: Number(c.stars ?? 0),
    complaintCount: Number(c.complaintCount ?? 0),
    activeInvestigationCount: Number(c.activeInvestigationCount ?? 0),
    isFeatured: Boolean(c.isFeatured),
    priceRange: c.priceRange ?? "",
    isVerified: c.isVerified ?? false,
    isOnline: c.isOnline ?? true,
    coverColor: c.coverColor ?? "#C4522A",
    bio: c.bio ?? "",
    responseTime: c.responseTime ?? "< 30 min",
    dishes: mappedDishes,
    stories: mappedStories,
  };
}

function mapApiAuthUser(input: any): AuthUser {
  return {
    ...input,
    avatarUrl: normalizeRemoteUrl(input?.avatarUrl ?? null),
    chefProfile: input?.chefProfile
      ? {
          ...input.chefProfile,
          specialties: input.chefProfile.specialties ?? undefined,
        }
      : null,
    courierProfile: input?.courierProfile
      ? {
          ...input.courierProfile,
          rejectionReason: typeof input.courierProfile.rejectionReason === "string" ? input.courierProfile.rejectionReason : null,
          rejectionReasonUpdatedAt: input.courierProfile.rejectionReasonUpdatedAt ?? null,
          verificationDocuments: input.courierProfile.verificationDocuments
            ? {
                identityDocumentUrl: normalizeRemoteUrl(input.courierProfile.verificationDocuments.identityDocumentUrl ?? null),
                driverLicenseUrl: normalizeRemoteUrl(input.courierProfile.verificationDocuments.driverLicenseUrl ?? null),
                vehicleRegistrationUrl: normalizeRemoteUrl(input.courierProfile.verificationDocuments.vehicleRegistrationUrl ?? null),
                vehiclePhotoUrl: normalizeRemoteUrl(input.courierProfile.verificationDocuments.vehiclePhotoUrl ?? null),
                selfiePhotoUrl: normalizeRemoteUrl(input.courierProfile.verificationDocuments.selfiePhotoUrl ?? null),
              }
            : undefined,
          missingDocuments: Array.isArray(input.courierProfile.missingDocuments) ? input.courierProfile.missingDocuments : [],
        }
      : null,
  };
}

function mapApiOrder(order: any): Order {
  return {
    id: String(order.id),
    chefId: String(order.chefId),
    chefName: String(order.chefName ?? ""),
    dishes: Array.isArray(order.items)
      ? order.items.map((item: any) => ({
          dish: {
            id: String(item.dishId ?? `${order.id}-${item.dishName}`),
            name: String(item.dishName ?? ""),
            description: "",
            price: Number(item.price ?? 0),
            category: "",
            prepTime: "",
            imageUrl: normalizeRemoteUrl(item.imageUrl ?? null),
            imageUrls: normalizeImageUrlList(item.imageUrls, item.imageUrl ?? null),
            visualKey: item.visualKey ?? null,
          },
          quantity: Number(item.quantity ?? 1),
        }))
      : [],
    kind: order.kind === "commerce" ? "commerce" : "meal",
    commerceUniverse: order.commerceUniverse ?? null,
    merchantVisualKey: order.merchantVisualKey ?? null,
    total: Number(order.total ?? 0),
    deliveryFee: Number(order.deliveryFee ?? 0),
    totalWithDelivery: Number(order.totalWithDelivery ?? order.total ?? 0),
    deliveryDistanceKm: order.deliveryDistanceKm != null ? Number(order.deliveryDistanceKm) : null,
    deliveryDemandMultiplier: Number(order.deliveryDemandMultiplier ?? 1),
    freeDeliveryApplied: Boolean(order.freeDeliveryApplied),
    referralCreditUsed: Boolean(order.referralCreditUsed),
    status: order.status,
    createdAt: String(order.createdAt ?? new Date().toISOString()),
    cancelAvailableUntil: order.cancelAvailableUntil ? String(order.cancelAvailableUntil) : null,
    occasion: order.occasion ?? undefined,
    persons: order.persons ?? undefined,
    review: order.review
      ? {
          restaurantRating: Number(order.review.restaurantRating ?? 0),
          restaurantComment: order.review.restaurantComment ?? "",
          deliveryRating: order.review.deliveryRating != null ? Number(order.review.deliveryRating) : null,
          deliveryComment: order.review.deliveryComment ?? "",
          submittedAt: order.review.submittedAt ?? undefined,
        }
      : null,
    canReview: Boolean(order.canReview),
    delivery: order.delivery
      ? {
          id: String(order.delivery.id),
          status: order.delivery.status,
          courierUserId: order.delivery.courierUserId ? String(order.delivery.courierUserId) : null,
          deliveryAddress: order.delivery.deliveryAddress ?? undefined,
          restaurantAddress: order.delivery.restaurantAddress ?? undefined,
          restaurantLatitude: order.delivery.restaurantLatitude != null ? Number(order.delivery.restaurantLatitude) : null,
          restaurantLongitude: order.delivery.restaurantLongitude != null ? Number(order.delivery.restaurantLongitude) : null,
          deliveryLatitude: order.delivery.deliveryLatitude != null ? Number(order.delivery.deliveryLatitude) : null,
          deliveryLongitude: order.delivery.deliveryLongitude != null ? Number(order.delivery.deliveryLongitude) : null,
          broadcastedAt: order.delivery.broadcastedAt ? String(order.delivery.broadcastedAt) : null,
          broadcastEndsAt: order.delivery.broadcastEndsAt ? String(order.delivery.broadcastEndsAt) : null,
          broadcastRemainingMinutes: order.delivery.broadcastRemainingMinutes != null ? Number(order.delivery.broadcastRemainingMinutes) : null,
          canCancelSearch: Boolean(order.delivery.canCancelSearch),
          canRebroadcast: Boolean(order.delivery.canRebroadcast),
          latestLocation: order.delivery.latestLocation
            ? {
                latitude: Number(order.delivery.latestLocation.latitude),
                longitude: Number(order.delivery.latestLocation.longitude),
                accuracy: order.delivery.latestLocation.accuracy ?? null,
                heading: order.delivery.latestLocation.heading ?? null,
                speed: order.delivery.latestLocation.speed ?? null,
                createdAt: String(order.delivery.latestLocation.createdAt),
              }
            : null,
        }
      : null,
  };
}

function mapApiCustomRequest(request: any): CustomRequest {
  return {
    id: String(request.id),
    chefId: String(request.chefId),
    chefName: String(request.chefName ?? ""),
    chefLocation: String(request.chefLocation ?? ""),
    packageDishId: request.packageDishId ? String(request.packageDishId) : null,
    packageName: String(request.packageName ?? ""),
    packageDescription: String(request.packageDescription ?? ""),
    unitPrice: Number(request.unitPrice ?? 0),
    estimatedPersons: Number(request.estimatedPersons ?? 1),
    estimatedTotal: Number(request.estimatedTotal ?? 0),
    occasion: request.occasion ?? "",
    budget: request.budget ?? "",
    preferences: Array.isArray(request.preferences) ? request.preferences.map(String) : [],
    storyReference: request.storyReference ?? "",
    deliveryAddress: request.deliveryAddress ?? "",
    notes: request.notes ?? "",
    chefResponse: request.chefResponse ?? "",
    status: request.status,
    respondedAt: request.respondedAt ?? null,
    createdAt: String(request.createdAt ?? new Date().toISOString()),
    updatedAt: String(request.updatedAt ?? request.createdAt ?? new Date().toISOString()),
  };
}

function mapApiChefCustomRequest(request: any): ReceivedCustomRequest {
  return {
    id: String(request.id),
    clientId: String(request.clientId),
    clientName: String(request.clientName ?? "Cliente"),
    clientLocation: String(request.clientLocation ?? ""),
    packageDishId: request.packageDishId ? String(request.packageDishId) : null,
    packageName: String(request.packageName ?? ""),
    packageDescription: String(request.packageDescription ?? ""),
    unitPrice: Number(request.unitPrice ?? 0),
    estimatedPersons: Number(request.estimatedPersons ?? 1),
    estimatedTotal: Number(request.estimatedTotal ?? 0),
    occasion: request.occasion ?? "",
    budget: request.budget ?? "",
    preferences: Array.isArray(request.preferences) ? request.preferences.map(String) : [],
    storyReference: request.storyReference ?? "",
    deliveryAddress: request.deliveryAddress ?? "",
    notes: request.notes ?? "",
    chefResponse: request.chefResponse ?? "",
    status: request.status,
    respondedAt: request.respondedAt ?? null,
    createdAt: String(request.createdAt ?? new Date().toISOString()),
    updatedAt: String(request.updatedAt ?? request.createdAt ?? new Date().toISOString()),
  };
}

function mapApiChefOrder(order: any): ReceivedOrder {
  return {
    id: String(order.id),
    clientId: String(order.clientId),
    clientName: String(order.clientName ?? "Cliente"),
    clientLocation: String(order.clientLocation ?? ""),
    items: Array.isArray(order.items)
      ? order.items.map((item: any) => ({
          dishId: item.dishId ? String(item.dishId) : null,
          dishName: String(item.dishName ?? ""),
          quantity: Number(item.quantity ?? 1),
          price: Number(item.price ?? 0),
        }))
      : [],
    total: Number(order.total ?? 0),
    status: order.status,
    createdAt: String(order.createdAt ?? new Date().toISOString()),
    occasion: order.occasion ?? null,
    persons: order.persons ?? null,
    notes: order.notes ?? null,
    delivery: order.delivery
      ? {
          id: String(order.delivery.id),
          status: order.delivery.status,
          courierUserId: order.delivery.courierUserId ? String(order.delivery.courierUserId) : null,
          deliveryAddress: order.delivery.deliveryAddress ?? undefined,
          restaurantAddress: order.delivery.restaurantAddress ?? undefined,
          restaurantLatitude: order.delivery.restaurantLatitude != null ? Number(order.delivery.restaurantLatitude) : null,
          restaurantLongitude: order.delivery.restaurantLongitude != null ? Number(order.delivery.restaurantLongitude) : null,
          deliveryLatitude: order.delivery.deliveryLatitude != null ? Number(order.delivery.deliveryLatitude) : null,
          deliveryLongitude: order.delivery.deliveryLongitude != null ? Number(order.delivery.deliveryLongitude) : null,
          broadcastedAt: order.delivery.broadcastedAt ? String(order.delivery.broadcastedAt) : null,
          broadcastEndsAt: order.delivery.broadcastEndsAt ? String(order.delivery.broadcastEndsAt) : null,
          broadcastRemainingMinutes: order.delivery.broadcastRemainingMinutes != null ? Number(order.delivery.broadcastRemainingMinutes) : null,
          canCancelSearch: Boolean(order.delivery.canCancelSearch),
          canRebroadcast: Boolean(order.delivery.canRebroadcast),
          latestLocation: order.delivery.latestLocation
            ? {
                latitude: Number(order.delivery.latestLocation.latitude),
                longitude: Number(order.delivery.latestLocation.longitude),
                accuracy: order.delivery.latestLocation.accuracy ?? null,
                heading: order.delivery.latestLocation.heading ?? null,
                speed: order.delivery.latestLocation.speed ?? null,
                createdAt: String(order.delivery.latestLocation.createdAt),
              }
            : null,
        }
      : null,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customRequests, setCustomRequests] = useState<CustomRequest[]>([]);
  const [chefOrders, setChefOrders] = useState<ReceivedOrder[]>([]);
  const [chefCustomRequests, setChefCustomRequests] = useState<ReceivedCustomRequest[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chefStats, setChefStats] = useState<ChefStats | null>(null);
  const [chefDishes, setChefDishes] = useState<Dish[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoadingChefs, setIsLoadingChefs] = useState(true);
  const [isLoadingChefOrders, setIsLoadingChefOrders] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const refreshChefs = useCallback(async () => {
    try {
      const data = await apiFetch<{ chefs: any[] }>("/chefs", { cacheConfig: PUBLIC_CHEFS_CACHE });
      setChefs(data.chefs.map(mapApiChef));
    } catch (e) {
      console.warn("Failed to load chefs from API:", e);
    } finally {
      setIsLoadingChefs(false);
    }
  }, []);

  const refreshStories = useCallback(async () => {
    try {
      const data = await apiFetch<{ stories: any[] }>("/stories", { cacheConfig: PUBLIC_STORIES_CACHE });
      setStories((data.stories ?? []).map(mapApiStory));
    } catch (e) {
      console.warn("Failed to load stories:", e);
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    if (!token || user?.type !== "client") {
      return;
    }
    try {
      const data = await apiFetch<{ orders: any[] }>("/orders", {
        token,
        cacheConfig: buildUserScopedApiCache("client-orders", 90 * 1000, user.id),
      });
      setOrders((data.orders ?? []).map(mapApiOrder));
    } catch (error) {
      console.warn("Failed to load orders:", error);
    }
  }, [token, user?.id, user?.type]);

  const fetchCustomRequests = useCallback(async () => {
    if (!token || user?.type !== "client") return;
    try {
      const data = await apiFetch<{ requests: any[] }>("/custom-requests", {
        token,
        cacheConfig: buildUserScopedApiCache("client-custom-requests", 90 * 1000, user.id),
      });
      setCustomRequests((data.requests ?? []).map(mapApiCustomRequest));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (message.includes("Cannot GET /api/custom-requests") || message.includes("404")) {
        setCustomRequests([]);
        return;
      }
      console.warn("Failed to load custom requests:", error);
    }
  }, [token, user?.id, user?.type]);

  const fetchChefCustomRequests = useCallback(async () => {
    if (!token || user?.type !== "chef") return;
    try {
      const data = await apiFetch<{ requests: any[] }>("/chef/custom-requests", {
        token,
        cacheConfig: buildUserScopedApiCache("chef-custom-requests", 45 * 1000, user.id),
      });
      setChefCustomRequests((data.requests ?? []).map(mapApiChefCustomRequest));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (message.includes("Cannot GET /api/chef/custom-requests") || message.includes("404")) {
        setChefCustomRequests([]);
        return;
      }
      console.warn("Failed to load chef custom requests:", error);
    }
  }, [token, user?.id, user?.type]);

  const fetchChefOrders = useCallback(async () => {
    if (!token || user?.type !== "chef") return;
    try {
      setIsLoadingChefOrders(true);
      const data = await apiFetch<{ orders: any[] }>("/chef/orders", {
        token,
        cacheConfig: buildUserScopedApiCache("chef-orders", 45 * 1000, user.id),
      });
      setChefOrders((data.orders ?? []).map(mapApiChefOrder));
    } catch (error) {
      console.warn("Failed to load chef orders:", error);
    } finally {
      setIsLoadingChefOrders(false);
    }
  }, [token, user?.id, user?.type]);

  const likeStory = useCallback(async (storyId: string) => {
    try {
      const response = await apiFetch<{ liked: boolean; likeCount: number }>(`/stories/${storyId}/like`, { method: "POST", token: token ?? undefined });
      await invalidateApiCache("/stories", PUBLIC_STORIES_CACHE);
      setStories((current) =>
        current.map((story) =>
          story.id === storyId
            ? {
                ...story,
                likedByMe: response.liked,
                likeCount: response.likeCount,
              }
            : story
        )
      );
    } catch (e) {
      console.warn("Failed to like story:", e);
    }
  }, [token]);

  const addStoryComment = useCallback(async (storyId: string, body: string) => {
    try {
      const response = await apiFetch<{ comment: any; commentCount: number }>(`/stories/${storyId}/comments`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({ body }),
      });
      await invalidateApiCache("/stories", PUBLIC_STORIES_CACHE);

      setStories((current) =>
        current.map((story) =>
          story.id === storyId
            ? {
                ...story,
                commentCount: response.commentCount,
                comments: [
                  {
                    id: String(response.comment.id),
                    storyId: String(response.comment.storyId ?? storyId),
                    userId: String(response.comment.userId ?? ""),
                    userName: String(response.comment.userName ?? "Utilisateur"),
                    userAvatarUrl: normalizeRemoteUrl(response.comment.userAvatarUrl ?? null),
                    userCoverColor: response.comment.userCoverColor ?? null,
                    body: String(response.comment.body ?? body),
                    createdAt: String(response.comment.createdAt ?? new Date().toISOString()),
                  },
                  ...story.comments,
                ].slice(0, 12),
              }
            : story
        )
      );
    } catch (e) {
      console.warn("Failed to comment story:", e);
    }
  }, [token]);

  const deleteStoryComment = useCallback(async (storyId: string, commentId: string) => {
    const resolvedToken = token ?? (await AsyncStorage.getItem("nixyah_token")) ?? undefined;

    if (!resolvedToken) {
      throw new Error("Connexion requise");
    }

    try {
      let response = await apiFetch<{ deletedCommentId: string; commentCount: number }>(`/stories/${storyId}/comments/${commentId}`, {
        method: "DELETE",
        token: resolvedToken,
      });

      if (!response) {
        response = await apiFetch<{ deletedCommentId: string; commentCount: number }>(`/stories/${storyId}/comments/${commentId}/delete`, {
          method: "POST",
          token: resolvedToken,
        });
      }

      await invalidateApiCache("/stories", PUBLIC_STORIES_CACHE);

      setStories((current) =>
        current.map((story) =>
          story.id === storyId
            ? {
                ...story,
                commentCount: response.commentCount,
                comments: story.comments.filter((comment) => comment.id !== response.deletedCommentId),
              }
            : story
        )
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      if (message.includes("Cannot DELETE")) {
        try {
          const response = await apiFetch<{ deletedCommentId: string; commentCount: number }>(`/stories/${storyId}/comments/${commentId}/delete`, {
            method: "POST",
            token: resolvedToken,
          });

          await invalidateApiCache("/stories", PUBLIC_STORIES_CACHE);

          setStories((current) =>
            current.map((story) =>
              story.id === storyId
                ? {
                    ...story,
                    commentCount: response.commentCount,
                    comments: story.comments.filter((comment) => comment.id !== response.deletedCommentId),
                  }
                : story
            )
          );
          return;
        } catch (fallbackError) {
          console.warn("Failed to delete story comment with fallback:", fallbackError);
          throw fallbackError;
        }
      }

      console.warn("Failed to delete story comment:", e);
      throw e;
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        const [cachedChefs, cachedStories] = await Promise.all([
          readApiCache<{ chefs: any[] }>("/chefs", PUBLIC_CHEFS_CACHE, { allowExpired: true }),
          readApiCache<{ stories: any[] }>("/stories", PUBLIC_STORIES_CACHE, { allowExpired: true }),
        ]);

        if (cachedChefs?.chefs?.length) {
          setChefs(cachedChefs.chefs.map(mapApiChef));
          setIsLoadingChefs(false);
        }

        if (cachedStories?.stories?.length) {
          setStories(cachedStories.stories.map(mapApiStory));
        }

        const savedToken = await AsyncStorage.getItem("nixyah_token");
        if (savedToken) {
          try {
            const me = await apiFetch<AuthUser>("/auth/me", { token: savedToken });
            setUser(mapApiAuthUser(me));
            setToken(savedToken);
          } catch (err) {
            await AsyncStorage.removeItem("nixyah_token");
          }
        }
      } catch (e) {
        console.warn("Failed to read auth token:", e);
      }

      setIsLoadingAuth(false);

      refreshChefs();
      refreshStories();
    })();
  }, [refreshChefs, refreshStories]);

  useEffect(() => {
    if (isLoadingAuth) {
      return;
    }

    let isCancelled = false;

    const loadScopedState = async () => {
      try {
        const favoritesValue = await AsyncStorage.getItem(getScopedStorageKey(FAVORITES_STORAGE_KEY, user?.id));
        if (!isCancelled) {
          setFavorites(favoritesValue ? JSON.parse(favoritesValue) : []);
        }
      } catch (error) {
        console.warn("Failed to load favorites:", error);
        if (!isCancelled) {
          setFavorites([]);
        }
      }

      if (!user) {
        if (!isCancelled) {
          setOrders([]);
          setCustomRequests([]);
          setChats([]);
          setChefOrders([]);
          setChefCustomRequests([]);
          setNotifications([]);
          setChefStats(null);
        }
        return;
      }

      try {
        const [ordersValue, chatsValue] = await Promise.all([
          user.type === "client" ? AsyncStorage.getItem(getScopedStorageKey(ORDERS_STORAGE_KEY, user.id)) : Promise.resolve(null),
          AsyncStorage.getItem(getScopedStorageKey(CHATS_STORAGE_KEY, user.id)),
        ]);

        if (!isCancelled) {
          setOrders(user.type === "client" && ordersValue ? JSON.parse(ordersValue) : []);
          setChats(chatsValue ? JSON.parse(chatsValue) : []);
          setCustomRequests([]);
          setChefCustomRequests([]);
        }
      } catch (error) {
        console.warn("Failed to load scoped user data:", error);
        if (!isCancelled) {
          setOrders([]);
          setCustomRequests([]);
          setChats([]);
          setChefCustomRequests([]);
        }
      }
    };

    void loadScopedState();

    return () => {
      isCancelled = true;
    };
  }, [isLoadingAuth, user?.id, user?.type]);

  useEffect(() => {
    if (isLoadingAuth) {
      return;
    }

    void AsyncStorage.setItem(getScopedStorageKey(FAVORITES_STORAGE_KEY, user?.id), JSON.stringify(favorites));
  }, [favorites, isLoadingAuth, user?.id]);

  useEffect(() => {
    if (isLoadingAuth || !user || user.type !== "client") {
      return;
    }

    void AsyncStorage.setItem(getScopedStorageKey(ORDERS_STORAGE_KEY, user.id), JSON.stringify(orders));
  }, [isLoadingAuth, orders, user?.id, user?.type]);

  useEffect(() => {
    if (isLoadingAuth || !user) {
      return;
    }

    void AsyncStorage.setItem(getScopedStorageKey(CHATS_STORAGE_KEY, user.id), JSON.stringify(chats));
  }, [chats, isLoadingAuth, user?.id]);

  useEffect(() => {
    if (token && user?.type === "client") {
      refreshOrders();
      fetchCustomRequests();
      void (async () => {
        try {
          const data = await apiFetch<{ chefIds: string[] }>("/chefs/favorites", { token });
          setFavorites((data.chefIds ?? []).map(String));
        } catch (error) {
          console.warn("Failed to load favorite chefs:", error);
        }
      })();
    }
  }, [token, user?.type, refreshOrders, fetchCustomRequests]);

  useEffect(() => {
    if (token && user?.type === "chef") {
      fetchChefOrders();
      fetchChefCustomRequests();
    }
  }, [token, user?.type, fetchChefCustomRequests, fetchChefOrders]);

  const login = useCallback(async (emailOrPhone: string, password: string) => {
    const data = await apiFetch<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ emailOrPhone, password }),
    });
    await AsyncStorage.setItem("nixyah_token", data.token);
    setToken(data.token);
    setUser(mapApiAuthUser(data.user));
  }, []);

  const loginWithPasskey = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error("Email requis pour utiliser une passkey");
    }

    const optionsResponse = await apiFetch<{ options: any }>("/auth/passkey/login/options", {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail }),
    });

    const assertion = await getNativePasskey(optionsResponse.options);
    if (!assertion) {
      throw new Error("Connexion passkey annulée");
    }

    const data = await apiFetch<{ token: string; user: AuthUser }>("/auth/passkey/login/verify", {
      method: "POST",
      body: JSON.stringify({
        challenge: optionsResponse.options.challenge,
        response: assertion,
      }),
    });

    await AsyncStorage.setItem("nixyah_token", data.token);
    setToken(data.token);
    setUser(mapApiAuthUser(data.user));
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("nixyah_token");
    setToken(null);
    setUser(null);
    setOrders([]);
    setCustomRequests([]);
    setChats([]);
    setFavorites([]);
    setChefOrders([]);
    setChefCustomRequests([]);
    setNotifications([]);
    setChefStats(null);
  }, []);

  const registerClient = useCallback(async (data: RegisterClientData) => {
    const res = await apiFetch<{ token?: string; user: AuthUser; requiresEmailConfirmation?: boolean; email?: string | null }>("/auth/register/client", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.token) {
      await AsyncStorage.setItem("nixyah_token", res.token);
      setToken(res.token);
      setUser(mapApiAuthUser(res.user));
      return { requiresEmailConfirmation: false, email: res.user.email };
    }

    await AsyncStorage.removeItem("nixyah_token");
    setToken(null);
    setUser(null);
    return {
      requiresEmailConfirmation: Boolean(res.requiresEmailConfirmation),
      email: res.email ?? res.user.email ?? null,
    };
  }, []);

  const registerChef = useCallback(async (data: RegisterChefData) => {
    const res = await apiFetch<{ token?: string; user: AuthUser; requiresEmailConfirmation?: boolean; email?: string | null }>("/auth/register/chef", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.token) {
      await AsyncStorage.setItem("nixyah_token", res.token);
      setToken(res.token);
      setUser(mapApiAuthUser(res.user));
      await invalidateApiCache("/chefs", PUBLIC_CHEFS_CACHE);
      await refreshChefs();
      return { requiresEmailConfirmation: false, email: res.user.email };
    }

    await AsyncStorage.removeItem("nixyah_token");
    setToken(null);
    setUser(null);
    await invalidateApiCache("/chefs", PUBLIC_CHEFS_CACHE);
    await refreshChefs();
    return {
      requiresEmailConfirmation: Boolean(res.requiresEmailConfirmation),
      email: res.email ?? res.user.email ?? null,
    };
  }, [refreshChefs]);

  const registerCourier = useCallback(async (data: RegisterCourierData) => {
    const res = await apiFetch<{ token?: string; user: AuthUser; requiresEmailConfirmation?: boolean; email?: string | null }>("/auth/register/courier", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.token) {
      await AsyncStorage.setItem("nixyah_token", res.token);
      setToken(res.token);
      setUser(mapApiAuthUser(res.user));
      return { requiresEmailConfirmation: false, email: res.user.email };
    }

    await AsyncStorage.removeItem("nixyah_token");
    setToken(null);
    setUser(null);
    return {
      requiresEmailConfirmation: Boolean(res.requiresEmailConfirmation),
      email: res.email ?? res.user.email ?? null,
    };
  }, []);

  const listPasskeys = useCallback(async () => {
    if (!token) {
      throw new Error("Non connecté");
    }

    const response = await apiFetch<{ passkeys: PasskeySummary[] }>("/auth/passkey/list", {
      token,
    });

    return response.passkeys ?? [];
  }, [token]);

  const registerPasskey = useCallback(async (deviceName?: string) => {
    if (!token) {
      throw new Error("Non connecté");
    }

    const optionsResponse = await apiFetch<{ options: any }>("/auth/passkey/register/options", {
      method: "POST",
      token,
    });

    const creation = await createNativePasskey(optionsResponse.options);
    if (!creation) {
      throw new Error("Création de passkey annulée");
    }

    const response = await apiFetch<{ passkeys: PasskeySummary[] }>("/auth/passkey/register/verify", {
      method: "POST",
      token,
      body: JSON.stringify({
        challenge: optionsResponse.options.challenge,
        response: creation,
        deviceName: deviceName?.trim() || getDefaultPasskeyDeviceName(),
      }),
    });

    return response.passkeys ?? [];
  }, [token]);

  const deletePasskey = useCallback(async (id: string) => {
    if (!token) {
      throw new Error("Non connecté");
    }

    await apiFetch(`/auth/passkey/${id}`, {
      method: "DELETE",
      token,
    });
  }, [token]);

  const updateCourierVerificationDossier = useCallback(async (data: {
    identityDocumentUrl?: string | null;
    driverLicenseUrl?: string | null;
    vehicleRegistrationUrl?: string | null;
    vehiclePhotoUrl?: string | null;
    selfiePhotoUrl?: string | null;
  }) => {
    if (!token || user?.type !== "courier") {
      throw new Error("Session livreur requise");
    }

    const payload = Object.fromEntries(
      Object.entries(data).filter(([, value]) => typeof value !== "undefined")
    ) as typeof data;

    if (Object.keys(payload).length === 0) {
      if (user.courierProfile) {
        return user.courierProfile;
      }
      throw new Error("Aucun document à mettre à jour");
    }

    const response = await apiFetch<{ courierProfile: AuthUser["courierProfile"] }>("/auth/me/courier-dossier", {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });

    const nextCourierProfile = mapApiAuthUser({ courierProfile: response.courierProfile }).courierProfile;
    setUser((current) => {
      if (!current || current.type !== "courier") {
        return current;
      }

      return {
        ...current,
        courierProfile: nextCourierProfile,
      };
    });

    return nextCourierProfile;
  }, [token, user?.type]);

  const postStory = useCallback(async (storyData: { caption: string; dishName?: string; price?: number; emoji?: string; bgColor?: string; imageUrl?: string | null; videoUrl?: string | null; videoDurationSeconds?: number | null }) => {
    if (!token) throw new Error("Non connecté");
    await apiFetch("/stories", {
      method: "POST",
      body: JSON.stringify(storyData),
      token,
    });
    await Promise.all([
      invalidateApiCache("/stories", PUBLIC_STORIES_CACHE),
      invalidateApiCache("/chefs", PUBLIC_CHEFS_CACHE),
    ]);
    await Promise.all([refreshStories(), refreshChefs()]);
  }, [token, refreshChefs, refreshStories]);

  const addOrder = useCallback((order: Order) => {
    setOrders((prev) => [order, ...prev]);
  }, []);

  const createOrder = useCallback(async (data: {
    chefId: string;
    items: Array<{ dishId: string; quantity: number }>;
    occasion?: string;
    persons?: number;
    budget?: string;
    notes?: string;
    deliveryAddress?: string;
  }) => {
    if (!token || user?.type !== "client") {
      throw new Error("Non connecté");
    }

    const response = await apiFetch<any>("/orders", {
      method: "POST",
      token,
      body: JSON.stringify({
        chefId: Number(data.chefId),
        items: data.items.map((item) => ({
          dishId: Number(item.dishId),
          quantity: Number(item.quantity),
        })),
        occasion: data.occasion ?? null,
        persons: data.persons ?? null,
        budget: data.budget ?? null,
        notes: data.notes ?? null,
        deliveryAddress: data.deliveryAddress ?? user.location ?? null,
      }),
    });

    const mappedOrder = mapApiOrder(response);
    setOrders((prev) => [mappedOrder, ...prev.filter((order) => order.id !== mappedOrder.id)]);
    await invalidateApiCache("/orders", buildUserScopedApiCache("client-orders", 90 * 1000, user.id));
    return mappedOrder;
  }, [token, user?.id, user?.location, user?.type]);

  const createCustomRequest = useCallback(async (data: {
    chefId: string;
    packageDishId: string;
    estimatedPersons: number;
    estimatedTotal: number;
    occasion?: string;
    budget?: string;
    preferences?: string[];
    storyReference?: string;
    notes?: string;
    deliveryAddress?: string;
  }) => {
    if (!token || user?.type !== "client") {
      throw new Error("Non connecté");
    }

    const response = await apiFetch<{ request: any }>("/custom-requests", {
      method: "POST",
      token,
      body: JSON.stringify({
        chefId: Number(data.chefId),
        packageDishId: Number(data.packageDishId),
        estimatedPersons: Number(data.estimatedPersons),
        estimatedTotal: Number(data.estimatedTotal),
        occasion: data.occasion ?? null,
        budget: data.budget ?? null,
        preferences: data.preferences ?? [],
        storyReference: data.storyReference ?? null,
        notes: data.notes ?? null,
        deliveryAddress: data.deliveryAddress ?? user.location ?? null,
      }),
    });

    const mappedRequest = mapApiCustomRequest(response.request);
    setCustomRequests((prev) => [mappedRequest, ...prev.filter((request) => request.id !== mappedRequest.id)]);
    await invalidateApiCache("/custom-requests", buildUserScopedApiCache("client-custom-requests", 90 * 1000, user.id));
    return mappedRequest;
  }, [token, user?.id, user?.location, user?.type]);

  const toggleFavorite = useCallback(async (chefId: string) => {
    const previousFavorites = favorites;
    const isFavorite = previousFavorites.includes(chefId);
    const nextFavorites = isFavorite
      ? previousFavorites.filter((id) => id !== chefId)
      : [...previousFavorites, chefId];

    setFavorites(nextFavorites);

    if (!token || user?.type !== "client") {
      return;
    }

    try {
      await apiFetch(`/chefs/${chefId}/favorite`, {
        method: isFavorite ? "DELETE" : "POST",
        token,
      });
    } catch (error) {
      console.warn("Failed to sync favorite chef:", error);
      setFavorites(previousFavorites);
      throw error;
    }
  }, [favorites, token, user?.type]);

  const sendMessage = useCallback(
    (chatId: string, chefId: string, text: string, chefName: string, chefSpecialty: string, coverColor: string) => {
      const newMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        text,
        isMe: true,
        timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      };
      setChats((prev) => {
        const existing = prev.find((c) => c.id === chatId);
        if (existing) {
          return prev.map((c) =>
            c.id === chatId
              ? { ...c, messages: [...c.messages, newMsg], lastMessage: text, lastMessageTime: newMsg.timestamp, unread: 0 }
              : c
          );
        }
        const newChat: Chat = {
          id: chatId,
          chefId,
          chefName,
          chefSpecialty,
          coverColor,
          lastMessage: text,
          lastMessageTime: newMsg.timestamp,
          unread: 0,
          messages: [newMsg],
        };
        return [...prev, newChat];
      });
    },
    []
  );

  const getChef = useCallback(
    (id: string) => chefs.find((c) => c.id === id),
    [chefs]
  );

  const updateCurrentUser = useCallback(async (data: { avatarUrl?: string | null; coverColor?: string; location?: string }) => {
    if (!token) throw new Error("Non connecté");
    const updated = await apiFetch<AuthUser>("/auth/me", {
      method: "PATCH",
      token,
      body: JSON.stringify(data),
    });
    const nextUser = mapApiAuthUser(updated);
    setUser(nextUser);
    await invalidateApiCache("/chefs", PUBLIC_CHEFS_CACHE);
    await refreshChefs();
    return nextUser;
  }, [token, refreshChefs]);

  const fetchChefStats = useCallback(async (chefId: string) => {
    try {
      setIsLoadingNotifications(true);
      const data = await apiFetch<ChefStats>(`/chef/${chefId}/stats`, {
        token: token ?? undefined,
        cacheConfig: buildUserScopedApiCache(`chef-stats:${chefId}`, 60 * 1000, user?.id),
      });
      setChefStats(data);
    } catch (error) {
      console.warn("Failed to load chef stats:", error);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [token, user?.id]);

  const fetchChefDishes = useCallback(async (chefId: string) => {
    try {
      const data = await apiFetch<{ dishes: any[] }>(`/chef/${chefId}/dishes`, {
        cacheConfig: buildUserScopedApiCache(`chef-dishes:${chefId}`, 5 * 60 * 1000, user?.id),
      });
      setChefDishes(data.dishes.map(mapApiDish));
    } catch (error) {
      console.warn("Failed to load chef dishes:", error);
    }
  }, [user?.id]);

  const updateChefDish = useCallback(async (dishId: string, data: { name: string; description: string; category: string; prepTime: string; imageUrls: string[]; isPopular?: boolean; discountPercent?: number; discountLabel?: string }) => {
    if (!token || !user?.id) throw new Error("Non connecté");
    await apiFetch(`/chef/${user.id}/dishes/${dishId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        category: data.category,
        prepTime: data.prepTime,
        imageUrl: data.imageUrls[0] ?? null,
        imageUrls: data.imageUrls,
        isPopular: Boolean(data.isPopular),
        discountPercent: Number(data.discountPercent ?? 0),
        discountLabel: data.discountLabel ?? "",
      }),
    });
    await Promise.all([
      invalidateApiCache(`/chef/${user.id}/dishes`, buildUserScopedApiCache(`chef-dishes:${user.id}`, 5 * 60 * 1000, user.id)),
      invalidateApiCache("/chefs", PUBLIC_CHEFS_CACHE),
    ]);
    await Promise.all([fetchChefDishes(user.id), refreshChefs()]);
  }, [fetchChefDishes, refreshChefs, token, user?.id]);

  const deleteChefDish = useCallback(async (dishId: string) => {
    if (!token || !user?.id) throw new Error("Non connecté");
    await apiFetch(`/chef/${user.id}/dishes/${dishId}`, {
      method: "DELETE",
      token,
    });
    await Promise.all([
      invalidateApiCache(`/chef/${user.id}/dishes`, buildUserScopedApiCache(`chef-dishes:${user.id}`, 5 * 60 * 1000, user.id)),
      invalidateApiCache("/chefs", PUBLIC_CHEFS_CACHE),
    ]);
    await Promise.all([fetchChefDishes(user.id), refreshChefs()]);
  }, [fetchChefDishes, refreshChefs, token, user?.id]);

  const updateChefCustomRequestStatus = useCallback(async (requestId: string, data: { status: ReceivedCustomRequest["status"]; chefResponse?: string }) => {
    if (!token || user?.type !== "chef") throw new Error("Non connecté");
    await apiFetch(`/chef/custom-requests/${requestId}/status`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        status: data.status,
        chefResponse: data.chefResponse ?? "",
      }),
    });
    await invalidateApiCache("/chef/custom-requests", buildUserScopedApiCache("chef-custom-requests", 45 * 1000, user.id));
    await fetchChefCustomRequests();
  }, [fetchChefCustomRequests, token, user?.id, user?.type]);

  const updateChefOrderStatus = useCallback(async (orderId: string, status: ReceivedOrder["status"]) => {
    if (!token || user?.type !== "chef") throw new Error("Non connectée");
    await apiFetch(`/chef/orders/${orderId}/status`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status }),
    });
    await Promise.all([
      invalidateApiCache("/chef/orders", buildUserScopedApiCache("chef-orders", 45 * 1000, user.id)),
      invalidateApiCache(`/chef/${user.id}/stats`, buildUserScopedApiCache(`chef-stats:${user.id}`, 60 * 1000, user.id)),
    ]);
    await Promise.all([fetchChefOrders(), fetchChefStats(user.id)]);
  }, [fetchChefOrders, fetchChefStats, token, user?.id, user?.type]);

  const requestDeliveryForOrder = useCallback(async (orderId: string) => {
    if (!token || user?.type !== "chef") throw new Error("Non connectée");
    await apiFetch(`/delivery/orders/${orderId}/broadcast`, {
      method: "POST",
      token,
    });
    await Promise.all([
      invalidateApiCache("/chef/orders", buildUserScopedApiCache("chef-orders", 45 * 1000, user.id)),
      invalidateApiCache(`/chef/${user.id}/stats`, buildUserScopedApiCache(`chef-stats:${user.id}`, 60 * 1000, user.id)),
    ]);
    await Promise.all([fetchChefOrders(), fetchChefStats(user.id)]);
  }, [fetchChefOrders, fetchChefStats, token, user?.id, user?.type]);

  const cancelDeliverySearchForOrder = useCallback(async (deliveryJobId: string) => {
    if (!token || user?.type !== "chef") throw new Error("Non connectée");
    await apiFetch(`/delivery/jobs/${deliveryJobId}/cancel-search`, {
      method: "POST",
      token,
    });
    await Promise.all([
      invalidateApiCache("/chef/orders", buildUserScopedApiCache("chef-orders", 45 * 1000, user.id)),
      invalidateApiCache(`/chef/${user.id}/stats`, buildUserScopedApiCache(`chef-stats:${user.id}`, 60 * 1000, user.id)),
    ]);
    await Promise.all([fetchChefOrders(), fetchChefStats(user.id)]);
  }, [fetchChefOrders, fetchChefStats, token, user?.id, user?.type]);

  const fetchNotifications = useCallback(async (options?: { silent?: boolean }) => {
    if (!token || !user?.id) return;
    try {
      if (!options?.silent) {
        setIsLoadingNotifications(true);
      }
      const data = await apiFetch<{ notifications: any[] }>("/chef/notifications/list", {
        token,
      });
      setNotifications(data.notifications.map((n: any) => ({
        id: String(n.id),
        type: n.type,
        title: n.title,
        message: n.message,
        orderId: n.orderId ? String(n.orderId) : null,
        deliveryJobId: n.deliveryJobId ? String(n.deliveryJobId) : null,
        isRead: n.isRead,
        timestamp: n.timestamp,
      })));
    } catch (error) {
      console.warn("Failed to load notifications:", error);
    } finally {
      if (!options?.silent) {
        setIsLoadingNotifications(false);
      }
    }
  }, [token, user?.id]);

  useEffect(() => {
    if (!token || !user?.id) {
      return;
    }

    void fetchNotifications({ silent: true });
    const interval = setInterval(() => {
      void fetchNotifications({ silent: true });
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchNotifications, token, user?.id]);

  const value = useMemo(
    () => ({
      chefs,
      stories,
      orders,
      customRequests,
      chefOrders,
      chefCustomRequests,
      chats,
      notifications,
      chefStats,
      chefDishes,
      favorites,
      isLoadingChefs,
      isLoadingChefOrders,
      isLoadingNotifications,
      user,
      token,
      isLoadingAuth,
      login,
      loginWithPasskey,
      logout,
      registerClient,
      registerChef,
      registerCourier,
      registerPasskey,
      listPasskeys,
      deletePasskey,
      updateCourierVerificationDossier,
      postStory,
      addOrder,
      createOrder,
      createCustomRequest,
      toggleFavorite,
      sendMessage,
      getChef,
      updateCurrentUser,
      refreshChefs,
      refreshStories,
      likeStory,
      addStoryComment,
      deleteStoryComment,
      fetchChefStats,
      fetchChefDishes,
      updateChefDish,
      deleteChefDish,
      fetchChefOrders,
      fetchCustomRequests,
      fetchChefCustomRequests,
      updateChefCustomRequestStatus,
      updateChefOrderStatus,
      requestDeliveryForOrder,
      cancelDeliverySearchForOrder,
      fetchNotifications,
      refreshOrders,
    }),
    [chefs, stories, orders, customRequests, chefOrders, chefCustomRequests, chats, notifications, chefStats, chefDishes, favorites, isLoadingChefs, isLoadingChefOrders, isLoadingNotifications, user, token, isLoadingAuth, login, loginWithPasskey, logout, registerClient, registerChef, registerCourier, registerPasskey, listPasskeys, deletePasskey, updateCourierVerificationDossier, postStory, addOrder, createOrder, createCustomRequest, toggleFavorite, sendMessage, getChef, updateCurrentUser, refreshChefs, refreshStories, likeStory, addStoryComment, deleteStoryComment, fetchChefStats, fetchChefDishes, updateChefDish, deleteChefDish, fetchChefOrders, fetchCustomRequests, fetchChefCustomRequests, updateChefCustomRequestStatus, updateChefOrderStatus, requestDeliveryForOrder, cancelDeliverySearchForOrder, fetchNotifications, refreshOrders]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
