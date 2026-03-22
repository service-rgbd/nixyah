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

export default function CommerceStoreScreen() {
  const insets = useSafeAreaInsets();
  const { storeId, universe } = useLocalSearchParams<{ storeId: string; universe?: string }>();
  const resolvedUniverse = universe === "courses" || universe === "supermarkets" || universe === "boutiques" ? universe : "supermarkets";
  const { token, user } = useApp();
  const [store, setStore] = useState<CommerceApiStore | null>(null);
  const [products, setProducts] = useState<CommerceApiProduct[]>([]);
  const [category, setCategory] = useState<string | null>(null);
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

  const categories = useMemo(() => Array.from(new Set(products.map((item) => item.category))), [products]);
  const visibleProducts = useMemo(
    () => products.filter((item) => category === null || item.category === category),
    [category, products],
  );

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
            <Text style={styles.eyebrow}>Enseigne</Text>
            <Text style={styles.screenTitle}>{store?.name ?? "Catalogue"}</Text>
          </View>
          <Pressable style={styles.cartButton} onPress={() => router.push({ pathname: "/client/commerce-cart", params: { universe: resolvedUniverse } })}>
            <Ionicons name="bag-handle" size={18} color={Colors.light.text} />
            <Text style={styles.cartButtonText}>{cartCount}</Text>
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
              <View style={styles.heroBody}>
                <Text style={styles.heroTitle}>{store.name}</Text>
                <Text style={styles.heroMeta}>{store.location} · {formatCommerceEta(store.etaMinMinutes, store.etaMaxMinutes)}</Text>
                <Text style={styles.heroDescription}>{store.description}</Text>
              </View>
            </Gradient>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
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
            </ScrollView>

            <View style={styles.productList}>
              {visibleProducts.map((product) => (
                <View key={product.id} style={styles.productCard}>
                  <Image source={resolveCommerceVisual(product.visualKey, store.universe)} style={styles.productImage} />
                  <View style={styles.productBody}>
                    <View style={styles.productTopRow}>
                      <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                      {product.badge ? <Text style={[styles.productBadge, { color: store.accentColor }]}>{product.badge}</Text> : null}
                    </View>
                    <Text style={styles.productCategory}>{product.category} · {product.unitLabel}</Text>
                    <Text style={styles.productDescription} numberOfLines={2}>{product.description}</Text>
                    <View style={styles.productBottomRow}>
                      <View>
                        <Text style={styles.productPrice}>{product.price.toLocaleString("fr-FR")} FCFA</Text>
                        {product.originalPrice ? <Text style={styles.productOldPrice}>{product.originalPrice.toLocaleString("fr-FR")} FCFA</Text> : null}
                      </View>
                      <Pressable style={[styles.addButton, { backgroundColor: store.accentColor }]} onPress={() => void handleAddToCart(product)} disabled={activeProductId === product.id || !product.inStock}>
                        {activeProductId === product.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addButtonText}>{product.inStock ? "Ajouter" : "Indispo"}</Text>}
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder },
  headerTextBlock: { flex: 1 },
  cartButton: { minWidth: 52, height: 42, borderRadius: 21, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder },
  cartButtonText: { fontSize: 12, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  eyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
  screenTitle: { marginTop: 4, fontSize: 24, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  loadingCard: { alignItems: "center", justifyContent: "center", paddingVertical: 28, borderRadius: 24, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, gap: 10 },
  loadingText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  heroCard: { borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: Colors.light.cardBorder },
  heroImage: { width: "100%", height: 180 },
  heroBody: { padding: 18, gap: 6 },
  heroTitle: { fontSize: 22, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  heroMeta: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  heroDescription: { fontSize: 13, lineHeight: 19, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  categoryRow: { gap: 10 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: Colors.light.backgroundSecondary },
  categoryChipActive: { backgroundColor: Colors.light.tint },
  categoryChipText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  categoryChipTextActive: { color: "#fff" },
  productList: { gap: 12 },
  productCard: { flexDirection: "row", gap: 12, backgroundColor: Colors.light.card, borderRadius: 22, padding: 12, borderWidth: 1, borderColor: Colors.light.cardBorder },
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
  addButton: { minWidth: 82, minHeight: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  addButtonText: { color: "#fff", fontSize: 12, fontFamily: "Poppins_600SemiBold" },
});