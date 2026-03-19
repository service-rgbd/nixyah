import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { apiFetch } from "@/constants/api";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadCart = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data: any = await apiFetch(`/cart`, { token: (localStorage?.getItem("nixyah_token") as string) ?? undefined });
      setCart(data.cart);
    } catch (e) {
      console.warn("Failed to load cart", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCart(); }, [user]);

  const checkout = async () => {
    try {
      const res: any = await apiFetch(`/cart/checkout`, { method: "POST", token: (localStorage?.getItem("nixyah_token") as string) ?? undefined });
      Alert.alert("Commande créée", `Commande #${res.orderId} — Total: ${res.total} FCFA`);
      loadCart();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de passer la commande");
    }
  };

  if (!user) return (
    <View style={[styles.container, { paddingTop: insets.top }] }>
      <Text style={{ padding: 20 }}>Veuillez vous connecter pour voir votre panier.</Text>
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
        {loading ? (
          <ActivityIndicator />
        ) : cart && cart.items.length > 0 ? (
          cart.items.map((it: any) => (
            <View key={it.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.dishName}</Text>
                <Text style={styles.itemQty}>x{it.quantity} • {it.price} FCFA</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>Votre panier est vide</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.checkoutBtn} onPress={checkout}>
          <Text style={styles.checkoutText}>Valider la commande</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  title: { fontFamily: "Poppins_600SemiBold", fontSize: 18, color: Colors.light.text, marginBottom: 12 },
  item: { backgroundColor: Colors.light.card, padding: 12, borderRadius: 10, marginBottom: 8 },
  itemName: { fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  itemQty: { color: Colors.light.textSecondary, marginTop: 6 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.light.divider, backgroundColor: Colors.light.card },
  checkoutBtn: { backgroundColor: Colors.light.tint, padding: 14, borderRadius: 10, alignItems: "center" },
  checkoutText: { color: "#fff", fontFamily: "Poppins_600SemiBold" },
  empty: { color: Colors.light.textSecondary },
});
