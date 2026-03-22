import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Gradient from "@/components/SafeGradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { formatPrice } from "@/constants/chef-menu";
import { Dish, useApp } from "@/contexts/AppContext";

const OCCASIONS = ["Repas quotidien", "Anniversaire", "Dîner romantique", "Baptême/Mariage", "Réunion famille", "Événement pro"];
const PERSON_OPTIONS = ["1-2", "3-5", "6-10", "10-20", "20-50", "50+"];
const PERSON_ESTIMATES: Record<string, number> = {
  "1-2": 2,
  "3-5": 4,
  "6-10": 8,
  "10-20": 15,
  "20-50": 35,
  "50+": 50,
};
const BUDGET_OPTIONS = ["< 5 000 FCFA", "5 000 – 15 000", "15 000 – 50 000", "50 000 – 100 000", "> 100 000 FCFA"];
const PREFERENCES = ["Halal", "Sans porc", "Végétarien", "Très épicé", "Peu épicé", "Pas épicé", "Sans arachides", "Fruits de mer"];

const STEPS = [
  { label: "Occasion", icon: "star" as const },
  { label: "Personnes", icon: "users" as const },
  { label: "Budget", icon: "credit-card" as const },
  { label: "Préférences", icon: "heart" as const },
  { label: "Aperçu", icon: "file-text" as const },
];

function buildStructuredNotes(input: {
  packageDish: Dish;
  personLabel: string;
  personEstimate: number;
  estimatedTotal: number;
  occasion: string;
  budget: string;
  preferences: string[];
  notes: string;
  storySummary?: string;
}) {
  const sections = [
    `Formule choisie : ${input.packageDish.name}`,
    `Tarif indicatif : ${formatPrice(input.packageDish.price)} / pers.`,
    `Nombre de personnes : ${input.personLabel} (estimation ${input.personEstimate})`,
    `Estimation totale : ${formatPrice(input.estimatedTotal)}`,
    `Occasion : ${input.occasion}`,
    `Budget : ${input.budget}`,
    `Préférences : ${input.preferences.length > 0 ? input.preferences.join(", ") : "Aucune préférence particulière"}`,
  ];

  if (input.storySummary) {
    sections.push(`Référence story : ${input.storySummary}`);
  }

  if (input.notes.trim()) {
    sections.push(`Détails client : ${input.notes.trim()}`);
  }

  return sections.join("\n");
}

function PackageCard({
  dish,
  selected,
  persons,
  onPress,
}: {
  dish: Dish;
  selected: boolean;
  persons: string;
  onPress: () => void;
}) {
  const estimateCount = PERSON_ESTIMATES[persons] ?? 1;
  const estimate = dish.price * estimateCount;

  return (
    <Pressable style={[styles.packageCard, selected && styles.packageCardActive]} onPress={onPress}>
      <View style={styles.packageHeader}>
        <Text style={[styles.packageTitle, selected && styles.packageTitleActive]} numberOfLines={2}>{dish.name}</Text>
        {selected ? (
          <View style={styles.packageCheck}>
            <Feather name="check" size={14} color="#fff" />
          </View>
        ) : null}
      </View>
      <Text style={styles.packageDescription} numberOfLines={2}>{dish.description || "Formule modulable selon votre demande."}</Text>
      <View style={styles.packagePriceRow}>
        <Text style={[styles.packagePrice, selected && styles.packagePriceActive]}>{formatPrice(dish.price)}</Text>
        <Text style={styles.packagePriceMeta}>base / pers.</Text>
      </View>
      <View style={styles.packageEstimatePill}>
        <Text style={styles.packageEstimateText}>Estimation {persons || "1-2"} : {formatPrice(estimate)}</Text>
      </View>
    </Pressable>
  );
}

export default function OrderScreen() {
  const { chefId, dishName, price, storyCaption, packageId } = useLocalSearchParams<{
    chefId: string;
    dishName?: string;
    price?: string;
    storyCaption?: string;
    packageId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { getChef, createCustomRequest, user } = useApp();
  const chef = getChef(chefId ?? "");
  const selectedDishName = typeof dishName === "string" ? dishName : "";
  const selectedDishPrice = typeof price === "string" ? Number(price) : null;
  const storySummary = typeof storyCaption === "string" ? storyCaption : "";
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const customPackages = useMemo(
    () => (chef?.dishes ?? []).filter((dish) => dish.category === "Evenements"),
    [chef?.dishes],
  );
  const storyDish = useMemo(
    () => (chef?.dishes ?? []).find((dish) => dish.name.toLowerCase() === selectedDishName.toLowerCase()) ?? null,
    [chef?.dishes, selectedDishName],
  );
  const fallbackPackage = customPackages[0] ?? storyDish ?? null;

  const [step, setStep] = useState(0);
  const [occasion, setOccasion] = useState(selectedDishName ? "Repas quotidien" : "");
  const [persons, setPersons] = useState("");
  const [budget, setBudget] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [notes, setNotes] = useState(selectedDishName ? `Je veux une proposition inspirée de ${selectedDishName}.${storySummary ? ` Story: \"${storySummary}\".` : ""}` : "");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string>(typeof packageId === "string" ? packageId : fallbackPackage?.id ?? "");

  const selectedPackage = useMemo(
    () => customPackages.find((dish) => dish.id === selectedPackageId) ?? fallbackPackage,
    [customPackages, fallbackPackage, selectedPackageId],
  );
  const personEstimate = PERSON_ESTIMATES[persons] ?? 1;
  const estimatedTotal = selectedPackage ? selectedPackage.price * personEstimate : selectedDishPrice ?? 0;
  const canSubmit = Boolean(selectedPackage && occasion && persons && budget && !isSubmitting);

  if (user?.type === "courier") {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}> 
        <View style={styles.successContent}>
          <Gradient colors={["#0F766E", "#115E59"]} style={styles.successIcon}>
            <Feather name="truck" size={40} color="#fff" />
          </Gradient>
          <Text style={styles.successTitle}>Espace livreur</Text>
          <Text style={styles.successDesc}>Les livreurs ne peuvent pas créer ni passer de commande.</Text>
          <Pressable style={styles.successBtn} onPress={() => router.replace("/(tabs)/orders")}>
            <Text style={styles.successBtnText}>Voir les missions</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!chef || !selectedPackage) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}> 
        <View style={styles.successContent}>
          <Gradient colors={["#3F3A33", "#1F1A14"]} style={styles.successIcon}>
            <Feather name="slash" size={34} color="#fff" />
          </Gradient>
          <Text style={styles.successTitle}>Service indisponible</Text>
          <Text style={styles.successDesc}>
            Cette cuisinière n'a pas encore publié de formules sur-mesure. Ajoutez une formule dans la catégorie Evenements pour activer ce parcours.
          </Text>
          <Pressable style={styles.successBtn} onPress={() => router.back()}>
            <Text style={styles.successBtnText}>Retour au profil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const canProceed = () => {
    if (!selectedPackage) return false;
    if (step === 0) return Boolean(occasion);
    if (step === 1) return Boolean(persons);
    if (step === 2) return Boolean(budget);
    return true;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((current) => current + 1);
      return;
    }

    void handleSubmit();
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedPackage) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createCustomRequest({
        chefId: chef.id,
        packageDishId: selectedPackage.id,
        estimatedPersons: personEstimate,
        estimatedTotal,
        occasion,
        budget,
        preferences,
        storyReference: storySummary,
        notes: buildStructuredNotes({
          packageDish: selectedPackage,
          personLabel: persons,
          personEstimate,
          estimatedTotal,
          occasion,
          budget,
          preferences,
          notes,
          storySummary,
        }),
        deliveryAddress: user?.location,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erreur", error?.message ?? "Impossible d'envoyer la demande");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}> 
        <View style={styles.successContent}>
          <Gradient colors={[Colors.light.tint, Colors.light.tintDark]} style={styles.successIcon}>
            <Feather name="check" size={40} color="#fff" />
          </Gradient>
          <Text style={styles.successTitle}>Demande envoyée</Text>
          <Text style={styles.successDesc}>
            {chef.name} reçoit la formule, le nombre de convives, vos préférences et vos notes structurées. Vous serez notifié dès la réponse.
          </Text>
          <View style={styles.successSummaryCard}>
            <Text style={styles.successSummaryTitle}>{selectedPackage.name}</Text>
            <Text style={styles.successSummaryLine}>{persons} convives</Text>
            <Text style={styles.successSummaryLine}>Estimation : {formatPrice(estimatedTotal)}</Text>
          </View>
          <Pressable style={styles.successBtn} onPress={() => router.push("/(tabs)/orders")}>
            <Text style={styles.successBtnText}>Voir mes commandes</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/")}>
            <Text style={styles.homeLink}>Retour à l'accueil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}> 
      <View style={styles.header}>
        <Pressable onPress={() => step === 0 ? router.back() : setStep((current) => current - 1)} style={styles.closeBtn}>
          <Feather name={step === 0 ? "x" : "arrow-left"} size={20} color={Colors.light.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Demande sur-mesure</Text>
          <Text style={styles.headerSub}>{chef.name}</Text>
        </View>
        <Text style={styles.stepCount}>{step + 1}/{STEPS.length}</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
        <View style={styles.selectionCard}>
          <View style={styles.selectionHeader}>
            <View>
              <Text style={styles.selectionEyebrow}>Formules publiées</Text>
              <Text style={styles.selectionTitle}>Choisissez une base de devis</Text>
            </View>
            <Text style={styles.selectionCount}>{customPackages.length} option(s)</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packageRow}>
            {customPackages.map((dish) => (
              <PackageCard
                key={dish.id}
                dish={dish}
                selected={dish.id === selectedPackage?.id}
                persons={persons}
                onPress={() => setSelectedPackageId(dish.id)}
              />
            ))}
          </ScrollView>

          <View style={styles.liveEstimateCard}>
            <View>
              <Text style={styles.liveEstimateLabel}>Aperçu instantané</Text>
              <Text style={styles.liveEstimateTitle}>{selectedPackage.name}</Text>
            </View>
            <Text style={styles.liveEstimateValue}>{formatPrice(estimatedTotal)}</Text>
          </View>
        </View>

        {selectedDishName ? (
          <View style={styles.featuredDishBanner}>
            <View style={styles.featuredDishIcon}>
              <Feather name="play-circle" size={18} color={Colors.light.tint} />
            </View>
            <View style={styles.featuredDishTextWrap}>
              <Text style={styles.featuredDishLabel}>Référence story</Text>
              <Text style={styles.featuredDishName}>{selectedDishName}</Text>
            </View>
            <Text style={styles.featuredDishPrice}>{selectedDishPrice ? formatPrice(selectedDishPrice) : "Inspiration"}</Text>
          </View>
        ) : null}

        <View style={styles.stepIndicators}>
          {STEPS.map((item, index) => (
            <View key={item.label} style={styles.stepDot}>
              <View style={[styles.dot, index <= step && styles.dotActive, index < step && styles.dotDone]}>
                {index < step ? <Feather name="check" size={10} color="#fff" /> : <Text style={[styles.dotNum, index === step && styles.dotNumActive]}>{index + 1}</Text>}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.stepQuestion}>
          {step === 0 && "Quelle est l'occasion ?"}
          {step === 1 && "Pour combien de personnes ?"}
          {step === 2 && "Quel budget visez-vous ?"}
          {step === 3 && "Avez-vous des préférences alimentaires ?"}
          {step === 4 && "Vérifiez l'aperçu avant envoi"}
        </Text>
        <Text style={styles.stepHint}>
          {step === 0 && "Le contexte aide la cheffe à calibrer le format de la proposition."}
          {step === 1 && "L'estimation se met à jour automatiquement selon le nombre de convives."}
          {step === 2 && "La cheffe voit votre cible budgétaire dès réception."}
          {step === 3 && "Choisissez tout ce qui s'applique. Cette étape reste optionnelle."}
          {step === 4 && "Tous les détails transmis à la cuisinière apparaissent ci-dessous."}
        </Text>

        {step === 0 ? (
          <View style={styles.optionGrid}>
            {OCCASIONS.map((item) => (
              <Pressable key={item} style={[styles.optionChip, occasion === item && styles.optionChipActive]} onPress={() => setOccasion(item)}>
                <Text style={[styles.optionText, occasion === item && styles.optionTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.optionGrid}>
            {PERSON_OPTIONS.map((item) => (
              <Pressable key={item} style={[styles.optionChip, styles.optionChipLarge, persons === item && styles.optionChipActive]} onPress={() => setPersons(item)}>
                <Text style={[styles.optionTextLarge, persons === item && styles.optionTextActive]}>{item}</Text>
                <Text style={[styles.optionSubText, persons === item && styles.optionSubTextActive]}>pers.</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.optionColumn}>
            {BUDGET_OPTIONS.map((item) => (
              <Pressable key={item} style={[styles.budgetOption, budget === item && styles.budgetOptionActive]} onPress={() => setBudget(item)}>
                <Feather name={budget === item ? "check-circle" : "circle"} size={20} color={budget === item ? Colors.light.tint : Colors.light.tabIconDefault} />
                <Text style={[styles.budgetText, budget === item && styles.budgetTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.optionGrid}>
            {PREFERENCES.map((item) => {
              const selected = preferences.includes(item);
              return (
                <Pressable
                  key={item}
                  style={[styles.optionChip, selected && styles.optionChipActive]}
                  onPress={() => {
                    setPreferences((current) => selected ? current.filter((value) => value !== item) : [...current, item]);
                  }}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.previewStack}>
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Commande résumée</Text>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Formule</Text>
                <Text style={styles.previewValue}>{selectedPackage.name}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Occasion</Text>
                <Text style={styles.previewValue}>{occasion}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Convives</Text>
                <Text style={styles.previewValue}>{persons} ({personEstimate})</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Budget</Text>
                <Text style={styles.previewValue}>{budget}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Estimation</Text>
                <Text style={styles.previewValueAccent}>{formatPrice(estimatedTotal)}</Text>
              </View>
              <View style={styles.previewDivider} />
              <Text style={styles.previewSubTitle}>Préférences</Text>
              <Text style={styles.previewBody}>{preferences.length > 0 ? preferences.join(" • ") : "Aucune préférence particulière ajoutée."}</Text>
            </View>

            <View style={styles.notesSection}>
              <Text style={styles.previewSubTitle}>Détails supplémentaires</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Ex: livraison à 18h, sans trop piment, boissons séparées, menu enfant à prévoir..."
                placeholderTextColor={Colors.light.textTertiary}
                style={styles.notesInput}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <Text style={styles.notesHint}>Ces informations sont envoyées telles quelles à la cuisinière avec le récapitulatif structuré.</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomInset + 12 }]}> 
        <Pressable
          style={[styles.nextBtn, (!canProceed() || (step === STEPS.length - 1 && !canSubmit)) && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canProceed() || (step === STEPS.length - 1 && !canSubmit)}
        >
          <Gradient
            colors={canProceed() ? [Colors.light.tint, Colors.light.tintDark] : [Colors.light.tabIconDefault, Colors.light.tabIconDefault]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextBtnGradient}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>{step < STEPS.length - 1 ? "Continuer" : "Envoyer la demande"}</Text>
                <Feather name={step < STEPS.length - 1 ? "arrow-right" : "send"} size={18} color="#fff" />
              </>
            )}
          </Gradient>
        </Pressable>
        {step === 3 ? (
          <Pressable onPress={handleNext}>
            <Text style={styles.skipText}>Passer cette étape</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  headerSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  stepCount: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  progressBar: { height: 3, backgroundColor: Colors.light.backgroundTertiary, marginHorizontal: 20, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: Colors.light.tint, borderRadius: 2 },
  stepContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 16 },
  selectionCard: { borderRadius: 24, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 16, gap: 14 },
  selectionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  selectionEyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint, textTransform: "uppercase", letterSpacing: 0.8 },
  selectionTitle: { marginTop: 4, fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  selectionCount: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  packageRow: { gap: 12, paddingRight: 4 },
  packageCard: { width: 240, borderRadius: 20, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 14, gap: 10 },
  packageCardActive: { borderColor: Colors.light.tint, backgroundColor: "#FFF3E8" },
  packageHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  packageTitle: { flex: 1, fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  packageTitleActive: { color: Colors.light.tint },
  packageCheck: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.tint },
  packageDescription: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  packagePriceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  packagePrice: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  packagePriceActive: { color: Colors.light.tint },
  packagePriceMeta: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  packageEstimatePill: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: "rgba(212,97,26,0.1)", paddingHorizontal: 10, paddingVertical: 7 },
  packageEstimateText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  liveEstimateCard: { borderRadius: 18, backgroundColor: "#2A2017", padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  liveEstimateLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: 0.8 },
  liveEstimateTitle: { marginTop: 4, fontSize: 16, fontFamily: "Poppins_700Bold", color: "#fff" },
  liveEstimateValue: { fontSize: 18, fontFamily: "Poppins_700Bold", color: "#fff" },
  featuredDishBanner: { padding: 14, borderRadius: 18, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.cardBorder, flexDirection: "row", alignItems: "center", gap: 12 },
  featuredDishIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: `${Colors.light.tint}16` },
  featuredDishTextWrap: { flex: 1 },
  featuredDishLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
  featuredDishName: { marginTop: 2, fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  featuredDishPrice: { fontSize: 13, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  stepIndicators: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 4 },
  stepDot: { alignItems: "center" },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.light.backgroundTertiary, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.background },
  dotActive: { borderColor: Colors.light.tint },
  dotDone: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  dotNum: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.textTertiary },
  dotNumActive: { color: Colors.light.tint },
  stepQuestion: { fontSize: 22, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  stepHint: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, marginTop: -10 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  optionChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1.5, borderColor: Colors.light.cardBorder },
  optionChipLarge: { width: "30%", alignItems: "center" },
  optionChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  optionText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  optionTextLarge: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  optionSubText: { fontSize: 10, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  optionSubTextActive: { color: "rgba(255,255,255,0.82)" },
  optionTextActive: { color: "#fff" },
  optionColumn: { gap: 10 },
  budgetOption: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.light.cardBorder, backgroundColor: Colors.light.card },
  budgetOptionActive: { borderColor: Colors.light.tint, backgroundColor: Colors.light.backgroundSecondary },
  budgetText: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  budgetTextActive: { fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  previewStack: { gap: 14 },
  previewCard: { borderRadius: 22, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 16, gap: 10 },
  previewTitle: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  previewRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  previewLabel: { flex: 1, fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  previewValue: { flex: 1, fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, textAlign: "right" },
  previewValueAccent: { flex: 1, fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.tint, textAlign: "right" },
  previewDivider: { height: 1, backgroundColor: Colors.light.divider, marginVertical: 4 },
  previewSubTitle: { fontSize: 14, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  previewBody: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  notesSection: { gap: 10 },
  notesInput: { backgroundColor: Colors.light.backgroundSecondary, borderRadius: 16, padding: 16, fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.text, borderWidth: 1, borderColor: Colors.light.cardBorder, minHeight: 140 },
  notesHint: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, lineHeight: 18 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 12, borderTopWidth: 1, borderTopColor: Colors.light.divider, backgroundColor: Colors.light.background },
  nextBtn: { borderRadius: 16, overflow: "hidden" },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, minHeight: 56 },
  nextBtnText: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  skipText: { textAlign: "center", fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  successContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 16 },
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  successTitle: { fontSize: 24, fontFamily: "Poppins_700Bold", color: Colors.light.text, textAlign: "center" },
  successDesc: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 22 },
  successSummaryCard: { borderRadius: 18, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 16, alignItems: "center", gap: 4, minWidth: 220 },
  successSummaryTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  successSummaryLine: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  successBtn: { backgroundColor: Colors.light.tint, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  successBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  homeLink: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
});