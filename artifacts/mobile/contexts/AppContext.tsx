import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "@/constants/api";

export interface Chef {
  id: string;
  name: string;
  specialty: string;
  location: string;
  zone?: string;
  avatarUrl?: string | null;
  rating: number;
  reviewCount: number;
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
  category: string;
  prepTime: string;
  isPopular?: boolean;
  imageUrl?: string | null;
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
  thisMonth: {
    orders: number;
    revenue: number;
  };
  reviews: number;
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
  createdAt: string;
  expiresAt: string;
}

export interface Order {
  id: string;
  chefId: string;
  chefName: string;
  dishes: { dish: Dish; quantity: number }[];
  total: number;
  status: "pending" | "accepted" | "preparing" | "ready" | "delivered";
  createdAt: string;
  occasion?: string;
  persons?: number;
  delivery?: {
    id: string;
    status: "broadcasting" | "available" | "accepted" | "picked_up" | "on_the_way" | "delivered" | "cancelled";
    courierUserId?: string | null;
    deliveryAddress?: string;
    restaurantAddress?: string;
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
  type: "client" | "chef" | "courier";
  location: string;
  coverColor: string;
  avatarUrl?: string | null;
  chefProfile?: {
    id: string;
    specialty: string;
    location: string;
    zone: string;
    bio: string;
    rating: number;
    reviewCount: number;
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
    isAvailable: boolean;
    isVerified: boolean;
    currentLatitude?: number | null;
    currentLongitude?: number | null;
    lastLocationAt?: string | null;
  } | null;
}

interface AppContextValue {
  chefs: Chef[];
  stories: Story[];
  orders: Order[];
  chats: Chat[];
  notifications: Notification[];
  chefStats: ChefStats | null;
  chefDishes: Dish[];
  favorites: string[];
  isLoadingChefs: boolean;
  isLoadingNotifications: boolean;
  user: AuthUser | null;
  token: string | null;
  isLoadingAuth: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  registerClient: (data: RegisterClientData) => Promise<AuthRegistrationResult>;
  registerChef: (data: RegisterChefData) => Promise<AuthRegistrationResult>;
  registerCourier: (data: RegisterCourierData) => Promise<AuthRegistrationResult>;
  addOrder: (order: Order) => void;
  toggleFavorite: (chefId: string) => void;
  sendMessage: (chatId: string, chefId: string, text: string, chefName: string, chefSpecialty: string, coverColor: string) => void;
  getChef: (id: string) => Chef | undefined;
  refreshChefs: () => Promise<void>;
  refreshStories: () => Promise<void>;
  postStory: (data: { caption: string; dishName?: string; price?: number; emoji?: string; bgColor?: string; imageUrl?: string | null }) => Promise<void>;
  fetchChefStats: (chefId: string) => Promise<void>;
  fetchChefDishes: (chefId: string) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  refreshOrders: () => Promise<void>;
}

export interface RegisterClientData {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  location: string;
  preferences?: string[];
}

export interface RegisterChefData {
  name: string;
  email?: string;
  phone?: string;
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
  email?: string;
  phone?: string;
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

function mapApiChef(c: any): Chef {
  return {
    id: c.id,
    name: c.name,
    specialty: c.specialty,
    location: c.location,
    zone: c.zone,
    rating: c.rating ?? 5.0,
    reviewCount: c.reviewCount ?? 0,
    priceRange: c.priceRange ?? "",
    isVerified: c.isVerified ?? false,
    isOnline: c.isOnline ?? true,
    coverColor: c.coverColor ?? "#C4522A",
    bio: c.bio ?? "",
    responseTime: c.responseTime ?? "< 30 min",
    dishes: (c.dishes ?? []).map((d: any) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      price: d.price,
      category: d.category,
      prepTime: d.prepTime,
      isPopular: d.isPopular,
    })),
    stories: (c.stories ?? []).map((s: any) => ({
      id: String(s.id),
      chefId: String(s.chefId ?? s.chef_profile_id ?? c.id),
      chefName: s.chefName ?? s.chef_name ?? c.name,
      chefCoverColor: s.chefCoverColor ?? s.chef_cover_color ?? c.coverColor ?? "#C4522A",
      caption: s.caption,
      dishName: s.dishName ?? s.dish_name ?? null,
      price: s.price ?? null,
      emoji: s.emoji ?? null,
      bgColor: s.bgColor ?? s.bg_color ?? null,
      imageUrl: s.imageUrl ?? s.image_url ?? null,
      createdAt: s.createdAt ?? s.created_at ?? new Date().toISOString(),
      expiresAt: s.expiresAt ?? s.expires_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })),
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
            imageUrl: null,
          },
          quantity: Number(item.quantity ?? 1),
        }))
      : [],
    total: Number(order.total ?? 0),
    status: order.status,
    createdAt: String(order.createdAt ?? new Date().toISOString()),
    occasion: order.occasion ?? undefined,
    persons: order.persons ?? undefined,
    delivery: order.delivery
      ? {
          id: String(order.delivery.id),
          status: order.delivery.status,
          courierUserId: order.delivery.courierUserId ? String(order.delivery.courierUserId) : null,
          deliveryAddress: order.delivery.deliveryAddress ?? undefined,
          restaurantAddress: order.delivery.restaurantAddress ?? undefined,
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
  const [chats, setChats] = useState<Chat[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chefStats, setChefStats] = useState<ChefStats | null>(null);
  const [chefDishes, setChefDishes] = useState<Dish[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoadingChefs, setIsLoadingChefs] = useState(true);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const refreshChefs = useCallback(async () => {
    try {
      const data = await apiFetch<{ chefs: any[] }>("/chefs");
      setChefs(data.chefs.map(mapApiChef));
    } catch (e) {
      console.warn("Failed to load chefs from API:", e);
    } finally {
      setIsLoadingChefs(false);
    }
  }, []);

  const refreshStories = useCallback(async () => {
    try {
      const data = await apiFetch<{ stories: any[] }>("/stories");
      setStories((data.stories ?? []).map((s: any) => ({
        id: String(s.id),
        chefId: String(s.chefId ?? s.chef_profile_id ?? s.chef_id ?? ""),
        chefName: s.chefName ?? s.chef_name ?? s.chef_name_display ?? "",
        chefCoverColor: s.chefCoverColor ?? s.chef_cover_color ?? s.chefCoverColor ?? "#C4522A",
        caption: s.caption ?? "",
        dishName: s.dishName ?? s.dish_name ?? null,
        price: s.price ?? null,
        emoji: s.emoji ?? null,
        bgColor: s.bgColor ?? s.bg_color ?? null,
        imageUrl: s.imageUrl ?? s.image_url ?? null,
        createdAt: s.createdAt ?? s.created_at ?? new Date().toISOString(),
        expiresAt: s.expiresAt ?? s.expires_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })));
    } catch (e) {
      console.warn("Failed to load stories:", e);
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    if (!token || user?.type !== "client") {
      return;
    }
    try {
      const data = await apiFetch<{ orders: any[] }>("/orders", { token });
      setOrders((data.orders ?? []).map(mapApiOrder));
    } catch (error) {
      console.warn("Failed to load orders:", error);
    }
  }, [token, user?.type]);

  const likeStory = useCallback(async (storyId: string) => {
    try {
      await apiFetch(`/stories/${storyId}/like`, { method: "POST", token: token ?? undefined });
      // optionally refresh stories or update local state
    } catch (e) {
      console.warn("Failed to like story:", e);
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      // favorites can be kept locally regardless of auth
      try {
        const fav = await AsyncStorage.getItem("nixyah_favorites");
        if (fav) setFavorites(JSON.parse(fav));
      } catch (e) {
        console.warn("Failed to load favorites:", e);
      }

      // Check auth token and only load orders/chats for authenticated users
      try {
        const savedToken = await AsyncStorage.getItem("nixyah_token");
        if (savedToken) {
          try {
            const me = await apiFetch<AuthUser>("/auth/me", { token: savedToken });
            setUser(me);
            setToken(savedToken);

            const chatsStr = await AsyncStorage.getItem("nixyah_chats");
            if (chatsStr) setChats(JSON.parse(chatsStr));
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
    if (token && user?.type === "client") {
      refreshOrders();
    }
  }, [token, user?.type, refreshOrders]);

  const login = useCallback(async (emailOrPhone: string, password: string) => {
    const data = await apiFetch<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ emailOrPhone, password }),
    });
    await AsyncStorage.setItem("nixyah_token", data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("nixyah_token");
    setToken(null);
    setUser(null);
  }, []);

  const registerClient = useCallback(async (data: RegisterClientData) => {
    const res = await apiFetch<{ token?: string; user: AuthUser; requiresEmailConfirmation?: boolean; email?: string | null }>("/auth/register/client", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.token) {
      await AsyncStorage.setItem("nixyah_token", res.token);
      setToken(res.token);
      setUser(res.user);
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
      setUser(res.user);
      await refreshChefs();
      return { requiresEmailConfirmation: false, email: res.user.email };
    }

    await AsyncStorage.removeItem("nixyah_token");
    setToken(null);
    setUser(null);
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
      setUser(res.user);
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

  const postStory = useCallback(async (storyData: { caption: string; dishName?: string; price?: number; emoji?: string; bgColor?: string }) => {
    if (!token) throw new Error("Non connecté");
    await apiFetch("/stories", {
      method: "POST",
      body: JSON.stringify(storyData),
      token,
    });
    await refreshStories();
  }, [token, refreshStories]);

  const addOrder = useCallback((order: Order) => {
    setOrders((prev) => {
      const next = [order, ...prev];
      AsyncStorage.setItem("nixyah_orders", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((chefId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(chefId)
        ? prev.filter((id) => id !== chefId)
        : [...prev, chefId];
      AsyncStorage.setItem("nixyah_favorites", JSON.stringify(next));
      return next;
    });
  }, []);

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

  const fetchChefStats = useCallback(async (chefId: string) => {
    if (!token) return;
    try {
      setIsLoadingNotifications(true);
      const data = await apiFetch<ChefStats>(`/chef/${chefId}/stats`, { token });
      setChefStats(data);
    } catch (error) {
      console.warn("Failed to load chef stats:", error);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [token]);

  const fetchChefDishes = useCallback(async (chefId: string) => {
    try {
      const data = await apiFetch<{ dishes: any[] }>(`/chef/${chefId}/dishes`);
      setChefDishes(data.dishes.map((d: any) => ({
        id: String(d.id),
        name: d.name,
        description: d.description,
        price: d.price,
        category: d.category,
        prepTime: d.prepTime,
        isPopular: d.isPopular,
        imageUrl: d.imageUrl ?? null,
      })));
    } catch (error) {
      console.warn("Failed to load chef dishes:", error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!token || !user?.id) return;
    try {
      setIsLoadingNotifications(true);
      const data = await apiFetch<{ notifications: any[] }>("/chef/notifications/list", { token },);
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
      setIsLoadingNotifications(false);
    }
  }, [token, user?.id]);

  const value = useMemo(
    () => ({
      chefs,
      stories,
      orders,
      chats,
      notifications,
      chefStats,
      chefDishes,
      favorites,
      isLoadingChefs,
      isLoadingNotifications,
      user,
      token,
      isLoadingAuth,
      login,
      logout,
      registerClient,
      registerChef,
      registerCourier,
      postStory,
      addOrder,
      toggleFavorite,
      sendMessage,
      getChef,
      refreshChefs,
      refreshStories,
      fetchChefStats,
      fetchChefDishes,
      fetchNotifications,
      likeStory,
      refreshOrders,
    }),
    [chefs, stories, orders, chats, notifications, chefStats, chefDishes, favorites, isLoadingChefs, isLoadingNotifications, user, token, isLoadingAuth, login, logout, registerClient, registerChef, registerCourier, postStory, addOrder, toggleFavorite, sendMessage, getChef, refreshChefs, refreshStories, fetchChefStats, fetchChefDishes, fetchNotifications, refreshOrders]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
