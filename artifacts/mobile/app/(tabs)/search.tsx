import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useApp, Chef } from "@/contexts/AppContext";

const FILTERS = ["Toutes", "Ivoirien", "Grillades", "Événements", "Snacks", "Desserts", "Dioula"];

const CATEGORIES = [
  { id: "ivoirien",  label: "Ivoirien",    emoji: "🇨🇮", filter: "Ivoirien"    },
  { id: "grillades", label: "Grillades",   emoji: "🍖",  filter: "Grillades"   },
  { id: "snacks",    label: "Snacks",      emoji: "🥪",  filter: "Snacks"      },
  { id: "desserts",  label: "Desserts",    emoji: "🧁",  filter: "Desserts"    },
  { id: "dioula",    label: "Dioula",      emoji: "🍲",  filter: "Dioula"      },
  { id: "events",    label: "Événements",  emoji: "🎉",  filter: "Événements"  },
];

function ChefSpotlightCard({ chef, isFavorite, onFavoriteToggle }: { chef: Chef; isFavorite: boolean; onFavoriteToggle: () => void }) {
  const heroImage = getChefHeroImage(chef);
  const initials = chef.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const firstDish = chef.dishes?.[0] ?? null;

  return (
    <Pressable
      style={styles.spotlightCard}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
    >
      <View style={styles.spotlightMedia}>
        {heroImage ? (
          <ImageBackground source={{ uri: heroImage }} style={styles.spotlightImage} imageStyle={styles.spotlightImageStyle}>
            <View style={styles.spotlightOverlay} />
          </ImageBackground>
        ) : (
          <View style={[styles.spotlightImage, styles.spotlightFallback, { backgroundColor: chef.coverColor }]}>
            <Text style={styles.spotlightInitials}>{initials}</Text>
          </View>
        )}

        <Pressable style={styles.spotlightHeart} onPress={onFavoriteToggle} hitSlop={10}>
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={16}
            color={isFavorite ? Colors.light.error : Colors.light.text}
          />
        </Pressable>

        <View style={styles.spotlightBadgeRow}>
          {chef.isOnline ? (
            <View style={styles.spotlightStatusBadge}>
              <View style={styles.spotlightStatusDot} />
              <Text style={styles.spotlightStatusText}>En ligne</Text>
            </View>
          ) : null}
          {chef.isVerified ? (
            <View style={styles.spotlightVerifiedBadge}>
              <Ionicons name="shield-checkmark" size={12} color={Colors.light.tintDark} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.spotlightBody}>
        <View style={styles.spotlightTitleRow}>
          <Text style={styles.spotlightName} numberOfLines={1}>{chef.name}</Text>
          <View style={styles.spotlightRating}>
            <Ionicons name="star" size={12} color="#F7C27B" />
            <Text style={styles.spotlightRatingText}>{chef.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.spotlightSpecialty} numberOfLines={1}>{chef.specialty}</Text>
        <View style={styles.spotlightMetaRow}>
          <Feather name="map-pin" size={11} color={Colors.light.textTertiary} />
          <Text style={styles.spotlightMetaText} numberOfLines={1}>{chef.location.split(",")[0]}</Text>
        </View>
        {firstDish ? (
          <View style={styles.spotlightDishPill}>
            <Text style={styles.spotlightDishText} numberOfLines={1}>{firstDish.name}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function getChefHeroImage(chef: Chef) {
  return (
    chef.heroImageUrl ??
    chef.dishes?.find((dish) => dish.imageUrls?.[0])?.imageUrls?.[0] ??
    chef.dishes?.find((dish) => dish.imageUrl)?.imageUrl ??
    null
  );
}

// Slim horizontal list row — one chef per line, clean & scannable
function ChefRow({ chef, isFavorite, onFavoriteToggle }: { chef: Chef; isFavorite: boolean; onFavoriteToggle: () => void }) {
  const initials = chef.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const heroImage = getChefHeroImage(chef);
  const firstDish = chef.dishes?.[0] ?? null;
  return (
    <Pressable
      style={styles.chefRow}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
    >
      <View style={styles.chefRowMedia}>
        {heroImage ? (
          <ImageBackground source={{ uri: heroImage }} style={styles.chefRowAvatar} imageStyle={styles.chefRowAvatarImg}>
            <View style={styles.chefRowMediaOverlay} />
          </ImageBackground>
        ) : (
          <View style={[styles.chefRowAvatar, { backgroundColor: chef.coverColor }]}> 
            {chef.avatarUrl ? (
              <Image source={{ uri: chef.avatarUrl as string }} style={styles.chefRowAvatarImg} />
            ) : (
              <Text style={styles.chefRowInitials}>{initials}</Text>
            )}
          </View>
        )}
        <View style={styles.chefRowAvatarBadge}>
          {chef.avatarUrl ? (
            <Image source={{ uri: chef.avatarUrl as string }} style={styles.chefRowAvatarBadgeImg} />
          ) : (
            <View style={[styles.chefRowAvatarBadgeFallback, { backgroundColor: chef.coverColor }]}> 
              <Text style={styles.chefRowAvatarBadgeText}>{initials}</Text>
            </View>
          )}
        </View>
        {firstDish?.isPopular ? (
          <View style={styles.chefRowPhotoTag}>
            <Text style={styles.chefRowPhotoTagText}>Plat phare</Text>
          </View>
        ) : null}
        {chef.isOnline && <View style={styles.chefRowOnlineDot} />}
      </View>

      <View style={styles.chefRowBody}>
        <View style={styles.chefRowTop}>
          <Text style={styles.chefRowName} numberOfLines={1}>{chef.name}</Text>
          <View style={styles.chefRowRating}>
            <Ionicons name="star" size={11} color="#F7C27B" />
            <Text style={styles.chefRowRatingText}>{chef.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.chefRowSpecialty} numberOfLines={1}>{chef.specialty}</Text>
        <View style={styles.chefRowMeta}>
          <Feather name="map-pin" size={11} color={Colors.light.textTertiary} />
          <Text style={styles.chefRowMetaText}>{chef.location.split(",")[0]}</Text>
          <View style={styles.chefRowDot} />
          <Feather name="clock" size={11} color={Colors.light.textTertiary} />
          <Text style={styles.chefRowMetaText}>{chef.responseTime}</Text>
          {chef.priceRange ? (
            <>
              <View style={styles.chefRowDot} />
              <Text style={styles.chefRowPrice}>{chef.priceRange}</Text>
            </>
          ) : null}
        </View>
        {firstDish ? (
          <View style={styles.chefRowDishPill}>
            <Text style={styles.chefRowDishPillText} numberOfLines={1}>
              {firstDish.name} • {firstDish.price.toLocaleString()} FCFA
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.chefRowRight}>
        <Pressable onPress={onFavoriteToggle} hitSlop={12} style={styles.chefRowHeart}>
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={18}
            color={isFavorite ? Colors.light.tint : Colors.light.tabIconDefault}
          />
        </Pressable>
        <Feather name="chevron-right" size={16} color={Colors.light.cardBorder} />
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
  const isFiltering = query.length > 0 || selectedFilter !== "Toutes";

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

  const onlineChefs = chefs.filter((c) => c.isOnline).slice(0, 4);
  const popularChefs = [...chefs]
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
    .slice(0, 4);
  const spotlightChefs = [...chefs]
    .sort((a, b) => Number(b.isVerified) - Number(a.isVerified) || b.rating - a.rating)
    .slice(0, 6);
  const allSorted = [...chefs].sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* ── Sticky header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Explorer</Text>
            <Text style={styles.subtitle}>{chefs.length} cuisinières disponibles</Text>
          </View>
        </View>
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

      {/* ── Main scrollable content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 100 }}
      >
        {/* Category icon shortcuts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {CATEGORIES.map((item) => {
            const isActive = selectedFilter === item.filter;
            return (
              <Pressable
                key={item.id}
                style={styles.categoryItem}
                onPress={() => setSelectedFilter(isActive ? "Toutes" : item.filter)}
              >
                <View style={[styles.categoryIconWrap, isActive && styles.categoryIconWrapActive]}>
                  <Text style={styles.categoryEmoji}>{item.emoji}</Text>
                </View>
                <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
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

        {/* ── Content body ── */}
        {isLoadingChefs ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.light.tint} size="large" />
            <Text style={styles.loadingText}>Chargement des cuisinières...</Text>
          </View>

        ) : isFiltering ? (
          /* Search / filter results */
          filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="search" size={40} color={Colors.light.tabIconDefault} />
              <Text style={styles.emptyTitle}>Aucun résultat</Text>
              <Text style={styles.emptyDesc}>Essayez un autre mot-clé ou filtre</Text>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
                </Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{selectedFilter !== "Toutes" ? selectedFilter : "Recherche"}</Text>
                </View>
              </View>
              <View style={styles.chefList}>
                {filtered.map((chef) => (
                  <ChefRow
                    key={chef.id}
                    chef={chef}
                    isFavorite={favorites.includes(chef.id)}
                    onFavoriteToggle={() => toggleFavorite(chef.id)}
                  />
                ))}
              </View>
            </View>
          )

        ) : (
          /* Browse mode — rich sectioned layout */
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>A decouvrir</Text>
                <Pressable onPress={() => setSelectedFilter("Toutes")}>
                  <Text style={styles.sectionLink}>Highlights</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.spotlightRow}
              >
                {spotlightChefs.map((chef) => (
                  <ChefSpotlightCard
                    key={chef.id}
                    chef={chef}
                    isFavorite={favorites.includes(chef.id)}
                    onFavoriteToggle={() => toggleFavorite(chef.id)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* En ligne maintenant */}
            {onlineChefs.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>En ligne maintenant</Text>
                  <Pressable onPress={() => setSelectedFilter("Toutes")}>
                    <Text style={styles.sectionLink}>Voir tout</Text>
                  </Pressable>
                </View>
                <View style={styles.chefList}>
                  {onlineChefs.map((chef) => (
                    <ChefRow
                      key={chef.id}
                      chef={chef}
                      isFavorite={favorites.includes(chef.id)}
                      onFavoriteToggle={() => toggleFavorite(chef.id)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Les plus populaires */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Sélection populaire</Text>
                <Pressable onPress={() => setSelectedFilter("Toutes")}>
                  <Text style={styles.sectionLink}>Voir tout</Text>
                </Pressable>
              </View>
              <View style={styles.chefList}>
                {popularChefs.map((chef) => (
                  <ChefRow
                    key={chef.id}
                    chef={chef}
                    isFavorite={favorites.includes(chef.id)}
                    onFavoriteToggle={() => toggleFavorite(chef.id)}
                  />
                ))}
              </View>
            </View>

            {/* Toutes les cuisinières */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Toutes les cuisinières</Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{allSorted.length}</Text>
                </View>
              </View>
              <View style={styles.chefList}>
                {allSorted.map((chef) => (
                  <ChefRow
                    key={chef.id}
                    chef={chef}
                    isFavorite={favorites.includes(chef.id)}
                    onFavoriteToggle={() => toggleFavorite(chef.id)}
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

  // ── Header ──────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.light.text,
    padding: 0,
  },

  // ── Categories (emoji shortcuts) ──────────────────────────────────
  categoriesRow: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4, gap: 12 },
  categoryItem: { alignItems: "center", width: 68, gap: 6 },
  categoryIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryIconWrapActive: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderColor: Colors.light.tint,
    borderWidth: 2,
  },
  categoryEmoji: { fontSize: 26 },
  categoryLabel: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 15,
  },
  categoryLabelActive: {
    color: Colors.light.tint,
    fontFamily: "Poppins_600SemiBold",
  },

  // ── Filter chips ──────────────────────────────────────────────────
  filtersRow: { paddingHorizontal: 20, paddingVertical: 12, gap: 8, alignItems: "center" },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  filterText: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
  filterTextActive: {
    color: "#fff",
    fontFamily: "Poppins_600SemiBold",
  },

  // ── Sections ─────────────────────────────────────────────────────
  section: { marginTop: 8, paddingBottom: 4 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
  sectionBadge: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textTertiary,
  },
  spotlightRow: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 2,
  },
  spotlightCard: {
    width: 232,
    backgroundColor: Colors.light.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    overflow: "hidden",
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 2,
  },
  spotlightMedia: {
    position: "relative",
  },
  spotlightImage: {
    width: "100%",
    height: 156,
    justifyContent: "flex-end",
  },
  spotlightImageStyle: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  spotlightFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  spotlightInitials: {
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.92)",
  },
  spotlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,18,10,0.18)",
  },
  spotlightHeart: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  spotlightBadgeRow: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spotlightStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  spotlightStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.light.success,
  },
  spotlightStatusText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  spotlightVerifiedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,243,230,0.96)",
  },
  spotlightBody: {
    padding: 14,
    gap: 6,
  },
  spotlightTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  spotlightName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  spotlightRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  spotlightRatingText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  spotlightSpecialty: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  spotlightMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  spotlightMetaText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  spotlightDishPill: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: "100%",
  },
  spotlightDishText: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
  },
  // ── Chef list (vertical full-width rows) ─────────────────────────
  chefList: {
    marginHorizontal: 20,
    gap: 12,
  },
  chefRow: {
    flexDirection: "row",
    alignItems: "stretch",
    padding: 14,
    gap: 14,
    backgroundColor: Colors.light.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 2,
  },
  chefRowMedia: {
    width: 108,
    position: "relative",
    justifyContent: "center",
  },
  chefRowAvatar: {
    width: 108,
    height: 108,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  chefRowAvatarImg: {
    width: 108,
    height: 108,
    borderRadius: 24,
  },
  chefRowMediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,18,10,0.16)",
  },
  chefRowInitials: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.9)",
  },
  chefRowOnlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#27AE60",
    borderWidth: 2,
    borderColor: Colors.light.card,
  },
  chefRowAvatarBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
  },
  chefRowAvatarBadgeImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.82)",
  },
  chefRowAvatarBadgeFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.82)",
  },
  chefRowAvatarBadgeText: {
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.9)",
  },
  chefRowPhotoTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255,197,77,0.96)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chefRowPhotoTagText: {
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
    color: "#1A120A",
  },
  chefRowBody: { flex: 1, gap: 5, justifyContent: "center" },
  chefRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chefRowName: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
    marginRight: 8,
  },
  chefRowRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  chefRowRatingText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  chefRowSpecialty: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  chefRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
    marginTop: 1,
  },
  chefRowMetaText: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  chefRowPrice: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
  chefRowDishPill: {
    alignSelf: "flex-start",
    marginTop: 2,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: "100%",
  },
  chefRowDishPillText: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
  },
  chefRowDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.light.cardBorder,
    marginHorizontal: 1,
  },
  chefRowRight: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  chefRowHeart: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── States ──────────────────────────────────────────────────────
  loadingState: { alignItems: "center", paddingTop: 60, gap: 12 },
  loadingText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 10, paddingHorizontal: 40 },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
});
