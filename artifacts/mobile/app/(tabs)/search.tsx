import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  ImageBackground,
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
import { Chef, useApp } from "@/contexts/AppContext";

const quickCollectionImageA = require("@/assets/images/en-ce-moment.jpg");
const quickCollectionImageB = require("@/assets/images/confort-ivoirien.jpg");
const quickCollectionImageC = require("@/assets/images/grillades-soiree.jpg");
const quickCollectionImageD = require("@/assets/images/douceur-dessert.jpg");
const defaultChefProfileAsset = require("@/assets/images/photodeprofil-par-defaut-cuisiniere.svg");

function resolveLocalAssetUri(asset: number) {
  try {
    return Image.resolveAssetSource(asset)?.uri ?? null;
  } catch (error) {
    console.warn("Failed to resolve local asset uri", error);
    return null;
  }
}

const CUISINE_CHIPS = [
  { id: "all", label: "Pour toi", filter: null, emoji: "✨", tone: "#FFF4DA" },
  { id: "ivoirien", label: "Ivoirien", filter: "Ivoirien", emoji: "🇨🇮", tone: "#FFE0C8" },
  { id: "grillades", label: "Grillades", filter: "Grillades", emoji: "🍖", tone: "#FFD8C7" },
  { id: "snacks", label: "Snacks", filter: "Snacks", emoji: "🥪", tone: "#F8E8C8" },
  { id: "desserts", label: "Desserts", filter: "Desserts", emoji: "🧁", tone: "#FDE3D7" },
  { id: "dioula", label: "Dioula", filter: "Dioula", emoji: "🍲", tone: "#F2DFC6" },
  { id: "events", label: "Événements", filter: "Événements", emoji: "🎉", tone: "#F6DCCB" },
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

function formatCompact(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return String(value);
}

function getTopDish(chef: Chef) {
  return chef.dishes?.[0] ?? null;
}

function getStartingPrice(chef: Chef) {
  const prices = chef.dishes
    .map((dish) => dish.price)
    .filter((price): price is number => typeof price === "number" && !Number.isNaN(price));

  if (!prices.length) {
    return chef.priceRange || "Prix sur demande";
  }

  return `Dès ${Math.min(...prices).toLocaleString("fr-FR")} FCFA`;
}

function DiscoveryChip({
  label,
  emoji,
  active,
  tone,
  onPress,
}: {
  label: string;
  emoji: string;
  active: boolean;
  tone: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.discoveryChip,
        { backgroundColor: active ? Colors.light.tint : tone },
      ]}
      onPress={onPress}
    >
      <Text style={styles.discoveryChipEmoji}>{emoji}</Text>
      <Text style={[styles.discoveryChipLabel, active && styles.discoveryChipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function CollectionCard({
  title,
  subtitle,
  accent,
  icon,
  image,
}: {
  title: string;
  subtitle: string;
  accent: string;
  icon: keyof typeof Feather.glyphMap;
  image: ImageSourcePropType;
}) {
  return (
    <ImageBackground source={image} style={styles.collectionCard} imageStyle={styles.collectionImage}>
      <View style={[styles.collectionOverlay, { backgroundColor: accent }]} />
      <View style={styles.collectionSheen} />
      <View style={styles.collectionContent}>
        <View style={styles.collectionTopRow}>
          <View style={styles.collectionIconWrap}>
            <Feather name={icon} size={16} color="#fff" />
          </View>
          <View style={styles.collectionKickerPill}>
            <Text style={styles.collectionKickerText}>Rapide</Text>
          </View>
        </View>
        <Text style={styles.collectionTitle}>{title}</Text>
        <Text style={styles.collectionSubtitle}>{subtitle}</Text>
      </View>
    </ImageBackground>
  );
}

function SpotlightCard({
  chef,
  onPress,
  defaultChefProfileUri,
}: {
  chef: Chef;
  onPress: () => void;
  defaultChefProfileUri: string | null;
}) {
  const heroImage = getChefHeroImage(chef);
  const dish = getTopDish(chef);

  return (
    <Pressable style={styles.spotlightCard} onPress={onPress}>
      {heroImage ? (
        <ImageBackground source={{ uri: heroImage }} style={styles.spotlightMedia} imageStyle={styles.spotlightMediaRadius}>
          <View style={styles.spotlightOverlay} />
          <View style={styles.spotlightBadgeRow}>
            <View style={styles.spotlightBadge}>
              <Text style={styles.spotlightBadgeText}>{chef.isOnline ? "Disponible" : "À découvrir"}</Text>
            </View>
            {chef.isVerified ? (
              <View style={styles.spotlightVerifiedBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#fff" />
              </View>
            ) : null}
          </View>
          <View style={styles.spotlightContent}>
            <Text style={styles.spotlightEyebrow}>Sélection chaude</Text>
            <Text style={styles.spotlightTitle}>{chef.name}</Text>
            <Text style={styles.spotlightSubtitle} numberOfLines={2}>
              {chef.specialty} · {dish?.name ?? "Cuisine maison généreuse"}
            </Text>
            <View style={styles.spotlightStatsRow}>
              <Text style={styles.spotlightStatsText}>{getStartingPrice(chef)}</Text>
              <Text style={styles.spotlightStatsDot}>•</Text>
              <Text style={styles.spotlightStatsText}>{chef.location.split(",")[0]}</Text>
            </View>
          </View>
        </ImageBackground>
      ) : (
        <View style={[styles.spotlightMedia, styles.spotlightFallback, { backgroundColor: chef.coverColor }]}> 
          {chef.avatarUrl ? (
            <Image source={{ uri: chef.avatarUrl }} style={styles.spotlightFallbackAvatarImage} resizeMode="cover" />
          ) : defaultChefProfileUri ? (
            <View style={styles.spotlightFallbackAvatarArt}>
              <SvgUri width="138%" height="138%" uri={defaultChefProfileUri} />
            </View>
          ) : (
            <Text style={styles.spotlightFallbackInitials}>{chef.name.slice(0, 2).toUpperCase()}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

function ChefRowCard({
  chef,
  isFavorite,
  onFavoriteToggle,
  defaultChefProfileUri,
}: {
  chef: Chef;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
  defaultChefProfileUri: string | null;
}) {
  const heroImage = getChefHeroImage(chef);
  const topDish = getTopDish(chef);

  return (
    <Pressable
      style={styles.chefRowCard}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
    >
      {heroImage ? (
        <ImageBackground source={{ uri: heroImage }} style={styles.chefRowMedia} imageStyle={styles.chefRowMediaRadius}>
          <View style={styles.chefRowMediaOverlay} />
        </ImageBackground>
      ) : (
        <View style={[styles.chefRowMedia, styles.chefRowMediaFallback, { backgroundColor: chef.coverColor }]}> 
          {chef.avatarUrl ? (
            <Image source={{ uri: chef.avatarUrl }} style={styles.chefRowFallbackAvatarImage} resizeMode="cover" />
          ) : defaultChefProfileUri ? (
            <View style={styles.chefRowFallbackAvatarArt}>
              <SvgUri width="138%" height="138%" uri={defaultChefProfileUri} />
            </View>
          ) : (
            <Text style={styles.chefRowFallbackInitials}>{chef.name.slice(0, 2).toUpperCase()}</Text>
          )}
        </View>
      )}

      <View style={styles.chefRowContent}>
        <View style={styles.chefRowHeader}>
          <View style={styles.chefRowHeaderText}>
            <Text style={styles.chefRowName} numberOfLines={1}>{chef.name}</Text>
            <Text style={styles.chefRowSpecialty} numberOfLines={1}>{chef.specialty}</Text>
          </View>
          <Pressable style={styles.chefRowFavoriteButton} onPress={onFavoriteToggle} hitSlop={10}>
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={18}
              color={isFavorite ? Colors.light.error : Colors.light.text}
            />
          </Pressable>
        </View>

        <View style={styles.chefRowMetrics}>
          <View style={styles.metricPill}>
            <Feather name="star" size={12} color={Colors.light.tintDark} />
            <Text style={styles.metricPillText}>{chef.rating.toFixed(1)}</Text>
          </View>
          <View style={styles.metricPill}>
            <Feather name="thumbs-up" size={12} color={Colors.light.tintDark} />
            <Text style={styles.metricPillText}>{getApprovalRate(chef)}%</Text>
          </View>
          <View style={styles.metricPill}>
            <Feather name="clock" size={12} color={Colors.light.tintDark} />
            <Text style={styles.metricPillText}>{chef.responseTime}</Text>
          </View>
        </View>

        <View style={styles.chefRowBottom}>
          <View style={styles.chefRowMetaBlock}>
            <Text style={styles.chefRowMetaLabel}>Quartier</Text>
            <Text style={styles.chefRowMetaValue} numberOfLines={1}>{chef.location.split(",")[0]}</Text>
          </View>
          <View style={styles.chefRowMetaBlock}>
            <Text style={styles.chefRowMetaLabel}>Carte</Text>
            <Text style={styles.chefRowMetaValue} numberOfLines={1}>{topDish?.name ?? getStartingPrice(chef)}</Text>
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
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const defaultChefProfileUri = useMemo(() => resolveLocalAssetUri(defaultChefProfileAsset), []);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const onlineCount = chefs.filter((chef) => chef.isOnline).length;
  const verifiedCount = chefs.filter((chef) => chef.isVerified).length;
  const isFiltering = query.trim().length > 0 || selectedFilter !== null;

  const filteredChefs = useMemo(
    () =>
      [...chefs]
        .filter((chef) => {
          const normalizedQuery = query.trim().toLowerCase();
          const matchesQuery =
            !normalizedQuery ||
            chef.name.toLowerCase().includes(normalizedQuery) ||
            chef.specialty.toLowerCase().includes(normalizedQuery) ||
            chef.location.toLowerCase().includes(normalizedQuery) ||
            chef.dishes.some((dish) => dish.name.toLowerCase().includes(normalizedQuery));

          const matchesFilter =
            selectedFilter === null || chef.specialty.toLowerCase().includes(selectedFilter.toLowerCase());

          return matchesQuery && matchesFilter;
        })
        .sort(
          (a, b) =>
            Number(b.isOnline) - Number(a.isOnline) ||
            Number(b.isVerified) - Number(a.isVerified) ||
            b.rating - a.rating ||
            b.reviewCount - a.reviewCount
        ),
    [chefs, query, selectedFilter]
  );

  const spotlightChef = filteredChefs[0] ?? null;
  const trendingChefs = filteredChefs.slice(0, 3);
  const onlineChefs = filteredChefs.filter((chef) => chef.isOnline).slice(0, 4);
  const hiddenGems = filteredChefs.filter((chef) => !chef.isOnline).slice(0, 4);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}> 
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 96 }}
      >
        <View style={styles.headerBlock}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.pageEyebrow}>Explore</Text>
              <Text style={styles.pageTitle}>Le marché des cuisines qui donnent faim.</Text>
            </View>
            <View style={styles.headerCounterBubble}>
              <Text style={styles.headerCounterValue}>{formatCompact(chefs.length)}</Text>
              <Text style={styles.headerCounterLabel}>cuisines</Text>
            </View>
          </View>

          <Text style={styles.pageSubtitle}>
            Une découverte plus éditoriale: sélections du jour, cuisines en ligne, plats signatures et profils à suivre.
          </Text>

          <View style={styles.searchBox}>
            <Feather name="search" size={16} color={Colors.light.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Plat, quartier, envie du moment..."
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

        <View style={styles.heroBanner}>
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />
          <Text style={styles.heroEyebrow}>Sélection premium</Text>
          <Text style={styles.heroTitle}>Des cuisines maison, une lecture plus visuelle, un choix plus rapide.</Text>
          <Text style={styles.heroSubtitle}>
            {onlineCount} cuisinières en ligne maintenant · {verifiedCount} profils vérifiés · stories et menus visibles avant d’ouvrir une fiche.
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{onlineCount}</Text>
              <Text style={styles.heroStatLabel}>Actives</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{verifiedCount}</Text>
              <Text style={styles.heroStatLabel}>Vérifiées</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{filteredChefs.length}</Text>
              <Text style={styles.heroStatLabel}>À découvrir</Text>
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryChipsRow}>
          {CUISINE_CHIPS.map((item) => (
            <DiscoveryChip
              key={item.id}
              label={item.label}
              emoji={item.emoji}
              tone={item.tone}
              active={selectedFilter === item.filter}
              onPress={() => setSelectedFilter(item.filter)}
            />
          ))}
        </ScrollView>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collections rapides</Text>
            <Text style={styles.sectionCaption}>Des entrées visuelles plutôt qu’une page qui fait annuaire.</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionsRow}>
            <CollectionCard
              title="En ce moment"
              subtitle="Celles qui peuvent répondre vite"
              accent="rgba(212, 97, 26, 0.52)"
              icon="radio"
              image={quickCollectionImageA}
            />
            <CollectionCard
              title="Confort ivoirien"
              subtitle="Les assiettes qui rassurent et rassemblent"
              accent="rgba(143, 75, 50, 0.54)"
              icon="coffee"
              image={quickCollectionImageB}
            />
            <CollectionCard
              title="Soirée grillades"
              subtitle="Pour les envies plus intenses"
              accent="rgba(58, 41, 34, 0.58)"
              icon="zap"
              image={quickCollectionImageC}
            />
            <CollectionCard
              title="Desserts & douceurs"
              subtitle="Finale légère ou gourmande"
              accent="rgba(196, 116, 72, 0.5)"
              icon="heart"
              image={quickCollectionImageD}
            />
          </ScrollView>
        </View>

        {isLoadingChefs ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.light.tint} size="large" />
            <Text style={styles.loadingText}>On prépare le marché du jour...</Text>
          </View>
        ) : filteredChefs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔎</Text>
            <Text style={styles.emptyTitle}>Aucune cuisine trouvée</Text>
            <Text style={styles.emptyDesc}>Essaie un autre plat, un autre quartier ou réinitialise les filtres.</Text>
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
            {!isFiltering && spotlightChef ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>À mettre en avant</Text>
                  <Text style={styles.sectionCaption}>Une vraie carte hero, plus proche des captures premium.</Text>
                </View>
                <SpotlightCard
                  chef={spotlightChef}
                  onPress={() => router.push({ pathname: "/chef/[id]", params: { id: spotlightChef.id } })}
                  defaultChefProfileUri={defaultChefProfileUri}
                />
              </View>
            ) : null}

            {!isFiltering && trendingChefs.length ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Tendances du moment</Text>
                  <Text style={styles.sectionCaption}>Celles qui mélangent dispo, confiance et envie immédiate.</Text>
                </View>
                <View style={styles.rowCardList}>
                  {trendingChefs.map((chef) => (
                    <ChefRowCard
                      key={chef.id}
                      chef={chef}
                      isFavorite={favorites.includes(chef.id)}
                      onFavoriteToggle={() => toggleFavorite(chef.id)}
                      defaultChefProfileUri={defaultChefProfileUri}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {!isFiltering && onlineChefs.length ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderInline}>
                  <Text style={styles.sectionTitle}>En ligne maintenant</Text>
                  <Text style={styles.inlineStatusPill}>{onlineChefs.length} actives</Text>
                </View>
                <View style={styles.rowCardList}>
                  {onlineChefs.map((chef) => (
                    <ChefRowCard
                      key={chef.id}
                      chef={chef}
                      isFavorite={favorites.includes(chef.id)}
                      onFavoriteToggle={() => toggleFavorite(chef.id)}
                      defaultChefProfileUri={defaultChefProfileUri}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {!isFiltering && hiddenGems.length ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Adresses à garder de côté</Text>
                  <Text style={styles.sectionCaption}>Des profils un peu plus calmes, mais très commandables.</Text>
                </View>
                <View style={styles.rowCardList}>
                  {hiddenGems.map((chef) => (
                    <ChefRowCard
                      key={chef.id}
                      chef={chef}
                      isFavorite={favorites.includes(chef.id)}
                      onFavoriteToggle={() => toggleFavorite(chef.id)}
                      defaultChefProfileUri={defaultChefProfileUri}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderInline}>
                <Text style={styles.sectionTitle}>
                  {isFiltering
                    ? `${filteredChefs.length} résultat${filteredChefs.length > 1 ? "s" : ""}`
                    : "Toutes les cuisines"}
                </Text>
                {selectedFilter !== null ? (
                  <Pressable style={styles.clearFilterPill} onPress={() => setSelectedFilter(null)}>
                    <Text style={styles.clearFilterText}>{selectedFilter}</Text>
                    <Feather name="x" size={13} color={Colors.light.tint} />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.rowCardList}>
                {filteredChefs.map((chef) => (
                  <ChefRowCard
                    key={chef.id}
                    chef={chef}
                    isFavorite={favorites.includes(chef.id)}
                    onFavoriteToggle={() => toggleFavorite(chef.id)}
                    defaultChefProfileUri={defaultChefProfileUri}
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
  container: {
    flex: 1,
    backgroundColor: "#F6EFE6",
  },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  pageEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Poppins_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#B35A2C",
    marginBottom: 6,
  },
  pageTitle: {
    maxWidth: 270,
    fontSize: 30,
    lineHeight: 36,
    fontFamily: "Poppins_700Bold",
    color: "#201612",
  },
  pageSubtitle: {
    marginTop: 10,
    maxWidth: 330,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Poppins_400Regular",
    color: "#6B5A52",
  },
  headerCounterBubble: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FDE7C7",
    alignItems: "center",
    minWidth: 84,
  },
  headerCounterValue: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: "Poppins_700Bold",
    color: "#201612",
  },
  headerCounterLabel: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: "#7A5D43",
  },
  searchBox: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(126,99,79,0.12)",
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.text,
  },
  heroBanner: {
    overflow: "hidden",
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 28,
    padding: 20,
    backgroundColor: "#1F1511",
  },
  heroGlowA: {
    position: "absolute",
    top: -28,
    right: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(216,101,43,0.32)",
  },
  heroGlowB: {
    position: "absolute",
    bottom: -36,
    left: -18,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(247,194,123,0.18)",
  },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#F7C27B",
  },
  heroTitle: {
    marginTop: 10,
    maxWidth: 290,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Poppins_700Bold",
    color: "#FFF7EF",
  },
  heroSubtitle: {
    marginTop: 12,
    maxWidth: 310,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,247,239,0.76)",
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  heroStatCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  heroStatValue: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: "#FFF7EF",
  },
  heroStatLabel: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: "rgba(255,247,239,0.72)",
  },
  discoveryChipsRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  discoveryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
  },
  discoveryChipEmoji: {
    fontSize: 15,
  },
  discoveryChipLabel: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "#3A2922",
  },
  discoveryChipLabelActive: {
    color: "#fff",
  },
  sectionBlock: {
    marginTop: 22,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionHeaderInline: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 21,
    lineHeight: 26,
    fontFamily: "Poppins_700Bold",
    color: "#201612",
  },
  sectionCaption: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: "#786860",
  },
  collectionsRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  collectionCard: {
    width: 170,
    borderRadius: 24,
    minHeight: 182,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    shadowColor: "rgba(33,21,15,0.28)",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  collectionImage: {
    borderRadius: 24,
  },
  collectionOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  collectionSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 76,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  collectionContent: {
    padding: 16,
    paddingTop: 14,
    minHeight: 182,
    justifyContent: "space-between",
  },
  collectionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  collectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  collectionKickerPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(15,10,7,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  collectionKickerText: {
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.94)",
  },
  collectionTitle: {
    marginTop: 40,
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
  collectionSubtitle: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.82)",
  },
  spotlightCard: {
    marginHorizontal: 16,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: Colors.light.card,
  },
  spotlightMedia: {
    height: 330,
    justifyContent: "space-between",
  },
  spotlightMediaRadius: {
    borderRadius: 28,
  },
  spotlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(19,12,9,0.34)",
  },
  spotlightFallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  spotlightBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  spotlightBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  spotlightBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
  },
  spotlightVerifiedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(216,101,43,0.9)",
  },
  spotlightContent: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  spotlightEyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#FBD2A4",
  },
  spotlightTitle: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 34,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
  spotlightSubtitle: {
    marginTop: 8,
    maxWidth: "88%",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.86)",
  },
  spotlightStatsRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  spotlightStatsText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
  },
  spotlightStatsDot: {
    color: "rgba(255,255,255,0.56)",
  },
  spotlightFallbackAvatarImage: {
    width: "100%",
    height: "100%",
  },
  spotlightFallbackAvatarArt: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  spotlightFallbackInitials: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.92)",
    letterSpacing: 1.2,
  },
  rowCardList: {
    paddingHorizontal: 16,
    gap: 14,
  },
  chefRowCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 24,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(120,104,96,0.12)",
  },
  chefRowMedia: {
    width: 104,
    height: 124,
    borderRadius: 18,
    overflow: "hidden",
  },
  chefRowMediaRadius: {
    borderRadius: 18,
  },
  chefRowMediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,18,10,0.12)",
  },
  chefRowMediaFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  chefRowFallbackAvatarImage: {
    width: "100%",
    height: "100%",
  },
  chefRowFallbackAvatarArt: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  chefRowFallbackInitials: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.92)",
    letterSpacing: 0.9,
  },
  chefRowContent: {
    flex: 1,
    minWidth: 0,
  },
  chefRowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  chefRowHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  chefRowName: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Poppins_700Bold",
    color: "#201612",
  },
  chefRowSpecialty: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Poppins_400Regular",
    color: "#74635A",
  },
  chefRowFavoriteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.84)",
  },
  chefRowMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#F6EADB",
  },
  metricPillText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#4B372D",
  },
  chefRowBottom: {
    marginTop: 12,
    flexDirection: "row",
    gap: 12,
  },
  chefRowMetaBlock: {
    flex: 1,
    minWidth: 0,
  },
  chefRowMetaLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: "Poppins_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#A18069",
  },
  chefRowMetaValue: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Poppins_500Medium",
    color: "#33241D",
  },
  inlineStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F7E9D6",
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    color: "#A85A31",
    overflow: "hidden",
  },
  clearFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#F7E9D6",
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  clearFilterText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
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
