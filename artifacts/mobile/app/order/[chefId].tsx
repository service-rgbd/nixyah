import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Gradient from "@/components/SafeGradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
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

const OCCASIONS = ["Repas quotidien", "Anniversaire", "Dîner romantique", "Baptême/Mariage", "Réunion famille", "Événement pro"];
const PERSON_OPTIONS = ["1-2", "3-5", "6-10", "10-20", "20-50", "50+"];
const BUDGET_OPTIONS = ["< 5 000 FCFA", "5 000 – 15 000", "15 000 – 50 000", "50 000 – 100 000", "> 100 000 FCFA"];
const PREFERENCES = ["Halal", "Sans porc", "Végétarien", "Très épicé", "Peu épicé", "Pas épicé", "Sans arachides", "Fruits de mer"];

const STEPS = [
  { label: "Occasion", icon: "star" as const },
  { label: "Personnes", icon: "users" as const },
  { label: "Budget", icon: "credit-card" as const },
  { label: "Préférences", icon: "heart" as const },
  { label: "Détails", icon: "edit-3" as const },
];

export default function OrderScreen() {
  const { chefId, dishName, price, storyCaption } = useLocalSearchParams<{
    chefId: string;
    dishName?: string;
    price?: string;
    storyCaption?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { getChef, addOrder, user } = useApp();
  const chef = getChef(chefId ?? "");
  const selectedDishName = typeof dishName === "string" ? dishName : "";
  const selectedDishPrice = typeof price === "string" ? Number(price) : null;
  const storySummary = typeof storyCaption === "string" ? storyCaption : "";
  const initialNotes = selectedDishName
    ? `Je souhaite commander ${selectedDishName}${selectedDishPrice ? ` (${selectedDishPrice.toLocaleString("fr-FR")} FCFA)` : ""}${storySummary ? `, vu dans la story: \"${storySummary}\"` : ""}.`
    : "";

  const [step, setStep] = useState(0);
  const [occasion, setOccasion] = useState(selectedDishName ? "Repas quotidien" : "");
  const [persons, setPersons] = useState("");
  const [budget, setBudget] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [notes, setNotes] = useState(initialNotes);
  const [submitted, setSubmitted] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const featuredDish = selectedDishName
    ? chef?.dishes.find((dish) => dish.name.toLowerCase() === selectedDishName.toLowerCase()) ?? null
    : null;

  if (user?.type === "courier") {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.successContent}>
          <Gradient colors={["#0F766E", "#115E59"]} style={styles.successIcon}>
            <Feather name="truck" size={40} color="#fff" />
          </Gradient>
          <Text style={styles.successTitle}>Espace livreur</Text>
          <Text style={styles.successDesc}>
            Les livreurs ne peuvent pas créer ni passer de commande.
          </Text>
          <Pressable style={styles.successBtn} onPress={() => router.replace("/(tabs)/orders")}>
            <Text style={styles.successBtnText}>Voir les missions</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const canProceed = () => {
    if (step === 0) return !!occasion;
    if (step === 1) return !!persons;
    if (step === 2) return !!budget;
    return true;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!chef) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addOrder({
      id: `order-${Date.now()}`,
      chefId: chef.id,
      chefName: chef.name,
      dishes: featuredDish ? [{ dish: featuredDish, quantity: 1 }] : [],
      total: featuredDish?.price ?? selectedDishPrice ?? 0,
      status: "pending",
      createdAt: new Date().toISOString(),
      occasion,
      persons: parseInt(persons.split("-")[0]) || 1,
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.successContent}>
            <Gradient
              colors={[Colors.light.tint, Colors.light.tintDark]}
              style={styles.successIcon}
            >
              <Feather name="check" size={40} color="#fff" />
            </Gradient>
          <Text style={styles.successTitle}>Demande envoyée !</Text>
          <Text style={styles.successDesc}>
            {chef?.name} a reçu votre demande et vous répondra dans {chef?.responseTime}.
          </Text>
          <Text style={styles.successSub}>Vous serez notifié dès sa réponse</Text>
          <Pressable
            style={styles.successBtn}
            onPress={() => router.push("/(tabs)/orders")}
          >
            <Text style={styles.successBtnText}>Voir mes commandes</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/") }>
            <Text style={styles.homeLink}>Retour à l'accueil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => step === 0 ? router.back() : setStep((s) => s - 1)} style={styles.closeBtn}>
          <Feather name={step === 0 ? "x" : "arrow-left"} size={20} color={Colors.light.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Demande sur-mesure</Text>
          {chef && <Text style={styles.headerSub}>{chef.name}</Text>}
        </View>
        <Text style={styles.stepCount}>{step + 1}/{STEPS.length}</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      {selectedDishName ? (
        <View style={styles.featuredDishBanner}>
          <View style={styles.featuredDishIcon}>
            <Feather name="play-circle" size={18} color={Colors.light.tint} />
          </View>
          <View style={styles.featuredDishTextWrap}>
            <Text style={styles.featuredDishLabel}>Plat mis en avant dans la story</Text>
            <Text style={styles.featuredDishName}>{selectedDishName}</Text>
          </View>
          <Text style={styles.featuredDishPrice}>
            {(featuredDish?.price ?? selectedDishPrice ?? 0).toLocaleString("fr-FR")} FCFA
          </Text>
        </View>
      ) : null}

      <View style={styles.stepIndicators}>
        {STEPS.map((s, i) => (
          <View key={i} style={styles.stepDot}>
            <View style={[styles.dot, i <= step && styles.dotActive, i < step && styles.dotDone]}>
              {i < step ? (
                <Feather name="check" size={10} color="#fff" />
              ) : (
                <Text style={[styles.dotNum, i === step && styles.dotNumActive]}>{i + 1}</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepQuestion}>
          {step === 0 && "Quelle est l'occasion ?"}
          {step === 1 && "Pour combien de personnes ?"}
          {step === 2 && "Quel est votre budget ?"}
          {step === 3 && "Avez-vous des préférences alimentaires ?"}
          {step === 4 && "Des détails supplémentaires ?"}
        </Text>
        <Text style={styles.stepHint}>
          {step === 0 && "Choisissez le contexte de votre repas"}
          {step === 1 && "Approximativement, pas besoin d'être exact"}
          {step === 2 && "Par personne ou au total"}
          {step === 3 && "Sélectionnez tout ce qui s'applique (optionnel)"}
          {step === 4 && "Plats préférés, allergies, heure souhaitée... (optionnel)"}
        </Text>

        {step === 0 && (
          <View style={styles.optionGrid}>
            {OCCASIONS.map((o) => (
              <Pressable
                key={o}
                style={[styles.optionChip, occasion === o && styles.optionChipActive]}
                onPress={() => setOccasion(o)}
              >
                <Text style={[styles.optionText, occasion === o && styles.optionTextActive]}>{o}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {step === 1 && (
          <View style={styles.optionGrid}>
            {PERSON_OPTIONS.map((p) => (
              <Pressable
                key={p}
                style={[styles.optionChip, styles.optionChipLarge, persons === p && styles.optionChipActive]}
                onPress={() => setPersons(p)}
              >
                <Text style={[styles.optionTextLarge, persons === p && styles.optionTextActive]}>{p}</Text>
                <Text style={[styles.optionSubText, persons === p && { color: "rgba(255,255,255,0.8)" }]}>pers.</Text>
              </Pressable>
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={styles.optionColumn}>
            {BUDGET_OPTIONS.map((b) => (
              <Pressable
                key={b}
                style={[styles.budgetOption, budget === b && styles.budgetOptionActive]}
                onPress={() => setBudget(b)}
              >
                <Feather
                  name={budget === b ? "check-circle" : "circle"}
                  size={20}
                  color={budget === b ? Colors.light.tint : Colors.light.tabIconDefault}
                />
                <Text style={[styles.budgetText, budget === b && styles.budgetTextActive]}>{b}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={styles.optionGrid}>
            {PREFERENCES.map((p) => (
              <Pressable
                key={p}
                style={[styles.optionChip, preferences.includes(p) && styles.optionChipActive]}
                onPress={() => {
                  setPreferences((prev) =>
                    prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                  );
                }}
              >
                <Text style={[styles.optionText, preferences.includes(p) && styles.optionTextActive]}>{p}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {step === 4 && (
          <View style={styles.notesSection}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex: j'aimerais l'attiéké braisé pour 18h00, sans trop piment, avec du fanta en boisson..."
              placeholderTextColor={Colors.light.textTertiary}
              style={styles.notesInput}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoFocus
            />
            <Text style={styles.notesHint}>La cuisinière vous répondra rapidement avec un devis personnalisé.</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomInset + 12 }]}>
        <Pressable
          style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canProceed()}
        >
          <Gradient
            colors={canProceed() ? [Colors.light.tint, Colors.light.tintDark] : [Colors.light.tabIconDefault, Colors.light.tabIconDefault]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextBtnGradient}
          >
            <Text style={styles.nextBtnText}>
              {step < STEPS.length - 1 ? "Continuer" : "Envoyer la demande"}
            </Text>
            <Feather name={step < STEPS.length - 1 ? "arrow-right" : "send"} size={18} color="#fff" />
          </Gradient>
        </Pressable>
        {step === 3 && (
          <Pressable onPress={handleNext}>
            <Text style={styles.skipText}>Passer cette étape</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20,
    paddingBottom: 12, gap: 12,
  },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  headerSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  stepCount: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  progressBar: {
    height: 3, backgroundColor: Colors.light.backgroundTertiary, marginHorizontal: 20, borderRadius: 2,
  },
  progressFill: { height: 3, backgroundColor: Colors.light.tint, borderRadius: 2 },
  featuredDishBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featuredDishIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${Colors.light.tint}16`,
  },
  featuredDishTextWrap: {
    flex: 1,
  },
  featuredDishLabel: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  featuredDishName: {
    marginTop: 2,
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  featuredDishPrice: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.tint,
  },
  stepIndicators: {
    flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 16,
  },
  stepDot: { alignItems: "center" },
  dot: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2,
    borderColor: Colors.light.backgroundTertiary,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.light.background,
  },
  dotActive: { borderColor: Colors.light.tint },
  dotDone: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  dotNum: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.textTertiary },
  dotNumActive: { color: Colors.light.tint },
  stepContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  stepQuestion: { fontSize: 22, fontFamily: "Poppins_700Bold", color: Colors.light.text, marginBottom: 6 },
  stepHint: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, marginBottom: 24 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  optionChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
    backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1.5,
    borderColor: Colors.light.cardBorder,
  },
  optionChipLarge: { width: "30%", alignItems: "center" },
  optionChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  optionText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  optionTextLarge: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  optionSubText: { fontSize: 10, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  optionTextActive: { color: "#fff" },
  optionColumn: { gap: 10 },
  budgetOption: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 16, borderRadius: 14, borderWidth: 1.5,
    borderColor: Colors.light.cardBorder, backgroundColor: Colors.light.card,
  },
  budgetOptionActive: { borderColor: Colors.light.tint, backgroundColor: Colors.light.backgroundSecondary },
  budgetText: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  budgetTextActive: { fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  notesSection: { gap: 12 },
  notesInput: {
    backgroundColor: Colors.light.backgroundSecondary, borderRadius: 16,
    padding: 16, fontSize: 14, fontFamily: "Poppins_400Regular",
    color: Colors.light.text, borderWidth: 1, borderColor: Colors.light.cardBorder,
    minHeight: 140,
  },
  notesHint: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, lineHeight: 18 },
  footer: {
    paddingHorizontal: 20, paddingTop: 12, gap: 12,
    borderTopWidth: 1, borderTopColor: Colors.light.divider,
    backgroundColor: Colors.light.background,
  },
  nextBtn: { borderRadius: 16, overflow: "hidden" },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnGradient: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16,
  },
  nextBtnText: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  skipText: { textAlign: "center", fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  successContent: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 16,
  },
  successIcon: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  successTitle: { fontSize: 24, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  successDesc: {
    fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary,
    textAlign: "center", lineHeight: 22,
  },
  successSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  successBtn: {
    backgroundColor: Colors.light.tint, borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 14, marginTop: 8,
  },
  successBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  homeLink: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
});
