import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
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
import { Chef, useApp } from "@/contexts/AppContext";

const CATEGORIES = [
  { id: "all", label: "Tout", filter: null, emoji: "✨" },
  { id: "ivoirien", label: "Ivoirien", filter: "Ivoirien", emoji: "🇨🇮" },
  { id: "grillades", label: "Grillades", filter: "Grillades", emoji: "🍖" },
  { id: "snacks", label: "Snacks", filter: "Snacks", emoji: "🥪" },
  { id: "desserts", label: "Desserts", filter: "Desserts", emoji: "🧁" },
  { id: "dioula", label: "Dioula", filter: "Dioula", emoji: "🍲" },
  { id: "events", label: "Événements", filter: "Événements", emoji: "🎉" },
];

function getChefHeroImage(chef: Chef): string | null {
  return (
    chef.heroImageUrl ??
    chef.dishes?.find((dish) => dish.imageUrls?.[0])?.imageUrls?.[0] ??
    chef.dishes?.find((dish) => dish.imageUrl)?.imageUrl ??
    null
  );
}

function getApprovalRate(chef: Chef): number {
  return Math.max(91, Math.min(99, Math.round(chef.rating * 20)));
}

function getStatusBadge(chef: Chef) {
  if (chef.isOnline) {
    return {
      label: "En ligne",
      backgroundColor: "rgba(39,174,96,0.12)",
      textColor: Colors.light.success,
      icon: "radio" as const,
    };
  }

  if (chef.isVerified) {
    return {
      label: "Vérifiée",
      backgroundColor: "rgba(247,194,123,0.2)",
      textColor: Colors.light.tintDark,
      icon: "shield-checkmark" as const,
    };
  }

  return {
    label: "Cuisine maison",
    backgroundColor: Colors.light.backgroundSecondary,
    textColor: Colors.light.textSecondary,
    icon: "restaurant" as const,
  };
}

function FilterChip({
  label,
  emoji,
  active,
  onPress,
}: {
  label: string;
  emoji: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={styles.filterChipEmoji}>{emoji}</Text>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function RestaurantCard({
  chef,
  isFavorite,
  onFavoriteToggle,
}: {
  chef: Chef;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
}) {
  const heroImage = getChefHeroImage(chef);
  const initials = chef.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const topDish = chef.dishes?.[0] ?? null;
  const status = getStatusBadge(chef);

  return (
    <Pressable
      style={styles.restaurantCard}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
    >
      <View style={styles.restaurantCardMedia}>
        {heroImage ? (
          <ImageBackground source={{ uri: heroImage }} style={styles.restaurantCardImage} imageStyle={styles.restaurantCardImageStyle}>
            <View style={styles.restaurantCardOverlay} />
          </ImageBackground>
        ) : (
          <View style={[styles.restaurantCardImage, styles.restaurantCardFallback, { backgroundColor: chef.coverColor }]}>
            <Text style={styles.restaurantCardInitials}>{initials}</Text>
          </View>
        )}

        <View style={styles.restaurantCardTopBar}>
          <View style={[styles.statusBadge, { backgroundColor: status.backgroundColor }]}>
            <Ionicons name={status.icon} size={12} color={status.textColor} />
            <Text style={[styles.statusBadgeText, { color: status.textColor }]}>{status.label}</Text>
          </View>
          <Pressable style={styles.favoriteButton} onPress={onFavoriteToggle} hitSlop={10}>
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={18}
              color={isFavorite ? Colors.light.error : Colors.light.text}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.restaurantCardContent}>
        <View style={styles.restaurantCardHeaderRow}>
          <Text style={styles.restaurantCardTitle} numberOfLines={1}>{chef.name}</Text>
          {chef.isVerified ? <Text style={styles.restaurantCardSponsor}>Vérifiée</Text> : null}
        </View>

        <Text style={styles.restaurantCardSubtitle} numberOfLines={1}>{chef.specialty}</Text>

        <View style={styles.restaurantCardMetaRow}>
          <Text style={styles.restaurantCardMetaText}>
            👍 {getApprovalRate(chef)}% • {chef.responseTime} • {chef.priceRange || "Tarifs clairs"}
          </Text>
          <Text style={styles.restaurantCardSponsorMuted}>{chef.isOnline ? "Disponible" : "Sur demande"}</Text>
        </View>

        <View style={styles.restaurantCardBottomRow}>
          <View style={styles.restaurantCardLocationRow}>
            <Feather name="map-pin" size={13} color={Colors.light.textTertiary} />
            <Text style={styles.restaurantCardLocation} numberOfLines={1}>{chef.location.split(",")[0]}</Text>
          </View>
          {topDish ? (
            <View style={styles.restaurantCardDishPill}>
              <Text style={styles.restaurantCardDishText} numberOfLines={1}>{topDish.name}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { chefs, favorites, toggleFavorite, isLoadingChefs } = useApp();
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const onlineCount = chefs.filter((chef) => chef.isOnline).length;
  const isFiltering = query.trim().length > 0 || selectedFilter !== null;

  const filteredChefs = [...chefs]
    .filter((chef) => {
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        chef.name.toLowerCase().includes(normalizedQuery) ||
        chef.specialty.toLowerCase().includes(normalizedQuery) ||
        chef.location.toLowerCase().includes(normalizedQuery) ||
        chef.dishes.some((dish) => dish.name.toLowerCase().includes(normalizedQuery));

      const matchesFilter =
        selectedFilter === null ||
        chef.specialty.toLowerCase().includes(selectedFilter.toLowerCase());

      return matchesQuery && matchesFilter;
    })
    .sort(
      (a, b) =>
        Number(b.isOnline) - Number(a.isOnline) ||
        Number(b.isVerified) - Number(a.isVerified) ||
        b.rating - a.rating ||
        b.reviewCount - a.reviewCount
    );

  const featuredChef = filteredChefs[0] ?? null;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Explorer</Text>
        <Text style={styles.subtitle}>Des adresses qui donnent envie de commander, pas un simple annuaire.</Text>

        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={Colors.light.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cuisine, plat, quartier..."
            placeholderTextColor={Colors.light.textTertiary}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x" size={16} color={Colors.light.textTertiary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 92 }}
      >
        <View style={styles.editorialBlock}>
          <Text style={styles.editorialEyebrow}>Sélection du jour</Text>
          <Text style={styles.editorialTitle}>Choisis vite, commande mieux.</Text>
          <Text style={styles.editorialSubtitle}>Filtres simples, cartes claires, détails visibles avant même d’ouvrir la fiche.</Text>
          <View style={styles.editorialMetrics}>
            <View style={styles.editorialMetricPill}>
              <Text style={styles.editorialMetricValue}>{chefs.length}</Text>
              <Text style={styles.editorialMetricLabel}>adresses</Text>
            </View>
            <View style={styles.editorialMetricPill}>
              <Text style={styles.editorialMetricValue}>{onlineCount}</Text>
              <Text style={styles.editorialMetricLabel}>en ligne</Text>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {CATEGORIES.map((item) => (
            <FilterChip
              key={item.id}
              label={item.label}
              emoji={item.emoji}
              active={selectedFilter === item.filter}
              onPress={() => setSelectedFilter(item.filter)}
            />
          ))}
        </ScrollView>

        {isLoadingChefs ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.light.tint} size="large" />
            <Text style={styles.loadingText}>Chargement des cuisines...</Text>
          </View>
        ) : filteredChefs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔎</Text>
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptyDesc}>Essaie un autre plat, une autre cuisine ou un autre quartier.</Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => {
                setQuery("");
                setSelectedFilter(null);
              }}
            >
              <Text style={styles.emptyButtonText}>Réinitialiser</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {!isFiltering && featuredChef ? (
              <View style={styles.featuredWrap}>
                <Text style={styles.sectionLabel}>Adresse en vue</Text>
                <RestaurantCard
                  chef={featuredChef}
                  isFavorite={favorites.includes(featuredChef.id)}
                  onFavoriteToggle={() => toggleFavorite(featuredChef.id)}
                />
              </View>
            ) : null}

            <View style={styles.resultsSection}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>
                  {isFiltering ? `${filteredChefs.length} résultat${filteredChefs.length > 1 ? "s" : ""}` : "Toutes les adresses"}
                </Text>
                {selectedFilter !== null ? (
                  <Pressable style={styles.clearFilterPill} onPress={() => setSelectedFilter(null)}>
                    <Text style={styles.clearFilterText}>{selectedFilter}</Text>
                    <Feather name="x" size={13} color={Colors.light.tint} />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.cardList}>
                {filteredChefs.map((chef, index) => {
                  if (!isFiltering && featuredChef && chef.id === featuredChef.id && index === 0) {
                    return null;
                  }

                  return (
                    <RestaurantCard
                      key={chef.id}
                      chef={chef}
                      isFavorite={favorites.includes(chef.id)}
                      onFavoriteToggle={() => toggleFavorite(chef.id)}
                    />
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
    maxWidth: 310,
  },
  searchBox: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.text,
  },
  editorialBlock: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 24,
    padding: 18,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    gap: 8,
  },
  editorialEyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.tint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  editorialTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
    maxWidth: 240,
  },
  editorialSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
    maxWidth: 300,
  },
  editorialMetrics: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  editorialMetricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  editorialMetricValue: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  editorialMetricLabel: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
  filtersRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  filterChipEmoji: {
    fontSize: 14,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.textSecondary,
  },
  filterChipTextActive: {
    color: "#fff",
  },
  featuredWrap: {
    marginTop: 18,
  },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.tint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  resultsSection: {
    marginTop: 18,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resultsTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  clearFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  clearFilterText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
  cardList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  restaurantCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 3,
  },
  restaurantCardMedia: {
    position: "relative",
  },
  restaurantCardImage: {
    width: "100%",
    height: 184,
    justifyContent: "center",
    alignItems: "center",
  },
  restaurantCardImageStyle: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  restaurantCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,18,10,0.14)",
  },
  restaurantCardFallback: {
    backgroundColor: Colors.light.tint,
  },
  restaurantCardInitials: {
    fontSize: 30,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.94)",
  },
  restaurantCardTopBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
  },
  favoriteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantCardContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 13,
  },
  restaurantCardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  restaurantCardTitle: {
    flex: 1,
    color: Colors.light.text,
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
  },
  restaurantCardSponsor: {
    color: Colors.light.textTertiary,
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
  },
  restaurantCardSubtitle: {
    color: Colors.light.textSecondary,
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
  },
  restaurantCardMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  restaurantCardMetaText: {
    flex: 1,
    color: Colors.light.textSecondary,
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
  },
  restaurantCardSponsorMuted: {
    color: Colors.light.textTertiary,
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
  },
  restaurantCardBottomRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  restaurantCardLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
  },
  restaurantCardLocation: {
    flex: 1,
    color: Colors.light.textTertiary,
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
  },
  restaurantCardDishPill: {
    maxWidth: "48%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  restaurantCardDishText: {
    color: Colors.light.text,
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
  },
  loadingState: {
    alignItems: "center",
    paddingTop: 72,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 72,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  emptyDesc: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  emptyButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: Colors.light.tint,
  },
  emptyButtonText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
});
