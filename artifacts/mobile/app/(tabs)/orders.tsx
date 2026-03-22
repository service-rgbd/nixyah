import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { resolveCommerceVisual } from "@/constants/commerce-catalog";
import { ApiError, apiFetch } from "@/constants/api";
import { CustomRequest, Order, ReceivedCustomRequest, ReceivedOrder, useApp } from "@/contexts/AppContext";

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

const CUSTOM_REQUEST_STATUS_CONFIG = {
  pending: { label: "À étudier", color: "#D97706" },
  quoted: { label: "Devis envoyé", color: "#2563EB" },
  accepted: { label: "Acceptée", color: "#059669" },
  rejected: { label: "Refusée", color: "#DC2626" },
  cancelled: { label: "Annulée", color: "#6B7280" },
};

type DeliveryJob = {
  id: string;
  orderId: string;
  orderTotal?: number | null;
  status: keyof typeof DELIVERY_STATUS_CONFIG;
  restaurantName: string;
  restaurantAddress: string;
  restaurantLatitude?: number | null;
  restaurantLongitude?: number | null;
  clientName: string;
  deliveryAddress: string;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  broadcastEtaMinutes?: number | null;
  broadcastRadiusKm?: number | null;
  broadcastEndsAt?: string | null;
  broadcastRemainingMinutes?: number | null;
  distanceKm?: number | null;
  createdAt?: string | null;
  acceptedAt?: string | null;
  deliveredAt?: string | null;
};

type CourierMissionFilter = "all" | "current" | "available" | "history";
type ClientOrderFilter = "all" | "meal" | "delivery" | "custom";

const COURIER_REFRESH_INTERVAL_MS = 15000;
const CHEF_REFRESH_INTERVAL_MS = 20000;
const CLIENT_REFRESH_INTERVAL_MS = 25000;

function formatDistanceLabel(distanceKm?: number | null) {
  if (distanceKm == null) {
    return "Distance indisponible";
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(1)} km`;
}

function getDistanceKm(
  origin?: { latitude?: number | null; longitude?: number | null } | null,
  destination?: { latitude?: number | null; longitude?: number | null } | null,
) {
  if (
    !origin ||
    !destination ||
    origin.latitude == null ||
    origin.longitude == null ||
    destination.latitude == null ||
    destination.longitude == null
  ) {
    return null;
  }

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(destination.latitude - origin.latitude);
  const dLon = toRadians(destination.longitude - origin.longitude);
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatEtaLabel(distanceKm?: number | null, speedKmPerHour = 24) {
  if (distanceKm == null) {
    return "ETA indisponible";
  }

  const minutes = Math.max(3, Math.round((distanceKm / speedKmPerHour) * 60));
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder > 0 ? `${hours} h ${remainder} min` : `${hours} h`;
  }

  return `${minutes} min`;
}

function getMissionRouteDistanceKm(job: DeliveryJob) {
  return getDistanceKm(
    { latitude: job.restaurantLatitude, longitude: job.restaurantLongitude },
    { latitude: job.deliveryLatitude, longitude: job.deliveryLongitude },
  );
}

function formatChefOrderMoment(value?: string | null) {
  if (!value) {
    return "Maintenant";
  }

  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClockLabel(value?: string | null) {
  if (!value) {
    return "--:--";
  }

  return new Date(value).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHistoryDayLabel(value?: string | null) {
  if (!value) {
    return "Récemment";
  }

  const date = new Date(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / 86400000);

  if (diffDays === 0) {
    return "Aujourd'hui";
  }

  if (diffDays === 1) {
    return "Hier";
  }

  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getMissionDate(job: DeliveryJob) {
  return job.deliveredAt ?? job.acceptedAt ?? job.createdAt ?? null;
}

function formatMissionAmount(job: DeliveryJob) {
  return `${Math.round(job.orderTotal ?? 0).toLocaleString("fr-FR")}F`;
}

function getClientOrderStatus(order: Order) {
  if (order.delivery?.status === "cancelled") {
    return { label: "Annulée", color: "#D45845" };
  }

  if (order.delivery?.status === "delivered" || order.status === "delivered") {
    return { label: "Terminée", color: Colors.light.textSecondary };
  }

  const config = STATUS_CONFIG[order.status];
  return { label: config.label, color: config.color };
}

function getCommerceUniverseLabel(order: Order) {
  if (order.commerceUniverse === "courses") {
    return "Course";
  }

  if (order.commerceUniverse === "supermarkets") {
    return "Supermarché";
  }

  if (order.commerceUniverse === "boutiques") {
    return "Boutique";
  }

  return "Commerce";
}

function getCommerceUniverseIcon(order: Order) {
  if (order.commerceUniverse === "courses") {
    return { name: "cart" as const, color: "#C4522A" };
  }

  if (order.commerceUniverse === "supermarkets") {
    return { name: "storefront" as const, color: "#0F766E" };
  }

  return { name: "gift" as const, color: "#8B5E3C" };
}

function getCommerceRepeatHref(order: Order) {
  if (order.commerceUniverse === "supermarkets") {
    return "/client/supermarkets" as const;
  }

  if (order.commerceUniverse === "boutiques") {
    return "/client/boutiques" as const;
  }

  return "/client/courses" as const;
}

function groupItemsByDay<T>(items: T[], getDate: (item: T) => string | null) {
  const sections = new Map<string, { title: string; items: T[] }>();

  for (const item of items) {
    const dateValue = getDate(item);
    const key = dateValue ? new Date(dateValue).toDateString() : "unknown";
    const existing = sections.get(key);

    if (existing) {
      existing.items.push(item);
      continue;
    }

    sections.set(key, {
      title: formatHistoryDayLabel(dateValue),
      items: [item],
    });
  }

  return Array.from(sections.values());
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

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
  const missionTime = formatClockLabel(getMissionDate(job));
  const pickupDistanceKm = job.distanceKm ?? null;
  const routeDistanceKm = getMissionRouteDistanceKm(job);
  const pickupEtaLabel = formatEtaLabel(pickupDistanceKm, 24);
  const routeEtaLabel = formatEtaLabel(routeDistanceKm, 26);
  const timeboxLabel = job.broadcastRemainingMinutes != null && job.broadcastRemainingMinutes > 0
    ? `Encore ${job.broadcastRemainingMinutes} min pour accepter`
    : job.status === "broadcasting" || job.status === "available"
      ? "Touchez pour voir la mission"
      : null;

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyCardTopRow}>
        <View style={styles.historyCardIconWrap}>
          <Feather name="package" size={18} color="#1F1A17" />
        </View>
        <View style={styles.historyCardMain}>
          <View style={styles.historyCardHeadlineRow}>
            <Text style={styles.historyCardTitle} numberOfLines={1}>{`Livraison, ${missionTime}`}</Text>
            <Text style={styles.historyCardAmount}>{formatMissionAmount(job)}</Text>
          </View>
          <Text style={[styles.historyCardMeta, job.status === "cancelled" && styles.historyDangerMeta]} numberOfLines={1}>
            {job.restaurantName} → {job.clientName}
          </Text>
          <Text style={styles.historyCardSubline} numberOfLines={1}>{job.restaurantAddress}</Text>
          <Text style={styles.historyCardSubline} numberOfLines={1}>{job.deliveryAddress}</Text>
        </View>
      </View>

      <View style={styles.missionMetricsRow}>
        <View style={styles.missionMetricCard}>
          <Text style={styles.missionMetricLabel}>Distance arrivée</Text>
          <Text style={styles.missionMetricValue}>{formatDistanceLabel(pickupDistanceKm)}</Text>
        </View>
        <View style={styles.missionMetricCard}>
          <Text style={styles.missionMetricLabel}>ETA arrivée</Text>
          <Text style={styles.missionMetricValue}>{pickupEtaLabel}</Text>
        </View>
        <View style={styles.missionMetricCard}>
          <Text style={styles.missionMetricLabel}>Trajet total</Text>
          <Text style={styles.missionMetricValue}>{formatDistanceLabel(routeDistanceKm)}</Text>
        </View>
      </View>

      <View style={styles.missionInfoBlock}>
        <View style={styles.missionInfoRow}>
          <Feather name="map-pin" size={14} color={Colors.light.textSecondary} />
          <Text style={styles.missionInfoText} numberOfLines={1}>{`Restaurant: ${job.restaurantAddress}`}</Text>
        </View>
        <View style={styles.missionInfoRow}>
          <Feather name="navigation" size={14} color={Colors.light.textSecondary} />
          <Text style={styles.missionInfoText} numberOfLines={1}>{`Livraison: ${job.deliveryAddress}`}</Text>
        </View>
        <View style={styles.missionInfoRow}>
          <Feather name="clock" size={14} color={Colors.light.textSecondary} />
          <Text style={styles.missionInfoText} numberOfLines={1}>{`Estimation course: ${routeEtaLabel}`}</Text>
        </View>
        {timeboxLabel ? (
          <View style={styles.missionNoticePill}>
            <Text style={styles.missionNoticeText}>{timeboxLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.historyBottomRow}>
        <View style={[styles.historyStatusPill, { backgroundColor: `${config.color}18` }]}> 
          <Text style={[styles.historyStatusText, { color: config.color }]}>{config.label}</Text>
        </View>

        <View style={styles.historyActionsRow}>
          <Pressable style={styles.historyGhostBtn} onPress={() => router.push({ pathname: "/delivery/job/[id]", params: { id: job.id } })}>
            <Feather name="eye" size={16} color="#1F1A17" />
            <Text style={styles.historyGhostBtnText}>Détails</Text>
          </Pressable>
          <Pressable style={styles.historyGhostBtn} onPress={() => router.push("/(tabs)/help")}> 
            <Feather name="headphones" size={16} color="#1F1A17" />
            <Text style={styles.historyGhostBtnText}>Aide</Text>
          </Pressable>
          {onAccept ? (
            <Pressable style={styles.historyGhostBtn} onPress={() => onAccept(job.id)} disabled={accepting}>
              {accepting ? <ActivityIndicator color="#1F1A17" size="small" /> : <>
                <Feather name="check-circle" size={16} color="#1F1A17" />
                <Text style={styles.historyGhostBtnText}>Accepter</Text>
              </>}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ClientHistoryCard({
  order,
  onReportIssue,
  onCancelOrder,
  cancelling,
  reporting,
}: {
  order: Order;
  onReportIssue: (order: Order) => void;
  onCancelOrder: (order: Order) => void;
  cancelling?: boolean;
  reporting?: boolean;
}) {
  const status = getClientOrderStatus(order);
  const orderTime = formatClockLabel(order.createdAt);
  const isCommerceOrder = order.kind === "commerce";
  const commerceUniverseLabel = getCommerceUniverseLabel(order);
  const commerceUniverseIcon = getCommerceUniverseIcon(order);
  const primaryAddress = order.delivery?.restaurantAddress || order.chefName;
  const secondaryAddress = order.delivery?.deliveryAddress;
  const shouldPromptReview = Boolean(order.canReview && (order.status === "delivered" || order.delivery?.status === "delivered"));
  const primaryDish = order.dishes[0]?.dish ?? null;
  const primaryDishImage = primaryDish?.imageUrls?.[0] ?? primaryDish?.imageUrl ?? null;
  const commerceImageSource = isCommerceOrder ? resolveCommerceVisual(primaryDish?.visualKey ?? order.merchantVisualKey ?? null, order.commerceUniverse ?? undefined) : null;
  const [cancelCountdown, setCancelCountdown] = useState(() => {
    if (!order.cancelAvailableUntil) {
      return 0;
    }

    return Math.max(0, Math.ceil((new Date(order.cancelAvailableUntil).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!order.cancelAvailableUntil) {
      setCancelCountdown(0);
      return undefined;
    }

    const updateCountdown = () => {
      setCancelCountdown(Math.max(0, Math.ceil((new Date(order.cancelAvailableUntil!).getTime() - Date.now()) / 1000)));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [order.cancelAvailableUntil]);

  const canCancel = order.status === "pending" && !order.delivery && cancelCountdown > 0;

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyCardTopRow}>
        {primaryDishImage ? (
          <Image source={{ uri: primaryDishImage }} style={styles.historyDishThumb} />
        ) : commerceImageSource ? (
          <Image source={commerceImageSource} style={styles.historyDishThumb} />
        ) : (
          <View style={[styles.historyCardIconWrap, order.delivery ? styles.historyDeliveryIconWrap : styles.historyMealIconWrap]}>
            <Ionicons name={order.delivery ? "cube" : isCommerceOrder ? commerceUniverseIcon.name : "restaurant"} size={18} color={order.delivery ? "#F24C1A" : isCommerceOrder ? commerceUniverseIcon.color : "#D4611A"} />
          </View>
        )}
        <View style={styles.historyCardMain}>
          <View style={styles.historyCardHeadlineRow}>
            <Text style={styles.historyCardTitle} numberOfLines={1}>{`${order.delivery ? "Livraison" : isCommerceOrder ? `${commerceUniverseLabel} · ${order.chefName}` : order.chefName}, ${orderTime}`}</Text>
            <Text style={styles.historyCardAmount}>{`${Math.round(order.totalWithDelivery ?? order.total).toLocaleString("fr-FR")}F`}</Text>
          </View>
          <Text style={[styles.historyCardMeta, status.label === "Annulée" && styles.historyDangerMeta]} numberOfLines={1}>
            {status.label === "Annulée" ? status.label : primaryAddress}
          </Text>
          {status.label !== "Annulée" && secondaryAddress ? (
            <Text style={styles.historyCardSubline} numberOfLines={1}>{`${primaryAddress} → ${secondaryAddress}`}</Text>
          ) : null}
          {primaryDish ? (
            <Text style={styles.historyCardDishLine} numberOfLines={1}>{isCommerceOrder ? `${primaryDish.name}${primaryDish.category ? ` · ${primaryDish.category}` : ""}` : primaryDish.name}</Text>
          ) : null}
          <Text style={styles.historyCardSubline} numberOfLines={1}>
            {order.freeDeliveryApplied
              ? "Livraison offerte"
              : `Livraison ${Math.round(order.deliveryFee ?? 0).toLocaleString("fr-FR")}F`}
          </Text>
        </View>
      </View>

      <View style={styles.historyBottomRow}>
        <View style={[styles.historyStatusPill, { backgroundColor: `${status.color}18` }]}> 
          <Text style={[styles.historyStatusText, { color: status.color }]}>{status.label}</Text>
        </View>
        <View style={styles.historyActionsRow}>
          {canCancel ? (
            <Pressable style={styles.historyGhostBtn} onPress={() => onCancelOrder(order)} disabled={cancelling}>
              {cancelling ? <ActivityIndicator color="#1F1A17" size="small" /> : <>
                <Feather name="x-circle" size={16} color="#1F1A17" />
                <Text style={styles.historyGhostBtnText}>{`Annuler (${cancelCountdown}s)`}</Text>
              </>}
            </Pressable>
          ) : null}
          <Pressable style={styles.historyGhostBtn} onPress={() => onReportIssue(order)} disabled={reporting}>
            {reporting ? <ActivityIndicator color="#1F1A17" size="small" /> : <>
              <Feather name="headphones" size={16} color="#1F1A17" />
              <Text style={styles.historyGhostBtnText}>{isCommerceOrder ? "Support" : "Aide"}</Text>
            </>}
          </Pressable>
          {shouldPromptReview ? (
            <Pressable style={styles.historyGhostBtn} onPress={() => router.push({ pathname: "/client/review/[orderId]", params: { orderId: order.id } })}>
              <Feather name="star" size={16} color="#1F1A17" />
              <Text style={styles.historyGhostBtnText}>Évaluer</Text>
            </Pressable>
          ) : order.delivery ? (
            <Pressable style={styles.historyGhostBtn} onPress={() => router.push({ pathname: "/delivery/job/[id]", params: { id: order.delivery!.id } })}>
              <Feather name="repeat" size={16} color="#1F1A17" />
              <Text style={styles.historyGhostBtnText}>{status.label === "Terminée" ? "Répéter" : "Suivre"}</Text>
            </Pressable>
          ) : isCommerceOrder ? (
            <Pressable style={styles.historyGhostBtn} onPress={() => router.push(getCommerceRepeatHref(order))}>
              <Feather name="repeat" size={16} color="#1F1A17" />
              <Text style={styles.historyGhostBtnText}>Revoir</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.historyGhostBtn} onPress={() => router.push({ pathname: "/chef/[id]", params: { id: order.chefId } })}>
              <Feather name="repeat" size={16} color="#1F1A17" />
              <Text style={styles.historyGhostBtnText}>Répéter</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function CustomRequestHistoryCard({ request }: { request: CustomRequest }) {
  const status = CUSTOM_REQUEST_STATUS_CONFIG[request.status];

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyCardTopRow}>
        <View style={[styles.historyCardIconWrap, styles.historyMealIconWrap]}>
          <Feather name="clipboard" size={18} color="#D4611A" />
        </View>
        <View style={styles.historyCardMain}>
          <View style={styles.historyCardHeadlineRow}>
            <Text style={styles.historyCardTitle} numberOfLines={1}>{request.packageName}</Text>
            <Text style={styles.historyCardAmount}>{`${Math.round(request.estimatedTotal).toLocaleString("fr-FR")}F`}</Text>
          </View>
          <Text style={styles.historyCardMeta} numberOfLines={1}>{request.chefName}</Text>
          <Text style={styles.historyCardSubline} numberOfLines={1}>{`${request.estimatedPersons} pers. · ${request.occasion || "Demande sur-mesure"}`}</Text>
        </View>
      </View>

      <View style={styles.historyBottomRow}>
        <View style={[styles.historyStatusPill, { backgroundColor: `${status.color}18` }]}> 
          <Text style={[styles.historyStatusText, { color: status.color }]}>{status.label}</Text>
        </View>
        <View style={styles.historyActionsRow}>
          {request.chefResponse ? (
            <View style={styles.historyGhostBtnStatic}>
              <Feather name="message-square" size={16} color="#1F1A17" />
              <Text style={styles.historyGhostBtnText}>Réponse reçue</Text>
            </View>
          ) : null}
          <Pressable style={styles.historyGhostBtn} onPress={() => router.push({ pathname: "/chat/[chatId]", params: { chatId: `chat-${request.chefId}`, chefId: request.chefId, chefName: request.chefName, chefSpecialty: "", coverColor: "#C4522A" } })}>
            <Feather name="message-circle" size={16} color="#1F1A17" />
            <Text style={styles.historyGhostBtnText}>Contacter</Text>
          </Pressable>
        </View>
      </View>

      {request.notes ? (
        <View style={styles.chefBriefCard}>
          <Text style={styles.chefBriefLabel}>Brief envoyé</Text>
          <Text style={styles.chefBriefText}>{request.notes}</Text>
        </View>
      ) : null}
      {request.chefResponse ? (
        <View style={styles.chefBriefCard}>
          <Text style={styles.chefBriefLabel}>Réponse de la cheffe</Text>
          <Text style={styles.chefBriefText}>{request.chefResponse}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ChefOrderCard({
  order,
  onAdvance,
  onRequestDelivery,
  onCancelDeliverySearch,
  onOpenDelivery,
  loadingAction,
}: {
  order: ReceivedOrder;
  onAdvance: (order: ReceivedOrder) => void;
  onRequestDelivery: (order: ReceivedOrder) => void;
  onCancelDeliverySearch: (order: ReceivedOrder) => void;
  onOpenDelivery: (order: ReceivedOrder) => void;
  loadingAction: string | null;
}) {
  const config = STATUS_CONFIG[order.status];
  const deliveryConfig = order.delivery ? DELIVERY_STATUS_CONFIG[order.delivery.status] : null;
  const iconName = order.delivery ? "bicycle-outline" : "restaurant-outline";
  const headlineMeta = [order.clientLocation, order.occasion, order.persons ? `${order.persons} pers.` : null]
    .filter(Boolean)
    .join(" · ");

  const nextAction =
    order.status === "pending"
      ? { label: "Accepter", status: "accepted" as const }
      : order.status === "accepted"
        ? { label: "Lancer la préparation", status: "preparing" as const }
        : order.status === "preparing"
          ? { label: "Marquer prête", status: "ready" as const }
          : null;
  const canRebroadcastDelivery = Boolean(
    order.delivery &&
    !order.delivery.courierUserId &&
    order.delivery.canRebroadcast,
  );
  const canCancelDeliverySearch = Boolean(
    order.delivery &&
    !order.delivery.courierUserId &&
    order.delivery.canCancelSearch,
  );
  const deliveryActionLabel = canRebroadcastDelivery ? "Relancer la recherche" : "Trouver un livreur";
  const showDeliveryAction = Boolean(
    order.status === "ready" && (!order.delivery || canRebroadcastDelivery),
  );
  const deliveryBanner = order.delivery
    ? order.delivery.courierUserId
      ? {
          icon: "check-circle" as const,
          title: "Livreur trouvé",
          message: "La mission est acceptée. Vous pouvez ouvrir le suivi pour voir l'avancement de la course.",
          tone: "success" as const,
        }
      : order.delivery.status === "cancelled"
        ? canRebroadcastDelivery
          ? {
              icon: "refresh-cw" as const,
              title: "Relance disponible",
              message: "La pause est terminée. Vous pouvez relancer la recherche de livreur dès maintenant.",
              tone: "warning" as const,
            }
          : {
              icon: "pause-circle" as const,
              title: "Recherche suspendue",
              message: order.delivery.broadcastRemainingMinutes != null && order.delivery.broadcastRemainingMinutes > 0
                ? `La recherche reste en pause pendant encore ${order.delivery.broadcastRemainingMinutes} minute(s) avant une nouvelle relance.`
                : "La recherche est temporairement suspendue.",
              tone: "warning" as const,
            }
      : canRebroadcastDelivery
        ? {
            icon: "refresh-cw" as const,
            title: "Recherche expirée",
            message: "Aucun livreur n'a accepté cette mission. Relancez la recherche pour notifier de nouveaux livreurs.",
            tone: "warning" as const,
          }
        : {
            icon: "radio" as const,
            title: "Recherche en cours",
            message: order.delivery.broadcastRemainingMinutes != null && order.delivery.broadcastRemainingMinutes > 0
              ? `La mission reste diffusée pendant encore ${order.delivery.broadcastRemainingMinutes} minute(s).`
              : "La mission est encore en diffusion auprès des livreurs disponibles.",
            tone: "info" as const,
          }
    : null;
  const deliveryBannerColors = deliveryBanner?.tone === "success"
    ? { backgroundColor: "rgba(15,118,110,0.10)", iconColor: "#0F766E", titleColor: "#0F766E" }
    : deliveryBanner?.tone === "warning"
      ? { backgroundColor: "rgba(217,119,6,0.12)", iconColor: "#B45309", titleColor: "#B45309" }
      : { backgroundColor: "rgba(37,99,235,0.10)", iconColor: "#2563EB", titleColor: "#2563EB" };

  return (
    <View style={[styles.chefCard, order.status === "pending" && styles.chefCardPriority]}>
      <View style={styles.chefCardTopRow}>
        <View style={styles.chefCardIdentityRow}>
          <View style={[styles.chefCardIconWrap, order.delivery ? styles.historyDeliveryIconWrap : styles.historyMealIconWrap]}>
            <Ionicons name={iconName} size={18} color={order.delivery ? "#F24C1A" : "#D4611A"} />
          </View>

          <View style={styles.chefCardMain}>
            <View style={styles.chefCardHeadlineRow}>
              <Text style={styles.chefCardTitle} numberOfLines={1}>{order.clientName}</Text>
              <Text style={styles.chefCardAmount}>{`${Math.round(order.total).toLocaleString("fr-FR")}F`}</Text>
            </View>

            <Text style={styles.chefCardDate}>{formatChefOrderMoment(order.createdAt)}</Text>
            {headlineMeta ? <Text style={styles.chefCardMeta}>{headlineMeta}</Text> : null}
          </View>
        </View>

        <View style={[styles.historyStatusPill, { backgroundColor: `${config.color}18` }]}> 
          <Text style={[styles.historyStatusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      <View style={styles.chefCardTagRow}>
        {order.occasion ? (
          <View style={styles.chefInfoChip}>
            <Text style={styles.chefInfoChipText}>{order.occasion}</Text>
          </View>
        ) : null}
        {order.persons ? (
          <View style={styles.chefInfoChip}>
            <Text style={styles.chefInfoChipText}>{`${order.persons} personnes`}</Text>
          </View>
        ) : null}
        {deliveryConfig ? (
          <View style={[styles.chefInfoChip, { backgroundColor: `${deliveryConfig.color}16` }]}> 
            <Text style={[styles.chefInfoChipText, { color: deliveryConfig.color }]}>{deliveryConfig.label}</Text>
          </View>
        ) : null}
      </View>

      {deliveryBanner ? (
        <View style={[styles.chefDeliveryBanner, { backgroundColor: deliveryBannerColors.backgroundColor }]}> 
          <View style={[styles.chefDeliveryBannerIconWrap, { backgroundColor: `${deliveryBannerColors.iconColor}18` }]}> 
            <Feather name={deliveryBanner.icon} size={16} color={deliveryBannerColors.iconColor} />
          </View>
          <View style={styles.chefDeliveryBannerBody}>
            <Text style={[styles.chefDeliveryBannerTitle, { color: deliveryBannerColors.titleColor }]}>{deliveryBanner.title}</Text>
            <Text style={styles.chefDeliveryBannerText}>{deliveryBanner.message}</Text>
          </View>
        </View>
      ) : null}

      {order.notes ? (
        <View style={styles.chefBriefCard}>
          <Text style={styles.chefBriefLabel}>Instruction</Text>
          <Text style={styles.chefBriefText}>{order.notes}</Text>
        </View>
      ) : null}

      <View style={styles.chefItemsCard}>
        {order.items.map((item, index) => (
          <View key={`${order.id}-${item.dishId ?? index}`} style={styles.chefItemRow}>
            <View style={styles.chefItemQuantityBadge}>
              <Text style={styles.chefItemQuantityText}>{item.quantity}x</Text>
            </View>
            <Text style={styles.chefItemName} numberOfLines={1}>{item.dishName}</Text>
            <Text style={styles.chefItemPrice}>{`${Math.round(item.price * item.quantity).toLocaleString("fr-FR")}F`}</Text>
          </View>
        ))}
      </View>

      <View style={styles.chefCardFooter}>
        <View style={styles.chefCardFooterMeta}>
          <Text style={styles.orderTotalLabel}>Total encaissé</Text>
          <Text style={styles.orderTotal}>{order.total.toLocaleString()} FCFA</Text>
        </View>

        <View style={styles.chefActionsRow}>
          {order.delivery ? (
            <Pressable style={styles.historyGhostBtn} onPress={() => onOpenDelivery(order)}>
              <Feather name="truck" size={16} color="#1F1A17" />
              <Text style={styles.historyGhostBtnText}>Suivre</Text>
            </Pressable>
          ) : null}

          {showDeliveryAction ? (
            <Pressable style={styles.historyGhostBtn} onPress={() => onRequestDelivery(order)} disabled={loadingAction === `${order.id}:delivery`}>
              {loadingAction === `${order.id}:delivery` ? <ActivityIndicator color="#1F1A17" size="small" /> : <>
                <Feather name="truck" size={16} color="#1F1A17" />
                <Text style={styles.historyGhostBtnText}>{deliveryActionLabel}</Text>
              </>}
            </Pressable>
          ) : null}

          {canCancelDeliverySearch ? (
            <Pressable style={styles.historyGhostBtn} onPress={() => onCancelDeliverySearch(order)} disabled={loadingAction === `${order.id}:delivery-cancel`}>
              {loadingAction === `${order.id}:delivery-cancel` ? <ActivityIndicator color="#1F1A17" size="small" /> : <>
                <Feather name="pause-circle" size={16} color="#1F1A17" />
                <Text style={styles.historyGhostBtnText}>Suspendre</Text>
              </>}
            </Pressable>
          ) : null}

          {nextAction ? (
            <Pressable style={styles.chefPrimaryActionBtn} onPress={() => onAdvance(order)} disabled={loadingAction === `${order.id}:status`}>
              {loadingAction === `${order.id}:status` ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.chefPrimaryActionText}>{nextAction.label}</Text>}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ChefCustomRequestCard({ request }: { request: ReceivedCustomRequest }) {
  const status = CUSTOM_REQUEST_STATUS_CONFIG[request.status];

  return (
    <View style={styles.chefCard}>
      <View style={styles.chefCardTopRow}>
        <View style={styles.chefCardIdentityRow}>
          <View style={[styles.chefCardIconWrap, styles.historyMealIconWrap]}>
            <Feather name="clipboard" size={18} color="#D4611A" />
          </View>
          <View style={styles.chefCardMain}>
            <View style={styles.chefCardHeadlineRow}>
              <Text style={styles.chefCardTitle} numberOfLines={1}>{request.clientName}</Text>
              <Text style={styles.chefCardAmount}>{`${Math.round(request.estimatedTotal).toLocaleString("fr-FR")}F`}</Text>
            </View>
            <Text style={styles.chefCardDate}>{formatChefOrderMoment(request.createdAt)}</Text>
            <Text style={styles.chefCardMeta}>{`${request.packageName} · ${request.estimatedPersons} pers.`}</Text>
          </View>
        </View>

        <View style={[styles.historyStatusPill, { backgroundColor: `${status.color}18` }]}> 
          <Text style={[styles.historyStatusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.chefCardTagRow}>
        {request.occasion ? <View style={styles.chefInfoChip}><Text style={styles.chefInfoChipText}>{request.occasion}</Text></View> : null}
        {request.budget ? <View style={styles.chefInfoChip}><Text style={styles.chefInfoChipText}>{request.budget}</Text></View> : null}
      </View>

      <View style={styles.chefBriefCard}>
        <Text style={styles.chefBriefLabel}>Brief client</Text>
        <Text style={styles.chefBriefText}>{request.notes || "Aucun détail complémentaire."}</Text>
      </View>

      {request.preferences.length > 0 ? (
        <View style={styles.chefItemsCard}>
          <Text style={styles.chefBriefLabel}>Préférences</Text>
          <Text style={styles.chefBriefText}>{request.preferences.join(" • ")}</Text>
        </View>
      ) : null}

      {request.chefResponse ? (
        <View style={styles.chefBriefCard}>
          <Text style={styles.chefBriefLabel}>Réponse envoyée</Text>
          <Text style={styles.chefBriefText}>{request.chefResponse}</Text>
        </View>
      ) : null}
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
    customRequests,
    chefOrders,
    chefCustomRequests,
    token,
    user,
    refreshOrders,
    fetchCustomRequests,
    fetchChefOrders,
    fetchChefCustomRequests,
    updateChefOrderStatus,
    requestDeliveryForOrder,
    cancelDeliverySearchForOrder,
    isLoadingChefOrders,
  } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const isCourier = user?.type === "courier";
  const isChef = user?.type === "chef";
  const isDeliveryMode = params.mode === "delivery";
  const [availableJobs, setAvailableJobs] = useState<DeliveryJob[]>([]);
  const [currentJobs, setCurrentJobs] = useState<DeliveryJob[]>([]);
  const [historyJobs, setHistoryJobs] = useState<DeliveryJob[]>([]);
  const [loadingCourier, setLoadingCourier] = useState(false);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [chefActionKey, setChefActionKey] = useState<string | null>(null);
  const [reportingOrderId, setReportingOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [courierLoadNotice, setCourierLoadNotice] = useState<string | null>(null);
  const [courierFilter, setCourierFilter] = useState<CourierMissionFilter>("all");
  const [clientFilter, setClientFilter] = useState<ClientOrderFilter>("all");
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

      const [availableResult, currentResult, historyResult] = await Promise.allSettled([
        apiFetch<{ jobs: DeliveryJob[] }>("/delivery/jobs/available", { token }),
        apiFetch<{ jobs: DeliveryJob[] }>("/delivery/jobs/current", { token }),
        apiFetch<{ jobs: DeliveryJob[] }>("/delivery/jobs/history", { token }),
      ]);

      setAvailableJobs(availableResult.status === "fulfilled" ? (availableResult.value.jobs ?? []) : []);
      setCurrentJobs(currentResult.status === "fulfilled" ? (currentResult.value.jobs ?? []) : []);
      setHistoryJobs(historyResult.status === "fulfilled" ? (historyResult.value.jobs ?? []) : []);

      if (historyResult.status === "rejected") {
        setCourierLoadNotice("L'historique des missions n'est pas encore disponible sur ce backend déployé. Les missions en cours et disponibles restent visibles.");
      } else if (availableResult.status === "rejected" || currentResult.status === "rejected") {
        setCourierLoadNotice("Certaines missions n'ont pas pu être chargées. Réessayez dans quelques secondes.");
      } else {
        setCourierLoadNotice(null);
      }
    } catch (error) {
      setCourierLoadNotice("Impossible de charger les missions pour le moment.");
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
          void fetchChefCustomRequests();
          return;
        }
        void refreshOrders();
        void fetchCustomRequests();
      };

      runRefresh();
      const interval = setInterval(
        runRefresh,
        isCourier ? COURIER_REFRESH_INTERVAL_MS : isChef ? CHEF_REFRESH_INTERVAL_MS : CLIENT_REFRESH_INTERVAL_MS,
      );
      return () => clearInterval(interval);
    }, [token, isCourier, isChef, refreshOrders, fetchCustomRequests, fetchChefOrders, fetchChefCustomRequests])
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
    custom: chefCustomRequests.filter((request) => request.status === "pending").length,
    delivered: chefOrders.filter((order) => order.status === "delivered").length,
  }), [chefCustomRequests, chefOrders]);

  const clientSummary = useMemo(() => ({
    active: orders.filter((order) => ["pending", "accepted", "preparing", "ready"].includes(order.status)).length,
    inDelivery: orders.filter((order) => order.delivery && ["accepted", "picked_up", "on_the_way"].includes(order.delivery.status)).length,
    delivered: orders.filter((order) => order.status === "delivered" || order.delivery?.status === "delivered").length,
    custom: customRequests.length,
    totalSpent: orders.reduce((sum, order) => sum + Number(order.totalWithDelivery ?? order.total), 0),
  }), [customRequests.length, orders]);

  const priorityOrders = chefOrders.filter((order) => ["pending", "accepted", "preparing"].includes(order.status));
  const readyOrders = chefOrders.filter((order) => order.status === "ready");
  const archivedOrders = chefOrders.filter((order) => order.status === "delivered");
  const pendingCustomRequests = chefCustomRequests.filter((request) => ["pending", "quoted"].includes(request.status));
  const archivedCustomRequests = chefCustomRequests.filter((request) => ["accepted", "rejected", "cancelled"].includes(request.status));
  const filteredClientOrders = useMemo(() => {
    if (clientFilter === "custom") {
      return [];
    }
    if (clientFilter === "all") {
      return orders;
    }

    if (clientFilter === "delivery") {
      return orders.filter((order) => Boolean(order.delivery));
    }

    return orders.filter((order) => !order.delivery);
  }, [clientFilter, orders]);
  const clientOrderSections = useMemo(
    () => groupItemsByDay(filteredClientOrders, (order) => order.createdAt),
    [filteredClientOrders],
  );
  const filteredCustomRequests = useMemo(() => clientFilter === "all" || clientFilter === "custom" ? customRequests : [], [clientFilter, customRequests]);
  const clientCustomRequestSections = useMemo(
    () => groupItemsByDay(filteredCustomRequests, (request) => request.createdAt),
    [filteredCustomRequests],
  );
  const filteredCurrentJobs = useMemo(
    () => courierFilter === "available" || courierFilter === "history" ? [] : currentJobs,
    [courierFilter, currentJobs],
  );
  const filteredAvailableJobs = useMemo(
    () => courierFilter === "current" || courierFilter === "history" ? [] : availableJobs,
    [availableJobs, courierFilter],
  );
  const filteredHistoryJobs = useMemo(
    () => courierFilter === "current" || courierFilter === "available" ? [] : historyJobs,
    [courierFilter, historyJobs],
  );
  const historySections = useMemo(
    () => groupItemsByDay(filteredHistoryJobs, (job) => getMissionDate(job)),
    [filteredHistoryJobs],
  );
  const chefSections = useMemo(
    () => [
      {
        key: "priority",
        title: "À traiter maintenant",
        subtitle: "Acceptez puis faites avancer les commandes les plus récentes.",
        items: priorityOrders,
        empty: "Aucune commande urgente en ce moment.",
      },
      {
        key: "ready",
        title: "Prêtes à sortir",
        subtitle: "Déclenchez la recherche d'un livreur puis suivez la prise en charge jusqu'à la livraison.",
        items: readyOrders,
        empty: "Aucune commande prête pour le moment.",
      },
      {
        key: "custom",
        title: "Demandes sur-mesure",
        subtitle: "Ces briefs sont séparés des commandes classiques et restent à traiter comme demandes personnalisées.",
        items: pendingCustomRequests,
        empty: "Aucune demande sur-mesure active.",
      },
      {
        key: "history",
        title: "Historique récent",
        subtitle: "Gardez un œil sur les commandes finalisées pour vérifier le rythme du service.",
        items: archivedOrders,
        empty: "Aucune commande finalisée pour l'instant.",
      },
      {
        key: "custom-history",
        title: "Demandes clôturées",
        subtitle: "Archive des demandes personnalisées déjà traitées.",
        items: archivedCustomRequests,
        empty: "Aucune demande sur-mesure clôturée.",
      },
    ],
    [archivedCustomRequests, archivedOrders, pendingCustomRequests, priorityOrders, readyOrders],
  );

  const handleAdvanceChefOrder = async (order: ReceivedOrder) => {
    const nextStatus =
      order.status === "pending"
        ? "accepted"
        : order.status === "accepted"
          ? "preparing"
          : order.status === "preparing"
            ? "ready"
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

  const handleCancelDeliverySearch = async (order: ReceivedOrder) => {
    if (!order.delivery) {
      return;
    }

    setChefActionKey(`${order.id}:delivery-cancel`);
    try {
      await cancelDeliverySearchForOrder(order.delivery.id);
    } catch (error) {
      await fetchChefOrders();
      console.warn("Failed to cancel delivery search:", error);
    } finally {
      setChefActionKey(null);
    }
  };

  const submitIssue = async (order: Order, payload: { reason: string; target: "chef" | "courier" | "platform"; category: string }) => {
    if (!token) {
      router.push("/auth/login");
      return;
    }

    setReportingOrderId(order.id);
    try {
      await apiFetch(`/orders/${order.id}/report-issue`, {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      Alert.alert("Signalement envoyé", "L'équipe concernée a été notifiée.");
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'envoyer le signalement pour le moment.");
    } finally {
      setReportingOrderId(null);
    }
  };

  const handleReportIssue = (order: Order) => {
    if (order.kind === "commerce") {
      router.push("/(tabs)/help");
      return;
    }

    Alert.alert("Signaler un problème", "Choisissez le motif principal.", [
      { text: "Retard du livreur", onPress: () => void submitIssue(order, { reason: "Retard du livreur", target: "courier", category: "delay" }) },
      { text: "Commande incomplète", onPress: () => void submitIssue(order, { reason: "Commande incomplète", target: "chef", category: "missing_items" }) },
      { text: "Qualité / hygiène", onPress: () => void submitIssue(order, { reason: "Qualité / hygiène", target: "chef", category: "hygiene" }) },
      { text: "Comportement livreur", onPress: () => void submitIssue(order, { reason: "Comportement livreur", target: "courier", category: "rude_behavior" }) },
      { text: "Facturation", onPress: () => void submitIssue(order, { reason: "Facturation", target: "platform", category: "billing" }) },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const handleCancelOrder = (order: Order) => {
    Alert.alert("Annuler la commande", "Cette annulation est uniquement possible dans les 10 secondes après validation.", [
      { text: "Retour", style: "cancel" },
      {
        text: "Annuler la commande",
        style: "destructive",
        onPress: async () => {
          if (!token) {
            return;
          }

          setCancellingOrderId(order.id);
          try {
            await apiFetch(`/orders/${order.id}/cancel`, { method: "POST", token });
            await refreshOrders();
            Alert.alert("Commande annulée", "La commande a été annulée avant son traitement en cuisine.");
          } catch (error: any) {
            Alert.alert("Annulation impossible", error?.message ?? "Cette commande ne peut plus être annulée.");
            await refreshOrders();
          } finally {
            setCancellingOrderId(null);
          }
        },
      },
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
      <View style={[styles.courierHistoryScreen, { paddingTop: topInset }]}> 
        <View style={styles.historyHeader}>
          <Text style={styles.historyScreenTitle}>Mes courses et commandes</Text>
          <Text style={styles.historyScreenSubtitle}>{currentJobs.length} en cours · {availableJobs.length} disponibles · {historyJobs.length} archivées</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCardSoft}>
              <Text style={styles.summaryValue}>{currentJobs.length}</Text>
              <Text style={styles.summaryLabel}>En cours</Text>
            </View>
            <View style={styles.summaryCardSoft}>
              <Text style={styles.summaryValue}>{availableJobs.length}</Text>
              <Text style={styles.summaryLabel}>À accepter</Text>
            </View>
            <View style={styles.summaryCardSoft}>
              <Text style={styles.summaryValue}>{historyJobs.length}</Text>
              <Text style={styles.summaryLabel}>Historique</Text>
            </View>
            <View style={styles.summaryCardSoft}>
              <Text style={styles.summaryValue}>{currentJobs.length + availableJobs.length + historyJobs.length}</Text>
              <Text style={styles.summaryLabel}>Total missions</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <FilterChip label="Tout" active={courierFilter === "all"} onPress={() => setCourierFilter("all")} />
            <FilterChip label="En cours" active={courierFilter === "current"} onPress={() => setCourierFilter("current")} />
            <FilterChip label="Disponibles" active={courierFilter === "available"} onPress={() => setCourierFilter("available")} />
            <FilterChip label="Historique" active={courierFilter === "history"} onPress={() => setCourierFilter("history")} />
          </ScrollView>
          {courierLoadNotice ? (
            <View style={styles.inlineNoticeCard}>
              <Text style={styles.inlineNoticeText}>{courierLoadNotice}</Text>
            </View>
          ) : null}
        </View>

        {loadingCourier ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={Colors.light.tint} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.historyList, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]} showsVerticalScrollIndicator={false}>
            {filteredCurrentJobs.length > 0 ? (
              <>
                <Text style={styles.daySectionTitle}>Mission en cours</Text>
                {filteredCurrentJobs.map((job) => (
                  <DeliveryJobCard key={job.id} job={job} />
                ))}
              </>
            ) : null}

            {filteredAvailableJobs.length > 0 ? <Text style={styles.daySectionTitle}>{filteredCurrentJobs.length > 0 ? "Nouvelles missions" : "Missions disponibles"}</Text> : null}
            {filteredAvailableJobs.map((job) => (
                <DeliveryJobCard key={job.id} job={job} onAccept={acceptJob} accepting={acceptingJobId === job.id} />
            ))}

            {historySections.map((section) => (
              <View key={section.title} style={styles.daySectionBlock}>
                <Text style={styles.daySectionTitle}>{section.title}</Text>
                {section.items.map((job) => (
                  <DeliveryJobCard key={job.id} job={job} />
                ))}
              </View>
            ))}

            {filteredCurrentJobs.length === 0 && filteredAvailableJobs.length === 0 && historySections.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyDesc}>Aucune mission à afficher pour ce filtre.</Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    );
  }

  if (isChef) {
    return (
      <View style={[styles.courierHistoryScreen, { paddingTop: topInset }]}> 
        <View style={styles.historyHeader}>
          <Text style={styles.historyScreenTitle}>Commandes reçues</Text>
          <Text style={styles.historyScreenSubtitle}>Pilotez la cuisine, déclenchez la livraison au bon moment et gardez une vue nette sur votre service.</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCardSoft}>
              <Text style={styles.summaryValue}>{chefSummary.pending}</Text>
              <Text style={styles.summaryLabel}>À accepter</Text>
            </View>
            <View style={styles.summaryCardSoft}>
              <Text style={styles.summaryValue}>{chefSummary.active}</Text>
              <Text style={styles.summaryLabel}>En cuisine</Text>
            </View>
            <View style={styles.summaryCardSoft}>
              <Text style={styles.summaryValue}>{chefSummary.ready}</Text>
              <Text style={styles.summaryLabel}>Prêtes</Text>
            </View>
            <View style={styles.summaryCardSoft}>
              <Text style={styles.summaryValue}>{chefSummary.custom}</Text>
              <Text style={styles.summaryLabel}>Sur-mesure</Text>
            </View>
          </View>
        </View>

        {isLoadingChefOrders ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={Colors.light.tint} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.historyList, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]} showsVerticalScrollIndicator={false}>
            {chefOrders.length === 0 ? (
              <View style={styles.emptyStateInline}>
                <View style={styles.emptyIcon}>
                  <Feather name="inbox" size={32} color={Colors.light.tabIconDefault} />
                </View>
                <Text style={styles.emptyTitle}>Aucune commande reçue</Text>
                <Text style={styles.emptyDesc}>Vos nouvelles commandes apparaîtront ici avec les prochaines actions à effectuer.</Text>
              </View>
            ) : (
              chefSections.map((section) => (
                <View key={section.key} style={styles.daySectionBlock}>
                  <SectionHeader title={section.title} subtitle={section.subtitle} />
                  {section.items.length === 0 ? (
                    <View style={styles.emptyInline}>
                      <Text style={styles.emptyDesc}>{section.empty}</Text>
                    </View>
                  ) : section.key.startsWith("custom")
                    ? section.items.map((request) => (
                        <ChefCustomRequestCard key={request.id} request={request as ReceivedCustomRequest} />
                      ))
                    : section.items.map((order) => (
                        <ChefOrderCard
                          key={(order as ReceivedOrder).id}
                          order={order as ReceivedOrder}
                          onAdvance={handleAdvanceChefOrder}
                          onRequestDelivery={handleRequestDelivery}
                          onCancelDeliverySearch={handleCancelDeliverySearch}
                          onOpenDelivery={(value) => value.delivery && router.push({ pathname: "/delivery/job/[id]", params: { id: value.delivery.id } })}
                          loadingAction={chefActionKey}
                        />
                      ))}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.courierHistoryScreen, { paddingTop: topInset }]}> 
      <View style={styles.historyHeader}>
        <Text style={styles.historyScreenTitle}>Mes courses et commandes</Text>
        <Text style={styles.historyScreenSubtitle}>{orders.length} commande{orders.length !== 1 ? "s" : ""} · {customRequests.length} demande{customRequests.length !== 1 ? "s" : ""} sur-mesure</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <FilterChip label="Tout" active={clientFilter === "all"} onPress={() => setClientFilter("all")} />
          <FilterChip label="Repas" active={clientFilter === "meal"} onPress={() => setClientFilter("meal")} />
          <FilterChip label="Livraison" active={clientFilter === "delivery"} onPress={() => setClientFilter("delivery")} />
          <FilterChip label="Sur-mesure" active={clientFilter === "custom"} onPress={() => setClientFilter("custom")} />
        </ScrollView>
      </View>

      {filteredClientOrders.length === 0 && filteredCustomRequests.length === 0 ? (
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
          contentContainerStyle={[styles.historyList, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCardSoft}>
              <Text style={styles.summaryValue}>{clientSummary.active}</Text>
              <Text style={styles.summaryLabel}>En cours</Text>
            </View>
            <View style={styles.summaryCardSoft}>
              <Text style={styles.summaryValue}>{clientSummary.inDelivery}</Text>
              <Text style={styles.summaryLabel}>En livraison</Text>
            </View>
            <View style={styles.summaryCardSoft}>
              <Text style={styles.summaryValue}>{clientSummary.delivered}</Text>
              <Text style={styles.summaryLabel}>Livrées</Text>
            </View>
            <View style={styles.summaryCardSoft}>
              <Text style={styles.summaryValue}>{clientSummary.custom}</Text>
              <Text style={styles.summaryLabel}>Sur-mesure</Text>
            </View>
          </View>

          {clientOrderSections.map((section) => (
            <View key={section.title} style={styles.daySectionBlock}>
              <Text style={styles.daySectionTitle}>{section.title}</Text>
              {section.items.map((order) => (
                <ClientHistoryCard key={order.id} order={order} onReportIssue={handleReportIssue} onCancelOrder={handleCancelOrder} cancelling={cancellingOrderId === order.id} reporting={reportingOrderId === order.id} />
              ))}
            </View>
          ))}

          {clientCustomRequestSections.map((section) => (
            <View key={`custom-${section.title}`} style={styles.daySectionBlock}>
              <Text style={styles.daySectionTitle}>{`${section.title} · sur-mesure`}</Text>
              {section.items.map((request) => (
                <CustomRequestHistoryCard key={request.id} request={request} />
              ))}
            </View>
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
  courierHistoryScreen: {
    flex: 1,
    backgroundColor: "#FCFBF9",
  },
  historyHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 14,
  },
  historyScreenTitle: {
    fontSize: 28,
    lineHeight: 33,
    fontFamily: "Poppins_700Bold",
    color: "#211B17",
  },
  historyScreenSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Poppins_400Regular",
    color: "#7C7068",
  },
  filterRow: {
    gap: 10,
    paddingRight: 20,
  },
  filterChip: {
    borderRadius: 999,
    backgroundColor: "#F2EFEC",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  filterChipActive: {
    backgroundColor: "#2D2723",
  },
  filterChipText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#2D2723",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  historyList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  daySectionBlock: {
    gap: 12,
  },
  daySectionTitle: {
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    color: "#8C827B",
  },
  historyCard: {
    borderRadius: 24,
    backgroundColor: "#F5F2EE",
    padding: 14,
    gap: 14,
  },
  historyCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  historyCardIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF8F2",
  },
  historyDishThumb: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#FFF8F2",
  },
  historyDeliveryIconWrap: {
    backgroundColor: "#FFF2ED",
  },
  historyMealIconWrap: {
    backgroundColor: "#FFF7E8",
  },
  historyCardMain: {
    flex: 1,
    minWidth: 0,
  },
  historyCardHeadlineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  historyCardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 21,
    fontFamily: "Poppins_600SemiBold",
    color: "#1F1A17",
  },
  historyCardAmount: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: "#1F1A17",
  },
  historyCardMeta: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: "#7B7068",
  },
  historyDangerMeta: {
    color: "#D45845",
  },
  historyCardSubline: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: "#91857D",
  },
  missionMetricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  missionMetricCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#EBE7E3",
    paddingHorizontal: 10,
    paddingVertical: 11,
    gap: 4,
  },
  missionMetricLabel: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: "#8C827B",
  },
  missionMetricValue: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: "#1F1A17",
  },
  missionInfoBlock: {
    borderRadius: 18,
    backgroundColor: "#FFFCF8",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 9,
    borderWidth: 1,
    borderColor: "rgba(124,112,104,0.10)",
  },
  missionInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  missionInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Poppins_400Regular",
    color: "#5F5650",
  },
  missionNoticePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(217,119,6,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  missionNoticeText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#B45309",
  },
  historyCardDishLine: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Poppins_500Medium",
    color: "#4D443F",
  },
  historyBottomRow: {
    gap: 12,
  },
  historyStatusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  historyStatusText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
  },
  historyActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  historyGhostBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#EBE7E3",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 12,
  },
  historyGhostBtnStatic: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#F3EDE6",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 12,
  },
  historyGhostBtnText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: "#1F1A17",
  },
  inlineNoticeCard: {
    borderRadius: 18,
    backgroundColor: "#F5EEE6",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inlineNoticeText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_500Medium",
    color: "#7C5A2D",
  },
  chefCard: {
    borderRadius: 24,
    backgroundColor: "#F5F2EE",
    padding: 14,
    gap: 14,
  },
  chefCardPriority: {
    borderWidth: 1,
    borderColor: "rgba(243, 156, 18, 0.24)",
  },
  chefCardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  chefCardIdentityRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chefCardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  chefCardMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  chefCardHeadlineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  chefCardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Poppins_600SemiBold",
    color: "#1F1A17",
  },
  chefCardAmount: {
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: "#1F1A17",
  },
  chefCardDate: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: "#6E625B",
  },
  chefCardMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: "#8A7D75",
  },
  chefCardTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chefInfoChip: {
    borderRadius: 999,
    backgroundColor: "#ECE7E2",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chefInfoChipText: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: "#5E544E",
  },
  chefBriefCard: {
    borderRadius: 18,
    backgroundColor: "#ECE7E2",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  chefDeliveryBanner: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  chefDeliveryBannerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  chefDeliveryBannerBody: {
    flex: 1,
    gap: 3,
  },
  chefDeliveryBannerTitle: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
  },
  chefDeliveryBannerText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: "#5E544E",
  },
  chefBriefLabel: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#8A7D75",
    textTransform: "uppercase",
  },
  chefBriefText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Poppins_400Regular",
    color: "#2D2723",
  },
  chefItemsCard: {
    borderRadius: 20,
    backgroundColor: "#FFFDFC",
    padding: 12,
    gap: 10,
  },
  chefItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chefItemQuantityBadge: {
    minWidth: 38,
    borderRadius: 12,
    backgroundColor: "#FFF2E8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  chefItemQuantityText: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: "#D4611A",
  },
  chefItemName: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: "#1F1A17",
  },
  chefItemPrice: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "#6E625B",
  },
  chefCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  chefCardFooterMeta: {
    flexShrink: 1,
  },
  chefActionsRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  chefPrimaryActionBtn: {
    minHeight: 56,
    minWidth: 122,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  chefPrimaryActionText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: "#FFFFFF",
  },
  summaryCardSoft: {
    width: "47%",
    backgroundColor: "#F5F2EE",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 4,
  },
});