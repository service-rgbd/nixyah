import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChefCard } from "@/components/ChefCard";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CATEGORIES = [
  { id: "all", label: "Tout", icon: "grid" as const },
  { id: "ivoirien", label: "Ivoirien", icon: "flag" as const },
  { id: "grillades", label: "Grillades", icon: "zap" as const },
  { id: "events", label: "Événements", icon: "star" as const },
  { id: "snacks", label: "Snacks", icon: "coffee" as const },
  { id: "desserts", label: "Desserts", icon: "heart" as const },
];

const STORIES = [
  { id: "s1", chefId: "1", color: "#C4522A" },
  { id: "s2", chefId: "2", color: "#8B5CF6" },
  { id: "s3", chefId: "3", color: "#059669" },
  { id: "s4", chefId: "4", color: "#D97706" },
  { id: "s5", chefId: "6", color: "#BE185D" },
];

function StoryItem({ chefId, color }: { chefId: string; color: string }) {
  const { getChef } = useApp();
  const chef = getChef(chefId);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!chef) return null;

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.92); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chefId } })}
    >
      <Animated.View style={[styles.storyWrapper, animStyle]}>
        <View style={[styles.storyRing, { borderColor: color }]}>
          <View style={[styles.storyAvatar, { backgroundColor: color }]}>
            <Text style={styles.storyInitials}>
              {chef.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </Text>
          </View>
        </View>
        <Text style={styles.storyName} numberOfLines={1}>{chef.name.split(" ")[0]}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { chefs, favorites, toggleFavorite } = useApp();
  const scrollY = useSharedValue(0);
  const [selectedCategory, setSelectedCategory] = React.useState("all");

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => ({
    opacity: scrollY.value > 60 ? 1 : 0,
  }));

  const popularChefs = chefs.slice(0, 4);
  const nearbyChefs = chefs.filter((c) => c.isOnline);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.stickyHeader, headerStyle, { paddingTop: topInset + 8 }]}>
        <Text style={styles.stickyLogo}>nixyah</Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 100 }}
      >
        <LinearGradient
          colors={["#D4611A", "#B5501A", "#8B3A12"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroGradient, { paddingTop: topInset + 16 }]}
        >
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroGreeting}>Bonjour </Text>
              <Text style={styles.heroTitle}>Que mangez-vous{"\n"}aujourd'hui ?</Text>
            </View>
            <Pressable onPress={() => router.push("/chat/new")} style={styles.bellBtn}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
            </Pressable>
          </View>

          <Pressable
            style={styles.searchBar}
            onPress={() => router.push("/(tabs)/search")}
          >
            <Feather name="search" size={16} color={Colors.light.textTertiary} />
            <Text style={styles.searchPlaceholder}>Cuisinière, plat, quartier…</Text>
            <View style={styles.filterBtn}>
              <Feather name="sliders" size={14} color={Colors.light.tint} />
            </View>
          </Pressable>
        </LinearGradient>

        <View style={styles.storiesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
            {STORIES.map((s) => (
              <StoryItem key={s.id} chefId={s.chefId} color={s.color} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.categoriesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Feather
                  name={cat.icon}
                  size={13}
                  color={selectedCategory === cat.id ? "#fff" : Colors.light.textSecondary}
                />
                <Text style={[styles.categoryLabel, selectedCategory === cat.id && styles.categoryLabelActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>En ligne maintenant</Text>
          <Pressable onPress={() => router.push("/(tabs)/search")}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          {nearbyChefs.map((chef) => (
            <ChefCard
              key={chef.id}
              chef={chef}
              variant="featured"
              isFavorite={favorites.includes(chef.id)}
              onFavoriteToggle={() => toggleFavorite(chef.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Populaires près de vous</Text>
          <Pressable onPress={() => router.push("/(tabs)/search")}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </Pressable>
        </View>
        <View style={styles.gridSection}>
          {popularChefs.map((chef) => (
            <ChefCard
              key={chef.id}
              chef={chef}
              variant="default"
              isFavorite={favorites.includes(chef.id)}
              onFavoriteToggle={() => toggleFavorite(chef.id)}
            />
          ))}
        </View>

        <View style={styles.bannerSection}>
          <LinearGradient
            colors={["#F7C27B", "#D4611A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promoBanner}
          >
            <View style={styles.promoContent}>
              <Text style={styles.promoLabel}>Nouveau</Text>
              <Text style={styles.promoTitle}>Chef à domicile</Text>
              <Text style={styles.promoDesc}>Réservez une cuisinière pour votre événement privé</Text>
              <Pressable
                style={styles.promoBtn}
                onPress={() => router.push("/(tabs)/search")}
              >
                <Text style={styles.promoBtnText}>Découvrir</Text>
                <Feather name="arrow-right" size={14} color={Colors.light.tint} />
              </Pressable>
            </View>
            <View style={styles.promoDecor}>
              <Text style={styles.promoEmojiBig}>🍲</Text>
            </View>
          </LinearGradient>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: Colors.light.card,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  stickyLogo: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: Colors.light.tint,
    letterSpacing: -0.5,
  },
  heroGradient: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  heroGreeting: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.75)",
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
    lineHeight: 34,
    marginTop: 2,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
  filterBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  storiesSection: { paddingVertical: 16 },
  storiesRow: { paddingHorizontal: 20, gap: 14 },
  storyWrapper: { alignItems: "center", gap: 5, width: 64 },
  storyRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  storyAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  storyInitials: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.9)",
  },
  storyName: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  categoriesSection: { marginBottom: 8 },
  categoriesRow: { paddingHorizontal: 20, gap: 8 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  categoryChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  categoryLabel: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
  categoryLabelActive: { color: "#fff" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.tint,
  },
  horizontalList: { paddingHorizontal: 20, gap: 14, paddingBottom: 4 },
  gridSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    gap: 14,
    marginBottom: 8,
  },
  bannerSection: { paddingHorizontal: 20, marginTop: 8 },
  promoBanner: {
    borderRadius: 20,
    flexDirection: "row",
    overflow: "hidden",
    minHeight: 130,
  },
  promoContent: { flex: 1, padding: 18, justifyContent: "center", gap: 4 },
  promoLabel: {
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  promoTitle: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
  promoDesc: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.85)",
    lineHeight: 17,
  },
  promoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  promoBtnText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
  promoDecor: {
    width: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  promoEmojiBig: { fontSize: 56 },
});
