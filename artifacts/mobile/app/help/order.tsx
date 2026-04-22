import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { apiFetch } from "@/constants/api";
import { useApp } from "@/contexts/AppContext";

type TabKey = "upcoming" | "past";

export default function OrderHelpScreen() {
  const insets = useSafeAreaInsets();
  const { orders, token } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [openingThreadId, setOpeningThreadId] = useState<string | null>(null);

  const upcomingOrders = useMemo(
    () => orders.filter((order) => !["delivered", "cancelled"].includes(order.status)),
    [orders],
  );

  const pastOrders = useMemo(
    () => orders.filter((order) => ["delivered", "cancelled"].includes(order.status)),
    [orders],
  );

  const displayedOrders = tab === "upcoming" ? upcomingOrders : pastOrders;

  const openSupportThread = async (orderId: string, targetRole: "chef" | "courier") => {
    if (!token) {
      Alert.alert("Connexion requise", "Connectez-vous pour ouvrir une conversation de support.");
      return;
    }

    try {
      setOpeningThreadId(`${orderId}:${targetRole}`);
      const response = await apiFetch<{ thread: { id: string } }>("/support/threads/open", {
        method: "POST",
        token,
        body: JSON.stringify({
          orderId: Number(orderId),
          targetRole,
          text: targetRole === "chef"
            ? "Bonjour, j'ai besoin d'aide concernant cette commande."
            : "Bonjour, j'ai besoin d'aide pour le suivi de cette livraison.",
        }),
      });

      router.push({
        pathname: "/help/thread/[threadId]",
        params: {
          threadId: response.thread.id,
          title: targetRole === "chef" ? "Support cuisinière" : "Support livreur",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'ouvrir cette conversation pour le moment.";
      Alert.alert("Support indisponible", message);
    } finally {
      setOpeningThreadId(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}> 
      <View style={styles.header}>
        <Pressable style={styles.headerIconBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Aide pour une commande</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabsRow}>
        <Pressable style={[styles.tabBtn, tab === "upcoming" && styles.tabBtnActive]} onPress={() => setTab("upcoming")}>
          <Text style={[styles.tabText, tab === "upcoming" && styles.tabTextActive]}>Commandes a venir</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === "past" && styles.tabBtnActive]} onPress={() => setTab("past")}>
          <Text style={[styles.tabText, tab === "past" && styles.tabTextActive]}>Commandes passees</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {displayedOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucune commande a afficher</Text>
            <Text style={styles.emptyText}>
              {tab === "upcoming"
                ? "Vos commandes en cours apparaitront ici pour contacter le support plus rapidement."
                : "Vos commandes livrees apparaitront ici pour ouvrir un sujet apres livraison."}
            </Text>
          </View>
        ) : (
          displayedOrders.map((order) => {
            const totalItems = order.dishes.reduce((sum, item) => sum + item.quantity, 0);
            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderRow}>
                  <Text style={styles.orderName} numberOfLines={1}>{order.chefName}</Text>
                  <View style={[styles.statusBadge, ["delivered", "cancelled"].includes(order.status) ? styles.statusDelivered : styles.statusOpen]}>
                    <Text style={[styles.statusText, ["delivered", "cancelled"].includes(order.status) ? styles.statusTextDelivered : styles.statusTextOpen]}>
                      {order.status === "cancelled" ? "Annulee" : order.status === "delivered" ? "Livre" : "En cours"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.orderDate}>
                  {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                  {", "}
                  {new Date(order.createdAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <View style={styles.orderMetaRow}>
                  <Text style={styles.orderMeta}>{order.delivery?.restaurantAddress ?? "Restaurant partenaire"}</Text>
                  <Text style={styles.orderMeta}>{totalItems} article{totalItems > 1 ? "s" : ""}</Text>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.actionButton, openingThreadId === `${order.id}:chef` && styles.actionButtonDisabled]}
                    disabled={openingThreadId === `${order.id}:chef`}
                    onPress={() => void openSupportThread(order.id, "chef")}
                  >
                    <Text style={styles.actionButtonText}>Contacter la cuisinière</Text>
                  </Pressable>
                  {order.delivery?.courierUserId ? (
                    <Pressable
                      style={[styles.secondaryActionButton, openingThreadId === `${order.id}:courier` && styles.actionButtonDisabled]}
                      disabled={openingThreadId === `${order.id}:courier`}
                      onPress={() => void openSupportThread(order.id, "courier")}
                    >
                      <Text style={styles.secondaryActionButtonText}>Contacter le livreur</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    backgroundColor: Colors.light.card,
  },
  headerIconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontFamily: "Poppins_700Bold", fontSize: 17, color: Colors.light.text },
  headerSpacer: { width: 32 },
  tabsRow: { flexDirection: "row", backgroundColor: Colors.light.card, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: Colors.light.text },
  tabText: { fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary, fontSize: 14 },
  tabTextActive: { color: Colors.light.text },
  content: { padding: 16, gap: 12 },
  orderCard: { paddingVertical: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orderName: { flex: 1, fontFamily: "Poppins_700Bold", fontSize: 16, color: Colors.light.text },
  orderDate: { fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary, fontSize: 13 },
  orderMetaRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  orderMeta: { fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, fontSize: 13 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionButton: { backgroundColor: Colors.light.tint, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  actionButtonText: { color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  secondaryActionButton: { backgroundColor: Colors.light.backgroundSecondary, borderRadius: 999, borderWidth: 1, borderColor: Colors.light.cardBorder, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryActionButtonText: { color: Colors.light.text, fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  actionButtonDisabled: { opacity: 0.6 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusDelivered: { backgroundColor: "#E7F8F1" },
  statusOpen: { backgroundColor: "#FFF2E5" },
  statusText: { fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  statusTextDelivered: { color: "#1B8E5F" },
  statusTextOpen: { color: "#B65A00" },
  emptyCard: { paddingVertical: 18, gap: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.light.divider },
  emptyTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: Colors.light.text },
  emptyText: { fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, lineHeight: 20 },
});
