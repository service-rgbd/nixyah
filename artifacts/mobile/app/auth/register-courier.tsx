import { Feather, Ionicons } from "@expo/vector-icons";
import Gradient from "@/components/SafeGradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

const VEHICLES = ["moto", "velo", "voiture"];
const courierIllustration = require("../../assets/images/courier-delivery-illustration.png");

export default function RegisterCourierScreen() {
  const insets = useSafeAreaInsets();
  const { registerCourier } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState("Abidjan");
  const [zone, setZone] = useState("");
  const [vehicleType, setVehicleType] = useState("moto");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!name.trim() || !password.trim() || !location.trim()) {
      setError("Nom, mot de passe et localisation requis");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Email ou téléphone requis");
      return;
    }
    if (password.length < 6) {
      setError("Minimum 6 caractères");
      return;
    }

    setLoading(true);
    try {
      const result = await registerCourier({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
        location: location.trim(),
        zone: zone.trim() || undefined,
        vehicleType,
      });
      if (result.requiresEmailConfirmation && result.email) {
        router.replace({ pathname: "/auth/confirm", params: { email: result.email } });
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Gradient colors={["#0F766E", "#115E59"]} style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerMedia} pointerEvents="none">
          <Image source={courierIllustration} style={styles.headerMediaImage} resizeMode="cover" />
          <View style={styles.headerOverlay} />
        </View>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Devenir livreur</Text>
          <Text style={styles.headerSub}>Recevez des missions et livrez les commandes Nixyah</Text>
          <View style={styles.heroIcon}>
            <Ionicons name="bicycle" size={42} color="#fff" />
          </View>
        </View>
      </Gradient>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={15} color={Colors.light.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nom complet</Text>
            <View style={styles.inputRow}>
              <Feather name="user" size={16} color={Colors.light.textTertiary} />
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nom et prénom" placeholderTextColor={Colors.light.textTertiary} />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <Feather name="mail" size={16} color={Colors.light.textTertiary} />
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@exemple.com" placeholderTextColor={Colors.light.textTertiary} autoCapitalize="none" />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Téléphone</Text>
            <View style={styles.inputRow}>
              <Feather name="phone" size={16} color={Colors.light.textTertiary} />
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+225 ..." placeholderTextColor={Colors.light.textTertiary} />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputRow}>
              <Feather name="lock" size={16} color={Colors.light.textTertiary} />
              <TextInput style={[styles.input, { flex: 1 }]} value={password} onChangeText={setPassword} placeholder="Minimum 6 caractères" placeholderTextColor={Colors.light.textTertiary} secureTextEntry={!showPassword} />
              <Pressable onPress={() => setShowPassword((prev) => !prev)}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={Colors.light.textTertiary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Localisation</Text>
            <View style={styles.inputRow}>
              <Feather name="map-pin" size={16} color={Colors.light.textTertiary} />
              <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Abidjan" placeholderTextColor={Colors.light.textTertiary} />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Zone</Text>
            <View style={styles.inputRow}>
              <Feather name="navigation" size={16} color={Colors.light.textTertiary} />
              <TextInput style={styles.input} value={zone} onChangeText={setZone} placeholder="Cocody, Yopougon..." placeholderTextColor={Colors.light.textTertiary} />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Vehicule</Text>
            <View style={styles.chipsRow}>
              {VEHICLES.map((vehicle) => (
                <Pressable key={vehicle} style={[styles.vehicleChip, vehicleType === vehicle && styles.vehicleChipActive]} onPress={() => setVehicleType(vehicle)}>
                  <Text style={[styles.vehicleChipText, vehicleType === vehicle && styles.vehicleChipTextActive]}>{vehicle}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Créer mon compte livreur</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingBottom: 28, minHeight: 320, overflow: "hidden" },
  headerMedia: {
    ...StyleSheet.absoluteFillObject,
  },
  headerMediaImage: {
    width: "100%",
    height: "100%",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 64, 59, 0.45)",
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  headerContent: {
    position: "relative",
    zIndex: 1,
  },
  headerTitle: { fontSize: 28, fontFamily: "Poppins_700Bold", color: "#fff" },
  headerSub: { fontSize: 14, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.88)", marginTop: 6 },
  heroIcon: { marginTop: 20, width: 88, height: 88, borderRadius: 44, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  body: { flex: 1, backgroundColor: Colors.light.background },
  form: { padding: 24, gap: 16 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FCA5A5" },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.error },
  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.backgroundSecondary, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.cardBorder, paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  input: { flex: 1, fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.text, padding: 0 },
  chipsRow: { flexDirection: "row", gap: 10 },
  vehicleChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.cardBorder },
  vehicleChipActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  vehicleChipText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  vehicleChipTextActive: { color: "#fff" },
  submitBtn: { backgroundColor: "#0F766E", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  submitBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#fff" },
});
