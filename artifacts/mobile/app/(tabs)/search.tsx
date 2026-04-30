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
import { apiFetch } from "@/constants/api";
import Colors from "@/constants/colors";
import {
  type CommerceApiProduct,
  type CommerceApiStore,
  type CommerceCatalogResponse,
  getProductsByUniverse,
  getStoresByUniverse,
  resolveCommerceProductVisual,
} from "@/constants/commerce-catalog";
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

type SearchQuickFilter = "all" | "online" | "verified" | "nearby";

const SEARCH_QUICK_FILTERS: Array<{
  id: SearchQuickFilter;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}> = [
  { id: "all", label: "Tout", icon: "sliders" },
  { id: "online", label: "En ligne", icon: "radio" },
  { id: "verified", label: "Vérifiées", icon: "shield" },
  { id: "nearby", label: "Proches", icon: "navigation" },
];

function normalizeSearchText(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getSearchTokens(value: string) {
  return normalizeSearchText(value).split(" ").filter(Boolean);
}

function matchesSearchTokens(tokens: string[], values: Array<string | null | undefined>) {
  if (!tokens.length) {
    return true;
  }

  const haystack = values.map((value) => normalizeSearchText(value)).filter(Boolean).join(" ");
  return tokens.every((token) => haystack.includes(token));
}

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
        ) : (
          <View style={[styles.nearbyAvatar, styles.nearbyAvatarFallback]}>
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

function SearchQuickFilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.quickFilterChip, active && styles.quickFilterChipActive]}
      onPress={onPress}
    >
      <Feather name={icon} size={13} color={active ? "#FFF7EF" : "#7A5D43"} />
      <Text style={[styles.quickFilterChipText, active && styles.quickFilterChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FilterSectionTitle({ title }: { title: string }) {
  return <Text style={styles.filterSectionTitle}>{title}</Text>;
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

function CommercePreviewCard({
  product,
  store,
}: {
  product: CommerceApiProduct;
  store: CommerceApiStore;
}) {
  return (
    <Pressable
      style={styles.commercePreviewCard}
      onPress={() =>
        router.push({
          pathname: "/client/commerce-store/[storeId]",
          params: { storeId: store.id, universe: store.universe },
        })
      }
    >
      <Image
        source={resolveCommerceProductVisual({
          name: product.name,
          visualKey: product.visualKey,
          imageUrl: product.imageUrl,
          universe: store.universe,
        })}
        style={styles.commercePreviewImage}
      />
      <View style={styles.commercePreviewBody}>
        <View
          style={[
            styles.commercePreviewUniversePill,
            { backgroundColor: `${store.accentColor}16` },
          ]}
        >
          <Text style={[styles.commercePreviewUniverseText, { color: store.accentColor }]}>
            {store.universe === "supermarkets"
              ? "Alimentaire"
              : store.universe === "courses"
                ? "Express"
                : "Boutique"}
          </Text>
        </View>
        <Text style={styles.commercePreviewName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.commercePreviewMeta} numberOfLines={1}>
          {store.name} · {product.category}
        </Text>
        <View style={styles.commercePreviewFooter}>
          <Text style={styles.commercePreviewPrice}>
            {product.price.toLocaleString("fr-FR")} FCFA
          </Text>
          <Text style={[styles.commercePreviewAction, { color: store.accentColor }]}>
            Voir
          </Text>
        </View>
      </View>
    </Pressable>
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
  const variantLabel =
    variant === "trending" ? "🔥 Tendance" : variant === "online" && chef.isOnline ? "En ligne" : null;
  const topDish = getTopDish(chef);
  const zoneLabel = chef.zone ?? chef.location.split(",")[0];

  return (
    <Pressable
      style={styles.chefRowCard}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
    >
      <View style={styles.chefRowMediaColumn}>
        <View style={styles.chefRowAvatarFloat}>
          <View style={styles.chefRowAvatarRing}>
            {chef.avatarUrl ? (
              <CachedRemoteImage uri={chef.avatarUrl} style={styles.chefRowAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.chefRowAvatar, styles.chefRowAvatarFallback]}>
                <Text style={styles.chefRowAvatarInitials}>{chef.name.slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
          </View>
          {chef.isOnline && <View style={styles.chefRowOnlineIndicator} />}
        </View>
      </View>
      <View style={styles.chefRowInfoPanel}>
        <View style={styles.chefRowHeaderLine}>
          <View style={styles.chefRowNameRow}>
            <Text style={styles.chefRowName} numberOfLines={1}>{chef.name}</Text>
            {chef.isVerified && (
              <Ionicons name="shield-checkmark" size={15} color={Colors.light.tint} />
            )}
          </View>
          <Pressable style={styles.chefRowFavBtn} onPress={onFavoriteToggle} hitSlop={10}>
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={18}
              color={isFavorite ? "#FF5B5B" : Colors.light.textTertiary}
            />
          </Pressable>
        </View>
        {variantLabel ? (
          <View style={[styles.chefRowVariantBadge, variant === "trending" ? styles.chefRowTrendBadge : styles.chefRowOnlineBadge]}>
            {variant === "online" && chef.isOnline ? <View style={styles.chefRowOnlineDot} /> : null}
            <Text style={[styles.chefRowVariantBadgeText, variant === "online" ? styles.chefRowVariantBadgeTextOnline : null]}>
              {variantLabel}
            </Text>
          </View>
        ) : null}
        <Text style={styles.chefRowSpecialty} numberOfLines={1}>{chef.specialty}</Text>
        <Text style={styles.chefRowHook} numberOfLines={2}>
          {topDish ? `${topDish.name} · ${getStartingPrice(chef)}` : "Cuisine maison soignée, profil à découvrir."}
        </Text>

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
            <Text style={styles.chefRowFooterText} numberOfLines={1}>{zoneLabel}</Text>
          </View>
          <Text style={styles.chefRowStartingPrice}>Voir le profil</Text>
        </View>

        <View style={styles.chefRowDelivery}>
          <Feather name="truck" size={11} color={Colors.light.success} />
          <Text style={styles.chefRowDeliveryText}>{getEstimatedDelivery(chef)} livraison estimée</Text>
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
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<SearchQuickFilter>("all");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [showFilterDetails, setShowFilterDetails] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [commerceStores, setCommerceStores] = useState<CommerceApiStore[]>([]);
  const [commerceProductsWithPhotos, setCommerceProductsWithPhotos] = useState<CommerceApiProduct[]>([]);
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

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const universes = ["courses", "supermarkets", "boutiques"] as const;
        const responses = await Promise.all(
          universes.map(async (universe) => {
            const response = await apiFetch<CommerceCatalogResponse>(`/commerce/catalog?universe=${universe}`);
            return response;
          })
        );

        if (!active) {
          return;
        }

        const stores = responses.flatMap((response) => response.stores ?? []);
        const products = responses
          .flatMap((response) => response.products ?? [])
          .filter((product) => typeof product.imageUrl === "string" && product.imageUrl.trim().length > 0);

        setCommerceStores(stores);
        setCommerceProductsWithPhotos(products);
      } catch (error) {
        console.warn("Failed to load commerce previews for explorer", error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const onlineCount = chefs.filter((chef) => chef.isOnline).length;
  const verifiedCount = chefs.filter((chef) => chef.isVerified).length;
  const searchTokens = useMemo(() => getSearchTokens(query), [query]);
  const isFiltering =
    query.trim().length > 0 ||
    selectedFilter !== null ||
    selectedQuickFilter !== "all" ||
    selectedZone !== null;
  const coursePreviewCount = getProductsByUniverse("courses").length;
  const supermarketStoreCount = getStoresByUniverse("supermarkets").length;
  const boutiquePreviewCount = getProductsByUniverse("boutiques").length;
  const commerceStoresById = useMemo(
    () => new Map(commerceStores.map((store) => [store.id, store])),
    [commerceStores]
  );
  const foodPreviewProducts = useMemo(
    () =>
      commerceProductsWithPhotos
        .filter((product) => commerceStoresById.get(product.storeId)?.universe === "supermarkets")
        .slice(0, 8),
    [commerceProductsWithPhotos, commerceStoresById]
  );
  const coursePreviewProducts = useMemo(
    () =>
      commerceProductsWithPhotos
        .filter((product) => commerceStoresById.get(product.storeId)?.universe === "courses")
        .slice(0, 6),
    [commerceProductsWithPhotos, commerceStoresById]
  );
  const boutiquePreviewProducts = useMemo(
    () =>
      commerceProductsWithPhotos
        .filter((product) => commerceStoresById.get(product.storeId)?.universe === "boutiques")
        .slice(0, 6),
    [commerceProductsWithPhotos, commerceStoresById]
  );
  const commercePreviewSections = useMemo(
    () => [
      {
        id: "food",
        title: "Produits alimentaires",
        caption: "Rayons utiles visibles directement dans Explorer.",
        products: foodPreviewProducts,
      },
      {
        id: "courses",
        title: "Courses express",
        caption: "Petites courses rapides, organisées en horizontal.",
        products: coursePreviewProducts,
      },
      {
        id: "boutiques",
        title: "Boutiques & enseignes",
        caption: "Sélections cadeaux et achats spécialisés en un coup d'œil.",
        products: boutiquePreviewProducts,
      },
    ],
    [boutiquePreviewProducts, coursePreviewProducts, foodPreviewProducts]
  );
  const availableZones = useMemo(
    () =>
      Array.from(new Set(chefs.map((chef) => (chef.zone ?? chef.location.split(",")[0]).trim()).filter(Boolean))).slice(
        0,
        8
      ),
    [chefs]
  );
  const activeFilterCount = [
    selectedFilter !== null,
    selectedQuickFilter !== "all",
    selectedZone !== null,
  ].filter(Boolean).length;

  const filteredChefs = useMemo(
    () =>
      [...chefs]
        .filter((chef) => {
          const matchesQuery =
            searchTokens.length === 0 ||
            matchesSearchTokens(searchTokens, [
              chef.name,
              chef.specialty,
              chef.location,
              chef.zone ?? "",
              ...chef.dishes.map((dish) => dish.name),
            ]);

          const matchesFilter =
            selectedFilter === null ||
            matchesSearchTokens(getSearchTokens(selectedFilter), [
              chef.specialty,
              ...chef.dishes.map((dish) => dish.name),
            ]);

          const matchesQuickFilter =
            selectedQuickFilter === "all" ||
            (selectedQuickFilter === "online" && chef.isOnline) ||
            (selectedQuickFilter === "verified" && chef.isVerified) ||
            (selectedQuickFilter === "nearby" &&
              userCoords !== null &&
              resolveZoneCoords(`${chef.location} ${chef.zone ?? ""}`) !== null);
          const matchesZone =
            selectedZone === null ||
            normalizeSearchText(chef.zone ?? chef.location.split(",")[0]) === normalizeSearchText(selectedZone);

          return matchesQuery && matchesFilter && matchesQuickFilter && matchesZone;
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
    [chefs, searchTokens, selectedFilter, selectedQuickFilter, selectedZone, userCoords]
  );

  const filteredCommerceProducts = useMemo(() => {
    if (!searchTokens.length) {
      return [];
    }

    return commerceProductsWithPhotos
      .filter((product) => {
        const store = commerceStoresById.get(product.storeId);
        return matchesSearchTokens(searchTokens, [
          product.name,
          product.category,
          product.description,
          store?.name ?? "",
          store?.location ?? "",
        ]);
      })
      .slice(0, 12);
  }, [commerceProductsWithPhotos, commerceStoresById, searchTokens]);

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
            <Pressable
              style={[styles.headerFilterButton, showFilterDetails && styles.headerFilterButtonActive]}
              onPress={() => setShowFilterDetails((current) => !current)}
            >
              {activeFilterCount > 0 ? (
                <View style={styles.headerFilterBadge}>
                  <Text style={styles.headerFilterBadgeText}>{activeFilterCount}</Text>
                </View>
              ) : null}
              <Feather
                name="filter"
                size={18}
                color={showFilterDetails ? "#FFF7EF" : Colors.light.text}
              />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Feather name="search" size={16} color={Colors.light.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Plat, produit, enseigne, quartier..."
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
              onPress={() => setSelectedFilter((current) => (current === item.filter ? null : item.filter))}
            />
          ))}
        </ScrollView>

        {showFilterDetails ? (
          <View style={styles.filterPanel}>
            <View style={styles.filterPanelHeader}>
              <Text style={styles.filterPanelTitle}>Paramètres de filtrage</Text>
              {activeFilterCount > 0 ? (
                <Pressable
                  style={styles.filterResetPill}
                  onPress={() => {
                    setSelectedQuickFilter("all");
                    setSelectedZone(null);
                    setSelectedFilter(null);
                  }}
                >
                  <Text style={styles.filterResetText}>Réinitialiser</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.filterPanelSection}>
              <FilterSectionTitle title="Disponibilité" />
              <Text style={styles.filterSectionHint}>Choisissez le niveau de visibilité souhaité.</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFiltersRow}>
              {SEARCH_QUICK_FILTERS.map((item) => (
                <SearchQuickFilterChip
                  key={item.id}
                  label={item.label}
                  icon={item.icon}
                  active={selectedQuickFilter === item.id}
                  onPress={() => setSelectedQuickFilter(item.id)}
                />
              ))}
            </ScrollView>

            <View style={styles.filterPanelSection}>
              <FilterSectionTitle title="Quartiers" />
              <Text style={styles.filterSectionHint}>Affichez d’abord les profils du bon secteur.</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFiltersRow}>
              <SearchQuickFilterChip
                label="Tous les quartiers"
                icon="map-pin"
                active={selectedZone === null}
                onPress={() => setSelectedZone(null)}
              />
              {availableZones.map((zone) => (
                <SearchQuickFilterChip
                  key={zone}
                  label={zone}
                  icon="map-pin"
                  active={selectedZone === zone}
                  onPress={() => setSelectedZone((current) => (current === zone ? null : zone))}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {isFiltering ? (
          <View style={styles.searchSummaryRow}>
            <Text style={styles.searchSummaryText}>
              {filteredChefs.length} cuisine{filteredChefs.length > 1 ? "s" : ""}
            </Text>
            {query.trim().length > 0 ? (
              <Text style={styles.searchSummaryText}>
                {filteredCommerceProducts.length} produit{filteredCommerceProducts.length > 1 ? "s" : ""}
              </Text>
            ) : null}
            {selectedZone ? <Text style={styles.searchSummaryText}>{selectedZone}</Text> : null}
          </View>
        ) : null}

        {!isFiltering && !query.trim().length && foodPreviewProducts.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Produits du supermarché</Text>
              <Text style={styles.sectionCaption}>Produits avec vraies photos visibles, en accès rapide.</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.commercePreviewRow}
            >
              {foodPreviewProducts.map((product) => {
                const store = commerceStoresById.get(product.storeId);
                if (!store) {
                  return null;
                }

                return (
                  <CommercePreviewCard
                    key={`food-top-${product.id}`}
                    product={product}
                    store={store}
                  />
                );
              })}
            </ScrollView>
          </View>
        ) : null}

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
              setSelectedQuickFilter("all");
              setSelectedZone(null);
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

        {!query.trim().length
          ? commercePreviewSections
              .filter((section) => section.id !== "food")
              .map((section) =>
              section.products.length ? (
                <View key={section.id} style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionCaption}>{section.caption}</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.commercePreviewRow}
                  >
                    {section.products.map((product) => {
                      const store = commerceStoresById.get(product.storeId);
                      if (!store) {
                        return null;
                      }

                      return (
                        <CommercePreviewCard
                          key={`${section.id}-${product.id}`}
                          product={product}
                          store={store}
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null
            )
          : null}

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

        {query.trim().length > 0 && filteredCommerceProducts.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Produits & enseignes</Text>
              <Text style={styles.sectionCaption}>
                La recherche remonte aussi les rayons commerce utiles.
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.commercePreviewRow}
            >
              {filteredCommerceProducts.map((product) => {
                const store = commerceStoresById.get(product.storeId);
                if (!store) {
                  return null;
                }

                return (
                  <CommercePreviewCard
                    key={`search-product-${product.id}`}
                    product={product}
                    store={store}
                  />
                );
              })}
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
                setSelectedQuickFilter("all");
              setSelectedZone(null);
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
  headerFilterButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDE7C7",
    position: "relative",
  },
  headerFilterButtonActive: {
    backgroundColor: "#201612",
  },
  headerFilterBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D9652B",
  },
  headerFilterBadgeText: {
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
    color: "#FFF7EF",
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
  filterPanel: {
    marginTop: 12,
    marginHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderRadius: 22,
    backgroundColor: "#FFF9F3",
    borderWidth: 1,
    borderColor: "rgba(126,99,79,0.10)",
    gap: 6,
  },
  filterPanelHeader: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filterPanelTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: "#201612",
  },
  filterResetPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F7E9D6",
  },
  filterResetText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#A85A31",
  },
  filterPanelSection: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 4,
  },
  filterSectionTitle: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#8B5A3C",
  },
  filterSectionHint: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Poppins_400Regular",
    color: "#7A5D43",
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
  quickFiltersRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
  quickFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: "rgba(126,99,79,0.12)",
  },
  quickFilterChipActive: {
    backgroundColor: "#201612",
    borderColor: "#201612",
  },
  quickFilterChipText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "#7A5D43",
  },
  quickFilterChipTextActive: {
    color: "#FFF7EF",
  },
  searchSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchSummaryText: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#F7E9D6",
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#A85A31",
    overflow: "hidden",
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
    width: 162,
    borderRadius: 24,
    minHeight: 170,
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
    padding: 15,
    paddingTop: 13,
    minHeight: 170,
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
    marginTop: 32,
    fontSize: 17,
    lineHeight: 21,
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
  commercePreviewRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  commercePreviewCard: {
    width: 188,
    backgroundColor: "#FFF9F4",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(126,99,79,0.10)",
  },
  commercePreviewImage: {
    width: "100%",
    height: 126,
  },
  commercePreviewBody: {
    padding: 12,
    gap: 6,
  },
  commercePreviewUniversePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  commercePreviewUniverseText: {
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  commercePreviewName: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Poppins_700Bold",
    color: "#201612",
  },
  commercePreviewMeta: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Poppins_400Regular",
    color: "#74635A",
  },
  commercePreviewFooter: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  commercePreviewPrice: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.tintDark,
  },
  commercePreviewAction: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
  },
  spotlightCard: {
    marginHorizontal: 16,
    borderRadius: 0,
    overflow: "visible",
    backgroundColor: "transparent",
  },
  spotlightMedia: {
    height: 304,
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
    gap: 12,
  },
  chefRowCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(120,104,96,0.10)",
  },
  chefRowMediaColumn: {
    width: 106,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  chefRowVariantBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  chefRowTrendBadge: {
    backgroundColor: "#F6E7D1",
  },
  chefRowOnlineBadge: {
    backgroundColor: "#E8F6EC",
  },
  chefRowVariantBadgeText: {
    color: "#7C4A21",
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
  },
  chefRowVariantBadgeTextOnline: {
    color: "#168447",
  },
  chefRowOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#34C759",
  },
  chefRowFavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0E4D7",
  },
  chefRowInfoPanel: {
    flex: 1,
    minWidth: 0,
    paddingTop: 9,
    paddingRight: 2,
  },
  chefRowHeaderLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  chefRowNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chefRowName: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Poppins_700Bold",
    color: "#201612",
  },
  chefRowSpecialty: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: "#74635A",
  },
  chefRowHook: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_500Medium",
    color: "#3F2E26",
  },
  chefRowMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 8,
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#EFE2D2",
  },
  metricPillText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#4B372D",
  },
  chefRowFooter: {
    marginTop: 8,
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
    color: "#B15C31",
  },
  chefRowAvatarFloat: {
    position: "relative",
    width: 102,
    alignItems: "center",
    marginTop: 14,
  },
  chefRowAvatarRing: {
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 0,
    overflow: "hidden",
    backgroundColor: "#EFE2D2",
  },
  chefRowAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 51,
  },
  chefRowAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  chefRowAvatarInitials: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    color: "#6F5444",
  },
  chefRowOnlineIndicator: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#34C759",
    borderWidth: 2,
    borderColor: "#fff",
  },
  chefRowDelivery: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
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
    backgroundColor: "transparent",
    borderRadius: 0,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(120,104,96,0.10)",
  },
  nearbyAvatarWrap: {
    position: "relative",
  },
  nearbyAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EFE2D2",
  },
  nearbyAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  nearbyAvatarInitials: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: "#6F5444",
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
    backgroundColor: "#F0E4D7",
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
    backgroundColor: "transparent",
  },
  popDishMedia: {
    height: 170,
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 20,
    overflow: "hidden",
  },
  popDishMediaRadius: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    paddingTop: 12,
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
    backgroundColor: "transparent",
  },
  dishVertMedia: {
    height: 142,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    overflow: "hidden",
  },
  dishVertMediaRadius: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
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
    paddingTop: 10,
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
