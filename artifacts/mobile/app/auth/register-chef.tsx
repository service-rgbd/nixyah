import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { SvgUri } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

const chefIllustrationAsset = require("../../assets/images/register-chef-illustration.svg");

function resolveLocalAssetUri(asset: number) {
  try {
    return Image.resolveAssetSource(asset)?.uri ?? null;
  } catch (error) {
    console.warn("Failed to resolve local asset uri", error);
    return null;
  }
}

const SPECIALTIES = [
  "Cuisine Ivoirienne", "Cuisine Sénégalaise", "Traiteur & Événements",
  "Grillades", "Snacks & Street Food", "Pâtisserie & Desserts",
  "Cuisine Dioula", "Cuisine Malienne", "Cuisine du Nord CI", "Autres"
];

const ZONES_ABIDJAN = [
  "Cocody", "Yopougon", "Plateau", "Marcory", "Abobo", "Adjamé",
  "Treichville", "Koumassi", "Riviera", "Angré", "Deux Plateaux", "Attécoubé"
];

const AVATAR_COLORS = [
  "#C4522A", "#8B5CF6", "#059669", "#D97706", "#DC2626", "#BE185D",
  "#1D4ED8", "#0891B2", "#7C3AED", "#065F46"
];

const PRICE_RANGES = [
  "500 – 2 000 FCFA", "1 000 – 5 000 FCFA", "2 000 – 8 000 FCFA",
  "3 000 – 12 000 FCFA", "5 000 – 20 000 FCFA", "Sur devis"
];

const STEPS = [
  { title: "Bienvenue chez Nixyah 🍲", sub: "Partagez votre talent culinaire avec toute la communauté" },
  { title: "Votre identité 👩‍🍳", sub: "Renseignez vos coordonnées pour que les clients vous trouvent" },
  { title: "Sécurisez votre profil 🔒", sub: "Votre mot de passe protège votre compte" },
  { title: "Votre couleur 🎨", sub: "Choisissez la couleur de votre profil Nixyah" },
  { title: "Votre zone de livraison 📍", sub: "Dans quels quartiers livrez-vous ?" },
  { title: "Vos spécialités 🌟", sub: "Sélectionnez votre type de cuisine" },
  { title: "Vos tarifs 💰", sub: "Donnez une idée de votre fourchette de prix" },
  { title: "Votre histoire 📖", sub: "Racontez votre parcours culinaire aux clients" },
];

export default function RegisterChefScreen() {
  const insets = useSafeAreaInsets();
  const { registerChef } = useApp();
  const [step, setStep] = useState(0);
  const chefIllustrationUri = useMemo(() => resolveLocalAssetUri(chefIllustrationAsset), []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [coverColor, setCoverColor] = useState(AVATAR_COLORS[0]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [specialty, setSpecialty] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [bio, setBio] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const TOTAL_STEPS = STEPS.length;
  const progress = step / (TOTAL_STEPS - 1);

  const toggleZone = (z: string) => {
    setSelectedZones((prev) =>
      prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]
    );
  };

  const validateStep = (): boolean => {
    setError("");
    if (step === 1) {
      if (!name.trim()) { setError("Votre nom est requis"); return false; }
      if (!email.trim() && !phone.trim()) { setError("Email ou téléphone requis"); return false; }
    }
    if (step === 2) {
      if (!password || password.length < 6) { setError("Minimum 6 caractères"); return false; }
      if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas"); return false; }
    }
    if (step === 4 && selectedZones.length === 0) { setError("Sélectionnez au moins un quartier"); return false; }
    if (step === 5 && !specialty) { setError("Sélectionnez votre spécialité"); return false; }
    if (step === 6 && !priceRange) { setError("Choisissez votre fourchette de prix"); return false; }
    if (step === 7 && bio.trim().length < 20) { setError("Décrivez-vous en au moins 20 caractères"); return false; }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await registerChef({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
        specialty,
        location: selectedZones.length > 0 ? `${selectedZones[0]}, Abidjan` : "Abidjan",
        zone: selectedZones.join(", "),
        bio: bio.trim(),
        priceRange,
        coverColor,
        specialties: [specialty],
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

  const initials = name ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerMedia} pointerEvents="none">
          {chefIllustrationUri ? <SvgUri width="100%" height="100%" uri={chefIllustrationUri} /> : null}
          <View style={styles.headerOverlay} />
        </View>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <Pressable style={styles.backBtn} onPress={() => step > 0 ? setStep(step - 1) : router.back()}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </Pressable>
            <Text style={styles.stepCounter}>{step + 1} / {TOTAL_STEPS}</Text>
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          <Text style={styles.headerTitle}>{STEPS[step].title}</Text>
          <Text style={styles.headerSub}>{STEPS[step].sub}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={15} color={Colors.light.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {step === 0 && (
            <View style={styles.welcomeSection}>
              <View style={[styles.welcomeIcon, { backgroundColor: coverColor }]}>
                <Ionicons name="restaurant" size={40} color="#fff" />
              </View>
              <View style={styles.benefitsList}>
                {[
                  { icon: "users" as const, text: "Accédez à des milliers de clients à Abidjan" },
                  { icon: "trending-up" as const, text: "Monétisez votre passion pour la cuisine" },
                  { icon: "message-circle" as const, text: "Gérez vos commandes facilement via l'app" },
                  { icon: "star" as const, text: "Construisez votre réputation avec les avis clients" },
                  { icon: "camera" as const, text: "Publiez des stories pour montrer vos plats" },
                ].map((b, i) => (
                  <View key={i} style={styles.benefitItem}>
                    <View style={styles.benefitIcon}>
                      <Feather name={b.icon} size={16} color={Colors.light.tint} />
                    </View>
                    <Text style={styles.benefitText}>{b.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {step === 1 && (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Nom complet *</Text>
                <View style={styles.inputRow}>
                  <Feather name="user" size={16} color={Colors.light.textTertiary} />
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Prénom et nom" placeholderTextColor={Colors.light.textTertiary} autoCapitalize="words" />
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
                <Text style={styles.label}>Téléphone (WhatsApp) *</Text>
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
                  <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Répétez votre mot de passe" placeholderTextColor={Colors.light.textTertiary} secureTextEntry={!showPassword} />
                </View>
              </View>
            </>
          )}

          {step === 3 && (
            <View style={styles.colorSection}>
              <View style={[styles.avatarPreview, { backgroundColor: coverColor }]}>
                <Text style={styles.avatarPreviewText}>{initials}</Text>
              </View>
              <Text style={styles.colorHint}>Cette couleur apparaît sur votre profil</Text>
              <View style={styles.colorsGrid}>
                {AVATAR_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.colorDot, { backgroundColor: c }, coverColor === c && styles.colorDotSelected]}
                    onPress={() => setCoverColor(c)}
                  >
                    {coverColor === c && <Feather name="check" size={14} color="#fff" />}
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Sélectionnez vos quartiers de livraison *</Text>
              <View style={styles.chipsGrid}>
                {ZONES_ABIDJAN.map((z) => (
                  <Pressable
                    key={z}
                    style={[styles.chip, selectedZones.includes(z) && styles.chipActive]}
                    onPress={() => toggleZone(z)}
                  >
                    {selectedZones.includes(z) && <Feather name="check" size={11} color="#fff" />}
                    <Text style={[styles.chipText, selectedZones.includes(z) && styles.chipTextActive]}>{z}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {step === 5 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Votre type de cuisine *</Text>
              <View style={styles.chipsGrid}>
                {SPECIALTIES.map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.chip, specialty === s && styles.chipActive]}
                    onPress={() => setSpecialty(s)}
                  >
                    <Text style={[styles.chipText, specialty === s && styles.chipTextActive]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {step === 6 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Fourchette de prix par plat *</Text>
              <View style={styles.chipsGrid}>
                {PRICE_RANGES.map((p) => (
                  <Pressable
                    key={p}
                    style={[styles.priceChip, priceRange === p && styles.chipActive]}
                    onPress={() => setPriceRange(p)}
                  >
                    <Text style={[styles.chipText, priceRange === p && styles.chipTextActive]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {step === 7 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Parlez de vous *</Text>
              <TextInput
                style={styles.bioInput}
                value={bio}
                onChangeText={setBio}
                placeholder="Racontez votre passion, votre expérience, vos spécialités... Les clients veulent vous connaître avant de commander !"
                placeholderTextColor={Colors.light.textTertiary}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <Text style={styles.bioCount}>{bio.length} caractères</Text>
            </View>
          )}

          <Pressable
            style={[styles.nextBtn, { backgroundColor: coverColor }, loading && { opacity: 0.7 }]}
            onPress={handleNext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>
                  {step === TOTAL_STEPS - 1 ? "Créer mon profil cuisinière 🎉" : "Continuer"}
                </Text>
                {step < TOTAL_STEPS - 1 && <Feather name="arrow-right" size={18} color="#fff" />}
              </>
            )}
          </Pressable>

          {step === 0 && (
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Déjà un compte ?</Text>
              <Pressable onPress={() => router.push("/auth/login")}>
                <Text style={styles.loginLink}>Se connecter</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.light.tint,
    paddingBottom: 24,
    overflow: "hidden",
    minHeight: 320,
  },
  headerContent: {
    paddingHorizontal: 24,
    position: "relative",
    zIndex: 1,
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  stepCounter: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "rgba(255,255,255,0.8)" },
  progressBar: { height: 4, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 2, marginBottom: 18, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 2 },
  headerTitle: { fontSize: 22, fontFamily: "Poppins_700Bold", color: "#fff", marginBottom: 4 },
  headerSub: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.85)" },
  headerMedia: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F2DAA2",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(70, 32, 12, 0.28)",
  },
  body: { flex: 1, backgroundColor: Colors.light.background },
  form: { padding: 24, gap: 16 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FCA5A5" },
  errorText: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.error, flex: 1 },
  welcomeSection: { alignItems: "center", gap: 24, paddingVertical: 8 },
  welcomeIcon: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  benefitsList: { width: "100%", gap: 12 },
  benefitItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  benefitText: { flex: 1, fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.text },
  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.backgroundSecondary, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.cardBorder, paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  input: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.light.text, padding: 0 },
  colorSection: { alignItems: "center", gap: 16 },
  avatarPreview: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  avatarPreviewText: { fontSize: 36, fontFamily: "Poppins_700Bold", color: "#fff" },
  colorHint: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  colorsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  colorDot: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  colorDotSelected: { borderWidth: 3, borderColor: Colors.light.text },
  chipsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.cardBorder, flexDirection: "row", alignItems: "center", gap: 4 },
  chipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  chipText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  chipTextActive: { color: "#fff" },
  priceChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.cardBorder },
  bioInput: { backgroundColor: Colors.light.backgroundSecondary, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 14, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.light.text, minHeight: 140 },
  bioCount: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, textAlign: "right" },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  nextBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  loginRow: { flexDirection: "row", justifyContent: "center", gap: 6, alignItems: "center" },
  loginText: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  loginLink: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
});
