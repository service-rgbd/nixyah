import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
  type CommerceCartPayload,
  type CommerceCartResponse,
  type CommerceUniverse,
} from "@/constants/commerce-catalog";
import { useApp } from "@/contexts/AppContext";

type QuoteResponse = {
  subtotal: number;
  deliveryFee: number;
  totalWithDelivery: number;
  distanceKm?: number | null;
  storeName?: string | null;
  universe?: CommerceUniverse | null;
};

function resolveUniverseHref(universe?: CommerceUniverse | null) {
  if (universe === "supermarkets") {
    return "/client/supermarkets" as const;
  }

  if (universe === "boutiques") {
    return "/client/boutiques" as const;
  }

  return "/client/courses" as const;
}

export default function CommerceCartScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ universe?: string }>();
  const requestedUniverse = params.universe === "supermarkets" || params.universe === "boutiques" || params.universe === "courses"
    ? params.universe
    : "courses";
  const { token, user, refreshOrders } = useApp();
  const [cart, setCart] = useState<CommerceCartPayload | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const loadCart = useCallback(async () => {
    if (!token || user?.type !== "client") {
      setCart(null);
      setQuote(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch<CommerceCartResponse>("/commerce/cart", { token });
      setCart(response.cart);

      if (response.cart.itemCount > 0) {
        const pricing = await apiFetch<QuoteResponse>("/commerce/cart/quote", {
          method: "POST",
          token,
          body: JSON.stringify({ deliveryAddress: user.location }),
        });
        setQuote(pricing);
      } else {
        setQuote(null);
      }
    } catch (error) {
      console.warn("Failed to load commerce cart", error);
      Alert.alert("Erreur", "Impossible de charger le panier commerce pour le moment.");
    } finally {
      setLoading(false);
    }
  }, [token, user?.location, user?.type]);

  useFocusEffect(
    useCallback(() => {
      void loadCart();
    }, [loadCart]),
  );

  const updateQuantity = async (itemId: string, nextQuantity: number) => {
    if (!token) {
      return;
    }

    setActiveItemId(itemId);
    try {
      if (nextQuantity <= 0) {
        await apiFetch<CommerceCartResponse>(`/commerce/cart/items/${itemId}`, { method: "DELETE", token });
      } else {
        await apiFetch<CommerceCartResponse>(`/commerce/cart/items/${itemId}`, {
          method: "PUT",
          token,
          body: JSON.stringify({ quantity: nextQuantity }),
        });
      }
      await loadCart();
    } catch (error) {
      Alert.alert("Erreur", "Impossible de mettre a jour cet article.");
    } finally {
      setActiveItemId(null);
    }
  };

  const handleCheckout = async () => {
    if (!token || !user) {
      router.push("/auth/login");
      return;
    }

    if (!cart || cart.itemCount === 0) {
      return;
    }

    setCheckingOut(true);
    try {
      await apiFetch("/commerce/cart/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({ deliveryAddress: user.location }),
      });
      await refreshOrders();
      await loadCart();
      Alert.alert("Commande enregistree", "Votre commande commerce a bien ete validee.", [
        { text: "Voir mes commandes", onPress: () => router.push("/(tabs)/orders") },
      ]);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Impossible de finaliser cette commande.";
      Alert.alert("Erreur", message);
    } finally {
      setCheckingOut(false);
    }
  };

  const emptyUniverseHref = useMemo(() => resolveUniverseHref(requestedUniverse), [requestedUniverse]);

  if (!token || user?.type !== "client") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}> 
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptyText}>Connectez-vous en tant que client pour gerer le panier commerce.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push("/auth/login")}>
            <Text style={styles.primaryBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={18} color={Colors.light.text} />
          </Pressable>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>Panier commerce</Text>
            <Text style={styles.title}>Finaliser ma commande</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.light.tint} />
            <Text style={styles.loadingText}>Chargement du panier...</Text>
          </View>
        ) : null}

        {!loading && (!cart || cart.itemCount === 0) ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Panier vide</Text>
            <Text style={styles.emptyText}>Ajoutez quelques produits pour lancer une commande complete.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.push(emptyUniverseHref)}>
              <Text style={styles.primaryBtnText}>Retour au catalogue</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && cart && cart.itemCount > 0 ? (
          <>
            {cart.store ? (
              <Gradient colors={[`${cart.store.accentColor}18`, Colors.light.backgroundSecondary, Colors.light.card]} style={styles.storeHero}>
                <Image source={resolveCommerceVisual(cart.store.visualKey, cart.store.universe)} style={styles.storeHeroImage} />
                <View style={styles.storeHeroBody}>
                  <Text style={styles.storeHeroName}>{cart.store.name}</Text>
                  <Text style={styles.storeHeroMeta}>{cart.store.location} · {formatCommerceEta(cart.store.etaMinMinutes, cart.store.etaMaxMinutes)}</Text>
                  <Text style={styles.storeHeroTagline} numberOfLines={2}>{cart.store.tagline}</Text>
                </View>
              </Gradient>
            ) : null}

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Articles</Text>
                <Text style={styles.sectionMeta}>{cart.itemCount} article(s)</Text>
              </View>
              <View style={styles.itemList}>
                {cart.items.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    <Image source={resolveCommerceVisual(item.visualKey, cart.store?.universe)} style={styles.itemImage} />
                    <View style={styles.itemBody}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
                      <Text style={styles.itemMeta}>{item.category} · {item.unitLabel}</Text>
                      <Text style={styles.itemPrice}>{Math.round(item.price).toLocaleString("fr-FR")} FCFA</Text>
                    </View>
                    <View style={styles.qtyColumn}>
                      <Pressable style={styles.qtyBtn} onPress={() => void updateQuantity(item.id, item.quantity + 1)} disabled={activeItemId === item.id}>
                        <Feather name="plus" size={16} color={Colors.light.text} />
                      </Pressable>
                      <Text style={styles.qtyValue}>{item.quantity}</Text>
                      <Pressable style={styles.qtyBtn} onPress={() => void updateQuantity(item.id, item.quantity - 1)} disabled={activeItemId === item.id}>
                        {activeItemId === item.id ? <ActivityIndicator color={Colors.light.text} size="small" /> : <Feather name="minus" size={16} color={Colors.light.text} />}
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Livraison</Text>
                <Pressable onPress={() => router.push("/client/addresses")}>
                  <Text style={styles.linkText}>Modifier</Text>
                </Pressable>
              </View>
              <Text style={styles.addressText}>{user.location || "Adresse a renseigner"}</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Recapitulatif</Text>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Sous-total</Text><Text style={styles.summaryValue}>{Math.round(cart.subtotal).toLocaleString("fr-FR")} FCFA</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Livraison</Text><Text style={styles.summaryValue}>{Math.round(quote?.deliveryFee ?? 0).toLocaleString("fr-FR")} FCFA</Text></View>
              <View style={[styles.summaryRow, styles.summaryRowTotal]}><Text style={styles.summaryTotalLabel}>Total</Text><Text style={styles.summaryTotalValue}>{Math.round(quote?.totalWithDelivery ?? cart.subtotal).toLocaleString("fr-FR")} FCFA</Text></View>
            </View>

            <Pressable style={[styles.primaryBtn, checkingOut && styles.primaryBtnDisabled]} onPress={() => void handleCheckout()} disabled={checkingOut}>
              {checkingOut ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Valider la commande</Text>}
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingBottom: 40, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20 },
  backButton: { width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(104,83,69,0.14)" },
  headerTextWrap: { flex: 1 },
  eyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
  title: { marginTop: 4, fontSize: 24, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  loadingCard: { alignItems: "center", justifyContent: "center", paddingVertical: 28, marginHorizontal: 20, gap: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(104,83,69,0.10)" },
  loadingText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  emptyWrap: { marginHorizontal: 20, padding: 22, gap: 10, alignItems: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(104,83,69,0.10)" },
  emptyTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  emptyText: { fontSize: 13, lineHeight: 20, textAlign: "center", fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  storeHero: { overflow: "hidden", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(104,83,69,0.10)" },
  storeHeroImage: { width: "100%", height: 148 },
  storeHeroBody: { paddingHorizontal: 20, paddingVertical: 16, gap: 5 },
  storeHeroName: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  storeHeroMeta: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  storeHeroTagline: { fontSize: 13, lineHeight: 19, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  sectionCard: { paddingHorizontal: 20, paddingVertical: 16, gap: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(104,83,69,0.10)" },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  sectionMeta: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  itemList: { gap: 12 },
  itemCard: { flexDirection: "row", gap: 12, alignItems: "center" },
  itemImage: { width: 76, height: 76, borderRadius: 16 },
  itemBody: { flex: 1, gap: 4 },
  itemName: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  itemMeta: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  itemPrice: { fontSize: 13, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  qtyColumn: { alignItems: "center", gap: 6 },
  qtyBtn: { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(104,83,69,0.14)" },
  qtyValue: { fontSize: 14, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  linkText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  addressText: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryRowTotal: { paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: Colors.light.divider },
  summaryLabel: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  summaryValue: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  summaryTotalLabel: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  summaryTotalValue: { fontSize: 17, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  primaryBtn: { minHeight: 54, marginHorizontal: 20, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.tint, paddingHorizontal: 18 },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontFamily: "Poppins_600SemiBold" },
});