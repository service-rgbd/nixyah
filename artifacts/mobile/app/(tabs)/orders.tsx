import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { Order, useApp } from "@/contexts/AppContext";

const STATUS_CONFIG = {
  pending: { label: "En attente", color: "#F39C12", icon: "clock" as const },
  accepted: { label: "Acceptée", color: Colors.light.tint, icon: "check" as const },
  preparing: { label: "En préparation", color: "#8B5CF6", icon: "activity" as const },
  ready: { label: "Prête", color: "#27AE60", icon: "check-circle" as const },
  delivered: { label: "Livrée", color: Colors.light.textTertiary, icon: "package" as const },
};

function OrderCard({ order }: { order: Order }) {
  const config = STATUS_CONFIG[order.status];

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTop}>
        <View>
          <Text style={styles.orderChef}>{order.chefName}</Text>
          <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.color + "20" }]}>
          <Feather name={config.icon} size={11} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      <View style={styles.orderDivider} />

      <View style={styles.orderDishes}>
        {order.dishes.map(({ dish, quantity }) => (
          <View key={dish.id} style={styles.orderDishRow}>
            <Text style={styles.orderDishQty}>{quantity}x</Text>
            <Text style={styles.orderDishName} numberOfLines={1}>{dish.name}</Text>
            <Text style={styles.orderDishPrice}>{(dish.price * quantity).toLocaleString()} FCFA</Text>
          </View>
        ))}
      </View>

      <View style={styles.orderFooter}>
        <View>
          <Text style={styles.orderTotalLabel}>Total</Text>
          <Text style={styles.orderTotal}>{order.total.toLocaleString()} FCFA</Text>
        </View>
        {order.status === "delivered" && (
          <Pressable
            style={styles.reorderBtn}
            onPress={() => router.push({ pathname: "/chef/[id]", params: { id: order.chefId } })}
          >
            <Ionicons name="refresh" size={14} color={Colors.light.tint} />
            <Text style={styles.reorderText}>Commander à nouveau</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { orders } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes commandes</Text>
        <Text style={styles.subtitle}>{orders.length} commande{orders.length !== 1 ? "s" : ""}</Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="shopping-bag" size={36} color={Colors.light.tabIconDefault} />
          </View>
          <Text style={styles.emptyTitle}>Aucune commande</Text>
          <Text style={styles.emptyDesc}>
            Commandez chez une cuisinière pour voir vos commandes ici
          </Text>
          <Pressable
            style={styles.exploreBtn}
            onPress={() => router.push("/(tabs)/search")}
          >
            <Text style={styles.exploreBtnText}>Explorer les cuisinières</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: {
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  list: { paddingHorizontal: 20, gap: 14, paddingTop: 4 },
  orderCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderChef: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  orderDate: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
  },
  orderDivider: {
    height: 1,
    backgroundColor: Colors.light.divider,
    marginVertical: 12,
  },
  orderDishes: { gap: 6 },
  orderDishRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderDishQty: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
    minWidth: 22,
  },
  orderDishName: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.text,
  },
  orderDishPrice: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  orderTotalLabel: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  orderTotal: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  reorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reorderText: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.tint,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.textSecondary,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
    textAlign: "center",
    lineHeight: 20,
  },
  exploreBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 8,
  },
  exploreBtnText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
});
