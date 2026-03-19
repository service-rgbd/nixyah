import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { Order, useApp } from "@/contexts/AppContext";

const STATUS_CONFIG = {
  pending: { label: "En attente", color: "#F39C12", icon: "clock" as const },
  accepted: { label: "Acceptée", color: Colors.light.tint, icon: "check" as const },
  preparing: { label: "En préparation", color: "#8B5CF6", icon: "activity" as const },
  ready: { label: "Prête", color: "#27AE60", icon: "check-circle" as const },
  delivered: { label: "Livrée", color: Colors.light.textTertiary, icon: "package" as const },
};

const DELIVERY_STATUS_CONFIG = {
  broadcasting: { label: "Diffusion", color: "#D97706" },
  available: { label: "Disponible", color: "#D97706" },
  accepted: { label: "Livreur assigné", color: "#2563EB" },
  picked_up: { label: "Commande récupérée", color: "#7C3AED" },
  on_the_way: { label: "En livraison", color: "#059669" },
  delivered: { label: "Livrée", color: "#374151" },
  cancelled: { label: "Annulée", color: "#DC2626" },
};

type DeliveryJob = {
  id: string;
  orderId: string;
  status: keyof typeof DELIVERY_STATUS_CONFIG;
  restaurantName: string;
  restaurantAddress: string;
  clientName: string;
  deliveryAddress: string;
};

function OrderCard({ order }: { order: Order }) {
  const config = STATUS_CONFIG[order.status];
  const deliveryConfig = order.delivery ? DELIVERY_STATUS_CONFIG[order.delivery.status] : null;

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
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          {deliveryConfig ? (
            <View style={[styles.statusBadge, { backgroundColor: deliveryConfig.color + "20" }]}>
              <Text style={[styles.statusText, { color: deliveryConfig.color }]}>{deliveryConfig.label}</Text>
            </View>
          ) : null}
          {order.delivery ? (
            <Pressable style={styles.reorderBtn} onPress={() => router.push({ pathname: "/delivery/job/[id]", params: { id: order.delivery!.id } })}>
              <Feather name="map" size={14} color={Colors.light.tint} />
              <Text style={styles.reorderText}>Suivre</Text>
            </Pressable>
          ) : order.status === "delivered" ? (
            <Pressable
              style={styles.reorderBtn}
              onPress={() => router.push({ pathname: "/chef/[id]", params: { id: order.chefId } })}
            >
              <Ionicons name="refresh" size={14} color={Colors.light.tint} />
              <Text style={styles.reorderText}>Commander à nouveau</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function DeliveryJobCard({
  job,
  onAccept,
  accepting,
}: {
  job: DeliveryJob;
  onAccept?: (jobId: string) => void;
  accepting?: boolean;
}) {
  const config = DELIVERY_STATUS_CONFIG[job.status];

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderChef}>{job.restaurantName}</Text>
          <Text style={styles.orderDate}>{job.restaurantAddress}</Text>
          <Text style={[styles.orderDate, { marginTop: 6 }]}>{job.clientName} · {job.deliveryAddress}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.color + "20" }]}>
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      <View style={styles.orderFooter}>
        <Pressable style={styles.reorderBtn} onPress={() => router.push({ pathname: "/delivery/job/[id]", params: { id: job.id } })}>
          <Feather name="map" size={14} color={Colors.light.tint} />
          <Text style={styles.reorderText}>Voir le suivi</Text>
        </Pressable>
        {onAccept ? (
          <Pressable style={styles.acceptBtn} onPress={() => onAccept(job.id)} disabled={accepting}>
            {accepting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.acceptBtnText}>Accepter</Text>}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const { orders, token, user, refreshOrders } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const isCourier = user?.type === "courier";
  const isDeliveryMode = params.mode === "delivery";
  const [availableJobs, setAvailableJobs] = useState<DeliveryJob[]>([]);
  const [currentJobs, setCurrentJobs] = useState<DeliveryJob[]>([]);
  const [loadingCourier, setLoadingCourier] = useState(false);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);

  const loadCourierJobs = async () => {
    if (!token) return;
    setLoadingCourier(true);
    try {
      const [available, current] = await Promise.all([
        apiFetch<{ jobs: DeliveryJob[] }>("/delivery/jobs/available", { token }),
        apiFetch<{ jobs: DeliveryJob[] }>("/delivery/jobs/current", { token }),
      ]);
      setAvailableJobs(available.jobs ?? []);
      setCurrentJobs(current.jobs ?? []);
    } catch (error) {
      console.warn("Failed to load courier jobs:", error);
    } finally {
      setLoadingCourier(false);
    }
  };

  useEffect(() => {
    if (isCourier) {
      loadCourierJobs();
    } else {
      refreshOrders();
    }
  }, [isCourier, token, refreshOrders]);

  const acceptJob = async (jobId: string) => {
    if (!token) return;
    setAcceptingJobId(jobId);
    try {
      await apiFetch(`/delivery/jobs/${jobId}/accept`, { method: "POST", token });
      await loadCourierJobs();
      router.push({ pathname: "/delivery/job/[id]", params: { id: jobId } });
    } catch (error) {
      console.warn("Failed to accept delivery job:", error);
    } finally {
      setAcceptingJobId(null);
    }
  };

  if (!user && isDeliveryMode) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Service livraison</Text>
          <Text style={styles.subtitle}>Connectez-vous pour suivre ou rejoindre les livraisons.</Text>
        </View>

        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="truck" size={34} color={Colors.light.tint} />
          </View>
          <Text style={styles.emptyTitle}>Espace livreur</Text>
          <Text style={styles.emptyDesc}>
            Les livreurs recoivent les missions quand une commande est prete, acceptent la course
            et suivent le trajet jusqu'au client.
          </Text>
          <Pressable style={styles.exploreBtn} onPress={() => router.push("/auth/login")}>
            <Text style={styles.exploreBtnText}>Se connecter</Text>
          </Pressable>
          <Pressable style={styles.deliveryOutlineBtn} onPress={() => router.push("/auth/register-courier")}>
            <Text style={styles.deliveryOutlineBtnText}>Devenir livreur</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isCourier) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Mes missions</Text>
          <Text style={styles.subtitle}>{currentJobs.length} en cours · {availableJobs.length} disponibles</Text>
        </View>

        {loadingCourier ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={Colors.light.tint} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]} showsVerticalScrollIndicator={false}>
            {currentJobs.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Mission en cours</Text>
                {currentJobs.map((job) => (
                  <DeliveryJobCard key={job.id} job={job} />
                ))}
              </>
            ) : null}

            <Text style={styles.sectionTitle}>{currentJobs.length > 0 ? "Nouvelles missions" : "Missions disponibles"}</Text>
            {availableJobs.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyDesc}>Aucune mission disponible pour le moment.</Text>
              </View>
            ) : (
              availableJobs.map((job) => (
                <DeliveryJobCard key={job.id} job={job} onAccept={acceptJob} accepting={acceptingJobId === job.id} />
              ))
            )}
          </ScrollView>
        )}
      </View>
    );
  }

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
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
    marginBottom: 4,
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
  acceptBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    minWidth: 96,
    alignItems: "center",
  },
  acceptBtnText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
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
  emptyInline: {
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    padding: 16,
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
  deliveryOutlineBtn: {
    marginTop: 10,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
  },
  deliveryOutlineBtnText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
});
