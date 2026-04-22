import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, type LatLng, type Region } from "react-native-maps";

import Colors from "@/constants/colors";
import { shouldUseNativeMaps } from "@/constants/native-maps";

type DeliveryStatus = "broadcasting" | "available" | "accepted" | "picked_up" | "on_the_way" | "delivered" | "cancelled";

type RouteSnapshot = {
  coordinates: LatLng[];
  distanceKm: number | null;
  durationMinutes: number | null;
};

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || "";
const DIRECTIONS_PROVIDER = (process.env.EXPO_PUBLIC_DIRECTIONS_PROVIDER?.trim().toLowerCase() || (MAPBOX_ACCESS_TOKEN ? "mapbox" : "osrm")) as "mapbox" | "osrm";
const MAPBOX_DIRECTIONS_PROFILE = process.env.EXPO_PUBLIC_MAPBOX_DIRECTIONS_PROFILE?.trim() || "driving-traffic";
const OSRM_API_BASE_URL = process.env.EXPO_PUBLIC_DIRECTIONS_API_URL?.trim() || "https://router.project-osrm.org";
const OSRM_DIRECTIONS_PROFILE = process.env.EXPO_PUBLIC_DIRECTIONS_PROFILE?.trim() || "driving";

function toPoint(latitude?: number | null, longitude?: number | null): LatLng | null {
  if (latitude == null || longitude == null) {
    return null;
  }

  return { latitude, longitude };
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

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max(0.012, (maxLatitude - minLatitude) * 1.7),
    longitudeDelta: Math.max(0.012, (maxLongitude - minLongitude) * 1.7),
  };
}

function getActiveLeg(status: DeliveryStatus, courier: LatLng | null, restaurant: LatLng | null, client: LatLng | null): LatLng[] {
  if (status === "accepted" && courier && restaurant) {
    return [courier, restaurant];
  }

  if (["picked_up", "on_the_way"].includes(status) && courier && client) {
    return [courier, client];
  }

  return dedupePoints([restaurant, client]);
}

async function fetchRoadRoute(origin: LatLng, destination: LatLng): Promise<RouteSnapshot | null> {
  const query = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    alternatives: "false",
    steps: "false",
  });

  let url: string;
  if (DIRECTIONS_PROVIDER === "mapbox" && MAPBOX_ACCESS_TOKEN) {
    query.set("access_token", MAPBOX_ACCESS_TOKEN);
    url = `https://api.mapbox.com/directions/v5/mapbox/${MAPBOX_DIRECTIONS_PROFILE}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?${query.toString()}`;
  } else {
    url = `${OSRM_API_BASE_URL}/route/v1/${OSRM_DIRECTIONS_PROFILE}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?${query.toString()}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Directions API ${response.status}`);
  }

  const payload = await response.json();
  const route = payload?.routes?.[0];
  const coordinates = Array.isArray(route?.geometry?.coordinates)
    ? route.geometry.coordinates
        .map((point: unknown) => {
          if (!Array.isArray(point) || point.length < 2) {
            return null;
          }

          const [longitude, latitude] = point;
          if (typeof latitude !== "number" || typeof longitude !== "number") {
            return null;
          }

          return { latitude, longitude };
        })
        .filter((point: LatLng | null): point is LatLng => point !== null)
    : [];

  if (coordinates.length < 2) {
    return null;
  }

  return {
    coordinates,
    distanceKm: typeof route.distance === "number" ? route.distance / 1000 : null,
    durationMinutes: typeof route.duration === "number" ? Math.max(1, Math.round(route.duration / 60)) : null,
  };
}

export function DeliveryMiniMap(props: {
  status: DeliveryStatus;
  restaurantName?: string | null;
  restaurantAddress?: string | null;
  restaurantLatitude?: number | null;
  restaurantLongitude?: number | null;
  clientName?: string | null;
  deliveryAddress?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  courierName?: string | null;
  courierLatitude?: number | null;
  courierLongitude?: number | null;
  caption?: string | null;
  onPress?: () => void;
}) {
  const nativeMapsEnabled = shouldUseNativeMaps();
  const mapRef = useRef<MapView | null>(null);
  const [roadRoute, setRoadRoute] = useState<RouteSnapshot | null>(null);

  const restaurantPoint = useMemo(
    () => toPoint(props.restaurantLatitude, props.restaurantLongitude),
    [props.restaurantLatitude, props.restaurantLongitude],
  );
  const clientPoint = useMemo(
    () => toPoint(props.deliveryLatitude, props.deliveryLongitude),
    [props.deliveryLatitude, props.deliveryLongitude],
  );
  const courierPoint = useMemo(
    () => toPoint(props.courierLatitude, props.courierLongitude),
    [props.courierLatitude, props.courierLongitude],
  );

  const routeEndpoints = useMemo(() => {
    if (props.status === "accepted" && courierPoint && restaurantPoint) {
      return { origin: courierPoint, destination: restaurantPoint };
    }

    if (["picked_up", "on_the_way"].includes(props.status) && courierPoint && clientPoint) {
      return { origin: courierPoint, destination: clientPoint };
    }

    if (restaurantPoint && clientPoint) {
      return { origin: restaurantPoint, destination: clientPoint };
    }

    return null;
  }, [clientPoint, courierPoint, props.status, restaurantPoint]);

  useEffect(() => {
    let cancelled = false;

    if (!routeEndpoints) {
      setRoadRoute(null);
      return () => {
        cancelled = true;
      };
    }

    void fetchRoadRoute(routeEndpoints.origin, routeEndpoints.destination)
      .then((snapshot) => {
        if (!cancelled) {
          setRoadRoute(snapshot);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoadRoute(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [routeEndpoints]);

  const missionPoints = useMemo(() => dedupePoints([restaurantPoint, clientPoint]), [clientPoint, restaurantPoint]);
  const activeLegPoints = useMemo(
    () => roadRoute?.coordinates.length ? roadRoute.coordinates : getActiveLeg(props.status, courierPoint, restaurantPoint, clientPoint),
    [clientPoint, courierPoint, props.status, restaurantPoint, roadRoute],
  );
  const mapTracePoints = useMemo(
    () => dedupePoints([...activeLegPoints, ...missionPoints, courierPoint]),
    [activeLegPoints, courierPoint, missionPoints],
  );
  const mapRegion = useMemo(() => buildMapRegion(mapTracePoints), [mapTracePoints]);

  useEffect(() => {
    if (!mapRegion) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (mapTracePoints.length > 1) {
        mapRef.current?.fitToCoordinates(mapTracePoints, {
          edgePadding: { top: 50, right: 36, bottom: 50, left: 36 },
          animated: true,
        });
      } else {
        mapRef.current?.animateToRegion(mapRegion, 220);
      }
    }, 160);

    return () => clearTimeout(timeoutId);
  }, [mapRegion, mapTracePoints]);

  return (
    <Pressable style={styles.card} onPress={props.onPress} disabled={!props.onPress}>
      {mapRegion && nativeMapsEnabled ? (
        <MapView ref={mapRef} style={styles.map} initialRegion={mapRegion} pointerEvents="none">
          {missionPoints.length > 1 ? (
            <Polyline coordinates={missionPoints} strokeColor={Colors.light.terracotta} strokeWidth={3} lineDashPattern={[7, 7]} />
          ) : null}
          {activeLegPoints.length > 1 ? (
            <Polyline coordinates={activeLegPoints} strokeColor="#0F766E" strokeWidth={5} />
          ) : null}
          {restaurantPoint ? (
            <Marker coordinate={restaurantPoint} title={props.restaurantName ?? "Restaurant"} description={props.restaurantAddress ?? undefined} pinColor={Colors.light.tint} />
          ) : null}
          {clientPoint ? (
            <Marker coordinate={clientPoint} title={props.clientName ?? "Client"} description={props.deliveryAddress ?? undefined} pinColor="#0F766E" />
          ) : null}
          {courierPoint ? (
            <Marker coordinate={courierPoint} title={props.courierName ?? "Livreur"} pinColor={Colors.light.warning} />
          ) : null}
        </MapView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{mapRegion ? "Carte Android désactivée" : "Carte en attente"}</Text>
          <Text style={styles.emptyText}>
            {mapRegion
              ? "Le trajet reste suivi en arrière-plan, mais la carte native Android est temporairement masquée dans cette version pour éviter les crashs."
              : "Le trajet apparaîtra ici dès que les coordonnées seront prêtes."}
          </Text>
        </View>
      )}

      {props.caption ? (
        <View style={styles.captionBadge}>
          <Text style={styles.captionText}>{props.caption}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    backgroundColor: Colors.light.card,
    height: 170,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: Colors.light.backgroundSecondary,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  captionBadge: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  captionText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "#1F1A17",
    textAlign: "center",
  },
});