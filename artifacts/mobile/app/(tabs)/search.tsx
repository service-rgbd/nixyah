import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 14;
const CARD_H_PADDING = 20;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_H_PADDING * 2 - CARD_GAP) / 2;

const FILTERS = ["Toutes", "Ivoirien", "Grillades", "Événements", "Snacks", "Desserts", "Dioula"];
const SORT = ["Popularité", "Note", "Prix"];

function ChefGridCard({ chef, isFavorite, onFavoriteToggle }: { chef: Chef; isFavorite: boolean; onFavoriteToggle: () => void }) {
  const initials = chef.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  return (
    <Pressable
      style={[styles.card, { width: CARD_WIDTH }]}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
    >
      <View style={[styles.cardBg, { backgroundColor: chef.coverColor }]}>
        <Text style={styles.cardInitials}>{initials}</Text>
        <Pressable style={styles.heartBtn} onPress={onFavoriteToggle} hitSlop={12}>
          <Feather name="heart" size={14} color={isFavorite ? "#fff" : "rgba(255,255,255,0.7)"} />
        </Pressable>
        {chef.isOnline && (
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>En ligne</Text>
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{chef.name}</Text>
        <Text style={styles.cardSpecialty} numberOfLines={1}>{chef.specialty}</Text>
        <View style={styles.cardMeta}>
          <Feather name="star" size={11} color="#F59E0B" />
          <Text style={styles.cardRating}>{chef.rating.toFixed(1)}</Text>
          <Text style={styles.cardDot}>·</Text>
          <Feather name="map-pin" size={10} color={Colors.light.textTertiary} />
          <Text style={styles.cardLocation} numberOfLines={1}>{chef.location.split(",")[0]}</Text>
        </View>
        <Text style={styles.cardPrice} numberOfLines={1}>{chef.priceRange}</Text>
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { chefs, favorites, toggleFavorite, isLoadingChefs } = useApp();
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("Toutes");
  const [selectedSort, setSelectedSort] = useState("Popularité");

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
    .sort((a, b) => {
      if (selectedSort === "Note") return b.rating - a.rating;
      if (selectedSort === "Popularité") return b.reviewCount - a.reviewCount;
      return 0;
    });

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Découvrir</Text>
        <Text style={styles.subtitle}>{chefs.length} cuisinières disponibles</Text>
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
        style={styles.sortBar}
      >
        {SORT.map((s) => (
          <Pressable
            key={s}
            style={[styles.sortChip, selectedSort === s && styles.sortChipActive]}
            onPress={() => setSelectedSort(s)}
          >
            {selectedSort === s && <Feather name="check" size={11} color={Colors.light.tint} />}
            <Text style={[styles.sortText, selectedSort === s && styles.sortTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.results, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
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
          <View style={styles.grid}>
            {filtered.map((chef) => (
              <ChefGridCard
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
  title: {
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
    marginBottom: 2,
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
  filtersBar: { maxHeight: 52 },
  filtersRow: { paddingHorizontal: 20, gap: 8, alignItems: "center", paddingVertical: 8 },
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
  sortBar: { maxHeight: 44 },
  sortRow: { paddingHorizontal: 20, gap: 8, alignItems: "center", paddingVertical: 4 },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  sortChipActive: { backgroundColor: Colors.light.backgroundSecondary },
  sortText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  sortTextActive: { color: Colors.light.tint, fontFamily: "Poppins_600SemiBold" },
  results: { paddingHorizontal: CARD_H_PADDING, paddingTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP },
  loadingState: { alignItems: "center", paddingTop: 60, gap: 12 },
  loadingText: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: Colors.light.textSecondary },
  emptyDesc: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, textAlign: "center" },
  card: {
    borderRadius: 16,
    backgroundColor: Colors.light.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  cardBg: {
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInitials: {
    fontSize: 30,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.9)",
  },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ADE80" },
  onlineText: { fontSize: 9, fontFamily: "Poppins_500Medium", color: "#fff" },
  cardInfo: { padding: 10 },
  cardName: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  cardSpecialty: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, marginTop: 1 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 5 },
  cardRating: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  cardDot: { fontSize: 11, color: Colors.light.textTertiary },
  cardLocation: { fontSize: 10, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, flex: 1 },
  cardPrice: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint, marginTop: 4 },
});
