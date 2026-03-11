import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChefCard } from "@/components/ChefCard";
import Colors from "@/constants/colors";
import { useApp, Chef } from "@/contexts/AppContext";

const FILTERS = ["Toutes", "Ivoirien", "Grillades", "Événements", "Snacks", "Desserts", "Dioula"];
const SORT = ["Popularité", "Proximité", "Note", "Prix"];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { chefs, favorites, toggleFavorite } = useApp();
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("Toutes");
  const [selectedSort, setSelectedSort] = useState("Popularité");

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const filtered: Chef[] = chefs.filter((chef) => {
    const matchQuery =
      !query ||
      chef.name.toLowerCase().includes(query.toLowerCase()) ||
      chef.specialty.toLowerCase().includes(query.toLowerCase()) ||
      chef.location.toLowerCase().includes(query.toLowerCase());
    return matchQuery;
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
            placeholder="Cuisinière, plat, quartier, occasion..."
            placeholderTextColor={Colors.light.textTertiary}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Feather
              name="x"
              size={16}
              color={Colors.light.textTertiary}
              onPress={() => setQuery("")}
            />
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
          <View
            key={f}
            style={[styles.filterChip, selectedFilter === f && styles.filterChipActive]}
            onTouchEnd={() => setSelectedFilter(f)}
          >
            <Text style={[styles.filterText, selectedFilter === f && styles.filterTextActive]}>{f}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
        style={styles.sortBar}
      >
        {SORT.map((s) => (
          <View
            key={s}
            style={[styles.sortChip, selectedSort === s && styles.sortChipActive]}
            onTouchEnd={() => setSelectedSort(s)}
          >
            {selectedSort === s && <Feather name="check" size={11} color={Colors.light.tint} />}
            <Text style={[styles.sortText, selectedSort === s && styles.sortTextActive]}>{s}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.results, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="search" size={40} color={Colors.light.tabIconDefault} />
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptyDesc}>Essayez un autre mot-clé ou quartier</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((chef) => (
              <ChefCard
                key={chef.id}
                chef={chef}
                variant="featured"
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
  results: { paddingHorizontal: 20, paddingTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.textSecondary,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
    textAlign: "center",
  },
});
