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
  type: "client" | "chef";
  location: string;
  coverColor: string;
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
}

interface AppContextValue {
  chefs: Chef[];
  stories: Story[];
  orders: Order[];
  chats: Chat[];
  favorites: string[];
  isLoadingChefs: boolean;
  user: AuthUser | null;
  token: string | null;
  isLoadingAuth: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  registerClient: (data: RegisterClientData) => Promise<void>;
  registerChef: (data: RegisterChefData) => Promise<void>;
  addOrder: (order: Order) => void;
  toggleFavorite: (chefId: string) => void;
  sendMessage: (chatId: string, chefId: string, text: string, chefName: string, chefSpecialty: string, coverColor: string) => void;
  getChef: (id: string) => Chef | undefined;
  refreshChefs: () => Promise<void>;
  refreshStories: () => Promise<void>;
  postStory: (data: { caption: string; dishName?: string; price?: number; emoji?: string; bgColor?: string }) => Promise<void>;
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

const AppContext = createContext<AppContextValue | null>(null);

const MOCK_CHATS: Chat[] = [
  {
    id: "chat-1",
    chefId: "1",
    chefName: "Ama Coulibaly",
    chefSpecialty: "Cuisine Ivoirienne",
    coverColor: "#C4522A",
    lastMessage: "Votre commande est prête !",
    lastMessageTime: "14:32",
    unread: 1,
    messages: [
      { id: "m1", text: "Bonjour, j'aimerais commander l'attiéké poisson pour 2 personnes", isMe: true, timestamp: "14:20" },
      { id: "m2", text: "Bonjour ! Avec plaisir. Je peux le préparer dans 30 minutes. Vous préférez le poisson braisé ou frit ?", isMe: false, timestamp: "14:22" },
      { id: "m3", text: "Braisé s'il vous plaît", isMe: true, timestamp: "14:23" },
      { id: "m4", text: "Votre commande est prête !", isMe: false, timestamp: "14:32" },
    ],
  },
];

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
    stories: c.stories ?? [],
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [chats, setChats] = useState<Chat[]>(MOCK_CHATS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoadingChefs, setIsLoadingChefs] = useState(true);
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
      const data = await apiFetch<{ stories: Story[] }>("/stories");
      setStories(data.stories);
    } catch (e) {
      console.warn("Failed to load stories:", e);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("nixyah_favorites").then((v) => {
      if (v) setFavorites(JSON.parse(v));
    });
    AsyncStorage.getItem("nixyah_orders").then((v) => {
      if (v) setOrders(JSON.parse(v));
    });

    AsyncStorage.getItem("nixyah_token").then(async (savedToken) => {
      if (savedToken) {
        try {
          const me = await apiFetch<AuthUser>("/auth/me", { token: savedToken });
          setUser(me);
          setToken(savedToken);
        } catch {
          await AsyncStorage.removeItem("nixyah_token");
        }
      }
      setIsLoadingAuth(false);
    });

    refreshChefs();
    refreshStories();
  }, [refreshChefs, refreshStories]);

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
    const res = await apiFetch<{ token: string; user: AuthUser }>("/auth/register/client", {
      method: "POST",
      body: JSON.stringify(data),
    });
    await AsyncStorage.setItem("nixyah_token", res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const registerChef = useCallback(async (data: RegisterChefData) => {
    const res = await apiFetch<{ token: string; user: AuthUser }>("/auth/register/chef", {
      method: "POST",
      body: JSON.stringify(data),
    });
    await AsyncStorage.setItem("nixyah_token", res.token);
    setToken(res.token);
    setUser(res.user);
    await refreshChefs();
  }, [refreshChefs]);

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

  const value = useMemo(
    () => ({
      chefs,
      stories,
      orders,
      chats,
      favorites,
      isLoadingChefs,
      user,
      token,
      isLoadingAuth,
      login,
      logout,
      registerClient,
      registerChef,
      postStory,
      addOrder,
      toggleFavorite,
      sendMessage,
      getChef,
      refreshChefs,
      refreshStories,
    }),
    [chefs, stories, orders, chats, favorites, isLoadingChefs, user, token, isLoadingAuth, login, logout, registerClient, registerChef, postStory, addOrder, toggleFavorite, sendMessage, getChef, refreshChefs, refreshStories]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
