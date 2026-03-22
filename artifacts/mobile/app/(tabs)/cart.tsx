import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { apiFetch } from "@/constants/api";
import { formatAddressTimestamp, loadSavedDeliveryAddress, type SavedDeliveryAddress } from "@/constants/delivery-address";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, refreshOrders } = useApp();
  const addressScope = user?.id ? `user:${user.id}` : "guest";
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [savedAddress, setSavedAddress] = useState<SavedDeliveryAddress | null>(null);
  const [cashAnswer, setCashAnswer] = useState<"yes" | "no" | null>(null);
  const [pricingQuote, setPricingQuote] = useState<any>(null);

  const loadDeliveryAddress = useCallback(async () => {
    const address = await loadSavedDeliveryAddress(addressScope);
    setSavedAddress(address);
  }, [addressScope]);

  const loadCart = useCallback(async () => {
    if (!user || user.type !== "client" || !token) {
      setCart(null);
      return;
    }
    setLoading(true);
    try {
      const data: any = await apiFetch(`/cart`, { token });
      setCart(data.cart);
    } catch (e) {
      console.warn("Failed to load cart", e);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useFocusEffect(
    useCallback(() => {
      loadCart();
      loadDeliveryAddress();
    }, [loadCart, loadDeliveryAddress]),
  );

  const updateItemQuantity = useCallback(async (itemId: number, quantity: number) => {
    if (!token) return;
    try {
      setUpdatingItemId(itemId);
      if (quantity <= 0) {
        await apiFetch(`/cart/items/${itemId}`, { method: "DELETE", token });
      } else {
        await apiFetch(`/cart/items/${itemId}`, {
          method: "PUT",
          token,
          body: JSON.stringify({ quantity }),
        });
      }
      await loadCart();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de mettre à jour le panier");
    } finally {
      setUpdatingItemId(null);
    }
  }, [loadCart, token]);

  const loadPricingQuote = useCallback(async () => {
    if (!token || !user || user.type !== "client" || !(cart?.items?.length > 0)) {
      setPricingQuote(null);
      return;
    }

    try {
      const quote = await apiFetch(`/cart/quote`, {
        method: "POST",
        token,
        body: JSON.stringify({
          deliveryAddress: savedAddress?.label?.trim() || user.location || null,
          deliveryLatitude: savedAddress?.latitude ?? null,
          deliveryLongitude: savedAddress?.longitude ?? null,
        }),
      });
      setPricingQuote(quote);
    } catch (error) {
      console.warn("Failed to load cart pricing quote", error);
      setPricingQuote(null);
    }
  }, [cart?.items?.length, savedAddress?.label, savedAddress?.latitude, savedAddress?.longitude, token, user]);

  useEffect(() => {
    void loadPricingQuote();
  }, [loadPricingQuote]);

  const checkout = useCallback(async () => {
    if (!token) return;
    const resolvedDeliveryAddress = savedAddress?.label?.trim() || user?.location?.trim() || "";
    if (!resolvedDeliveryAddress) {
      Alert.alert("Adresse requise", "Ajoutez d'abord une adresse de livraison avant de valider la commande.", [
        {
          text: "Mes adresses",
          onPress: () => router.push("/client/addresses"),
        },
        {
          text: "Annuler",
          style: "cancel",
        },
      ]);
      return;
    }

    try {
      setIsCheckingOut(true);
      const notes = cashAnswer === "yes"
        ? "Client indique avoir de la monnaie."
        : cashAnswer === "no"
          ? "Client indique ne pas avoir de monnaie."
          : "";
      const res: any = await apiFetch(`/cart/checkout`, {
        method: "POST",
        token,
        body: JSON.stringify({
          deliveryAddress: resolvedDeliveryAddress,
          deliveryLatitude: savedAddress?.latitude ?? null,
          deliveryLongitude: savedAddress?.longitude ?? null,
          notes,
        }),
      });
      await Promise.all([loadCart(), refreshOrders()]);
      Alert.alert("Commande creee", `Commande #${res.orderId} - Total a payer: ${Number(res.totalWithDelivery ?? res.total).toLocaleString()} FCFA`, [
        {
          text: "Voir mes commandes",
          onPress: () => router.push("/(tabs)/orders"),
        },
        {
          text: "Continuer",
          style: "cancel",
        },
      ]);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de passer la commande");
    } finally {
      setIsCheckingOut(false);
    }
  }, [loadCart, refreshOrders, savedAddress, token, user?.location]);

  const cartItems = cart?.items ?? [];
  const total = cartItems.reduce((sum: number, item: any) => sum + Number(item.price ?? 0) * Number(item.quantity ?? 0), 0);
  const totalItems = cartItems.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0);
  const totalWithDelivery = Number(pricingQuote?.totalWithDelivery ?? total);
  const freeDeliveryLabel = pricingQuote?.freeDeliveryReason === "promo"
    ? "Offerte des 3 000 FCFA / 5 km"
    : pricingQuote?.freeDeliveryReason === "referral"
      ? "Offerte via parrainage"
      : null;
  const deliveryLabel = savedAddress?.label ?? user?.location ?? "Aucune adresse enregistree";

  if (!user) return (
    <View style={[styles.container, { paddingTop: insets.top }] }>
      <View style={{ padding: 20, gap: 12 }}>
        <Text style={styles.title}>Connexion requise</Text>
        <Text style={styles.empty}>Veuillez vous connecter pour voir votre panier et passer commande.</Text>
        <Pressable style={styles.checkoutBtn} onPress={() => router.push("/auth/login")}>
          <Text style={styles.checkoutText}>Se connecter</Text>
        </Pressable>
      </View>
    </View>
  );

  if (user.type === "courier") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }] }>
        <View style={{ padding: 20 }}>
          <Text style={styles.title}>Panier indisponible</Text>
          <Text style={styles.empty}>Le rôle livreur ne peut pas accéder au panier ni passer commande.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }] }>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.title}>Votre panier</Text>
        <View style={styles.addressCard}>
          <View style={styles.addressHeader}>
            <View style={styles.addressIconWrap}>
              <Feather name="map-pin" size={16} color={Colors.light.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressTitle}>Adresse de livraison</Text>
              <Text style={styles.addressText}>{deliveryLabel}</Text>
              <Text style={styles.addressMeta}>{formatAddressTimestamp(savedAddress?.updatedAt)}</Text>
            </View>
            <Pressable style={styles.addressLinkBtn} onPress={() => router.push("/client/addresses")}>
              <Text style={styles.addressLinkText}>Modifier</Text>
            </Pressable>
          </View>
          {typeof user?.freeDeliveryCredits === "number" && user.freeDeliveryCredits > 0 ? (
            <View style={styles.creditPill}>
              <Feather name="gift" size={14} color={Colors.light.tint} />
              <Text style={styles.creditPillText}>{`${user.freeDeliveryCredits} livraison(s) offerte(s) disponible(s)`}</Text>
            </View>
          ) : null}
        </View>

        {cartItems.length > 0 ? (
          <View style={styles.addressCard}>
            <Text style={styles.addressTitle}>Avez-vous la monnaie ?</Text>
            <Text style={styles.addressMeta}>Cette information est transmise avec la commande pour faciliter la livraison.</Text>
            <View style={styles.cashChoiceRow}>
              <Pressable style={[styles.cashChip, cashAnswer === "yes" && styles.cashChipActive]} onPress={() => setCashAnswer("yes")}>
                <Text style={[styles.cashChipText, cashAnswer === "yes" && styles.cashChipTextActive]}>Oui, j'ai la monnaie</Text>
              </Pressable>
              <Pressable style={[styles.cashChip, cashAnswer === "no" && styles.cashChipActive]} onPress={() => setCashAnswer("no")}>
                <Text style={[styles.cashChipText, cashAnswer === "no" && styles.cashChipTextActive]}>Non, je n'ai pas la monnaie</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator />
        ) : cartItems.length > 0 ? (
          cartItems.map((it: any) => (
            <View key={it.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.dishName}</Text>
                <Text style={styles.itemQty}>{Number(it.price).toLocaleString()} FCFA l'unité</Text>
                <Text style={styles.itemLineTotal}>{(Number(it.price ?? 0) * Number(it.quantity ?? 0)).toLocaleString()} FCFA</Text>
              </View>
              <View style={styles.qtyWrap}>
                <Pressable style={styles.qtyBtn} onPress={() => updateItemQuantity(it.id, Number(it.quantity) - 1)} disabled={updatingItemId === it.id}>
                  <Text style={styles.qtyBtnText}>-</Text>
                </Pressable>
                <Text style={styles.qtyCount}>{it.quantity}</Text>
                <Pressable style={styles.qtyBtn} onPress={() => updateItemQuantity(it.id, Number(it.quantity) + 1)} disabled={updatingItemId === it.id}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>Votre panier est vide</Text>
        )}

        {cartItems.length > 0 ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Articles</Text>
              <Text style={styles.summaryValue}>{totalItems}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sous-total</Text>
              <Text style={styles.summaryValue}>{total.toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Livraison</Text>
              <Text style={styles.summaryValue}>
                {pricingQuote
                  ? pricingQuote.deliveryFee > 0
                    ? `${Number(pricingQuote.deliveryFee).toLocaleString()} FCFA`
                    : "Offerte"
                  : "Calcul..."}
              </Text>
            </View>
            {pricingQuote ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Distance</Text>
                  <Text style={styles.summaryHint}>{`${Number(pricingQuote.distanceKm ?? 0).toFixed(1)} km`}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Demande</Text>
                  <Text style={styles.summaryHint}>{`x${Number(pricingQuote.demandMultiplier ?? 1).toFixed(2)}`}</Text>
                </View>
                {freeDeliveryLabel ? (
                  <View style={styles.freeDeliveryBanner}>
                    <Feather name="check-circle" size={14} color="#0F766E" />
                    <Text style={styles.freeDeliveryBannerText}>{freeDeliveryLabel}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 16) }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total à payer</Text>
          <Text style={styles.totalValue}>{totalWithDelivery.toLocaleString()} FCFA</Text>
        </View>
        <Pressable style={[styles.checkoutBtn, (!cartItems.length || isCheckingOut || !cashAnswer) && styles.checkoutBtnDisabled]} onPress={checkout} disabled={!cartItems.length || isCheckingOut || !cashAnswer}>
          <Text style={styles.checkoutText}>{isCheckingOut ? "Validation..." : "Valider la commande"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  title: { fontFamily: "Poppins_600SemiBold", fontSize: 18, color: Colors.light.text, marginBottom: 12 },
  addressCard: { backgroundColor: Colors.light.card, padding: 14, borderRadius: 16, marginBottom: 14 },
  addressHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  addressIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  addressTitle: { fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  addressText: { marginTop: 2, color: Colors.light.text, fontFamily: "Poppins_500Medium", lineHeight: 20 },
  addressMeta: { marginTop: 4, color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular" },
  addressLinkBtn: { paddingVertical: 6 },
  addressLinkText: { color: Colors.light.tint, fontFamily: "Poppins_600SemiBold" },
  creditPill: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: "rgba(196,82,42,0.08)", paddingHorizontal: 12, paddingVertical: 9 },
  creditPillText: { color: Colors.light.tint, fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  cashChoiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  cashChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: Colors.light.cardBorder, backgroundColor: Colors.light.backgroundSecondary },
  cashChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  cashChipText: { color: Colors.light.text, fontFamily: "Poppins_500Medium" },
  cashChipTextActive: { color: "#fff" },
  item: { backgroundColor: Colors.light.card, padding: 12, borderRadius: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  itemName: { fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  itemQty: { color: Colors.light.textSecondary, marginTop: 6 },
  itemLineTotal: { color: Colors.light.tint, marginTop: 8, fontFamily: "Poppins_600SemiBold" },
  qtyWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.backgroundSecondary },
  qtyBtnText: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  qtyCount: { minWidth: 22, textAlign: "center", fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  summaryCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 14, marginTop: 12, gap: 10 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryLabel: { color: Colors.light.textSecondary, fontFamily: "Poppins_500Medium" },
  summaryValue: { color: Colors.light.text, fontFamily: "Poppins_600SemiBold" },
  summaryHint: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", maxWidth: 180, textAlign: "right" },
  freeDeliveryBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: "rgba(15,118,110,0.10)", paddingHorizontal: 12, paddingVertical: 10 },
  freeDeliveryBannerText: { color: "#0F766E", fontFamily: "Poppins_500Medium", flex: 1 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.light.divider, backgroundColor: Colors.light.card },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  totalLabel: { fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  totalValue: { fontFamily: "Poppins_700Bold", color: Colors.light.text, fontSize: 18 },
  checkoutBtn: { backgroundColor: Colors.light.tint, padding: 14, borderRadius: 10, alignItems: "center" },
  checkoutBtnDisabled: { opacity: 0.6 },
  checkoutText: { color: "#fff", fontFamily: "Poppins_600SemiBold" },
  empty: { color: Colors.light.textSecondary },
});
