import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChefCard } from "@/components/ChefCard";
import Gradient from "@/components/SafeGradient";
import { apiFetch } from "@/constants/api";
import Colors from "@/constants/colors";
import { useApp, Story } from "@/contexts/AppContext";

const storiesDuJourIcon = require("@/assets/images/icon-storiesdujour.png") as ImageSourcePropType;
const gateauxMaisonIcon = require("@/assets/images/icon-maisongateaux.png") as ImageSourcePropType;
const courierIllustration = require("@/assets/images/courier-delivery-illustration.png") as ImageSourcePropType;

const SERVICE_GROUPS = [
  [
    { id: "restaurants", title: "Restaurants", emoji: "🍔", action: () => router.push("/(tabs)/search") },
    { id: "courses", title: "Courses", emoji: "🛒", action: () => router.push("/(tabs)/search") },
  ],
  [
    { id: "faq", title: "FAQ", emoji: "❓", action: () => router.push("/(tabs)/help") },
    { id: "support", title: "Support", emoji: "💬", action: () => router.push("/(tabs)/help") },
    { id: "courier", title: "Livraison", emoji: "🛵", action: () => router.push("/(tabs)/orders?mode=delivery") },
  ],
];

const CURATED_ITEMS = [
  { id: "express", title: "Stories du jour", emoji: "📹", imageSource: storiesDuJourIcon, action: () => router.push("/(tabs)/stories") },
  { id: "verified", title: "Cheffes verifiees", emoji: "✅", action: () => router.push("/(tabs)/search") },
  { id: "desserts", title: "Gateaux maison", emoji: "🧁", imageSource: gateauxMaisonIcon, action: () => router.push("/(tabs)/search") },
  { id: "promos", title: "Promotions", emoji: "🏷️", action: () => router.push("/(tabs)/search") },
];

function StoryCircle({ story }: { story: Story }) {
  const initials = story.chefName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const bgColor = story.bgColor ?? story.chefCoverColor;

  return (
    <Pressable
      style={styles.storyCircleItem}
      onPress={() => router.push({ pathname: "/story/[id]", params: { id: story.id } })}
    >
      <View style={[styles.storyCircleRing, { borderColor: bgColor }]}>
        <View style={[styles.storyCircleAvatar, { backgroundColor: bgColor }]}>
          {story.imageUrl ? (
            <Image source={{ uri: story.imageUrl }} style={styles.storyCircleImage} />
          ) : story.emoji ? (
            <Text style={styles.storyCircleEmoji}>{story.emoji}</Text>
          ) : (
            <Text style={styles.storyCircleInitials}>{initials}</Text>
          )}
        </View>
      </View>
      <Text style={styles.storyCircleLabel} numberOfLines={1}>
        {story.chefName.split(" ")[0]}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { chefs, stories, favorites, toggleFavorite, user, token } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const isCourier = user?.type === "courier";
  const locationLabel = user?.location || "Abidjan";
  const recommendedChefs = chefs.slice(0, 4);
  const onlineChefs = chefs.filter((chef) => chef.isOnline).slice(0, 8);
  const uniqueStories: Story[] = [];
  const seen = new Set<string>();

  for (const story of stories) {
    if (!seen.has(story.chefId)) {
      seen.add(story.chefId);
      uniqueStories.push(story);
    }
  }

  const [courierStats, setCourierStats] = useState({ current: 0, available: 0 });

  useEffect(() => {
    if (!isCourier || !token) return;
    (async () => {
      try {
        const [available, current] = await Promise.all([
          apiFetch<{ jobs: any[] }>("/delivery/jobs/available", { token }),
          apiFetch<{ jobs: any[] }>("/delivery/jobs/current", { token }),
        ]);
        setCourierStats({ current: current.jobs?.length ?? 0, available: available.jobs?.length ?? 0 });
      } catch (error) {
        console.warn("Failed to load courier dashboard:", error);
      }
    })();
  }, [isCourier, token]);

  if (isCourier) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 110 }}>
          <Gradient colors={["#0F766E", "#115E59", "#134E4A"]} style={[styles.heroSection, { paddingTop: topInset + 10 }]}>
            <View style={styles.courierHeroCard}>
              <View style={styles.courierHeroText}>
                <Text style={styles.courierEyebrow}>Dashboard livreur</Text>
                <Text style={styles.courierTitle}>Prenez une mission et suivez la course en direct.</Text>
                <Text style={styles.courierSubtitle}>{user?.courierProfile?.isAvailable ? "Disponible pour recevoir des missions" : "Indisponible actuellement"}</Text>
              </View>
              <Image source={courierIllustration} style={styles.courierHeroImage} resizeMode="contain" />
            </View>
          </Gradient>

          <View style={styles.mainContent}>
            <View style={styles.courierStatsRow}>
              <View style={styles.courierStatCard}>
                <Text style={styles.courierStatValue}>{courierStats.current}</Text>
                <Text style={styles.courierStatLabel}>Mission en cours</Text>
              </View>
              <View style={styles.courierStatCard}>
                <Text style={styles.courierStatValue}>{courierStats.available}</Text>
                <Text style={styles.courierStatLabel}>Missions disponibles</Text>
              </View>
            </View>

            <Pressable style={styles.courierPrimaryBtn} onPress={() => router.push("/(tabs)/orders")}>
              <Feather name="truck" size={18} color="#fff" />
              <Text style={styles.courierPrimaryBtnText}>Voir les missions</Text>
            </Pressable>

            <Pressable style={styles.courierSecondaryBtn} onPress={() => router.push("/(tabs)/profile")}>
              <Feather name="user" size={18} color="#0F766E" />
              <Text style={styles.courierSecondaryBtnText}>Mon profil livreur</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 110 }}
      >
        <Gradient
          colors={[Colors.light.tint, Colors.light.terracotta, Colors.light.tintDark]}
          style={[styles.heroSection, { paddingTop: topInset + 10 }]}
        >
          <Pressable style={styles.locationPill} onPress={() => router.push("/(tabs)/search")}>
            <Ionicons name="location-outline" size={15} color={Colors.light.text} />
            <Text style={styles.locationText} numberOfLines={1}>
              {locationLabel}
            </Text>
            <Feather name="chevron-down" size={16} color={Colors.light.text} />
          </Pressable>

          <View style={styles.heroGrid}>
            {SERVICE_GROUPS.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.heroGridRow}>
                {row.map((item) => (
                  <Pressable key={item.id} style={styles.serviceCard} onPress={item.action}>
                    <View style={styles.serviceIconWrap}>
                      <Text style={styles.serviceEmoji}>{item.emoji}</Text>
                    </View>
                    <Text style={styles.serviceLabel}>{item.title}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </Gradient>

        <View style={styles.mainContent}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ceci est pour vous</Text>
            <Pressable onPress={() => router.push("/(tabs)/stories")}>
              <Feather name="info" size={18} color={Colors.light.textTertiary} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.curatedRow}>
            {CURATED_ITEMS.map((item) => (
              <Pressable key={item.id} style={styles.curatedCard} onPress={item.action}>
                <View style={styles.curatedIcon}>
                  {item.imageSource ? (
                    <Image source={item.imageSource} style={styles.curatedImage} resizeMode="contain" />
                  ) : (
                    <Text style={styles.curatedEmoji}>{item.emoji}</Text>
                  )}
                </View>
                <Text style={styles.curatedTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {uniqueStories.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Stories du moment</Text>
                <Pressable onPress={() => router.push("/(tabs)/stories")}>
                  <Text style={styles.sectionLink}>Voir tout</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow}>
                {uniqueStories.map((story) => (
                  <StoryCircle key={story.id} story={story} />
                ))}
              </ScrollView>
            </>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>En ligne maintenant</Text>
            <Pressable onPress={() => router.push("/(tabs)/search")}>
              <Text style={styles.sectionLink}>Voir tout</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.onlineRow}>
            {onlineChefs.map((chef) => (
              <ChefCard
                key={chef.id}
                chef={chef}
                variant="compact"
                isFavorite={favorites.includes(chef.id)}
                onFavoriteToggle={() => toggleFavorite(chef.id)}
              />
            ))}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cuisinieres recommandees</Text>
            <Pressable onPress={() => router.push("/(tabs)/search")}>
              <Text style={styles.sectionLink}>Explorer</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendedRow}>
            {recommendedChefs.map((chef) => (
              <ChefCard
                key={chef.id}
                chef={chef}
                variant="default"
                isFavorite={favorites.includes(chef.id)}
                onFavoriteToggle={() => toggleFavorite(chef.id)}
              />
            ))}
          </ScrollView>

          <Gradient colors={[Colors.light.backgroundSecondary, Colors.light.background]} style={styles.promoCard}>
            <View style={styles.promoTimer}>
              <Text style={styles.promoTimerBox}>19</Text>
              <Text style={styles.promoTimerSeparator}>:</Text>
              <Text style={styles.promoTimerBox}>51</Text>
            </View>
            <View style={styles.promoBody}>
              <View style={{ flex: 1 }}>
                <Text style={styles.promoTitle}>Duree limitee : nouvelles adresses a -30 %</Text>
                <Text style={styles.promoText}>Retrouve des cheffes, des snacks et des plats du jour dans un format plus clair et plus rapide.</Text>
              </View>
              <View style={styles.promoVisual}>
                <Text style={styles.promoVisualEmoji}>🏷️</Text>
              </View>
            </View>
          </Gradient>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  heroSection: {
    paddingHorizontal: 18,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  locationPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minWidth: 220,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  locationText: {
    maxWidth: 170,
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  heroGrid: {
    marginTop: 22,
    gap: 12,
  },
  heroGridRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  serviceCard: {
    alignItems: "center",
    width: 100,
    gap: 7,
  },
  serviceIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.light.card,
    borderWidth: 2,
    borderColor: "rgba(212,97,26,0.14)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 3,
  },
  serviceEmoji: { fontSize: 34 },
  serviceLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
    textAlign: "center",
  },
  mainContent: {
    marginTop: -10,
    paddingTop: 18,
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  sectionLink: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.tint,
  },
  curatedRow: { paddingHorizontal: 20, gap: 10, paddingBottom: 18 },
  curatedCard: {
    width: 92,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 13,
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 2,
  },
  curatedIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  curatedImage: {
    width: 32,
    height: 32,
  },
  curatedEmoji: { fontSize: 22 },
  curatedTitle: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
  },
  storyRow: { paddingHorizontal: 20, gap: 14, paddingBottom: 10 },
  storyCircleItem: { width: 72, alignItems: "center", gap: 6 },
  storyCircleRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    padding: 3,
    backgroundColor: Colors.light.card,
  },
  storyCircleAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  storyCircleImage: { width: 56, height: 56, borderRadius: 28 },
  storyCircleEmoji: { fontSize: 25 },
  storyCircleInitials: { fontSize: 17, fontFamily: "Poppins_700Bold", color: "#fff" },
  storyCircleLabel: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  onlineRow: { paddingHorizontal: 20, gap: 14, paddingBottom: 12 },
  recommendedRow: { paddingHorizontal: 20, gap: 12, paddingBottom: 12 },
  promoCard: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  courierHeroCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 28,
    paddingLeft: 18,
    paddingRight: 10,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  courierHeroText: {
    flex: 1,
    gap: 8,
    alignItems: "flex-start",
  },
  courierHeroImage: {
    width: 170,
    height: 140,
  },
  courierEyebrow: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "rgba(255,255,255,0.8)", textTransform: "uppercase" },
  courierTitle: { fontSize: 28, lineHeight: 34, fontFamily: "Poppins_700Bold", color: "#fff", marginTop: 6 },
  courierSubtitle: { fontSize: 14, lineHeight: 21, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.88)" },
  courierStatsRow: { flexDirection: "row", gap: 12 },
  courierStatCard: { flex: 1, backgroundColor: Colors.light.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: Colors.light.cardBorder },
  courierStatValue: { fontSize: 28, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  courierStatLabel: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, marginTop: 4 },
  courierPrimaryBtn: { marginTop: 20, backgroundColor: "#0F766E", borderRadius: 18, paddingVertical: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  courierPrimaryBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  courierSecondaryBtn: { marginTop: 12, borderRadius: 18, paddingVertical: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1, borderColor: "#0F766E", backgroundColor: "#ECFDF5" },
  courierSecondaryBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#0F766E" },
  promoTimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  promoTimerBox: {
    backgroundColor: Colors.light.text,
    color: "#fff",
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  promoTimerSeparator: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  promoBody: { flexDirection: "row", alignItems: "center", gap: 14 },
  promoTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  promoText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  promoVisual: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: "rgba(212,97,26,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  promoVisualEmoji: { fontSize: 40 },
});
