import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, type LatLng, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import {
  formatAddressTimestamp,
  loadSavedDeliveryAddress,
  saveDeliveryAddress,
  type SavedDeliveryAddress,
} from "@/constants/delivery-address";
import { useApp } from "@/contexts/AppContext";

function formatReverseGeocode(result: Location.LocationGeocodedAddress | null, fallback: string): string {
  if (!result) {
    return fallback;
  }

  const segments = [
    result.name,
    result.street,
    result.district,
    result.city,
    result.region,
  ].filter(Boolean);

  return segments.length > 0 ? segments.join(", ") : fallback;
}

function buildRegion(point: LatLng | null): Region {
  if (!point) {
    return {
      latitude: 5.348,
      longitude: -4.026,
      latitudeDelta: 0.11,
      longitudeDelta: 0.11,
    };
  }

  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };
}

export default function ClientAddressesScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateCurrentUser } = useApp();
  const addressScope = user?.id ? `user:${user.id}` : "guest";
  const [addressLabel, setAddressLabel] = useState(user?.location ?? "");
  const [savedAddress, setSavedAddress] = useState<SavedDeliveryAddress | null>(null);
  const [draftPoint, setDraftPoint] = useState<LatLng | null>(null);
  const [loadingSavedAddress, setLoadingSavedAddress] = useState(true);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [saving, setSaving] = useState(false);

  const mapRegion = useMemo(() => buildRegion(draftPoint), [draftPoint]);

  const loadAddress = useCallback(async () => {
    setLoadingSavedAddress(true);
    try {
      const existingAddress = await loadSavedDeliveryAddress(addressScope);
      setSavedAddress(existingAddress);
      setAddressLabel(existingAddress?.label ?? user?.location ?? "");
      setDraftPoint(
        existingAddress?.latitude != null && existingAddress?.longitude != null
          ? { latitude: existingAddress.latitude, longitude: existingAddress.longitude }
          : null,
      );
    } finally {
      setLoadingSavedAddress(false);
    }
  }, [addressScope, user?.location]);

  useEffect(() => {
    loadAddress();
  }, [loadAddress]);

  const resolveAddressFromPoint = useCallback(async (point: LatLng) => {
    const reverse = await Location.reverseGeocodeAsync(point);
    const fallback = `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
    return formatReverseGeocode(reverse[0] ?? null, fallback);
  }, []);

  const applyPoint = useCallback(async (point: LatLng) => {
    setDraftPoint(point);
    try {
      const label = await resolveAddressFromPoint(point);
      setAddressLabel(label);
    } catch {
      setAddressLabel(`${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`);
    }
  }, [resolveAddressFromPoint]);

  const useCurrentLocation = useCallback(async () => {
    try {
      setDetectingLocation(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission requise", "Autorisez la localisation pour enregistrer votre position de livraison.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      const reverse = await Location.reverseGeocodeAsync(point);
      const fallback = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
      const nextAddress: SavedDeliveryAddress = {
        label: formatReverseGeocode(reverse[0] ?? null, fallback),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        updatedAt: new Date().toISOString(),
      };

      setSavedAddress(nextAddress);
      setAddressLabel(nextAddress.label);
      setDraftPoint(point);
    } catch (error: any) {
      Alert.alert("Erreur", error?.message ?? "Impossible de recuperer votre position actuelle");
    } finally {
      setDetectingLocation(false);
    }
  }, []);

  const saveAddress = useCallback(async () => {
    const normalizedLabel = addressLabel.trim();
    if (!normalizedLabel) {
      Alert.alert("Adresse requise", "Entrez une adresse ou utilisez votre position actuelle.");
      return;
    }

    try {
      setSaving(true);
      const nextAddress: SavedDeliveryAddress = {
        label: normalizedLabel,
        latitude: draftPoint?.latitude ?? null,
        longitude: draftPoint?.longitude ?? null,
        updatedAt: new Date().toISOString(),
      };

      await saveDeliveryAddress(nextAddress, addressScope);
      await updateCurrentUser({ location: normalizedLabel });
      setSavedAddress(nextAddress);
      Alert.alert("Adresse enregistree", "Votre derniere position de livraison sera proposee automatiquement au checkout.", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert("Erreur", error?.message ?? "Impossible d'enregistrer votre adresse");
    } finally {
      setSaving(false);
    }
  }, [addressLabel, addressScope, draftPoint, updateCurrentUser]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={18} color={Colors.light.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Mes adresses</Text>
            <Text style={styles.subtitle}>Enregistrez votre derniere position pour accelerer la commande et la livraison.</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Adresse principale</Text>
          {loadingSavedAddress ? (
            <ActivityIndicator color={Colors.light.tint} />
          ) : (
            <>
              <Text style={styles.addressText}>{savedAddress?.label ?? user?.location ?? "Aucune adresse enregistree"}</Text>
              <Text style={styles.addressMeta}>{formatAddressTimestamp(savedAddress?.updatedAt)}</Text>
            </>
          )}
        </View>

        <View style={styles.editorCard}>
          <Text style={styles.label}>Adresse de livraison</Text>
          <TextInput
            value={addressLabel}
            onChangeText={setAddressLabel}
            placeholder="Ex: Cocody Angre 8e tranche, pres du marche"
            placeholderTextColor={Colors.light.textSecondary}
            style={styles.input}
            multiline
          />

          <Pressable style={styles.locateBtn} onPress={useCurrentLocation} disabled={detectingLocation}>
            {detectingLocation ? <ActivityIndicator color="#fff" /> : <Feather name="navigation" size={16} color="#fff" />}
            <Text style={styles.locateBtnText}>{detectingLocation ? "Localisation..." : "Utiliser ma position actuelle"}</Text>
          </Pressable>

          <Text style={styles.helper}>
            La position actuelle sera transmise aux livreurs pour afficher l'itineraire directement dans l'app.
          </Text>

          <View style={styles.mapCard}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>Point exact sur la carte</Text>
              <Text style={styles.mapHint}>Touchez la carte ou deplacez l'epingle pour affiner la livraison.</Text>
            </View>
            <MapView
              key={draftPoint ? `${draftPoint.latitude.toFixed(5)}:${draftPoint.longitude.toFixed(5)}` : "default-address-map"}
              style={styles.map}
              initialRegion={mapRegion}
              onPress={(event) => {
                void applyPoint(event.nativeEvent.coordinate);
              }}
            >
              {draftPoint ? (
                <Marker
                  coordinate={draftPoint}
                  draggable
                  pinColor={Colors.light.tint}
                  onDragEnd={(event) => {
                    void applyPoint(event.nativeEvent.coordinate);
                  }}
                />
              ) : null}
            </MapView>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={saveAddress} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? "Enregistrement..." : "Enregistrer cette adresse"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: 20, paddingBottom: 140, gap: 16 },
  headerRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: "Poppins_700Bold", fontSize: 22, color: Colors.light.text },
  subtitle: { marginTop: 4, color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", lineHeight: 20 },
  infoCard: { backgroundColor: Colors.light.card, borderRadius: 18, padding: 18, gap: 8 },
  editorCard: { backgroundColor: Colors.light.card, borderRadius: 18, padding: 18, gap: 12 },
  mapCard: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.light.divider,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  mapHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 4,
  },
  mapTitle: { fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  mapHint: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", lineHeight: 18 },
  map: { height: 220 },
  cardTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: Colors.light.text },
  addressText: { fontFamily: "Poppins_600SemiBold", color: Colors.light.text, lineHeight: 22 },
  addressMeta: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular" },
  label: { fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  input: {
    minHeight: 96,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 14,
    paddingVertical: 14,
    textAlignVertical: "top",
    color: Colors.light.text,
    fontFamily: "Poppins_400Regular",
  },
  locateBtn: {
    backgroundColor: Colors.light.tint,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  locateBtnText: { color: "#fff", fontFamily: "Poppins_600SemiBold" },
  helper: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", lineHeight: 20 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
    backgroundColor: Colors.light.card,
  },
  saveBtn: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 15 },
});
