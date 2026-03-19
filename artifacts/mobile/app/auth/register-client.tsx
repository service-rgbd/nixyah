import { Feather } from "@expo/vector-icons";
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

const authUsersImage = require("../../assets/images/login-register-users.png");

const ZONES = ["Cocody", "Yopougon", "Plateau", "Marcory", "Abobo", "Adjamé", "Treichville", "Koumassi", "Riviera", "Angré"];
const PREFS = ["Ivoirien", "Sénégalais", "Grillades", "Snacks", "Desserts", "Traiteur", "Street food", "Végétarien"];

export default function RegisterClientScreen() {
  const insets = useSafeAreaInsets();
  const { registerClient } = useApp();
  const [step, setStep] = useState(1);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [location, setLocation] = useState("Abidjan");
  const [selectedZone, setSelectedZone] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const togglePref = (p: string) => {
    setPreferences((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleNext = () => {
    setError("");
    if (step === 1) {
      if (!name.trim()) { setError("Votre prénom est requis"); return; }
      if (!email.trim() && !phone.trim()) { setError("Email ou téléphone requis"); return; }
      setStep(2);
    } else if (step === 2) {
      if (!password.trim()) { setError("Mot de passe requis"); return; }
      if (password.length < 6) { setError("Minimum 6 caractères"); return; }
      if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas"); return; }
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await registerClient({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
        location: selectedZone ? `${selectedZone}, ${location}` : location,
        preferences,
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
      <Gradient
        colors={[Colors.light.tint, Colors.light.tintDark]}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerMedia} pointerEvents="none">
          <Image source={authUsersImage} style={styles.headerMediaImage} resizeMode="cover" />
          <View style={styles.headerOverlay} />
        </View>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <Pressable style={styles.backBtn} onPress={() => step > 1 ? setStep(step - 1) : router.back()}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </Pressable>
            <View style={styles.steps}>
              {[1, 2, 3].map((s) => (
                <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]} />
              ))}
            </View>
          </View>
          <Text style={styles.headerTitle}>
            {step === 1 ? "Créer mon compte 🛒" : step === 2 ? "Sécurisez votre accès 🔒" : "Personnalisez votre expérience 🍽️"}
          </Text>
          <Text style={styles.headerSub}>
            {step === 1 ? "Vos coordonnées pour commander facilement" : step === 2 ? "Choisissez un mot de passe sûr" : "Dites-nous ce que vous aimez manger"}
          </Text>
        </View>
      </Gradient>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={15} color={Colors.light.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {step === 1 && (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Votre prénom *</Text>
                <View style={styles.inputRow}>
                  <Feather name="user" size={16} color={Colors.light.textTertiary} />
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Kouamé" placeholderTextColor={Colors.light.textTertiary} autoCapitalize="words" />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputRow}>
                  <Feather name="mail" size={16} color={Colors.light.textTertiary} />
                  <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@exemple.com" placeholderTextColor={Colors.light.textTertiary} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Téléphone (WhatsApp)</Text>
                <View style={styles.inputRow}>
                  <Feather name="phone" size={16} color={Colors.light.textTertiary} />
                  <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+225 07 00 00 00 00" placeholderTextColor={Colors.light.textTertiary} keyboardType="phone-pad" />
                </View>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Mot de passe *</Text>
                <View style={styles.inputRow}>
                  <Feather name="lock" size={16} color={Colors.light.textTertiary} />
                  <TextInput style={[styles.input, { flex: 1 }]} value={password} onChangeText={setPassword} placeholder="Minimum 6 caractères" placeholderTextColor={Colors.light.textTertiary} secureTextEntry={!showPassword} />
                  <Pressable onPress={() => setShowPassword(!showPassword)}>
                    <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={Colors.light.textTertiary} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirmer le mot de passe *</Text>
                <View style={styles.inputRow}>
                  <Feather name="lock" size={16} color={Colors.light.textTertiary} />
                  <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Répétez le mot de passe" placeholderTextColor={Colors.light.textTertiary} secureTextEntry={!showPassword} />
                </View>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Votre quartier</Text>
                <View style={styles.zonesGrid}>
                  {ZONES.map((z) => (
                    <Pressable
                      key={z}
                      style={[styles.zoneChip, selectedZone === z && styles.zoneChipActive]}
                      onPress={() => setSelectedZone(selectedZone === z ? "" : z)}
                    >
                      <Text style={[styles.zoneText, selectedZone === z && styles.zoneTextActive]}>{z}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Vos cuisines préférées</Text>
                <View style={styles.zonesGrid}>
                  {PREFS.map((p) => (
                    <Pressable
                      key={p}
                      style={[styles.zoneChip, preferences.includes(p) && styles.zoneChipActive]}
                      onPress={() => togglePref(p)}
                    >
                      <Text style={[styles.zoneText, preferences.includes(p) && styles.zoneTextActive]}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          )}

          {step < 3 ? (
            <Pressable style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>Continuer</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </Pressable>
          ) : (
            <Pressable style={[styles.nextBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>Créer mon compte</Text>
                  <Feather name="check" size={18} color="#fff" />
                </>
              )}
            </Pressable>
          )}

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Déjà un compte ?</Text>
            <Pressable onPress={() => router.push("/auth/login")}>
              <Text style={styles.loginLink}>Se connecter</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 24, overflow: "hidden", minHeight: 320 },
  headerContent: { paddingHorizontal: 24, position: "relative", zIndex: 1 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  steps: { flexDirection: "row", gap: 8 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.35)" },
  stepDotActive: { backgroundColor: "#fff", width: 20, borderRadius: 4 },
  headerTitle: { fontSize: 24, fontFamily: "Poppins_700Bold", color: "#fff", marginBottom: 4 },
  headerSub: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.85)" },
  headerMedia: {
    ...StyleSheet.absoluteFillObject,
  },
  headerMediaImage: {
    width: "100%",
    height: "100%",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(70, 32, 12, 0.42)",
  },
  body: { flex: 1, backgroundColor: Colors.light.background },
  form: { padding: 24, gap: 16 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FCA5A5" },
  errorText: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.error, flex: 1 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.backgroundSecondary, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.cardBorder, paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  input: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.light.text, padding: 0 },
  zonesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  zoneChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.cardBorder },
  zoneChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  zoneText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  zoneTextActive: { color: "#fff" },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.tint, borderRadius: 16, paddingVertical: 16, marginTop: 8, shadowColor: Colors.light.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  nextBtnText: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  loginRow: { flexDirection: "row", justifyContent: "center", gap: 6, alignItems: "center", marginTop: 4 },
  loginText: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  loginLink: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
});
