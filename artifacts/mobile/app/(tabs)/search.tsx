import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useApp, Chef } from "@/contexts/AppContext";

const FILTERS = ["Toutes", "Ivoirien", "Grillades", "Événements", "Snacks", "Desserts", "Dioula"];

function ChefShowcaseCard({ chef, isFavorite, onFavoriteToggle }: { chef: Chef; isFavorite: boolean; onFavoriteToggle: () => void }) {
  const initials = chef.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const specialties = chef.dishes.slice(0, 3).map((dish) => dish.name).filter(Boolean);
  return (
    <Pressable
      style={styles.showcaseCard}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
    >
      <View style={[styles.showcaseHero, { backgroundColor: chef.coverColor }]}>
        <View style={styles.showcaseHeroTop}>
          <View style={styles.showcasePill}>
            <Ionicons name="star" size={12} color="#F7C27B" />
            <Text style={styles.showcasePillText}>{chef.rating.toFixed(1)} · {chef.reviewCount} avis</Text>
          </View>
          <Pressable style={styles.showcaseHeartBtn} onPress={onFavoriteToggle} hitSlop={12}>
            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={16} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.showcaseHeroBottom}>
          {chef.avatarUrl ? (
            <Image source={{ uri: chef.avatarUrl as string }} style={styles.showcaseAvatarImage} />
          ) : (
            <View style={styles.showcaseAvatarFallback}>
              <Text style={styles.showcaseInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.showcaseHeroText}>
            <Text style={styles.showcaseName}>{chef.name}</Text>
            <Text style={styles.showcaseSpecialty}>{chef.specialty}</Text>
          </View>
        </View>

        {chef.isOnline && (
          <View style={styles.showcaseOnlineBadge}>
            <View style={styles.showcaseOnlineDot} />
            <Text style={styles.showcaseOnlineText}>Disponible maintenant</Text>
          </View>
        )}
      </View>
      <View style={styles.showcaseContent}>
        <View style={styles.showcaseMetaRow}>
          <View style={styles.showcaseMetaItem}>
            <Feather name="map-pin" size={12} color={Colors.light.textTertiary} />
            <Text style={styles.showcaseMetaText}>{chef.location.split(",")[0]}</Text>
          </View>
          <View style={styles.showcaseMetaItem}>
            <Feather name="clock" size={12} color={Colors.light.textTertiary} />
            <Text style={styles.showcaseMetaText}>{chef.responseTime}</Text>
          </View>
          <Text style={styles.showcasePrice}>{chef.priceRange || "Tarif sur demande"}</Text>
        </View>

        {specialties.length > 0 ? (
          <View style={styles.specialtiesRow}>
            {specialties.map((label) => (
              <View key={label} style={styles.specialtyChip}>
                <Text style={styles.specialtyChipText} numberOfLines={1}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.showcaseFooter}>
          <Text style={styles.showcaseBio} numberOfLines={2}>
            {chef.bio || "Cuisine maison, service soigne et saveurs pensees pour votre moment."}
          </Text>
          <View style={styles.showcaseArrow}>
            <Feather name="arrow-right" size={16} color={Colors.light.tint} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { chefs, favorites, toggleFavorite, isLoadingChefs } = useApp();
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("Toutes");

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const filtered: Chef[] = chefs
    .filter((chef) => {
      const matchQuery =
        !query ||
        chef.name.toLowerCase().includes(query.toLowerCase()) ||
        chef.specialty.toLowerCase().includes(query.toLowerCase()) ||
        chef.location.toLowerCase().includes(query.toLowerCase());
      const matchFilter =
        selectedFilter === "Toutes" ||
        chef.specialty.toLowerCase().includes(selectedFilter.toLowerCase());
      return matchQuery && matchFilter;
    })
    .sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating);
  const featuredChef = filtered[0] ?? null;
  const secondaryChefs = featuredChef ? filtered.slice(1) : filtered;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <Feather name="search" size={17} color={Colors.light.tint} />
          </View>
          <Text style={styles.title}>Découvrir</Text>
        </View>
        <Text style={styles.subtitle}>{chefs.length} cuisinières sélectionnées pour vous</Text>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={Colors.light.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cuisinière, plat, quartier..."
            placeholderTextColor={Colors.light.textTertiary}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x" size={16} color={Colors.light.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={styles.filtersBar}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, selectedFilter === f && styles.filterChipActive]}
            onPress={() => setSelectedFilter(f)}
          >
            <Text style={[styles.filterText, selectedFilter === f && styles.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={[styles.results, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]} showsVerticalScrollIndicator={false}>
        {isLoadingChefs ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.light.tint} size="large" />
            <Text style={styles.loadingText}>Chargement des cuisinières...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="search" size={40} color={Colors.light.tabIconDefault} />
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptyDesc}>Essayez un autre mot-clé ou quartier</Text>
          </View>
        ) : (
          <View style={styles.showcaseList}>
            {featuredChef ? (
              <View style={styles.featuredProfileWrap}>
                <Text style={styles.sectionCaption}>Profil mis en avant</Text>
                <ChefShowcaseCard
                  chef={featuredChef}
                  isFavorite={favorites.includes(featuredChef.id)}
                  onFavoriteToggle={() => toggleFavorite(featuredChef.id)}
                />
              </View>
            ) : null}
            {secondaryChefs.map((chef) => (
              <ChefShowcaseCard
                key={chef.id}
                chef={chef}
                isFavorite={favorites.includes(chef.id)}
                onFavoriteToggle={() => toggleFavorite(chef.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.light.text,
    padding: 0,
  },
  filtersBar: { maxHeight: 48 },
  filtersRow: { paddingHorizontal: 20, gap: 8, alignItems: "center", paddingVertical: 6 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  filterChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  filterText: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
  filterTextActive: { color: "#fff" },
  results: { paddingHorizontal: 20, paddingTop: 8 },
  showcaseList: { gap: 16 },
  featuredProfileWrap: {
    gap: 10,
  },
  sectionCaption: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  loadingState: { alignItems: "center", paddingTop: 60, gap: 12 },
  loadingText: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: Colors.light.textSecondary },
  emptyDesc: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, textAlign: "center" },
  showcaseCard: {
    borderRadius: 24,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    overflow: "hidden",
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 4,
  },
  showcaseHero: {
    minHeight: 156,
    padding: 16,
    justifyContent: "space-between",
  },
  showcaseHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  showcasePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  showcasePillText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
  showcaseHeartBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  showcaseHeroBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  showcaseAvatarImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.45)",
  },
  showcaseAvatarFallback: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  showcaseInitials: {
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
  showcaseHeroText: {
    flex: 1,
    gap: 2,
  },
  showcaseName: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
  showcaseSpecialty: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: "rgba(255,255,255,0.88)",
  },
  showcaseOnlineBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  showcaseOnlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ADE80" },
  showcaseOnlineText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  showcaseContent: {
    padding: 16,
    gap: 12,
  },
  showcaseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  showcaseMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  showcaseMetaText: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
  showcasePrice: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.tint,
  },
  specialtiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  specialtyChip: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  specialtyChipText: {
    maxWidth: 120,
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  showcaseFooter: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  showcaseBio: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  showcaseArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.backgroundSecondary,
  },
});
