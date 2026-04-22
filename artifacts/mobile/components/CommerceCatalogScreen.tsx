import { Feather, Ionicons } from "@expo/vector-icons";
import { type Href, router } from "expo-router";
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
  type CommerceUniverse,
} from "@/constants/commerce-catalog";
import { useApp } from "@/contexts/AppContext";

type CommerceCatalogScreenProps = {
  universe: CommerceUniverse;
  eyebrow: string;
  title: string;
  subtitle: string;
  accentColor: string;
  accentSoftColor: string;
  primaryIcon: React.ComponentProps<typeof Ionicons>["name"];
  primaryActionLabel: string;
  primaryActionHref: Href;
};

export default function CommerceCatalogScreen({
  universe,
  eyebrow,
  title,
  subtitle,
  accentColor,
  accentSoftColor,
  primaryIcon,
  primaryActionLabel,
  primaryActionHref,
}: CommerceCatalogScreenProps) {
  const insets = useSafeAreaInsets();
  const { token, user } = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [stores, setStores] = useState<CommerceApiStore[]>([]);
  const [products, setProducts] = useState<CommerceApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<CommerceCatalogResponse>(`/commerce/catalog?universe=${universe}`);
      setStores(response.stores ?? []);
      setProducts(response.products ?? []);
    } catch (error) {
      console.warn("Failed to load commerce catalog", error);
      Alert.alert("Erreur", "Impossible de charger ce catalogue pour le moment.");
    } finally {
      setLoading(false);
    }
  }, [universe]);

  const loadCart = useCallback(async () => {
    if (!token || user?.type !== "client") {
      setCartCount(0);
      return;
    }

    try {
      const response = await apiFetch<CommerceCartResponse>("/commerce/cart", { token });
      setCartCount(Number(response.cart?.itemCount ?? 0));
    } catch (error) {
      console.warn("Failed to load commerce cart", error);
    }
  }, [token, user?.type]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === null || product.category === category;
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery) ||
        product.category.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [category, products, query]);

  const handleOpenCart = () => {
    router.push({ pathname: "/client/commerce-cart", params: { universe } });
  };

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
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={18} color={Colors.light.text} />
          </Pressable>
          <View style={styles.headerTextBlock}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.screenTitle}>{title}</Text>
          </View>
          <Pressable style={styles.cartButton} onPress={handleOpenCart}>
            <Ionicons name="bag-handle" size={18} color={Colors.light.text} />
            <Text style={styles.cartButtonText}>{cartCount}</Text>
          </Pressable>
        </View>

        <Gradient colors={[accentSoftColor, Colors.light.backgroundSecondary, Colors.light.card]} style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIconWrap, { backgroundColor: `${accentColor}16` }]}> 
              <Ionicons name={primaryIcon} size={26} color={accentColor} />
            </View>
            <Pressable style={[styles.heroAction, { backgroundColor: accentColor }]} onPress={() => router.push(primaryActionHref)}>
              <Text style={styles.heroActionText}>{primaryActionLabel}</Text>
            </Pressable>
          </View>
          <Text style={styles.heroTitle}>{subtitle}</Text>
          <Text style={styles.heroMeta}>{stores.length} enseigne(s) · {products.length} produit(s) visibles</Text>
        </Gradient>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={accentColor} />
            <Text style={styles.loadingText}>Chargement du catalogue...</Text>
          </View>
        ) : null}

        {!loading ? <View style={styles.searchBox}>
          <Feather name="search" size={16} color={Colors.light.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Chercher un produit, un rayon, une envie..."
            placeholderTextColor={Colors.light.textTertiary}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x" size={16} color={Colors.light.textTertiary} />
            </Pressable>
          ) : null}
        </View> : null}

        {!loading ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          <Pressable style={[styles.categoryChip, category === null && styles.categoryChipActive]} onPress={() => setCategory(null)}>
            <Text style={[styles.categoryChipText, category === null && styles.categoryChipTextActive]}>Tout</Text>
          </Pressable>
          {categories.map((item) => {
            const selected = item === category;
            return (
              <Pressable key={item} style={[styles.categoryChip, selected && styles.categoryChipActive]} onPress={() => setCategory(item)}>
                <Text style={[styles.categoryChipText, selected && styles.categoryChipTextActive]}>{item}</Text>
              </Pressable>
            );
          })}
        </ScrollView> : null}

        {!loading ? <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderInline}>
            <Text style={styles.sectionTitle}>Enseignes</Text>
            <Text style={styles.sectionMeta}>{stores.length} disponibles</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeRow}>
            {stores.map((store) => (
              <Pressable
                key={store.id}
                style={styles.storeCard}
                onPress={() => router.push({ pathname: "/client/commerce-store/[storeId]", params: { storeId: store.id, universe: store.universe } })}
              >
                <Image source={resolveCommerceVisual(store.visualKey, store.universe)} style={styles.storeImage} />
                <View style={styles.storeBody}>
                  <View style={[styles.storeAccent, { backgroundColor: store.accentColor }]} />
                  <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
                  <Text style={styles.storeTagline} numberOfLines={2}>{store.tagline}</Text>
                  <Text style={styles.storeMeta}>{store.location} · {formatCommerceEta(store.etaMinMinutes, store.etaMaxMinutes)}</Text>
                  <Text style={styles.storeOpenText}>Entrer dans l'enseigne</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View> : null}

        {!loading ? <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderInline}>
            <Text style={styles.sectionTitle}>Catalogue</Text>
            <Text style={styles.sectionMeta}>{filteredProducts.length} resultat(s)</Text>
          </View>
          <View style={styles.productList}>
            {filteredProducts.map((product) => {
              const store = stores.find((item) => item.id === product.storeId);
              return (
                <View key={product.id} style={styles.productCard}>
                  <Image source={resolveCommerceVisual(product.visualKey, store?.universe ?? universe)} style={styles.productImage} />
                  <View style={styles.productBody}>
                    <View style={styles.productTopRow}>
                      <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                      {product.badge ? <Text style={[styles.productBadge, { color: accentColor }]}>{product.badge}</Text> : null}
                    </View>
                    <Text style={styles.productCategory}>{product.category} · {product.unitLabel}</Text>
                    <Text style={styles.productDescription} numberOfLines={2}>{product.description}</Text>
                    <View style={styles.productBottomRow}>
                      <View>
                        <Text style={styles.productPrice}>{product.price.toLocaleString("fr-FR")} FCFA</Text>
                        {product.originalPrice ? <Text style={styles.productOldPrice}>{product.originalPrice.toLocaleString("fr-FR")} FCFA</Text> : null}
                      </View>
                      <View style={styles.productActionBlock}>
                        <Pressable
                          onPress={() => {
                            if (store) {
                              router.push({ pathname: "/client/commerce-store/[storeId]", params: { storeId: store.id, universe: store.universe } });
                            }
                          }}
                        >
                          <Text style={styles.productStore} numberOfLines={1}>{store?.name ?? "Catalogue"}</Text>
                        </Pressable>
                        <Pressable style={[styles.addButton, { backgroundColor: accentColor }]} onPress={() => void handleAddToCart(product)} disabled={activeProductId === product.id || !product.inStock}>
                          {activeProductId === product.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addButtonText}>{product.inStock ? "Ajouter" : "Indispo"}</Text>}
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          {filteredProducts.length === 0 ? <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucun produit visible</Text>
            <Text style={styles.emptyText}>Essayez une autre categorie ou relancez la recherche.</Text>
          </View> : null}
        </View> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingBottom: 48, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20 },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(104,83,69,0.14)",
  },
  headerTextBlock: { flex: 1 },
  cartButton: {
    minWidth: 52,
    height: 42,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(104,83,69,0.14)",
  },
  cartButtonText: { fontSize: 12, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  screenTitle: {
    marginTop: 4,
    fontSize: 24,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  heroCard: {
    borderRadius: 0,
    padding: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(104,83,69,0.10)",
  },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  heroIconWrap: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  heroAction: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  heroActionText: { color: "#fff", fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  heroTitle: { marginTop: 16, fontSize: 20, lineHeight: 28, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  heroMeta: { marginTop: 6, fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    marginHorizontal: 20,
    gap: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(104,83,69,0.10)",
  },
  loadingText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "transparent",
    marginHorizontal: 20,
    paddingHorizontal: 0,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: "rgba(104,83,69,0.14)",
  },
  searchInput: { flex: 1, padding: 0, fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.text },
  categoryRow: { gap: 10, paddingHorizontal: 20 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(104,83,69,0.14)",
  },
  categoryChipActive: { backgroundColor: "transparent", borderColor: Colors.light.tint },
  categoryChipText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  categoryChipTextActive: { color: Colors.light.tint },
  sectionBlock: { gap: 12 },
  sectionHeaderInline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  sectionMeta: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  storeRow: { gap: 12, paddingHorizontal: 20 },
  storeCard: {
    width: 240,
    backgroundColor: "transparent",
  },
  storeImage: { width: "100%", height: 118, borderRadius: 18 },
  storeBody: { paddingTop: 12, gap: 6 },
  storeAccent: { width: 36, height: 4, borderRadius: 999 },
  storeName: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  storeTagline: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  storeMeta: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  storeOpenText: { marginTop: 4, fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  productList: { gap: 12, paddingHorizontal: 20 },
  productCard: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(104,83,69,0.10)" },
  productImage: { width: 92, height: 92, borderRadius: 16 },
  productBody: { flex: 1, gap: 4 },
  productTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  productName: { flex: 1, fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  productBadge: { fontSize: 11, fontFamily: "Poppins_700Bold" },
  productCategory: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  productDescription: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  productBottomRow: { marginTop: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 10 },
  productPrice: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  productOldPrice: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, textDecorationLine: "line-through" },
  productActionBlock: { alignItems: "flex-end", gap: 8 },
  productStore: { maxWidth: 118, textAlign: "right", fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  addButton: {
    minWidth: 82,
    minHeight: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  addButtonText: { color: "#fff", fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  emptyCard: {
    marginHorizontal: 20,
    paddingVertical: 18,
    gap: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(104,83,69,0.10)",
  },
  emptyTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  emptyText: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
});