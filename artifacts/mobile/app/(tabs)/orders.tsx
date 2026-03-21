import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { ApiError, apiFetch } from "@/constants/api";
import { Order, ReceivedOrder, useApp } from "@/contexts/AppContext";

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
  restaurantLatitude?: number | null;
  restaurantLongitude?: number | null;
  clientName: string;
  deliveryAddress: string;
  broadcastRadiusKm?: number | null;
  broadcastEndsAt?: string | null;
  broadcastRemainingMinutes?: number | null;
  distanceKm?: number | null;
};

function OrderCard({
  order,
  onReportIssue,
  reporting,
}: {
  order: Order;
  onReportIssue: (order: Order) => void;
  reporting?: boolean;
}) {
  const config = STATUS_CONFIG[order.status];
  const deliveryConfig = order.delivery ? DELIVERY_STATUS_CONFIG[order.delivery.status] : null;
  const trackingSteps = [
    { key: "accepted", label: "Acceptée", done: ["accepted", "preparing", "ready", "delivered"].includes(order.status) },
    { key: "preparing", label: "Cuisine", done: ["preparing", "ready", "delivered"].includes(order.status) },
    { key: "delivery", label: order.delivery ? deliveryConfig?.label ?? "Livraison" : "Livraison", done: Boolean(order.delivery && ["accepted", "picked_up", "on_the_way", "delivered"].includes(order.delivery.status)) },
    { key: "delivered", label: "Livrée", done: order.status === "delivered" || order.delivery?.status === "delivered" },
  ];

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

      <View style={styles.orderOverviewCard}>
        <Text style={styles.orderOverviewTitle}>Vue d'ensemble de la course</Text>
        <View style={styles.orderOverviewSteps}>
          {trackingSteps.map((step, index) => (
            <React.Fragment key={step.key}>
              <View style={styles.orderOverviewStep}>
                <View style={[styles.orderOverviewDot, step.done && styles.orderOverviewDotDone]} />
                <Text style={[styles.orderOverviewStepText, step.done && styles.orderOverviewStepTextDone]} numberOfLines={1}>
                  {step.label}
                </Text>
              </View>
              {index < trackingSteps.length - 1 ? <View style={styles.orderOverviewLine} /> : null}
            </React.Fragment>
          ))}
        </View>
        <Text style={styles.orderOverviewMeta}>
          {order.delivery?.restaurantAddress || "Préparation chez la cuisinière"}
          {order.delivery?.deliveryAddress ? ` • ${order.delivery.deliveryAddress}` : ""}
        </Text>
      </View>

      <View style={styles.orderFooter}>
        <View>
          <Text style={styles.orderTotalLabel}>Total</Text>
          <Text style={styles.orderTotal}>{order.total.toLocaleString()} FCFA</Text>
        </View>
        <View style={styles.trailingActions}>
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
          <Pressable style={styles.issueBtn} onPress={() => onReportIssue(order)} disabled={reporting}>
            {reporting ? (
              <ActivityIndicator color={Colors.light.textSecondary} size="small" />
            ) : (
              <>
                <Feather name="alert-circle" size={14} color={Colors.light.textSecondary} />
                <Text style={styles.issueBtnText}>Signaler un problème</Text>
              </>
            )}
          </Pressable>
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
          {job.distanceKm != null || job.broadcastRadiusKm != null || job.broadcastRemainingMinutes != null ? (
            <Text style={[styles.orderMeta, { marginTop: 8 }]}> 
              {job.distanceKm != null ? `${job.distanceKm.toFixed(1)} km de vous` : "Zone en cours"}
              {job.broadcastRadiusKm != null ? ` · rayon ${job.broadcastRadiusKm} km` : ""}
              {job.broadcastRemainingMinutes != null ? ` · ${job.broadcastRemainingMinutes} min restantes` : ""}
            </Text>
          ) : null}
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

function ChefOrderCard({
  order,
  onAdvance,
  onRequestDelivery,
  onOpenDelivery,
  loadingAction,
}: {
  order: ReceivedOrder;
  onAdvance: (order: ReceivedOrder) => void;
  onRequestDelivery: (order: ReceivedOrder) => void;
  onOpenDelivery: (order: ReceivedOrder) => void;
  loadingAction: string | null;
}) {
  const config = STATUS_CONFIG[order.status];
  const deliveryConfig = order.delivery ? DELIVERY_STATUS_CONFIG[order.delivery.status] : null;

  const nextAction =
    order.status === "pending"
      ? { label: "Accepter", status: "accepted" as const }
      : order.status === "accepted"
        ? { label: "Lancer la préparation", status: "preparing" as const }
        : order.status === "preparing"
          ? { label: "Marquer prête", status: "ready" as const }
          : order.status === "ready" && !order.delivery
            ? { label: "Terminer la commande", status: "delivered" as const }
            : null;

  return (
    <View style={[styles.orderCard, order.status === "pending" && styles.priorityOrderCard]}>
      <View style={styles.orderTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.orderChef}>{order.clientName}</Text>
          <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</Text>
          {order.clientLocation ? <Text style={styles.orderMeta}>📍 {order.clientLocation}</Text> : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.color + "20" }]}>
          <Feather name={config.icon} size={11} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      {(order.occasion || order.persons || order.notes) ? (
        <View style={styles.briefCard}>
          {order.occasion ? <Text style={styles.briefText}>Occasion: <Text style={styles.briefStrong}>{order.occasion}</Text></Text> : null}
          {order.persons ? <Text style={styles.briefText}>Personnes: <Text style={styles.briefStrong}>{order.persons}</Text></Text> : null}
          {order.notes ? <Text style={styles.briefText}>Note: <Text style={styles.briefStrong}>{order.notes}</Text></Text> : null}
        </View>
      ) : null}

      <View style={styles.orderDivider} />

      <View style={styles.orderDishes}>
        {order.items.map((item, index) => (
          <View key={`${order.id}-${item.dishId ?? index}`} style={styles.orderDishRow}>
            <Text style={styles.orderDishQty}>{item.quantity}x</Text>
            <Text style={styles.orderDishName}>{item.dishName}</Text>
            <Text style={styles.orderDishPrice}>{(item.price * item.quantity).toLocaleString()} FCFA</Text>
          </View>
        ))}
      </View>

      <View style={styles.kitchenFooter}>
        <View>
          <Text style={styles.orderTotalLabel}>Total encaissé</Text>
          <Text style={styles.orderTotal}>{order.total.toLocaleString()} FCFA</Text>
        </View>
        <View style={styles.trailingActions}>
          {deliveryConfig ? (
            <View style={[styles.statusBadge, { backgroundColor: deliveryConfig.color + "20" }]}>
              <Text style={[styles.statusText, { color: deliveryConfig.color }]}>{deliveryConfig.label}</Text>
            </View>
          ) : null}

          {order.delivery ? (
            <Pressable style={styles.reorderBtn} onPress={() => onOpenDelivery(order)}>
              <Feather name="truck" size={14} color={Colors.light.tint} />
              <Text style={styles.reorderText}>Suivre la livraison</Text>
            </Pressable>
          ) : order.status === "ready" ? (
            <Pressable style={styles.secondaryActionBtn} onPress={() => onRequestDelivery(order)} disabled={loadingAction === `${order.id}:delivery`}>
              {loadingAction === `${order.id}:delivery` ? <ActivityIndicator color={Colors.light.tint} size="small" /> : <>
                <Feather name="truck" size={14} color={Colors.light.tint} />
                <Text style={styles.secondaryActionText}>Trouver un livreur</Text>
              </>}
            </Pressable>
          ) : null}

          {nextAction ? (
            <Pressable style={styles.acceptBtn} onPress={() => onAdvance(order)} disabled={loadingAction === `${order.id}:status`}>
              {loadingAction === `${order.id}:status` ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.acceptBtnText}>{nextAction.label}</Text>}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function OrdersScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const {
    orders,
    chefOrders,
    token,
    user,
    refreshOrders,
    fetchChefOrders,
    updateChefOrderStatus,
    requestDeliveryForOrder,
    isLoadingChefOrders,
  } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const isCourier = user?.type === "courier";
  const isChef = user?.type === "chef";
  const isDeliveryMode = params.mode === "delivery";
  const [availableJobs, setAvailableJobs] = useState<DeliveryJob[]>([]);
  const [currentJobs, setCurrentJobs] = useState<DeliveryJob[]>([]);
  const [loadingCourier, setLoadingCourier] = useState(false);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [chefActionKey, setChefActionKey] = useState<string | null>(null);
  const [reportingOrderId, setReportingOrderId] = useState<string | null>(null);
  const courierLocationSyncedAtRef = useRef(0);
  const alertedMissionIdsRef = useRef<Set<string>>(new Set());

  const syncCourierAvailabilityLocation = async () => {
    if (!token || !isCourier) {
      return;
    }

    const shouldSync = Date.now() - courierLocationSyncedAtRef.current > 30_000;
    if (!shouldSync) {
      return;
    }

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await apiFetch("/delivery/courier/location", {
        method: "POST",
        token,
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });

      courierLocationSyncedAtRef.current = Date.now();
    } catch (error) {
      console.warn("Failed to sync courier location:", error);
    }
  };

  const loadCourierJobs = async () => {
    if (!token) return;
    setLoadingCourier(true);
    try {
      await syncCourierAvailabilityLocation();

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
    if (!isCourier || loadingCourier || availableJobs.length === 0) {
      return;
    }

    const newJob = availableJobs.find((job) => !alertedMissionIdsRef.current.has(job.id));
    for (const job of availableJobs) {
      alertedMissionIdsRef.current.add(job.id);
    }

    if (!newJob) {
      return;
    }

    const proximityText = newJob.distanceKm != null
      ? `${newJob.distanceKm.toFixed(1)} km de votre position`
      : "dans votre zone actuelle";
    const windowText = newJob.broadcastRemainingMinutes != null
      ? `Visible encore ${newJob.broadcastRemainingMinutes} minutes.`
      : "";

    Alert.alert(
      "Nouvelle mission disponible",
      `${newJob.restaurantName} pour ${newJob.clientName} · ${proximityText}. ${windowText}`.trim(),
      [
        { text: "Plus tard", style: "cancel" },
        { text: "Voir", onPress: () => router.push({ pathname: "/delivery/job/[id]", params: { id: newJob.id } }) },
      ],
    );
  }, [availableJobs, isCourier, loadingCourier]);

  useFocusEffect(
    React.useCallback(() => {
      if (!token) {
        return undefined;
      }

      const runRefresh = () => {
        if (isCourier) {
          void loadCourierJobs();
          return;
        }
        if (isChef) {
          void fetchChefOrders();
          return;
        }
        void refreshOrders();
      };

      runRefresh();
      const interval = setInterval(runRefresh, isCourier ? 8000 : isChef ? 10000 : 12000);
      return () => clearInterval(interval);
    }, [token, isCourier, isChef, refreshOrders, fetchChefOrders])
  );

  const acceptJob = async (jobId: string) => {
    if (!token) return;
    setAcceptingJobId(jobId);
    try {
      await apiFetch(`/delivery/jobs/${jobId}/accept`, { method: "POST", token });
      await loadCourierJobs();
      router.push({ pathname: "/delivery/job/[id]", params: { id: jobId } });
    } catch (error) {
      if (error instanceof ApiError && ["NotFound", "Conflict"].includes(error.code ?? "")) {
        await loadCourierJobs();
      }
      console.warn("Failed to accept delivery job:", error);
    } finally {
      setAcceptingJobId(null);
    }
  };

  const chefSummary = useMemo(() => ({
    pending: chefOrders.filter((order) => order.status === "pending").length,
    active: chefOrders.filter((order) => ["accepted", "preparing"].includes(order.status)).length,
    ready: chefOrders.filter((order) => order.status === "ready").length,
    delivered: chefOrders.filter((order) => order.status === "delivered").length,
  }), [chefOrders]);

  const clientSummary = useMemo(() => ({
    active: orders.filter((order) => ["pending", "accepted", "preparing", "ready"].includes(order.status)).length,
    inDelivery: orders.filter((order) => order.delivery && ["accepted", "picked_up", "on_the_way"].includes(order.delivery.status)).length,
    delivered: orders.filter((order) => order.status === "delivered" || order.delivery?.status === "delivered").length,
    totalSpent: orders.reduce((sum, order) => sum + order.total, 0),
  }), [orders]);

  const priorityOrders = chefOrders.filter((order) => ["pending", "accepted", "preparing"].includes(order.status));
  const readyOrders = chefOrders.filter((order) => order.status === "ready");
  const archivedOrders = chefOrders.filter((order) => order.status === "delivered");

  const handleAdvanceChefOrder = async (order: ReceivedOrder) => {
    const nextStatus =
      order.status === "pending"
        ? "accepted"
        : order.status === "accepted"
          ? "preparing"
          : order.status === "preparing"
            ? "ready"
            : order.status === "ready"
              ? "delivered"
              : null;
    if (!nextStatus) return;
    setChefActionKey(`${order.id}:status`);
    try {
      await updateChefOrderStatus(order.id, nextStatus);
    } catch (error) {
      await fetchChefOrders();
      console.warn("Failed to advance chef order:", error);
    } finally {
      setChefActionKey(null);
    }
  };

  const handleRequestDelivery = async (order: ReceivedOrder) => {
    setChefActionKey(`${order.id}:delivery`);
    try {
      await requestDeliveryForOrder(order.id);
    } catch (error) {
      await fetchChefOrders();
      console.warn("Failed to request delivery:", error);
    } finally {
      setChefActionKey(null);
    }
  };

  const submitIssue = async (order: Order, reason: string) => {
    if (!token) {
      router.push("/auth/login");
      return;
    }

    setReportingOrderId(order.id);
    try {
      await apiFetch(`/orders/${order.id}/report-issue`, {
        method: "POST",
        token,
        body: JSON.stringify({ reason }),
      });
      Alert.alert("Signalement envoyé", "L'équipe concernée a été notifiée.");
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'envoyer le signalement pour le moment.");
    } finally {
      setReportingOrderId(null);
    }
  };

  const handleReportIssue = (order: Order) => {
    Alert.alert("Signaler un problème", "Choisissez le motif principal.", [
      { text: "Retard important", onPress: () => void submitIssue(order, "Retard important") },
      { text: "Commande incomplète", onPress: () => void submitIssue(order, "Commande incomplète") },
      { text: "Problème de livraison", onPress: () => void submitIssue(order, "Problème de livraison") },
      { text: "Annuler", style: "cancel" },
    ]);
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
            Les livreurs reçoivent les missions quand une commande est prête, acceptent la course
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
                <SectionHeader title="Mission en cours" subtitle="Priorité sur ce trajet avant de prendre une nouvelle course." />
                {currentJobs.map((job) => (
                  <DeliveryJobCard key={job.id} job={job} />
                ))}
              </>
            ) : null}

            <SectionHeader title={currentJobs.length > 0 ? "Nouvelles missions" : "Missions disponibles"} subtitle="N'acceptez que les courses que vous pouvez démarrer rapidement." />
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

  if (isChef) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}> 
        <View style={styles.header}>
          <Text style={styles.title}>Commandes reçues</Text>
          <Text style={styles.subtitle}>Pilotez la cuisine, puis déclenchez la livraison au bon moment.</Text>
        </View>

        {isLoadingChefOrders ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={Colors.light.tint} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{chefSummary.pending}</Text>
                <Text style={styles.summaryLabel}>À accepter</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{chefSummary.active}</Text>
                <Text style={styles.summaryLabel}>En cuisine</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{chefSummary.ready}</Text>
                <Text style={styles.summaryLabel}>Prêtes</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{chefSummary.delivered}</Text>
                <Text style={styles.summaryLabel}>Terminées</Text>
              </View>
            </View>

            {chefOrders.length === 0 ? (
              <View style={styles.emptyStateInline}>
                <View style={styles.emptyIcon}>
                  <Feather name="inbox" size={32} color={Colors.light.tabIconDefault} />
                </View>
                <Text style={styles.emptyTitle}>Aucune commande reçue</Text>
                <Text style={styles.emptyDesc}>Vos nouvelles commandes apparaîtront ici avec les prochaines actions à effectuer.</Text>
              </View>
            ) : (
              <>
                <SectionHeader title="À traiter maintenant" subtitle="Acceptez puis faites avancer les commandes les plus récentes." />
                {priorityOrders.length === 0 ? (
                  <View style={styles.emptyInline}>
                    <Text style={styles.emptyDesc}>Aucune commande urgente en ce moment.</Text>
                  </View>
                ) : priorityOrders.map((order) => (
                  <ChefOrderCard
                    key={order.id}
                    order={order}
                    onAdvance={handleAdvanceChefOrder}
                    onRequestDelivery={handleRequestDelivery}
                    onOpenDelivery={(value) => value.delivery && router.push({ pathname: "/delivery/job/[id]", params: { id: value.delivery.id } })}
                    loadingAction={chefActionKey}
                  />
                ))}

                <SectionHeader title="Prêtes à sortir" subtitle="Déclenchez un livreur ou clôturez la remise si la cliente récupère sur place." />
                {readyOrders.length === 0 ? (
                  <View style={styles.emptyInline}>
                    <Text style={styles.emptyDesc}>Aucune commande prête pour le moment.</Text>
                  </View>
                ) : readyOrders.map((order) => (
                  <ChefOrderCard
                    key={order.id}
                    order={order}
                    onAdvance={handleAdvanceChefOrder}
                    onRequestDelivery={handleRequestDelivery}
                    onOpenDelivery={(value) => value.delivery && router.push({ pathname: "/delivery/job/[id]", params: { id: value.delivery.id } })}
                    loadingAction={chefActionKey}
                  />
                ))}

                <SectionHeader title="Historique récent" subtitle="Gardez un œil sur les commandes finalisées pour vérifier le rythme du service." />
                {archivedOrders.length === 0 ? (
                  <View style={styles.emptyInline}>
                    <Text style={styles.emptyDesc}>Aucune commande finalisée pour l'instant.</Text>
                  </View>
                ) : archivedOrders.map((order) => (
                  <ChefOrderCard
                    key={order.id}
                    order={order}
                    onAdvance={handleAdvanceChefOrder}
                    onRequestDelivery={handleRequestDelivery}
                    onOpenDelivery={(value) => value.delivery && router.push({ pathname: "/delivery/job/[id]", params: { id: value.delivery.id } })}
                    loadingAction={chefActionKey}
                  />
                ))}
              </>
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
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{clientSummary.active}</Text>
              <Text style={styles.summaryLabel}>En préparation</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{clientSummary.inDelivery}</Text>
              <Text style={styles.summaryLabel}>En livraison</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{clientSummary.delivered}</Text>
              <Text style={styles.summaryLabel}>Livrées</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{Math.round(clientSummary.totalSpent / 1000)}k</Text>
              <Text style={styles.summaryLabel}>FCFA dépensés</Text>
            </View>
          </View>

          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onReportIssue={handleReportIssue} reporting={reportingOrderId === order.id} />
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
  sectionHeader: { gap: 4, marginTop: 8, marginBottom: 2 },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  list: { paddingHorizontal: 20, gap: 14, paddingTop: 4 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: {
    width: "47%",
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
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
  priorityOrderCard: {
    borderColor: "rgba(243, 156, 18, 0.38)",
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
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
  orderMeta: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
  },
  briefCard: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundSecondary,
    padding: 12,
    gap: 4,
  },
  briefText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  briefStrong: {
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
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
    alignItems: "flex-end",
    marginTop: 14,
    gap: 12,
  },
  kitchenFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 14,
    gap: 12,
  },
  trailingActions: {
    alignItems: "flex-end",
    gap: 8,
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
  issueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
    minHeight: 26,
  },
  issueBtnText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
  orderOverviewCard: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundSecondary,
    padding: 12,
    gap: 10,
  },
  orderOverviewTitle: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  orderOverviewSteps: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderOverviewStep: {
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  orderOverviewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.cardBorder,
  },
  orderOverviewDotDone: {
    backgroundColor: Colors.light.tint,
  },
  orderOverviewStepText: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textTertiary,
  },
  orderOverviewStepTextDone: {
    color: Colors.light.text,
  },
  orderOverviewLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.cardBorder,
    marginHorizontal: 6,
    marginBottom: 18,
  },
  orderOverviewMeta: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  secondaryActionText: {
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
  emptyStateInline: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
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