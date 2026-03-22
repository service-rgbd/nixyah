import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Gradient from "@/components/SafeGradient";
import { ApiError, apiFetch } from "@/constants/api";
import Colors from "@/constants/colors";
import {
  formatCommerceEta,
  resolveCommerceVisual,
  type CommerceApiProduct,
  type CommerceApiStore,
  type CommerceCartResponse,
  type CommerceCatalogResponse,
} from "@/constants/commerce-catalog";
import { useApp } from "@/contexts/AppContext";

type StoreTab = "establishment" | "categories" | "promos";

function getCategoryIcon(category: string): React.ComponentProps<typeof Ionicons>["name"] {
  const normalized = category.toLowerCase();

  if (normalized.includes("fruit") || normalized.includes("legume")) return "leaf-outline";
  if (normalized.includes("boisson")) return "wine-outline";
  if (normalized.includes("lait") || normalized.includes("oeuf")) return "nutrition-outline";
  if (normalized.includes("boucher") || normalized.includes("poisson") || normalized.includes("traiteur")) return "restaurant-outline";
  if (normalized.includes("snack") || normalized.includes("petit-dejeuner")) return "cafe-outline";
  if (normalized.includes("huile") || normalized.includes("epice") || normalized.includes("sauce") || normalized.includes("epicerie")) return "basket-outline";
  if (normalized.includes("surgele") || normalized.includes("glace")) return "snow-outline";
  if (normalized.includes("bebe")) return "happy-outline";
  if (normalized.includes("hygiene") || normalized.includes("soin")) return "sparkles-outline";
  if (normalized.includes("maison")) return "home-outline";
  if (normalized.includes("cadeau")) return "gift-outline";
  if (normalized.includes("prive")) return "shield-checkmark-outline";
  return "grid-outline";
}

function getSavingsAmount(product: CommerceApiProduct) {
  if (!product.originalPrice || product.originalPrice <= product.price) {
    return 0;
  }

  return Math.round(product.originalPrice - product.price);
}

function getSearchableText(product: CommerceApiProduct) {
  return `${product.name} ${product.description} ${product.category} ${product.unitLabel}`.toLowerCase();
}

export default function CommerceStoreScreen() {
  const insets = useSafeAreaInsets();
  const { storeId, universe } = useLocalSearchParams<{ storeId: string; universe?: string }>();
  const resolvedUniverse = universe === "courses" || universe === "supermarkets" || universe === "boutiques" ? universe : "supermarkets";
  const { token, user } = useApp();
  const [store, setStore] = useState<CommerceApiStore | null>(null);
  const [products, setProducts] = useState<CommerceApiProduct[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StoreTab>("establishment");
  const [cartCount, setCartCount] = useState(0);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStore = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<CommerceCatalogResponse>(`/commerce/catalog?universe=${resolvedUniverse}`);
      const nextStore = (response.stores ?? []).find((item) => item.id === storeId) ?? null;
      setStore(nextStore);
      setProducts((response.products ?? []).filter((item) => item.storeId === storeId));
    } catch (error) {
      console.warn("Failed to load commerce store", error);
      Alert.alert("Erreur", "Impossible de charger cette enseigne pour le moment.");
    } finally {
      setLoading(false);
    }
  }, [resolvedUniverse, storeId]);

  const loadCart = useCallback(async () => {
    if (!token || user?.type !== "client") {
      setCartCount(0);
      return;
    }

    try {
      const response = await apiFetch<CommerceCartResponse>("/commerce/cart", { token });
      setCartCount(Number(response.cart?.itemCount ?? 0));
    } catch {
      setCartCount(0);
    }
  }, [token, user?.type]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  const searchedProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) => getSearchableText(product).includes(normalizedQuery));
  }, [products, query]);

  const categoryCards = useMemo(() => {
    const counts = new Map<string, { count: number; visualKey: string | null }>();
    for (const product of products) {
      const current = counts.get(product.category);
      counts.set(product.category, {
        count: (current?.count ?? 0) + 1,
        visualKey: current?.visualKey ?? product.visualKey,
      });
    }

    return Array.from(counts.entries()).map(([category, meta]) => ({
      category,
      count: meta.count,
      visualKey: meta.visualKey,
    }));
  }, [products]);

  const visibleProducts = useMemo(() => {
    return searchedProducts.filter((product) => selectedCategory === null || product.category === selectedCategory);
  }, [searchedProducts, selectedCategory]);

  const groupedProducts = useMemo(() => {
    const sections = new Map<string, CommerceApiProduct[]>();
    for (const product of visibleProducts) {
      const current = sections.get(product.category) ?? [];
      current.push(product);
      sections.set(product.category, current);
    }

    return Array.from(sections.entries()).map(([category, items]) => ({ category, items }));
  }, [visibleProducts]);

  const promoProducts = useMemo(() => {
    return searchedProducts.filter((product) => Boolean(product.badge) || Boolean(product.originalPrice));
  }, [searchedProducts]);

  const handleAddToCart = async (product: CommerceApiProduct) => {
    if (!token || user?.type !== "client") {
      Alert.alert("Connexion requise", "Connectez-vous avec un compte client pour ajouter ce produit au panier.", [
        { text: "Plus tard", style: "cancel" },
        { text: "Se connecter", onPress: () => router.push("/auth/login") },
      ]);
      return;
    }

    setActiveProductId(product.id);
    try {
      const response = await apiFetch<CommerceCartResponse>("/commerce/cart/items", {
        method: "POST",
        token,
        body: JSON.stringify({ productId: Number(product.id), quantity: 1 }),
      });
      setCartCount(Number(response.cart?.itemCount ?? 0));
    } catch (error) {
      if (error instanceof ApiError && error.code === "MultiStoreCartNotAllowed") {
        Alert.alert("Panier mono-enseigne", "Terminez ou videz le panier actuel avant de commander dans une autre enseigne.");
      } else {
        Alert.alert("Erreur", "Impossible d'ajouter ce produit au panier pour le moment.");
      }
    } finally {
      setActiveProductId(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={18} color={Colors.light.text} />
          </Pressable>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerEyebrow}>{resolvedUniverse === "supermarkets" ? "Supermarche" : resolvedUniverse === "boutiques" ? "Boutique" : "Commerce"}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{store?.name ?? "Enseigne"}</Text>
          </View>
          <Pressable style={styles.headerButton} onPress={() => router.push({ pathname: "/client/commerce-cart", params: { universe: resolvedUniverse } })}>
            <Ionicons name="bag-handle-outline" size={18} color={Colors.light.text} />
            {cartCount > 0 ? <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View> : null}
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.light.tint} />
            <Text style={styles.loadingText}>Chargement de l'enseigne...</Text>
          </View>
        ) : null}

        {!loading && store ? (
          <>
            <Gradient colors={[`${store.accentColor}18`, Colors.light.backgroundSecondary, Colors.light.card]} style={styles.heroCard}>
              <Image source={resolveCommerceVisual(store.visualKey, store.universe)} style={styles.heroImage} />
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{promoProducts.length > 0 ? `Promo sur ${promoProducts.length} produit(s)` : store.tagline}</Text>
              </View>
              <View style={styles.heroBody}>
                <Text style={styles.heroTitle}>{store.name}</Text>
                <Text style={styles.heroDescription}>{store.description}</Text>
                <View style={styles.heroStatsRow}>
                  <View style={styles.heroStatCard}>
                    <Ionicons name="albums-outline" size={18} color={Colors.light.tint} />
                    <Text style={styles.heroStatValue}>{categoryCards.length}</Text>
                    <Text style={styles.heroStatLabel}>Catégories</Text>
                  </View>
                  <View style={styles.heroStatCard}>
                    <Ionicons name="time-outline" size={18} color={Colors.light.tint} />
                    <Text style={styles.heroStatValue}>{formatCommerceEta(store.etaMinMinutes, store.etaMaxMinutes)}</Text>
                    <Text style={styles.heroStatLabel}>Livraison</Text>
                  </View>
                  <View style={styles.heroStatCard}>
                    <Ionicons name="pricetag-outline" size={18} color={Colors.light.tint} />
                    <Text style={styles.heroStatValue}>{promoProducts.length}</Text>
                    <Text style={styles.heroStatLabel}>Promos</Text>
                  </View>
                </View>
              </View>
            </Gradient>

            <View style={styles.searchBox}>
              <Feather name="search" size={16} color={Colors.light.textTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Rechercher un produit ou un rayon"
                placeholderTextColor={Colors.light.textTertiary}
                style={styles.searchInput}
                autoCorrect={false}
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} hitSlop={8}>
                  <Feather name="x" size={16} color={Colors.light.textTertiary} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.tabRow}>
              {[
                { key: "establishment", label: "Etablissement" },
                { key: "categories", label: "Categories" },
                { key: "promos", label: "Promos" },
              ].map((tab) => {
                const selected = activeTab === tab.key;
                return (
                  <Pressable key={tab.key} style={[styles.tabButton, selected && styles.tabButtonActive]} onPress={() => setActiveTab(tab.key as StoreTab)}>
                    <Text style={[styles.tabButtonText, selected && styles.tabButtonTextActive]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {activeTab !== "promos" ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Parcourir les catégories</Text>
                  <Text style={styles.sectionMeta}>{categoryCards.length} rayons</Text>
                </View>
                <View style={styles.categoriesGrid}>
                  {categoryCards.map((item) => {
                    const selected = item.category === selectedCategory;
                    return (
                      <Pressable
                        key={item.category}
                        style={[styles.categoryCard, selected && styles.categoryCardActive]}
                        onPress={() => {
                          setSelectedCategory(selected ? null : item.category);
                          setActiveTab("categories");
                        }}
                      >
                        <View style={[styles.categoryIconWrap, selected && styles.categoryIconWrapActive]}>
                          <Ionicons name={getCategoryIcon(item.category)} size={20} color={selected ? "#fff" : Colors.light.tint} />
                        </View>
                        <Image source={resolveCommerceVisual(item.visualKey, store.universe)} style={styles.categoryThumb} />
                        <Text style={[styles.categoryCardTitle, selected && styles.categoryCardTitleActive]} numberOfLines={2}>{item.category}</Text>
                        <Text style={[styles.categoryCardMeta, selected && styles.categoryCardMetaActive]}>{item.count} produit(s)</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {promoProducts.length > 0 ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Promotions</Text>
                  <Pressable onPress={() => setActiveTab("promos")}>
                    <Text style={styles.sectionLink}>Voir tout</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promoRow}>
                  {promoProducts.map((product) => {
                    const savings = getSavingsAmount(product);
                    return (
                      <View key={product.id} style={styles.promoCard}>
                        <Image source={resolveCommerceVisual(product.visualKey, store.universe)} style={styles.promoImage} />
                        <Pressable style={styles.promoAddButton} onPress={() => void handleAddToCart(product)} disabled={activeProductId === product.id || !product.inStock}>
                          {activeProductId === product.id ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="plus" size={18} color="#fff" />}
                        </Pressable>
                        <Text style={styles.promoName} numberOfLines={2}>{product.name}</Text>
                        <Text style={styles.promoUnit}>{product.unitLabel}</Text>
                        <View style={styles.promoPriceRow}>
                          <Text style={styles.promoPrice}>{Math.round(product.price).toLocaleString("fr-FR")} FCFA</Text>
                          {product.originalPrice ? <Text style={styles.promoOldPrice}>{Math.round(product.originalPrice).toLocaleString("fr-FR")} FCFA</Text> : null}
                        </View>
                        {savings > 0 ? <View style={styles.savingsPill}><Text style={styles.savingsPillText}>-{savings.toLocaleString("fr-FR")} FCFA</Text></View> : null}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {(activeTab === "establishment" || activeTab === "categories") ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{selectedCategory ? selectedCategory : "Tous les rayons"}</Text>
                  <Text style={styles.sectionMeta}>{visibleProducts.length} produit(s)</Text>
                </View>
                <View style={styles.sectionStack}>
                  {groupedProducts.map((section) => (
                    <View key={section.category} style={styles.categorySectionCard}>
                      <View style={styles.categorySectionHeader}>
                        <View>
                          <Text style={styles.categorySectionTitle}>{section.category}</Text>
                          <Text style={styles.categorySectionMeta}>{section.items.length} produit(s) disponibles</Text>
                        </View>
                        {selectedCategory !== section.category ? (
                          <Pressable onPress={() => setSelectedCategory(section.category)}>
                            <Text style={styles.sectionLink}>Filtrer</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRail}>
                        {section.items.map((product) => (
                          <View key={product.id} style={styles.productRailCard}>
                            <Image source={resolveCommerceVisual(product.visualKey, store.universe)} style={styles.productRailImage} />
                            <Text style={styles.productRailName} numberOfLines={2}>{product.name}</Text>
                            <Text style={styles.productRailMeta}>{product.unitLabel}</Text>
                            <Text style={styles.productRailPrice}>{Math.round(product.price).toLocaleString("fr-FR")} FCFA</Text>
                            <Pressable style={styles.productRailButton} onPress={() => void handleAddToCart(product)} disabled={activeProductId === product.id || !product.inStock}>
                              {activeProductId === product.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.productRailButtonText}>Ajouter</Text>}
                            </Pressable>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {activeTab === "promos" ? (
              <View style={styles.sectionStack}>
                {promoProducts.map((product) => {
                  const savings = getSavingsAmount(product);
                  return (
                    <View key={product.id} style={styles.productListCard}>
                      <Image source={resolveCommerceVisual(product.visualKey, store.universe)} style={styles.productListImage} />
                      <View style={styles.productListBody}>
                        <View style={styles.productListTopRow}>
                          <Text style={styles.productListName} numberOfLines={2}>{product.name}</Text>
                          {product.badge ? <Text style={styles.productBadge}>{product.badge}</Text> : null}
                        </View>
                        <Text style={styles.productListMeta}>{product.category} · {product.unitLabel}</Text>
                        <Text style={styles.productListDescription} numberOfLines={2}>{product.description}</Text>
                        <View style={styles.productListBottomRow}>
                          <View>
                            <Text style={styles.productListPrice}>{Math.round(product.price).toLocaleString("fr-FR")} FCFA</Text>
                            {product.originalPrice ? <Text style={styles.productListOldPrice}>{Math.round(product.originalPrice).toLocaleString("fr-FR")} FCFA</Text> : null}
                          </View>
                          <View style={styles.productListActionWrap}>
                            {savings > 0 ? <View style={styles.savingsPill}><Text style={styles.savingsPillText}>-{savings.toLocaleString("fr-FR")} FCFA</Text></View> : null}
                            <Pressable style={styles.productListButton} onPress={() => void handleAddToCart(product)} disabled={activeProductId === product.id || !product.inStock}>
                              {activeProductId === product.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.productListButtonText}>Ajouter</Text>}
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: 20, paddingBottom: 56, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder },
  headerTextBlock: { flex: 1 },
  headerEyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
  headerTitle: { marginTop: 4, fontSize: 22, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  cartBadge: { position: "absolute", top: 6, right: 5, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, backgroundColor: Colors.light.tint },
  cartBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Poppins_700Bold" },
  loadingCard: { alignItems: "center", justifyContent: "center", paddingVertical: 28, borderRadius: 24, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, gap: 10 },
  loadingText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  heroCard: { borderRadius: 30, overflow: "hidden", borderWidth: 1, borderColor: Colors.light.cardBorder },
  heroImage: { width: "100%", height: 190 },
  heroBadge: { position: "absolute", top: 14, left: 14, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(255,250,245,0.94)", borderWidth: 1, borderColor: Colors.light.cardBorder },
  heroBadgeText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  heroBody: { padding: 18, gap: 10 },
  heroTitle: { fontSize: 26, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  heroDescription: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  heroStatsRow: { flexDirection: "row", gap: 10 },
  heroStatCard: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 18, paddingVertical: 12, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder },
  heroStatValue: { fontSize: 13, fontFamily: "Poppins_700Bold", color: Colors.light.text, textAlign: "center" },
  heroStatLabel: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary, textAlign: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.light.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: Colors.light.cardBorder },
  searchInput: { flex: 1, padding: 0, fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.text },
  tabRow: { flexDirection: "row", gap: 10 },
  tabButton: { flex: 1, minHeight: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.cardBorder },
  tabButtonActive: { backgroundColor: Colors.light.tint },
  tabButtonText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.textSecondary },
  tabButtonTextActive: { color: "#fff" },
  sectionBlock: { gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  sectionMeta: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  sectionLink: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  categoriesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  categoryCard: { width: "47%", borderRadius: 22, padding: 12, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder },
  categoryCardActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  categoryIconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.backgroundSecondary },
  categoryIconWrapActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  categoryThumb: { width: "100%", height: 78, borderRadius: 16, marginTop: 12 },
  categoryCardTitle: { marginTop: 10, fontSize: 14, lineHeight: 19, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  categoryCardTitleActive: { color: "#fff" },
  categoryCardMeta: { marginTop: 4, fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  categoryCardMetaActive: { color: "rgba(255,255,255,0.82)" },
  promoRow: { gap: 12, paddingRight: 20 },
  promoCard: { width: 172, borderRadius: 24, padding: 12, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder },
  promoImage: { width: "100%", height: 120, borderRadius: 18 },
  promoAddButton: { position: "absolute", right: 20, top: 100, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.tint, borderWidth: 2, borderColor: Colors.light.card },
  promoName: { marginTop: 12, fontSize: 15, lineHeight: 20, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  promoUnit: { marginTop: 4, fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  promoPriceRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  promoPrice: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  promoOldPrice: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, textDecorationLine: "line-through" },
  savingsPill: { alignSelf: "flex-start", marginTop: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.light.accent },
  savingsPillText: { fontSize: 11, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  sectionStack: { gap: 14 },
  categorySectionCard: { borderRadius: 24, padding: 14, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, gap: 12 },
  categorySectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  categorySectionTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  categorySectionMeta: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  productRail: { gap: 12, paddingRight: 20 },
  productRailCard: { width: 158 },
  productRailImage: { width: "100%", height: 112, borderRadius: 18 },
  productRailName: { marginTop: 10, fontSize: 14, lineHeight: 19, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  productRailMeta: { marginTop: 4, fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  productRailPrice: { marginTop: 6, fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  productRailButton: { marginTop: 10, minHeight: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.tint },
  productRailButtonText: { color: "#fff", fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  productListCard: { flexDirection: "row", gap: 12, backgroundColor: Colors.light.card, borderRadius: 22, padding: 12, borderWidth: 1, borderColor: Colors.light.cardBorder },
  productListImage: { width: 96, height: 96, borderRadius: 16 },
  productListBody: { flex: 1, gap: 4 },
  productListTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  productListName: { flex: 1, fontSize: 15, lineHeight: 20, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  productBadge: { fontSize: 11, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  productListMeta: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  productListDescription: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  productListBottomRow: { marginTop: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  productListPrice: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  productListOldPrice: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, textDecorationLine: "line-through" },
  productListActionWrap: { alignItems: "flex-end" },
  productListButton: { marginTop: 8, minWidth: 88, minHeight: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.tint, paddingHorizontal: 12 },
  productListButtonText: { color: "#fff", fontSize: 12, fontFamily: "Poppins_600SemiBold" },
});