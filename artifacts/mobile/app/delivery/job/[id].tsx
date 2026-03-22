import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, type LatLng, type Region } from "react-native-maps";
import Colors from "@/constants/colors";
import { apiFetch } from "@/constants/api";
import { saveDeliveryAddress } from "@/constants/delivery-address";
import { useApp } from "@/contexts/AppContext";
import { ApiError } from "@/constants/api";

type DeliveryJobDetail = {
  id: string;
  orderId: string;
  status: "broadcasting" | "available" | "accepted" | "picked_up" | "on_the_way" | "delivered" | "cancelled";
  restaurantName: string;
  restaurantAddress: string;
  restaurantLatitude?: number | null;
  restaurantLongitude?: number | null;
  clientName: string;
  deliveryAddress: string;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  notes?: string | null;
  orderTotal?: number | null;
  createdAt?: string | null;
  acceptedAt?: string | null;
  deliveredAt?: string | null;
  client?: { id: string; name: string; phone?: string | null } | null;
  chef?: { id: string; name: string; phone?: string | null } | null;
  courier?: { id: string; name: string; phone?: string | null } | null;
  latestLocation?: {
    latitude: number;
    longitude: number;
    createdAt: string;
  } | null;
};

function formatDistanceKm(distanceKm: number | null) {
  if (distanceKm === null) {
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

function toPoint(latitude?: number | null, longitude?: number | null): LatLng | null {
  if (latitude == null || longitude == null) {
    return null;
  }

  return { latitude, longitude };
}

function buildMapRegion(points: LatLng[]): Region | null {
  if (points.length === 0) {
    return null;
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  const latitudeDelta = Math.max(0.018, (maxLatitude - minLatitude) * 1.55);
  const longitudeDelta = Math.max(0.018, (maxLongitude - minLongitude) * 1.55);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}

function dedupePoints(points: Array<LatLng | null>): LatLng[] {
  const seen = new Set<string>();
  const result: LatLng[] = [];

  for (const point of points) {
    if (!point) {
      continue;
    }

    const key = `${point.latitude.toFixed(6)}:${point.longitude.toFixed(6)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(point);
  }

  return result;
}

function getActiveLeg(job: DeliveryJobDetail | null, courier: LatLng | null, restaurant: LatLng | null, client: LatLng | null): LatLng[] {
  if (!job) {
    return [];
  }

  if (job.status === "accepted" && courier && restaurant) {
    return [courier, restaurant];
  }

  if (["picked_up", "on_the_way"].includes(job.status) && courier && client) {
    return [courier, client];
  }

  return dedupePoints([restaurant, client]);
}

function pointsMatch(a: LatLng | null, b: LatLng | null): boolean {
  if (!a || !b) {
    return false;
  }

  return Math.abs(a.latitude - b.latitude) < 0.00001 && Math.abs(a.longitude - b.longitude) < 0.00001;
}

function formatEta(distanceKm: number | null, speedKmPerHour: number): string | null {
  if (distanceKm == null) {
    return null;
  }

  const minutes = Math.max(3, Math.round((distanceKm / speedKmPerHour) * 60));
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours} h ${remaining} min` : `${hours} h`;
  }

  return `${minutes} min`;
}

function formatJobClock(value?: string | null) {
  if (!value) {
    return "--:--";
  }

  return new Date(value).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getJobStatusMeta(status?: DeliveryJobDetail["status"]) {
  switch (status) {
    case "cancelled":
      return { label: "Annulée", color: "#D45845" };
    case "delivered":
      return { label: "Terminée", color: "#6E655F" };
    case "accepted":
      return { label: "Assignée", color: Colors.light.tint };
    case "picked_up":
      return { label: "Récupérée", color: "#7C3AED" };
    case "on_the_way":
      return { label: "En livraison", color: "#0F766E" };
    case "broadcasting":
    case "available":
      return { label: "En attente", color: "#D97706" };
    default:
      return { label: "Mission", color: Colors.light.textSecondary };
  }
}

export default function DeliveryJobScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { token, user } = useApp();
  const addressScope = user?.id ? `user:${user.id}` : "guest";
  const jobId = String(params.id ?? "");
  const [job, setJob] = useState<DeliveryJobDetail | null>(null);
  const [locations, setLocations] = useState<Array<{ latitude: number; longitude: number; createdAt: string }>>([]);
  const [deviceLocation, setDeviceLocation] = useState<LatLng | null>(null);
  const [pendingClientPoint, setPendingClientPoint] = useState<LatLng | null>(null);
  const [isEditingClientPoint, setIsEditingClientPoint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [updatingClientLocation, setUpdatingClientLocation] = useState(false);
  const [jobAccessBlocked, setJobAccessBlocked] = useState(false);
  const isCourier = user?.type === "courier";
  const isClient = user?.type === "client";

  const loadJob = async () => {
    if (!token || !jobId || jobAccessBlocked) return;
    try {
      const data = await apiFetch<{ job: DeliveryJobDetail; locations: Array<{ latitude: number; longitude: number; createdAt: string }> }>(`/delivery/jobs/${jobId}`, { token });
      setJob(data.job);
      setLocations(data.locations ?? []);
    } catch (error) {
      if (error instanceof ApiError && ["Forbidden", "NotFound"].includes(error.code ?? "")) {
        setJobAccessBlocked(true);
        Alert.alert("Mission indisponible", "Cette mission n'est plus accessible pour ce compte.", [
          { text: "Retour", onPress: () => router.back() },
        ]);
      } else {
        console.warn("Failed to load delivery job:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJob();
    if (jobAccessBlocked) {
      return undefined;
    }
    const interval = setInterval(loadJob, 5000);
    return () => clearInterval(interval);
  }, [jobAccessBlocked, jobId, token]);

  useEffect(() => {
    if (!isEditingClientPoint) {
      setPendingClientPoint(toPoint(job?.deliveryLatitude, job?.deliveryLongitude));
    }
  }, [isEditingClientPoint, job?.deliveryLatitude, job?.deliveryLongitude]);

  useEffect(() => {
    if (!isCourier || !token || !job || !["accepted", "picked_up", "on_the_way"].includes(job.status)) {
      return;
    }

    let cancelled = false;
    const pushCourierLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const nextPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setDeviceLocation(nextPoint);
        await apiFetch(`/delivery/jobs/${job.id}/location`, {
          method: "POST",
          token,
          body: JSON.stringify({
            latitude: nextPoint.latitude,
            longitude: nextPoint.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          }),
        });
      } catch (error) {
        console.warn("Failed to send courier location:", error);
      }
    };

    void pushCourierLocation();
    const interval = setInterval(() => {
      void pushCourierLocation();
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isCourier, job, token]);

  const canClientEditLocation = Boolean(isClient && job && !["delivered", "cancelled"].includes(job.status));

  const restaurantPoint = useMemo(
    () => toPoint(job?.restaurantLatitude, job?.restaurantLongitude),
    [job?.restaurantLatitude, job?.restaurantLongitude],
  );
  const clientPoint = useMemo(() => pendingClientPoint ?? toPoint(job?.deliveryLatitude, job?.deliveryLongitude), [job?.deliveryLatitude, job?.deliveryLongitude, pendingClientPoint]);
  const savedClientPoint = useMemo(
    () => toPoint(job?.deliveryLatitude, job?.deliveryLongitude),
    [job?.deliveryLatitude, job?.deliveryLongitude],
  );
  const courierPoint = useMemo(
    () => toPoint(job?.latestLocation?.latitude, job?.latestLocation?.longitude) ?? (isCourier ? deviceLocation : null),
    [deviceLocation, isCourier, job?.latestLocation?.latitude, job?.latestLocation?.longitude],
  );
  const historyPoints = useMemo(
    () => locations.map((location) => ({ latitude: location.latitude, longitude: location.longitude })),
    [locations],
  );
  const activeLegPoints = useMemo(
    () => getActiveLeg(job, courierPoint, restaurantPoint, clientPoint),
    [clientPoint, courierPoint, job, restaurantPoint],
  );
  const missionPoints = useMemo(
    () => dedupePoints([restaurantPoint, clientPoint]),
    [clientPoint, restaurantPoint],
  );
  const mapRegion = useMemo(
    () => buildMapRegion(dedupePoints([...missionPoints, ...historyPoints, ...activeLegPoints, courierPoint])),
    [activeLegPoints, courierPoint, historyPoints, missionPoints],
  );
  const itinerary = useMemo(() => {
    if (!job) {
      return null;
    }

    const restaurantPoint = job.restaurantLatitude != null && job.restaurantLongitude != null
      ? { latitude: job.restaurantLatitude, longitude: job.restaurantLongitude }
      : null;
    const clientPoint = pendingClientPoint ?? (job.deliveryLatitude != null && job.deliveryLongitude != null
      ? { latitude: job.deliveryLatitude, longitude: job.deliveryLongitude }
      : null);

    const courierToRestaurantDistance = getDistanceKm(courierPoint, restaurantPoint);
    const courierToClientDistance = getDistanceKm(courierPoint, clientPoint);
    const restaurantToClientDistance = getDistanceKm(restaurantPoint, clientPoint);

    if (job.status === "accepted") {
      return {
        title: "Prochaine étape",
        route: "Rejoindre le restaurant",
        origin: "Votre position",
        destination: job.restaurantName,
        distance: formatDistanceKm(courierToRestaurantDistance),
        eta: formatEta(courierToRestaurantDistance, 22),
      };
    }

    if (["picked_up", "on_the_way"].includes(job.status)) {
      return {
        title: "Prochaine étape",
        route: "Livrer la cliente",
        origin: job.restaurantName,
        destination: job.clientName,
        distance: formatDistanceKm(courierToClientDistance),
        eta: formatEta(courierToClientDistance, 26),
      };
    }

    return {
      title: "Mission",
      route: "Trajet restaurant vers cliente",
      origin: job.restaurantName,
      destination: job.clientName,
      distance: formatDistanceKm(restaurantToClientDistance),
      eta: formatEta(restaurantToClientDistance, 24),
    };
  }, [courierPoint, job, pendingClientPoint, restaurantPoint]);

  const navigationTarget = useMemo(() => {
    if (!job) {
      return null;
    }

    if (isCourier && job.status === "accepted" && restaurantPoint) {
      return {
        point: restaurantPoint,
        label: job.restaurantName,
        caption: "Ouvrir le trajet vers le restaurant",
      };
    }

    if (isCourier && ["picked_up", "on_the_way"].includes(job.status) && clientPoint) {
      return {
        point: clientPoint,
        label: job.clientName,
        caption: "Ouvrir le trajet vers la cliente",
      };
    }

    if (clientPoint) {
      return {
        point: clientPoint,
        label: job.clientName,
        caption: "Ouvrir le point de livraison",
      };
    }

    if (restaurantPoint) {
      return {
        point: restaurantPoint,
        label: job.restaurantName,
        caption: "Ouvrir le point du restaurant",
      };
    }

    return null;
  }, [clientPoint, isCourier, job, restaurantPoint]);

  const hasPendingClientChange = useMemo(() => {
    if (!pendingClientPoint) {
      return false;
    }

    if (!savedClientPoint) {
      return true;
    }

    return !pointsMatch(pendingClientPoint, savedClientPoint);
  }, [pendingClientPoint, savedClientPoint]);

  const useCurrentClientLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission requise", "Autorisez la localisation pour partager votre point exact au livreur.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextPoint = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setDeviceLocation(nextPoint);
      setIsEditingClientPoint(true);
      setPendingClientPoint(nextPoint);
    } catch (error: any) {
      Alert.alert("Erreur", error?.message ?? "Impossible de recuperer votre position actuelle");
    }
  };

  const updateClientLocation = async () => {
    if (!token || !job || !pendingClientPoint) {
      return;
    }

    try {
      setUpdatingClientLocation(true);
      const reverse = await Location.reverseGeocodeAsync(pendingClientPoint);
      const fallbackAddress = `${pendingClientPoint.latitude.toFixed(5)}, ${pendingClientPoint.longitude.toFixed(5)}`;
      const deliveryAddress = reverse[0]
        ? [reverse[0].name, reverse[0].street, reverse[0].district, reverse[0].city, reverse[0].region].filter(Boolean).join(", ") || fallbackAddress
        : fallbackAddress;

      const data = await apiFetch<{ job: DeliveryJobDetail }>(`/delivery/jobs/${job.id}/client-location`, {
        method: "POST",
        token,
        body: JSON.stringify({
          latitude: pendingClientPoint.latitude,
          longitude: pendingClientPoint.longitude,
          deliveryAddress,
        }),
      });

      setIsEditingClientPoint(false);
      setJob(data.job);
      setPendingClientPoint(toPoint(data.job.deliveryLatitude, data.job.deliveryLongitude));
      await saveDeliveryAddress({
        label: deliveryAddress,
        latitude: pendingClientPoint.latitude,
        longitude: pendingClientPoint.longitude,
        updatedAt: new Date().toISOString(),
      }, addressScope);
      Alert.alert("Position mise a jour", "Le livreur suit maintenant votre dernier point exact.");
    } catch (error: any) {
      Alert.alert("Erreur", error?.message ?? "Impossible de mettre a jour votre position exacte");
    } finally {
      setUpdatingClientLocation(false);
    }
  };

  const openNavigation = async () => {
    if (!navigationTarget) {
      return;
    }

    const { point, label } = navigationTarget;
    const encodedLabel = encodeURIComponent(label);
    const url = Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${point.latitude},${point.longitude}&q=${encodedLabel}`
      : `geo:0,0?q=${point.latitude},${point.longitude}(${encodedLabel})`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Navigation indisponible", "Impossible d'ouvrir l'application de cartographie.");
    }
  };

  const callPhoneNumber = async (phone?: string | null, contactLabel?: string) => {
    if (!phone) {
      Alert.alert("Numéro indisponible", `Aucun numéro de téléphone n'est disponible pour ${contactLabel ?? "ce contact"}.`);
      return;
    }

    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      Alert.alert("Appel indisponible", "Impossible d'ouvrir l'application téléphone.");
    }
  };

  const handleAction = async (action: "pickup" | "complete") => {
    if (!token || !job) return;
    setActionLoading(true);
    try {
      await apiFetch(`/delivery/jobs/${job.id}/${action === "pickup" ? "pickup" : "complete"}`, {
        method: "POST",
        token,
      });
      await loadJob();
    } catch (error: any) {
      Alert.alert("Erreur", error?.message ?? "Action impossible");
    } finally {
      setActionLoading(false);
    }
  };

  const jobTimeLabel = formatJobClock(job?.acceptedAt ?? job?.createdAt ?? job?.deliveredAt);
  const statusMeta = getJobStatusMeta(job?.status);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}> 
        <View style={styles.headerTopRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={18} color="#1F1A17" />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{`Livraison, ${jobTimeLabel}`}</Text>
            <Text style={[styles.headerSub, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.light.tint} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 100 }}>
          <View style={styles.summaryHeroCard}>
            <View style={styles.summaryHeroIconWrap}>
              <Feather name="package" size={34} color="#F24C1A" />
            </View>
            <Text style={styles.summaryHeroTitle}>{`Livraison, ${jobTimeLabel}`}</Text>
            <Text style={[styles.summaryHeroStatus, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>

          <View style={styles.topActionRow}>
            <Pressable style={styles.topActionCard} onPress={() => router.push("/(tabs)/help")}>
              <Feather name="headphones" size={24} color="#1F1A17" />
              <Text style={styles.topActionText}>Aide</Text>
            </Pressable>
            <Pressable style={styles.topActionCard} onPress={navigationTarget ? openNavigation : () => loadJob()}>
              <Feather name={navigationTarget ? "navigation" : "repeat"} size={24} color="#1F1A17" />
              <Text style={styles.topActionText}>{navigationTarget ? "Trajet" : "Répéter"}</Text>
            </Pressable>
          </View>

          <View style={styles.mapCard}>
            {mapRegion ? (
              <MapView
                style={styles.map}
                initialRegion={mapRegion}
                showsUserLocation={Boolean(isCourier || isClient)}
                onPress={canClientEditLocation ? (event) => {
                  setIsEditingClientPoint(true);
                  setPendingClientPoint(event.nativeEvent.coordinate);
                } : undefined}
              >
                {missionPoints.length > 1 ? (
                  <Polyline
                    coordinates={missionPoints}
                    strokeColor={Colors.light.terracotta}
                    strokeWidth={3}
                    lineDashPattern={[8, 8]}
                  />
                ) : null}

                {activeLegPoints.length > 1 ? (
                  <Polyline
                    coordinates={activeLegPoints}
                    strokeColor="#0F766E"
                    strokeWidth={5}
                  />
                ) : null}

                {historyPoints.length > 1 ? (
                  <Polyline
                    coordinates={historyPoints}
                    strokeColor={Colors.light.tint}
                    strokeWidth={4}
                  />
                ) : null}

                {restaurantPoint ? (
                  <Marker coordinate={restaurantPoint} title={job?.restaurantName ?? "Restaurant"} description={job?.restaurantAddress} pinColor={Colors.light.tint} />
                ) : null}

                {clientPoint ? (
                  <Marker
                    coordinate={clientPoint}
                    title={job?.clientName ?? "Client"}
                    description={job?.deliveryAddress}
                    pinColor="#0F766E"
                    draggable={canClientEditLocation}
                    onDragEnd={canClientEditLocation ? (event) => {
                      setIsEditingClientPoint(true);
                      setPendingClientPoint(event.nativeEvent.coordinate);
                    } : undefined}
                  />
                ) : null}

                {courierPoint ? (
                  <Marker coordinate={courierPoint} title={job?.courier?.name ?? "Livreur"} description={job?.latestLocation?.createdAt ? `Position mise a jour ${new Date(job.latestLocation.createdAt).toLocaleTimeString()}` : "Position en direct"} pinColor={Colors.light.warning} />
                ) : null}
              </MapView>
            ) : (
              <View style={styles.mapEmptyState}>
                <Feather name="map-pin" size={28} color={Colors.light.tint} />
                <Text style={styles.mapEmptyTitle}>Carte indisponible</Text>
                <Text style={styles.mapEmptyText}>
                  Les coordonnees du trajet ne sont pas encore disponibles pour cette mission.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: Colors.light.tint }]} />
              <Text style={styles.legendText}>Restaurant</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: "#0F766E" }]} />
              <Text style={styles.legendText}>Destination</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: Colors.light.warning }]} />
              <Text style={styles.legendText}>Livreur</Text>
            </View>
          </View>

          {itinerary ? (
            <View style={styles.itineraryCard}>
              <View style={styles.itineraryHeader}>
                <Text style={styles.itineraryTitle}>{itinerary.title}</Text>
                <Text style={styles.itineraryDistance}>{itinerary.distance}</Text>
              </View>
              <Text style={styles.itineraryRoute}>{itinerary.route}</Text>
              {itinerary.eta ? <Text style={styles.itineraryEta}>ETA approx. {itinerary.eta}</Text> : null}
              <View style={styles.itinerarySteps}>
                <View style={styles.itineraryStepRow}>
                  <View style={styles.itineraryDotStart} />
                  <Text style={styles.itineraryStepText}>{itinerary.origin}</Text>
                </View>
                <View style={styles.itineraryConnector} />
                <View style={styles.itineraryStepRow}>
                  <View style={styles.itineraryDotEnd} />
                  <Text style={styles.itineraryStepText}>{itinerary.destination}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {canClientEditLocation ? (
            <View style={styles.routeActionsCard}>
              <Text style={styles.routeActionsTitle}>Votre point exact</Text>
              <Text style={styles.routeActionsText}>
                Touchez la carte ou deplacez l'epingle, puis confirmez pour que le livreur suive votre derniere position.
              </Text>
              <View style={styles.inlineActionRow}>
                <Pressable style={styles.secondaryActionBtn} onPress={useCurrentClientLocation}>
                  <Feather name="crosshair" size={15} color={Colors.light.tint} />
                  <Text style={styles.secondaryActionBtnText}>Me localiser</Text>
                </Pressable>
                <Pressable
                  style={[styles.routeActionBtn, (!hasPendingClientChange || updatingClientLocation) && styles.routeActionBtnDisabled]}
                  onPress={updateClientLocation}
                  disabled={!hasPendingClientChange || updatingClientLocation}
                >
                  <Feather name="check" size={15} color="#fff" />
                  <Text style={styles.routeActionBtnText}>{updatingClientLocation ? "Mise a jour..." : "Envoyer ma position"}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.addressCard}>
            <View style={styles.addressRow}>
              <Feather name="package" size={20} color="#1F1A17" />
              <Text style={styles.addressText}>{job?.restaurantAddress}</Text>
            </View>
            <View style={styles.addressDivider} />
            <View style={styles.addressRow}>
              <Feather name="flag" size={20} color="#1F1A17" />
              <Text style={styles.addressText}>{job?.deliveryAddress}</Text>
            </View>
          </View>

          <View style={styles.sectionTitleBlock}>
            <Text style={styles.sectionHeading}>Détails</Text>
          </View>

          <View style={styles.infoSectionPlain}>
            <Text style={styles.infoPrimaryText}>{job?.courier?.name ?? job?.clientName ?? "Mission"}</Text>
            <Text style={styles.infoSecondaryText}>{isCourier ? "Livreur" : job?.courier ? "Coursier" : "Affectation en attente"}</Text>
          </View>

          {isCourier && job ? (
            <View style={styles.contactCard}>
              <View style={styles.contactHeaderRow}>
                <View style={styles.contactTitleBlock}>
                  <Text style={styles.contactEyebrow}>Cliente</Text>
                  <Text style={styles.contactName}>{job.client?.name ?? job.clientName}</Text>
                </View>
                <Pressable
                  style={[styles.contactCallBtn, !job.client?.phone && styles.contactCallBtnDisabled]}
                  onPress={() => callPhoneNumber(job.client?.phone, job.client?.name ?? job.clientName)}
                  disabled={!job.client?.phone}
                >
                  <Feather name="phone-call" size={16} color="#fff" />
                  <Text style={styles.contactCallBtnText}>Appeler</Text>
                </Pressable>
              </View>
              <View style={styles.contactInfoRow}>
                <Feather name="phone" size={16} color={Colors.light.textSecondary} />
                <Text style={styles.contactInfoText}>{job.client?.phone ?? "Numéro non disponible"}</Text>
              </View>
              <View style={styles.contactInfoRow}>
                <Feather name="map-pin" size={16} color={Colors.light.textSecondary} />
                <Text style={styles.contactInfoText}>{job.deliveryAddress}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.sectionTitleBlock}>
            <Text style={styles.sectionHeading}>Prix</Text>
          </View>

          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Service de livraison par courrier</Text>
              <Text style={styles.priceValue}>{`${Math.round(job?.orderTotal ?? 0).toLocaleString("fr-FR")}F`}</Text>
            </View>
            <View style={styles.addressDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.priceTotalLabel}>Total</Text>
              <Text style={styles.priceTotalValue}>{`${Math.round(job?.orderTotal ?? 0).toLocaleString("fr-FR")}F`}</Text>
            </View>
            <View style={styles.paymentMethodCard}>
              <Text style={styles.paymentMethodText}>Paiement à la livraison</Text>
            </View>
          </View>

          {job?.notes ? (
            <View style={styles.infoSectionPlain}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.sectionSub}>{job.notes}</Text>
            </View>
          ) : null}

          {isCourier && job ? (
            <View style={styles.actionsRow}>
              {job.status === "accepted" ? (
                <Pressable style={styles.actionBtn} onPress={() => handleAction("pickup")} disabled={actionLoading}>
                  <Text style={styles.actionBtnText}>{actionLoading ? "..." : "Commande recuperee"}</Text>
                </Pressable>
              ) : null}
              {["picked_up", "on_the_way"].includes(job.status) ? (
                <Pressable style={[styles.actionBtn, { backgroundColor: "#0F766E" }]} onPress={() => handleAction("complete")} disabled={actionLoading}>
                  <Text style={styles.actionBtnText}>{actionLoading ? "..." : "Livraison terminee"}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {isClient && job?.status === "delivered" ? (
            <View style={styles.actionsRow}>
              <Pressable style={styles.actionBtn} onPress={() => router.push({ pathname: "/client/review/[orderId]", params: { orderId: job.orderId } })}>
                <Text style={styles.actionBtnText}>Noter la commande et la livraison</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
  header: { paddingHorizontal: 18, paddingBottom: 18, backgroundColor: "#FFFFFF", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F2EFEC", alignItems: "center", justifyContent: "center" },
  headerTitleWrap: { flex: 1, alignItems: "center" },
  headerSpacer: { width: 40, height: 40 },
  headerTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: "#1F1A17" },
  headerSub: { fontSize: 13, fontFamily: "Poppins_400Regular", marginTop: 2 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryHeroCard: { alignItems: "center", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10 },
  summaryHeroIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(31,26,23,0.12)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 6,
  },
  summaryHeroTitle: { marginTop: 16, fontSize: 26, fontFamily: "Poppins_700Bold", color: "#1F1A17" },
  summaryHeroStatus: { marginTop: 4, fontSize: 15, fontFamily: "Poppins_400Regular" },
  topActionRow: { flexDirection: "row", gap: 12, paddingHorizontal: 18, marginBottom: 16 },
  topActionCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 20,
    backgroundColor: "#F1EEEA",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  topActionText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#1F1A17" },
  mapCard: { margin: 18, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: Colors.light.cardBorder, backgroundColor: Colors.light.card, height: 300 },
  map: { flex: 1 },
  mapEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  mapEmptyTitle: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  mapEmptyText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 18,
    marginTop: -2,
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: Colors.light.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
  },
  itineraryCard: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    padding: 16,
    gap: 10,
  },
  itineraryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itineraryTitle: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
  },
  itineraryDistance: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
  itineraryRoute: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  itineraryEta: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
  itinerarySteps: {
    gap: 0,
  },
  itineraryStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itineraryDotStart: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.tint,
  },
  itineraryDotEnd: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0F766E",
  },
  itineraryStepText: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
  },
  itineraryConnector: {
    width: 1,
    height: 18,
    backgroundColor: Colors.light.cardBorder,
    marginLeft: 4,
    marginVertical: 6,
  },
  routeActionsCard: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    padding: 16,
    gap: 12,
  },
  routeActionsTitle: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
  },
  routeActionsText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.text,
  },
  inlineActionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  routeActionBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Colors.light.tint,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  routeActionBtnDisabled: {
    opacity: 0.6,
  },
  routeActionBtnText: {
    color: "#fff",
    fontFamily: "Poppins_600SemiBold",
  },
  secondaryActionBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.backgroundSecondary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  secondaryActionBtnText: {
    color: Colors.light.tint,
    fontFamily: "Poppins_600SemiBold",
  },
  addressCard: {
    marginHorizontal: 18,
    marginBottom: 18,
    backgroundColor: Colors.light.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    overflow: "hidden",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  addressDivider: {
    height: 1,
    backgroundColor: Colors.light.cardBorder,
    marginHorizontal: 18,
  },
  addressText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Poppins_500Medium",
    color: "#1F1A17",
  },
  sectionTitleBlock: {
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 22,
    fontFamily: "Poppins_700Bold",
    color: "#1F1A17",
  },
  infoSectionPlain: {
    paddingHorizontal: 18,
    marginBottom: 22,
  },
  infoPrimaryText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Poppins_500Medium",
    color: "#1F1A17",
  },
  infoSecondaryText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Poppins_400Regular",
    color: "#8C827B",
  },
  contactCard: {
    marginHorizontal: 18,
    marginBottom: 18,
    backgroundColor: Colors.light.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    padding: 16,
    gap: 12,
  },
  contactHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  contactTitleBlock: {
    flex: 1,
  },
  contactEyebrow: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
  },
  contactName: {
    marginTop: 4,
    fontSize: 18,
    fontFamily: "Poppins_600SemiBold",
    color: "#1F1A17",
  },
  contactCallBtn: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#0F766E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  contactCallBtnDisabled: {
    opacity: 0.45,
  },
  contactCallBtnText: {
    color: "#fff",
    fontFamily: "Poppins_600SemiBold",
  },
  contactInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  contactInfoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.text,
  },
  priceCard: {
    marginHorizontal: 18,
    marginBottom: 22,
    backgroundColor: Colors.light.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    padding: 18,
    gap: 18,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  priceLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Poppins_400Regular",
    color: "#1F1A17",
  },
  priceValue: {
    fontSize: 15,
    fontFamily: "Poppins_500Medium",
    color: "#1F1A17",
  },
  priceTotalLabel: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: "#1F1A17",
  },
  priceTotalValue: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: "#1F1A17",
  },
  paymentMethodCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  paymentMethodText: {
    fontSize: 15,
    fontFamily: "Poppins_500Medium",
    color: "#1F1A17",
  },
  section: { marginHorizontal: 18, marginBottom: 14, backgroundColor: Colors.light.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.textTertiary, marginBottom: 6, textTransform: "uppercase" },
  sectionValue: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  sectionSub: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, marginTop: 4, lineHeight: 20 },
  actionsRow: { paddingHorizontal: 18, gap: 12 },
  actionBtn: { backgroundColor: Colors.light.tint, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  actionBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#fff" },
});
