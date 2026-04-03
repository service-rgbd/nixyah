import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
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

import { CachedRemoteBackground, CachedRemoteImage, prefetchRemoteImages } from "@/components/CachedRemoteImage";
import Colors from "@/constants/colors";
import { getProductsByUniverse, getStoresByUniverse } from "@/constants/commerce-catalog";
import { Chef, Dish, useApp } from "@/contexts/AppContext";

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

function UniverseShortcutCard({
  label,
  sub,
  icon,
  accentColor,
  tone,
  active,
  onPress,
}: {
  label: string;
  sub: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accentColor: string;
  tone: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.universeCard, { backgroundColor: active ? "#201612" : tone }]}
      onPress={onPress}
    >
      <View style={[styles.universeIconWrap, { backgroundColor: active ? "rgba(255,255,255,0.12)" : `${accentColor}18` }]}> 
        <Ionicons name={icon} size={18} color={active ? "#FFF7EF" : accentColor} />
      </View>
      <Text style={[styles.universeLabel, active && styles.universeLabelActive]}>{label}</Text>
      <Text style={[styles.universeSub, active && styles.universeSubActive]} numberOfLines={2}>{sub}</Text>
    </Pressable>
  );
}

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

function getEstimatedDelivery(chef: Chef): string {
  const rt = chef.responseTime ?? "";
  const match = rt.match(/(\d+)/);
  if (!match) return "~45 min";
  const baseMin = parseInt(match[1], 10);
  return `~${baseMin + 15} min`;
}

// ── Abidjan zone → approximate GPS ──────────────────────────────
const ZONE_COORDS: Record<string, [number, number]> = {
  cocody:       [ 5.3609,  -3.9976],
  yopougon:     [ 5.3365,  -4.0706],
  plateau:      [ 5.3190,  -4.0169],
  adjame:       [ 5.3606,  -4.0336],
  marcory:      [ 5.2954,  -3.9914],
  koumassi:     [ 5.2924,  -4.0190],
  treichville:  [ 5.2972,  -4.0032],
  abobo:        [ 5.4151,  -4.0470],
  bingerville:  [ 5.3596,  -3.8831],
  angre:        [ 5.3742,  -3.9717],
  riviera:      [ 5.3718,  -3.9628],
  port_bouet:   [ 5.2607,  -3.9326],
  williamsville:[ 5.3582,  -4.0286],
  attiecoube:   [ 5.3673,  -4.0476],
};

function resolveZoneCoords(text: string): [number, number] | null {
  const lower = text.toLowerCase();
  for (const [key, coords] of Object.entries(ZONE_COORDS)) {
    if (lower.includes(key.replace("_", " ")) || lower.includes(key)) return coords;
  }
  return null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function NearbyChefCard({
  chef,
  distanceKm,
  isFavorite,
  onFavoriteToggle,
  defaultChefProfileUri,
}: {
  chef: Chef;
  distanceKm: number | null;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
  defaultChefProfileUri: string | null;
}) {
  return (
    <Pressable
      style={styles.nearbyCard}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
    >
      <View style={styles.nearbyAvatarWrap}>
        {chef.avatarUrl ? (
          <CachedRemoteImage uri={chef.avatarUrl} style={styles.nearbyAvatar} contentFit="cover" />
        ) : defaultChefProfileUri ? (
          <View style={[styles.nearbyAvatar, { overflow: "hidden" }]}>
            <SvgUri width="110%" height="110%" uri={defaultChefProfileUri} />
          </View>
        ) : (
          <View style={[styles.nearbyAvatar, styles.nearbyAvatarFallback, { backgroundColor: chef.coverColor || "#F2DFC6" }]}>
            <Text style={styles.nearbyAvatarInitials}>{chef.name.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        {chef.isOnline && <View style={styles.nearbyOnlineDot} />}
      </View>

      <View style={styles.nearbyInfo}>
        <View style={styles.nearbyNameRow}>
          <Text style={styles.nearbyName} numberOfLines={1}>{chef.name}</Text>
          {chef.isVerified ? <Ionicons name="shield-checkmark" size={13} color={Colors.light.tint} /> : null}
        </View>
        <Text style={styles.nearbySpecialty} numberOfLines={1}>{chef.specialty}</Text>
        <View style={styles.nearbyMetaRow}>
          {distanceKm !== null ? (
            <View style={styles.nearbyDistancePill}>
              <Feather name="navigation" size={10} color={Colors.light.tint} />
              <Text style={styles.nearbyDistanceText}>{formatDistance(distanceKm)}</Text>
            </View>
          ) : null}
          <View style={styles.nearbyTimePill}>
            <Feather name="clock" size={10} color="#74635A" />
            <Text style={styles.nearbyTimeText}>{getEstimatedDelivery(chef)}</Text>
          </View>
        </View>
      </View>

      <Pressable style={styles.nearbyFav} onPress={onFavoriteToggle} hitSlop={10}>
        <Ionicons
          name={isFavorite ? "heart" : "heart-outline"}
          size={16}
          color={isFavorite ? "#FF5B5B" : Colors.light.textTertiary}
        />
      </Pressable>
    </Pressable>
  );
}

function PopularDishCard({
  dish,
  chef,
  rank,
}: {
  dish: Dish;
  chef: Chef;
  rank: number;
}) {
  const imageUri = dish.imageUrls?.[0] ?? dish.imageUrl ?? null;
  const orderProxy = Math.round((chef.reviewCount ?? 0) * 3.2 + (chef.stars ?? 0) * 4);
  const rankBg = rank === 1 ? "#E8872A" : rank === 2 ? "#909090" : rank === 3 ? "#955C30" : "rgba(20,12,8,0.72)";
  return (
    <Pressable
      style={styles.popDishCard}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id, dishId: dish.id } })}
    >
      {imageUri ? (
        <CachedRemoteBackground uri={imageUri} style={styles.popDishMedia} imageStyle={styles.popDishMediaRadius}>
          <View style={[styles.popDishRankBadge, { backgroundColor: rankBg }]}>
            <Text style={styles.popDishRankText}>#{rank}</Text>
          </View>
          {orderProxy > 0 ? (
            <View style={styles.popDishOrderBadge}>
              <Text style={styles.popDishOrderText}>🔥 {orderProxy > 999 ? `${Math.round(orderProxy / 100) / 10}k` : orderProxy} cmd</Text>
            </View>
          ) : null}
        </CachedRemoteBackground>
      ) : (
        <View style={[styles.popDishMedia, { backgroundColor: "#F2DFC6", alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 42 }}>🍽</Text>
          <View style={[styles.popDishRankBadge, { backgroundColor: rankBg }]}><Text style={styles.popDishRankText}>#{rank}</Text></View>
        </View>
      )}
      <View style={styles.popDishInfo}>
        <Text style={styles.popDishName} numberOfLines={2}>{dish.name}</Text>
        <View style={styles.popDishChefRow}>
          <Text style={styles.popDishChef} numberOfLines={1}>{chef.name}</Text>
          <View style={styles.popDishRatingPill}>
            <Feather name="star" size={9} color={Colors.light.tintDark} />
            <Text style={styles.popDishRatingText}>{chef.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.popDishPrice}>{dish.price > 0 ? `${dish.price.toLocaleString("fr-FR")} F` : "Sur demande"}</Text>
      </View>
    </Pressable>
  );
}

function DishVerticalCard({
  dish,
  chefName,
  chefId,
}: {
  dish: Dish;
  chefName: string;
  chefId: string;
}) {
  const imageUri = dish.imageUrls?.[0] ?? dish.imageUrl ?? null;
  return (
    <Pressable
      style={styles.dishVertCard}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chefId, dishId: dish.id } })}
    >
      {imageUri ? (
        <CachedRemoteBackground uri={imageUri} style={styles.dishVertMedia} imageStyle={styles.dishVertMediaRadius}>
          <View style={styles.dishVertScrim} />
          {dish.isPopular ? (
            <View style={styles.dishVertPopular}>
              <Text style={styles.dishVertPopularText}>⚡ Populaire</Text>
            </View>
          ) : null}
        </CachedRemoteBackground>
      ) : (
        <View style={[styles.dishVertMedia, { backgroundColor: "#F2DFC6", alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 32 }}>🍽</Text>
        </View>
      )}
      <View style={styles.dishVertInfo}>
        <Text style={styles.dishVertName} numberOfLines={2}>{dish.name}</Text>
        <Text style={styles.dishVertChef} numberOfLines={1}>par {chefName}</Text>
        <Text style={styles.dishVertPrice}>{dish.price > 0 ? `${dish.price.toLocaleString("fr-FR")} FCFA` : "Sur demande"}</Text>
      </View>
    </Pressable>
  );
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
    <CachedRemoteBackground uri={resolveLocalAssetUri(image as number) ?? ""} style={styles.collectionCard} imageStyle={styles.collectionImage}>
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
    </CachedRemoteBackground>
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
        <CachedRemoteBackground uri={heroImage} style={styles.spotlightMedia} imageStyle={styles.spotlightMediaRadius}>
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
        </CachedRemoteBackground>
      ) : (
        <View style={[styles.spotlightMedia, styles.spotlightFallback, { backgroundColor: chef.coverColor }]}> 
          {chef.avatarUrl ? (
            <CachedRemoteImage uri={chef.avatarUrl} style={styles.spotlightFallbackAvatarImage} contentFit="cover" />
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
  variant = "default",
}: {
  chef: Chef;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
  defaultChefProfileUri: string | null;
  variant?: "trending" | "online" | "default";
}) {
  const heroImage = getChefHeroImage(chef);

  const coverOverlay = (
    <>
      <View style={styles.chefRowCoverScrim} />
      {variant === "trending" && (
        <View style={[styles.chefRowVariantBadge, styles.chefRowTrendBadge]}>
          <Text style={styles.chefRowVariantBadgeText}>🔥 Tendance</Text>
        </View>
      )}
      {variant === "online" && chef.isOnline && (
        <View style={[styles.chefRowVariantBadge, styles.chefRowOnlineBadge]}>
          <View style={styles.chefRowOnlineDot} />
          <Text style={styles.chefRowVariantBadgeText}>En ligne</Text>
        </View>
      )}
      <Pressable style={styles.chefRowFavBtn} onPress={onFavoriteToggle} hitSlop={10}>
        <Ionicons
          name={isFavorite ? "heart" : "heart-outline"}
          size={18}
          color={isFavorite ? "#FF5B5B" : "#fff"}
        />
      </Pressable>
    </>
  );

  return (
    <Pressable
      style={styles.chefRowCard}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
    >
      {heroImage ? (
        <CachedRemoteBackground
          uri={heroImage}
          style={styles.chefRowCoverBg}
          imageStyle={styles.chefRowCoverRadius}
        >
          {coverOverlay}
        </CachedRemoteBackground>
      ) : (
        <View style={[styles.chefRowCoverBg, { backgroundColor: chef.coverColor || "#F2DFC6" }]}>
          {coverOverlay}
        </View>
      )}

      <View style={styles.chefRowInfoPanel}>
        <View style={styles.chefRowNameRow}>
          <Text style={styles.chefRowName} numberOfLines={1}>{chef.name}</Text>
          {chef.isVerified && (
            <Ionicons name="shield-checkmark" size={15} color={Colors.light.tint} />
          )}
        </View>
        <Text style={styles.chefRowSpecialty} numberOfLines={1}>{chef.specialty}</Text>

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

        <View style={styles.chefRowFooter}>
          <View style={styles.chefRowFooterLeft}>
            <Feather name="map-pin" size={11} color="#A18069" />
            <Text style={styles.chefRowFooterText} numberOfLines={1}>{chef.location.split(",")[0]}</Text>
          </View>
          <Text style={styles.chefRowStartingPrice}>{getStartingPrice(chef)}</Text>
        </View>

        <View style={styles.chefRowDelivery}>
          <Feather name="truck" size={11} color={Colors.light.success} />
          <Text style={styles.chefRowDeliveryText}>{getEstimatedDelivery(chef)} livraison estimée</Text>
        </View>

        <View style={styles.chefRowCta}>
          <Text style={styles.chefRowCtaText}>Voir le menu</Text>
          <Feather name="arrow-right" size={13} color={Colors.light.tint} />
        </View>
      </View>

      {/* Floating avatar — rendered last to layer above cover + panel */}
      <View style={styles.chefRowAvatarFloat}>
        <View style={styles.chefRowAvatarRing}>
          {chef.avatarUrl ? (
            <CachedRemoteImage uri={chef.avatarUrl} style={styles.chefRowAvatar} contentFit="cover" />
          ) : defaultChefProfileUri ? (
            <View style={[styles.chefRowAvatar, { overflow: "hidden" }]}>
              <SvgUri width="138%" height="138%" uri={defaultChefProfileUri} />
            </View>
          ) : (
            <View style={[styles.chefRowAvatar, styles.chefRowAvatarFallback, { backgroundColor: chef.coverColor || "#F2DFC6" }]}>
              <Text style={styles.chefRowAvatarInitials}>{chef.name.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
        </View>
        {chef.isOnline && <View style={styles.chefRowOnlineIndicator} />}
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { chefs, favorites, toggleFavorite, isLoadingChefs } = useApp();
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const defaultChefProfileUri = useMemo(() => resolveLocalAssetUri(defaultChefProfileAsset), []);

  // Request location once on mount
  useEffect(() => {
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      } catch {
        // location unavailable — silent
      }
    })();
  }, []);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const onlineCount = chefs.filter((chef) => chef.isOnline).length;
  const verifiedCount = chefs.filter((chef) => chef.isVerified).length;
  const isFiltering = query.trim().length > 0 || selectedFilter !== null;
  const coursePreviewCount = getProductsByUniverse("courses").length;
  const supermarketStoreCount = getStoresByUniverse("supermarkets").length;
  const boutiquePreviewCount = getProductsByUniverse("boutiques").length;

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
            Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) ||
            Number(b.isOnline) - Number(a.isOnline) ||
            Number(b.isVerified) - Number(a.isVerified) ||
            b.rating - a.rating ||
            Number(b.stars ?? 0) - Number(a.stars ?? 0) ||
            b.reviewCount - a.reviewCount
        ),
    [chefs, query, selectedFilter]
  );

  const spotlightChef = filteredChefs[0] ?? null;
  const trendingChefs = filteredChefs.slice(0, 3);
  const onlineChefs = filteredChefs.filter((chef) => chef.isOnline).slice(0, 4);
  const hiddenGems = filteredChefs.filter((chef) => !chef.isOnline).slice(0, 4);

  // Nearby chefs sorted by haversine distance when GPS available
  const nearbyChefs = useMemo(() => {
    if (!userCoords) return [];
    return [...chefs]
      .map((chef) => {
        const coords = resolveZoneCoords(chef.location + " " + (chef.zone ?? ""));
        const distanceKm = coords
          ? haversineKm(userCoords.lat, userCoords.lon, coords[0], coords[1])
          : null;
        return { chef, distanceKm };
      })
      .filter((item): item is { chef: Chef; distanceKm: number } => item.distanceKm !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6);
  }, [chefs, userCoords]);

  // Most ordered dishes — all `isPopular` dishes ranked by chef.reviewCount + stars
  const mostOrderedDishes = useMemo(() => {
    const result: { dish: Dish; chef: Chef }[] = [];
    for (const chef of [...chefs].sort((a, b) => (b.reviewCount + (b.stars ?? 0)) - (a.reviewCount + (a.stars ?? 0)))) {
      for (const dish of chef.dishes) {
        if (dish.isPopular && (dish.imageUrls?.[0] || dish.imageUrl)) {
          result.push({ dish, chef });
        }
      }
    }
    // Fill with any dish that has image if population < 8
    if (result.length < 8) {
      for (const chef of chefs) {
        for (const dish of chef.dishes) {
          if (!dish.isPopular && (dish.imageUrls?.[0] || dish.imageUrl) && !result.some((r) => r.dish.id === dish.id)) {
            result.push({ dish, chef });
          }
          if (result.length >= 8) break;
        }
        if (result.length >= 8) break;
      }
    }
    return result.slice(0, 8);
  }, [chefs]);

  const topDishes = useMemo(() => {
    const result: { dish: Dish; chef: Chef }[] = [];
    for (const chef of filteredChefs.slice(0, 10)) {
      const candidates = chef.dishes.filter((d) => !!(d.imageUrls?.[0] || d.imageUrl));
      const pick = candidates.find((d) => d.isPopular) ?? candidates[0];
      if (pick) result.push({ dish: pick, chef });
    }
    return result.slice(0, 10);
  }, [filteredChefs]);

  useEffect(() => {
    void prefetchRemoteImages(
      filteredChefs.slice(0, 10).flatMap((chef) => [
        getChefHeroImage(chef),
        chef.avatarUrl,
      ])
    );
  }, [filteredChefs]);

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
              <Text style={styles.pageTitle}>Cuisines autour de vous</Text>
            </View>
            <View style={styles.headerCounterBubble}>
              <Text style={styles.headerCounterValue}>{formatCompact(chefs.length)}</Text>
              <Text style={styles.headerCounterLabel}>cuisines</Text>
            </View>
          </View>

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

        {!isFiltering && trendingChefs.length ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderInline}>
              <Text style={styles.sectionTitle}>{"Cuisini\u00e8res"}</Text>
              <View style={styles.nearbyLivePill}>
                <View style={styles.nearbyLiveDot} />
                <Text style={styles.nearbyLivePillText}>{onlineCount} en ligne</Text>
              </View>
            </View>
            <View style={styles.rowCardList}>
              {trendingChefs.map((chef) => (
                <ChefRowCard
                  key={chef.id}
                  chef={chef}
                  isFavorite={favorites.includes(chef.id)}
                  onFavoriteToggle={() => toggleFavorite(chef.id)}
                  defaultChefProfileUri={defaultChefProfileUri}
                  variant="trending"
                />
              ))}
            </View>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.universeRow}
          style={{ marginTop: 4, marginBottom: 8 }}
        >
          <UniverseShortcutCard
            label="Cuisinieres"
            sub={`${chefs.length} profils et menus visibles`}
            icon="restaurant"
            accentColor={Colors.light.tint}
            tone="#FBE7DB"
            active
            onPress={() => {
              setQuery("");
              setSelectedFilter(null);
            }}
          />
          <UniverseShortcutCard
            label="Courses"
            sub={`${coursePreviewCount} essentiels en express`}
            icon="cart"
            accentColor={Colors.light.terracotta}
            tone="#FDEBDE"
            onPress={() => router.push("/client/courses")}
          />
          <UniverseShortcutCard
            label="Supermarches"
            sub={`${supermarketStoreCount} enseignes et rayons`}
            icon="storefront"
            accentColor="#0F766E"
            tone="#E6F6F3"
            onPress={() => router.push("/client/supermarkets")}
          />
          <UniverseShortcutCard
            label="Boutiques"
            sub={`${boutiquePreviewCount} selections speciales`}
            icon="gift"
            accentColor="#8B5E3C"
            tone="#F7ECE1"
            onPress={() => router.push("/client/boutiques")}
          />
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

        {!isFiltering && nearbyChefs.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderInline}>
              <Text style={styles.sectionTitle}>Proches de vous</Text>
              <View style={styles.nearbyLivePill}>
                <View style={styles.nearbyLiveDot} />
                <Text style={styles.nearbyLivePillText}>GPS actif</Text>
              </View>
            </View>
            <View style={styles.nearbyList}>
              {nearbyChefs.map(({ chef, distanceKm }) => (
                <NearbyChefCard
                  key={chef.id}
                  chef={chef}
                  distanceKm={distanceKm}
                  isFavorite={favorites.includes(chef.id)}
                  onFavoriteToggle={() => toggleFavorite(chef.id)}
                  defaultChefProfileUri={defaultChefProfileUri}
                />
              ))}
            </View>
          </View>
        ) : null}

        {!isFiltering && mostOrderedDishes.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Plats les plus commandés</Text>
              <Text style={styles.sectionCaption}>Choix validés par la communauté.</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popDishRow}>
              {mostOrderedDishes.map(({ dish, chef }, index) => (
                <PopularDishCard key={`${chef.id}-${dish.id}`} dish={dish} chef={chef} rank={index + 1} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {!isFiltering && topDishes.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Plats du moment</Text>
              <Text style={styles.sectionCaption}>Signatures à commander maintenant.</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dishVertRow}>
              {topDishes.map(({ dish, chef }) => (
                <DishVerticalCard key={`${chef.id}-${dish.id}`} dish={dish} chefName={chef.name} chefId={chef.id} />
              ))}
            </ScrollView>
          </View>
        ) : null}

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
                      variant="online"
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
  universeSection: {
    marginTop: 20,
  },
  sectionHeaderInlineCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 12,
  },
  sectionCaptionCompact: {
    flex: 1,
    textAlign: "right",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Poppins_400Regular",
    color: "#786860",
  },
  universeRow: {
    gap: 12,
    paddingBottom: 2,
  },
  universeCard: {
    width: 158,
    borderRadius: 22,
    padding: 14,
    minHeight: 136,
  },
  universeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  universeLabel: {
    marginTop: 14,
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#201612",
  },
  universeLabelActive: {
    color: "#FFF7EF",
  },
  universeSub: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: "#6B5A52",
  },
  universeSubActive: {
    color: "rgba(255,247,239,0.76)",
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
    gap: 16,
  },
  chefRowCard: {
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(120,104,96,0.10)",
  },
  chefRowCoverBg: {
    height: 118,
  },
  chefRowCoverRadius: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  chefRowCoverScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,18,10,0.22)",
  },
  chefRowVariantBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chefRowTrendBadge: {
    backgroundColor: "rgba(20,12,8,0.65)",
    borderWidth: 1,
    borderColor: "rgba(252,186,3,0.5)",
  },
  chefRowOnlineBadge: {
    backgroundColor: "rgba(20,12,8,0.65)",
    borderWidth: 1,
    borderColor: "rgba(52,199,89,0.5)",
  },
  chefRowVariantBadgeText: {
    color: "#FFF7EF",
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
  },
  chefRowOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#34C759",
    shadowColor: "#34C759",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  chefRowFavBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  chefRowInfoPanel: {
    backgroundColor: "#fff",
    marginTop: -16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 30,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  chefRowNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chefRowName: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
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
  chefRowFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  chefRowFooterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  chefRowFooterText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Poppins_500Medium",
    color: "#74635A",
  },
  chefRowStartingPrice: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.tintDark,
  },
  chefRowCta: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: "#FEF0E2",
    borderWidth: 1,
    borderColor: "rgba(216,101,43,0.18)",
  },
  chefRowCtaText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
  chefRowAvatarFloat: {
    position: "absolute",
    top: 72,
    left: 12,
  },
  chefRowAvatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: "#fff",
    overflow: "hidden",
  },
  chefRowAvatar: {
    width: "100%",
    height: "100%",
  },
  chefRowAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  chefRowAvatarInitials: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.92)",
  },
  chefRowOnlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#34C759",
    borderWidth: 2,
    borderColor: "#fff",
  },
  chefRowDelivery: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  chefRowDeliveryText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.success,
  },
  // ── Nearby cards ────────────────────────────────────────────────
  nearbyList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  nearbyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(120,104,96,0.09)",
  },
  nearbyAvatarWrap: {
    position: "relative",
  },
  nearbyAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  nearbyAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  nearbyAvatarInitials: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "rgba(255,255,255,0.92)",
  },
  nearbyOnlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#34C759",
    borderWidth: 2,
    borderColor: "#fff",
  },
  nearbyInfo: {
    flex: 1,
    minWidth: 0,
  },
  nearbyNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  nearbyName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#201612",
  },
  nearbySpecialty: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: "#74635A",
  },
  nearbyMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 7,
    flexWrap: "wrap",
  },
  nearbyDistancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#FEF4EB",
    borderWidth: 1,
    borderColor: "rgba(216,101,43,0.18)",
  },
  nearbyDistanceText: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.tint,
  },
  nearbyTimePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#F6EADB",
  },
  nearbyTimeText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: "#74635A",
  },
  nearbyFav: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.backgroundSecondary,
  },
  nearbyLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E8F9EE",
    borderWidth: 1,
    borderColor: "rgba(52,199,89,0.28)",
  },
  nearbyLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#34C759",
  },
  nearbyLivePillText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#22A24C",
  },
  // ── Popular dishes ────────────────────────────────────────────
  popDishRow: {
    paddingHorizontal: 16,
    gap: 14,
    paddingBottom: 4,
  },
  popDishCard: {
    width: 230,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(120,104,96,0.08)",
    shadowColor: "rgba(42,28,18,0.12)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 4,
  },
  popDishMedia: {
    height: 170,
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 10,
  },
  popDishMediaRadius: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  popDishScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20,12,8,0.18)",
  },
  popDishRankBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  popDishRankText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
  },
  popDishOrderBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(20,12,8,0.60)",
    alignSelf: "flex-end",
  },
  popDishOrderText: {
    color: "#FFF7EF",
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
  },
  popDishInfo: {
    padding: 14,
    gap: 5,
  },
  popDishName: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Poppins_700Bold",
    color: "#201612",
  },
  popDishChef: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "#74635A",
  },
  popDishChefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  popDishBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  popDishRatingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F6EADB",
  },
  popDishRatingText: {
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    color: "#4B372D",
  },
  popDishPrice: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.tintDark,
  },
  dishVertRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  dishVertCard: {
    width: 142,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(120,104,96,0.08)",
    shadowColor: "rgba(42,28,18,0.10)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 3,
  },
  dishVertMedia: {
    height: 142,
    alignItems: "center",
    justifyContent: "center",
  },
  dishVertMediaRadius: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  dishVertScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20,12,8,0.14)",
  },
  dishVertPopular: {
    position: "absolute",
    bottom: 8,
    left: 8,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "rgba(20,12,8,0.62)",
  },
  dishVertPopularText: {
    color: "#FFF7EF",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
  },
  dishVertInfo: {
    padding: 11,
    gap: 3,
  },
  dishVertName: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Poppins_600SemiBold",
    color: "#201612",
  },
  dishVertChef: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: "#74635A",
  },
  dishVertPrice: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.tintDark,
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
