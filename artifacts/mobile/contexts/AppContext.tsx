import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface Chef {
  id: string;
  name: string;
  specialty: string;
  location: string;
  rating: number;
  reviewCount: number;
  priceRange: string;
  isVerified: boolean;
  isOnline: boolean;
  coverColor: string;
  bio: string;
  dishes: Dish[];
  responseTime: string;
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

export interface FavoriteChef {
  id: string;
  name: string;
  specialty: string;
  location: string;
  rating: number;
  coverColor: string;
}

interface AppContextValue {
  chefs: Chef[];
  orders: Order[];
  chats: Chat[];
  favorites: string[];
  hasOnboarded: boolean;
  setHasOnboarded: (v: boolean) => void;
  addOrder: (order: Order) => void;
  toggleFavorite: (chefId: string) => void;
  sendMessage: (chatId: string, chefId: string, text: string, chefName: string, chefSpecialty: string, coverColor: string) => void;
  getChef: (id: string) => Chef | undefined;
}

const AppContext = createContext<AppContextValue | null>(null);

const MOCK_CHEFS: Chef[] = [
  {
    id: "1",
    name: "Ama Coulibaly",
    specialty: "Cuisine Ivoirienne",
    location: "Cocody, Abidjan",
    rating: 4.9,
    reviewCount: 124,
    priceRange: "2 000 – 8 000 FCFA",
    isVerified: true,
    isOnline: true,
    coverColor: "#C4522A",
    bio: "Passionnée de cuisine ivoirienne depuis 15 ans. Je cuisine le vrai attiéké poulet braisé, le kedjenou et le garba de manière artisanale, comme à Grand-Bassam.",
    responseTime: "< 10 min",
    dishes: [
      { id: "d1", name: "Attiéké Poisson Braisé", description: "Attiéké maison avec poisson braisé, sauce tomate pimentée", price: 3500, category: "Plats Principaux", prepTime: "30 min", isPopular: true },
      { id: "d2", name: "Kedjenou de Poulet", description: "Poulet fermier mijoté aux épices, tomate et aubergine", price: 5000, category: "Plats Principaux", prepTime: "1h", isPopular: true },
      { id: "d3", name: "Garba Complet", description: "Attiéké avec thon, vinaigrette piment", price: 2000, category: "Plats Principaux", prepTime: "20 min" },
      { id: "d4", name: "Riz Sauce Graine", description: "Riz blanc avec sauce graine de palme, viande et légumes", price: 4500, category: "Plats Principaux", prepTime: "45 min" },
      { id: "d5", name: "Foutou Banane + Soupe Kplé", description: "Foutou artisanal avec soupe kplé au poisson fumé", price: 4000, category: "Plats Principaux", prepTime: "50 min" },
    ],
  },
  {
    id: "2",
    name: "Fatou Diallo",
    specialty: "Cuisine Dioula & Grillades",
    location: "Yopougon, Abidjan",
    rating: 4.7,
    reviewCount: 89,
    priceRange: "1 500 – 6 000 FCFA",
    isVerified: true,
    isOnline: false,
    coverColor: "#8B5CF6",
    bio: "Cuisinière Dioula depuis Bouaké. Mes brochettes et mon riz sauce arachide sont réputés dans tout Yop City. Livraison possible.",
    responseTime: "< 20 min",
    dishes: [
      { id: "d6", name: "Brochettes Bœuf Grillées", description: "Brochettes marinées aux épices africaines, sauce piment", price: 3000, category: "Grillades", prepTime: "25 min", isPopular: true },
      { id: "d7", name: "Riz Sauce Arachide", description: "Riz avec sauce arachide crémeuse, poulet, légumes", price: 4000, category: "Plats Principaux", prepTime: "40 min", isPopular: true },
      { id: "d8", name: "Foutou Igname + Sauce Pistache", description: "Igname pilée avec sauce pistache et viande", price: 4500, category: "Plats Principaux", prepTime: "55 min" },
      { id: "d9", name: "Thiéboudienne", description: "Riz au poisson sénégalais avec légumes variés", price: 5500, category: "Plats Principaux", prepTime: "1h15" },
    ],
  },
  {
    id: "3",
    name: "Marie-Claire Bah",
    specialty: "Traiteur & Événements",
    location: "Marcory, Abidjan",
    rating: 5.0,
    reviewCount: 67,
    priceRange: "3 000 – 15 000 FCFA",
    isVerified: true,
    isOnline: true,
    coverColor: "#059669",
    bio: "Traiteur certifiée, je prends en charge vos anniversaires, baptêmes, mariages. De 10 à 200 personnes. Cuisines fusion afro-européenne.",
    responseTime: "< 5 min",
    dishes: [
      { id: "d10", name: "Menu Baptême (10 pers)", description: "Plats variés ivoiriens + desserts pour 10 personnes", price: 45000, category: "Événements", prepTime: "Sur commande", isPopular: true },
      { id: "d11", name: "Poulet Yassa", description: "Poulet mariné au citron et oignon, riz basmati", price: 6000, category: "Plats Principaux", prepTime: "50 min" },
      { id: "d12", name: "Grillades Mixtes", description: "Poulet, poisson, brochettes bœuf avec garnitures", price: 8000, category: "Grillades", prepTime: "1h" },
      { id: "d13", name: "Buffet Dînatoire", description: "Buffet complet ivoirien-africain pour 20 personnes", price: 75000, category: "Événements", prepTime: "Sur commande" },
    ],
  },
  {
    id: "4",
    name: "Adjoa Mensah",
    specialty: "Snacks & Street Food",
    location: "Plateau, Abidjan",
    rating: 4.8,
    reviewCount: 203,
    priceRange: "500 – 3 000 FCFA",
    isVerified: false,
    isOnline: true,
    coverColor: "#D97706",
    bio: "Spécialiste du street food abidjanais. Alloco, makayabu, kédjénou express. Livraison rapide dans la Commune du Plateau.",
    responseTime: "< 15 min",
    dishes: [
      { id: "d14", name: "Alloco + Œuf", description: "Banane plantain frite avec œuf brouillé et piment", price: 1000, category: "Snacks", prepTime: "10 min", isPopular: true },
      { id: "d15", name: "Makayabu Sauce Tomate", description: "Morue salée avec tomate, oignon, piment fort", price: 2500, category: "Plats Principaux", prepTime: "20 min", isPopular: true },
      { id: "d16", name: "Sandwich Poulet Braisé", description: "Pain baguette, poulet braisé, mayo maison", price: 1500, category: "Snacks", prepTime: "15 min" },
      { id: "d17", name: "Jus de Gingembre Maison", description: "Gingembre frais, citron, miel de fleurs", price: 800, category: "Boissons", prepTime: "5 min" },
    ],
  },
  {
    id: "5",
    name: "Ramatou Koné",
    specialty: "Cuisine du Nord & Divers",
    location: "Abobo, Abidjan",
    rating: 4.6,
    reviewCount: 56,
    priceRange: "2 500 – 7 000 FCFA",
    isVerified: true,
    isOnline: false,
    coverColor: "#DC2626",
    bio: "Originaire de Korhogo, je prépare les plats du nord avec authenticité. Tô, sauce gombo, couscous de mil. Une cuisine rare à Abidjan.",
    responseTime: "< 30 min",
    dishes: [
      { id: "d18", name: "Tô + Sauce Gombo", description: "Pâte de maïs avec sauce okra et viande de bœuf", price: 3000, category: "Plats Principaux", prepTime: "45 min", isPopular: true },
      { id: "d19", name: "Couscous de Mil", description: "Couscous artisanal avec ragoût d'agneau et légumes", price: 5000, category: "Plats Principaux", prepTime: "1h" },
      { id: "d20", name: "Soupe de Poisson Fumé", description: "Bouillon parfumé avec poisson fumé et légumes du terroir", price: 2500, category: "Soupes", prepTime: "30 min" },
    ],
  },
  {
    id: "6",
    name: "Sophie Gnagnon",
    specialty: "Pâtisserie & Desserts Africains",
    location: "Deux Plateaux, Abidjan",
    rating: 4.9,
    reviewCount: 145,
    priceRange: "1 000 – 5 000 FCFA",
    isVerified: true,
    isOnline: true,
    coverColor: "#BE185D",
    bio: "Pâtissière ivoirienne formée en France. Je marie les saveurs africaines avec les techniques européennes. Gâteaux, beignets, desserts fusion.",
    responseTime: "< 10 min",
    dishes: [
      { id: "d21", name: "Beignets de Banane", description: "Beignets moelleux à la banane plantain, sucre glace", price: 1500, category: "Desserts", prepTime: "20 min", isPopular: true },
      { id: "d22", name: "Gâteau Noix de Coco", description: "Layer cake coco-vanille avec crème fraîche maison", price: 4500, category: "Pâtisserie", prepTime: "Sur commande" },
      { id: "d23", name: "Cake Chocolat-Café", description: "Fondant chocolat avec touche de café ivoirien", price: 3500, category: "Pâtisserie", prepTime: "1h" },
      { id: "d24", name: "Pain au Chocolat Africain", description: "Viennoiserie maison fourrée au chocolat pur cacao", price: 1000, category: "Viennoiseries", prepTime: "30 min", isPopular: true },
    ],
  },
];

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [chats, setChats] = useState<Chat[]>(MOCK_CHATS);
  const [favorites, setFavorites] = useState<string[]>(["1", "3"]);
  const [hasOnboarded, setHasOnboardedState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("nixyah_onboarded").then((v) => {
      if (v === "true") setHasOnboardedState(true);
    });
    AsyncStorage.getItem("nixyah_favorites").then((v) => {
      if (v) setFavorites(JSON.parse(v));
    });
    AsyncStorage.getItem("nixyah_orders").then((v) => {
      if (v) setOrders(JSON.parse(v));
    });
  }, []);

  const setHasOnboarded = useCallback((v: boolean) => {
    setHasOnboardedState(v);
    AsyncStorage.setItem("nixyah_onboarded", v ? "true" : "false");
  }, []);

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
    (id: string) => MOCK_CHEFS.find((c) => c.id === id),
    []
  );

  const value = useMemo(
    () => ({
      chefs: MOCK_CHEFS,
      orders,
      chats,
      favorites,
      hasOnboarded,
      setHasOnboarded,
      addOrder,
      toggleFavorite,
      sendMessage,
      getChef,
    }),
    [orders, chats, favorites, hasOnboarded, setHasOnboarded, addOrder, toggleFavorite, sendMessage, getChef]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
