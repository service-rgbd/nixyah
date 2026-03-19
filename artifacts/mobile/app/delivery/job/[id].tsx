import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { WebView } from "react-native-webview";
import Colors from "@/constants/colors";
import Gradient from "@/components/SafeGradient";
import { apiFetch } from "@/constants/api";
import { useApp } from "@/contexts/AppContext";

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
  courier?: { id: string; name: string; phone?: string | null } | null;
  latestLocation?: {
    latitude: number;
    longitude: number;
    createdAt: string;
  } | null;
};

function buildMapHtml(job: DeliveryJobDetail | null, locations: Array<{ latitude: number; longitude: number }> = []) {
  const restaurant = job?.restaurantLatitude && job?.restaurantLongitude
    ? [job.restaurantLatitude, job.restaurantLongitude]
    : null;
  const client = job?.deliveryLatitude && job?.deliveryLongitude
    ? [job.deliveryLatitude, job.deliveryLongitude]
    : null;
  const courier = job?.latestLocation
    ? [job.latestLocation.latitude, job.latestLocation.longitude]
    : null;

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
      body { background: #f6f1ea; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const map = L.map('map').setView(${JSON.stringify(courier || restaurant || client || [5.35, -4.02])}, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const bounds = [];
      const routePoints = ${JSON.stringify(locations)};

      const addMarker = (point, label) => {
        if (!point) return;
        const marker = L.marker(point).addTo(map).bindPopup(label);
        bounds.push(point);
        return marker;
      };

      addMarker(${JSON.stringify(restaurant)}, 'Restaurant');
      addMarker(${JSON.stringify(client)}, 'Client');
      addMarker(${JSON.stringify(courier)}, 'Livreur');

      if (routePoints.length > 1) {
        const polyline = L.polyline(routePoints.map((p) => [p.latitude, p.longitude]), { color: '#C4522A', weight: 4 }).addTo(map);
        bounds.push(...routePoints.map((p) => [p.latitude, p.longitude]));
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    </script>
  </body>
</html>`;
}

export default function DeliveryJobScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { token, user } = useApp();
  const jobId = String(params.id ?? "");
  const [job, setJob] = useState<DeliveryJobDetail | null>(null);
  const [locations, setLocations] = useState<Array<{ latitude: number; longitude: number; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const isCourier = user?.type === "courier";

  const loadJob = async () => {
    if (!token || !jobId) return;
    try {
      const data = await apiFetch<{ job: DeliveryJobDetail; locations: Array<{ latitude: number; longitude: number; createdAt: string }> }>(`/delivery/jobs/${jobId}`, { token });
      setJob(data.job);
      setLocations(data.locations ?? []);
    } catch (error) {
      console.warn("Failed to load delivery job:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJob();
    const interval = setInterval(loadJob, 5000);
    return () => clearInterval(interval);
  }, [jobId, token]);

  useEffect(() => {
    if (!isCourier || !token || !job || !["accepted", "picked_up", "on_the_way"].includes(job.status)) {
      return;
    }

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        await apiFetch(`/delivery/jobs/${job.id}/location`, {
          method: "POST",
          token,
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          }),
        });
      } catch (error) {
        console.warn("Failed to send courier location:", error);
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isCourier, job, token]);

  const mapHtml = useMemo(() => buildMapHtml(job, locations), [job, locations]);

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

  return (
    <View style={styles.screen}>
      <Gradient colors={[Colors.light.tintDark, Colors.light.tint]} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Suivi livraison</Text>
        <Text style={styles.headerSub}>Mission #{jobId}</Text>
      </Gradient>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.light.tint} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 100 }}>
          <View style={styles.mapCard}>
            <WebView originWhitelist={["*"]} source={{ html: mapHtml }} style={styles.map} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Etat</Text>
            <Text style={styles.sectionValue}>{job?.status ?? "indisponible"}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Restaurant</Text>
            <Text style={styles.sectionValue}>{job?.restaurantName}</Text>
            <Text style={styles.sectionSub}>{job?.restaurantAddress}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Client</Text>
            <Text style={styles.sectionValue}>{job?.clientName}</Text>
            <Text style={styles.sectionSub}>{job?.deliveryAddress}</Text>
          </View>

          {job?.notes ? (
            <View style={styles.section}>
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
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
  header: { paddingHorizontal: 18, paddingBottom: 22 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  headerTitle: { fontSize: 24, fontFamily: "Poppins_700Bold", color: "#fff" },
  headerSub: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.85)", marginTop: 4 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  mapCard: { margin: 18, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: Colors.light.cardBorder, backgroundColor: Colors.light.card, height: 300 },
  map: { flex: 1 },
  section: { marginHorizontal: 18, marginBottom: 14, backgroundColor: Colors.light.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.textTertiary, marginBottom: 6, textTransform: "uppercase" },
  sectionValue: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  sectionSub: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, marginTop: 4, lineHeight: 20 },
  actionsRow: { paddingHorizontal: 18, gap: 12 },
  actionBtn: { backgroundColor: Colors.light.tint, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  actionBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#fff" },
});
