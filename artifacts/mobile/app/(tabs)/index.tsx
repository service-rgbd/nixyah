import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Image as RNImage,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Gradient from "@/components/SafeGradient";
import Colors from "@/constants/colors";
import { Chef, Dish, useApp } from "@/contexts/AppContext";

const courierPromoImage = require("@/assets/images/courier-delivery-illustration.png");
const cashierPromoImage = require("@/assets/images/login-cashier-illustration.png");

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

type ServiceItem = {
  id: string;
  label: string;
  action: () => void;
  primaryIcon: IoniconsName;
  secondaryIcon: IoniconsName;
  accentColor: string;
};

const SERVICES: ServiceItem[] = [
  {
    id: "cuisinieres",
    label: "Cuisinieres",
    primaryIcon: "restaurant",
    secondaryIcon: "fast-food",
    accentColor: Colors.light.tint,
    action: () => router.push("/(tabs)/search"),
  },
  {
    id: "courses",
    label: "Courses",
    primaryIcon: "cart",
    secondaryIcon: "bag-handle",
    accentColor: Colors.light.terracotta,
    action: () => router.push("/client/courses"),
  },
  {
    id: "supermarches",
    label: "Supermarches",
    primaryIcon: "storefront",
    secondaryIcon: "basket",
    accentColor: Colors.light.success,
    action: () => router.push("/client/supermarkets"),
  },
  {
    id: "boutiques",
    label: "Boutiques",
    primaryIcon: "gift",
    secondaryIcon: "sparkles",
    accentColor: "#8B5E3C",
    action: () => router.push("/client/boutiques"),
  },
];

const PROMOS = [
  {
    id: "livraison",
    title: "Livraison suivie",
    subtitle: "Commandes prises en charge plus rapidement",
    image: courierPromoImage,
    icon: "bicycle" as IoniconsName,
    accentColor: Colors.light.accent,
    action: () => router.push("/(tabs)/orders?mode=delivery"),
  },
  {
    id: "courses",
    title: "Courses minute",
    subtitle: "Une course, une cheffe et un suivi simple",
    image: cashierPromoImage,
    icon: "bag-handle" as IoniconsName,
    accentColor: Colors.light.tint,
    action: () => router.push("/(tabs)/search"),
  },
];

type QuickDishItem = {
  chefId: string;
  name: string;
  price: number;
  imageSource: string | number | null;
};

const localDishAssets = {
  aloco: require("@/assets/images/Alloco-avec-oeuf-1.webp"),
  attieke: require("@/assets/images/attieke.jpg"),
  kedjenou: require("@/assets/images/poulet-kedjenou.jpg"),
  sauceArachide: require("@/assets/images/sauce-arachide.jpg"),
} as const;

function getDishImage(dish: Dish) {
  return dish.imageUrls?.[0] ?? dish.imageUrl ?? null;
}

function normalizeDishName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getLocalDishImage(name: string) {
  const normalized = normalizeDishName(name);

  if (normalized.includes("alloco") || normalized.includes("aloco")) {
    return localDishAssets.aloco;
  }

  if (normalized.includes("attieke") || normalized.includes("attieke poisson") || normalized.includes("attieke poulet")) {
    return localDishAssets.attieke;
  }

  if (normalized.includes("kedjenou")) {
    return localDishAssets.kedjenou;
  }

  if (normalized.includes("arachide")) {
    return localDishAssets.sauceArachide;
  }

  return null;
}

function getPrepMinutes(prepTime?: string) {
  if (!prepTime) return Number.POSITIVE_INFINITY;
  const match = prepTime.match(/(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function ServiceIllustration({
  primaryIcon,
  secondaryIcon,
  accentColor,
  size,
}: {
  primaryIcon: IoniconsName;
  secondaryIcon: IoniconsName;
  accentColor: string;
  size: number;
}) {
  const innerSize = size - 18;
  const primaryBadgeSize = Math.max(42, Math.round(size * 0.34));
  const iconPrimary = Math.max(26, Math.round(size * 0.24));
  const iconSecondary = Math.max(20, Math.round(size * 0.18));

  return (
    <View style={[styles.serviceBubbleInner, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
      <View style={styles.illustrationBackdrop} />
      <View style={styles.illustrationPlate} />
      <View style={[styles.illustrationOrb, styles.illustrationOrbLeft, { backgroundColor: `${accentColor}26` }]} />
      <View style={[styles.illustrationOrb, styles.illustrationOrbRight, { backgroundColor: "rgba(255,255,255,0.7)" }]} />
      <View style={[styles.illustrationStroke, styles.illustrationStrokeOne, { backgroundColor: accentColor }]} />
      <View style={[styles.illustrationStroke, styles.illustrationStrokeTwo, { backgroundColor: Colors.light.terracotta }]} />
      <View style={[styles.primaryBadge, { width: primaryBadgeSize, height: primaryBadgeSize, borderRadius: primaryBadgeSize / 2, backgroundColor: `${accentColor}1E` }]}>
        <Ionicons name={primaryIcon} size={iconPrimary} color={accentColor} />
      </View>
      <View style={[styles.secondaryBadge, { backgroundColor: Colors.light.card }]}> 
        <Ionicons name={secondaryIcon} size={iconSecondary} color={Colors.light.tintDark} />
      </View>
      <View style={[styles.illustrationSpark, { backgroundColor: accentColor }]} />
    </View>
  );
}

function ServiceBubble({
  label,
  primaryIcon,
  secondaryIcon,
  accentColor,
  action,
  bubbleSize,
}: {
  label: string;
  primaryIcon: IoniconsName;
  secondaryIcon: IoniconsName;
  accentColor: string;
  action: () => void;
  bubbleSize: number;
}) {
  return (
    <Pressable style={styles.serviceBubbleItem} onPress={action}>
      <View style={[styles.serviceBubbleOuter, { width: bubbleSize, height: bubbleSize, borderRadius: bubbleSize / 2 }]}>
        <ServiceIllustration
          primaryIcon={primaryIcon}
          secondaryIcon={secondaryIcon}
          accentColor={accentColor}
          size={bubbleSize}
        />
      </View>
      <View style={[styles.serviceLabelPill, { maxWidth: bubbleSize + 8 }]}> 
        <Text style={styles.serviceLabelText} numberOfLines={2}>{label}</Text>
      </View>
    </Pressable>
  );
}

function DiscoveryChefCard({ chef }: { chef: Chef }) {
  const imageUrl = chef.heroImageUrl ?? chef.avatarUrl ?? chef.dishes[0]?.imageUrl ?? null;
  const initials = chef.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Pressable
      style={styles.discoveryChefCard}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
    >
      <View style={styles.discoveryChefVisualWrap}>
        <View
          style={[
            styles.discoveryChefVisual,
            !imageUrl ? { backgroundColor: chef.coverColor } : null,
          ]}
        >
          {imageUrl ? (
            <RNImage source={{ uri: imageUrl }} style={styles.discoveryChefVisualImage} />
          ) : (
            <Text style={styles.discoveryChefInitials}>{initials}</Text>
          )}
        </View>
      </View>
      <View style={styles.discoveryChefBody}>
        <View style={styles.discoveryChefTopRow}>
          <Text style={styles.discoveryChefName} numberOfLines={1}>
            {chef.name}
          </Text>
          <View style={styles.discoveryChefRatingPill}>
            <Ionicons name="star" size={10} color="#F7C27B" />
            <Text style={styles.discoveryChefRatingText}>{chef.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.discoveryChefMeta} numberOfLines={1}>
          {chef.specialty}
        </Text>
        <View style={styles.discoveryChefLocationRow}>
          <Feather name="map-pin" size={11} color="rgba(255,255,255,0.54)" />
          <Text style={styles.discoveryChefLocation} numberOfLines={1}>
            {chef.location.split(",")[0]}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function DiscoveryUtilityCard({
  title,
  subtitle,
  icon,
  accentColor,
  action,
}: {
  title: string;
  subtitle: string;
  icon: IoniconsName;
  accentColor: string;
  action: () => void;
}) {
  return (
    <Pressable style={styles.discoveryUtilityCard} onPress={action}>
      <View style={[styles.discoveryUtilityIconWrap, { backgroundColor: `${accentColor}20` }] }>
        <Ionicons name={icon} size={18} color={accentColor} />
      </View>
      <View style={styles.discoveryUtilityTextBlock}>
        <Text style={styles.discoveryUtilityTitle}>{title}</Text>
        <Text style={styles.discoveryUtilitySubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
      <Feather name="arrow-up-right" size={15} color="rgba(255,255,255,0.68)" />
    </Pressable>
  );
}

function QuickDishCard({ item }: { item: QuickDishItem }) {
  return (
    <Pressable
      style={styles.quickDishCard}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: item.chefId } })}
    >
      <View style={styles.quickDishVisualWrap}>
        {typeof item.imageSource === "string" ? (
          <RNImage source={{ uri: item.imageSource }} style={styles.quickDishVisual} />
        ) : item.imageSource ? (
          <RNImage source={item.imageSource} style={styles.quickDishVisual} />
        ) : (
          <View style={[styles.quickDishVisual, styles.quickDishVisualFallback]}>
            <Ionicons name="fast-food" size={28} color={Colors.light.accent} />
          </View>
        )}
      </View>
      <Text style={styles.quickDishName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.quickDishPrice} numberOfLines={1}>
        {item.price.toLocaleString("fr-FR")} FCFA
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { chefs, user } = useApp();
  const topInset = Platform.OS === "web" ? 64 : insets.top;
  const locationLabel = user?.location || "Abidjan";
  const compactHome = height < 860;
  const bubbleSize = compactHome
    ? Math.max(96, Math.min(108, Math.floor((width - 92) / 2)))
    : Math.max(106, Math.min(122, Math.floor((width - 76) / 2)));

  const quickDishes: QuickDishItem[] = chefs
    .flatMap((chef) =>
      chef.dishes.map((dish) => ({
        chefId: chef.id,
        name: dish.name,
        price: dish.price,
        imageUrl: getDishImage(dish),
        prepMinutes: getPrepMinutes(dish.prepTime),
        isPopular: Boolean(dish.isPopular),
      }))
    )
    .sort((left, right) => {
      const prepDiff = left.prepMinutes - right.prepMinutes;
      if (prepDiff !== 0) return prepDiff;
      const popularDiff = Number(right.isPopular) - Number(left.isPopular);
      if (popularDiff !== 0) return popularDiff;
      return left.price - right.price;
    })
    .slice(0, 6)
    .map(({ chefId, name, price, imageUrl }) => ({
      chefId,
      name,
      price,
      imageSource: imageUrl ?? getLocalDishImage(name),
    }));
  const onlineCount = chefs.filter((chef) => chef.isOnline).length;

  return (
    <View style={styles.container}>
      <Gradient
        colors={[Colors.light.accent, Colors.light.tintLight, Colors.light.backgroundSecondary]}
        style={[styles.heroSection, { paddingTop: topInset + (compactHome ? 6 : 10) }]}
      >
        <View style={[styles.heroTopBar, compactHome ? styles.heroTopBarCompact : null]}>
          <Pressable style={styles.locationPill} onPress={() => router.push("/(tabs)/search")}>
            <Ionicons name="location-outline" size={17} color={Colors.light.text} />
            <Text style={styles.locationText} numberOfLines={1}>
              {locationLabel}
            </Text>
            <Feather name="chevron-down" size={16} color={Colors.light.text} />
          </Pressable>
          <View style={styles.statusChip}>
            <View style={styles.statusDot} />
            <Text style={styles.statusChipText}>{onlineCount} en ligne</Text>
          </View>
        </View>

        <View style={[styles.serviceBubbleGrid, compactHome ? styles.serviceBubbleGridCompact : null]}>
          {SERVICES.map((service) => (
            <ServiceBubble
              key={service.id}
              label={service.label}
              primaryIcon={service.primaryIcon}
              secondaryIcon={service.secondaryIcon}
              accentColor={service.accentColor}
              action={service.action}
              bubbleSize={bubbleSize}
            />
          ))}
        </View>
      </Gradient>

      <View style={[styles.discoveryPanel, { paddingBottom: Platform.OS === "web" ? 18 : insets.bottom + 8 }]}>
        <View style={styles.discoveryPanelEdge} />
        <View style={[styles.discoveryHeader, compactHome ? styles.discoveryHeaderCompact : null]}>
          <View>
            <Text style={styles.discoveryTitle}>Pour vous</Text>
            <Text style={styles.discoverySubtitle}>
              Plats rapides disponibles maintenant.
            </Text>
          </View>
          <Pressable style={styles.infoButton} onPress={() => router.push("/(tabs)/search")}>
            <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.82)" />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.quickDishRow, compactHome ? styles.quickDishRowCompact : null]}
        >
          {quickDishes.map((item) => (
            <QuickDishCard key={`${item.chefId}-${item.name}`} item={item} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: Colors.light.background,
  },
  heroSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  heroTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  heroTopBarCompact: {
    marginBottom: 16,
  },
  locationPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 27,
    backgroundColor: "rgba(255,250,245,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
  },
  locationText: {
    flex: 1,
    maxWidth: 190,
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,250,245,0.4)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.success,
  },
  statusChipText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  serviceBubbleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
    columnGap: 12,
    paddingHorizontal: 4,
    paddingTop: 12,
  },
  serviceBubbleGridCompact: {
    rowGap: 12,
    paddingTop: 8,
  },
  serviceBubbleItem: {
    width: "48%",
    alignItems: "center",
  },
  serviceBubbleOuter: {
    padding: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,234,192,0.68)",
    borderWidth: 1.5,
    borderColor: "rgba(212,97,26,0.16)",
  },
  serviceBubbleInner: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,249,242,0.92)",
    borderWidth: 2,
    borderColor: Colors.light.tintLight,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 3,
    overflow: "hidden",
    position: "relative",
  },
  illustrationBackdrop: {
    position: "absolute",
    width: "68%",
    height: "68%",
    borderRadius: 999,
    backgroundColor: "rgba(247,194,123,0.22)",
  },
  illustrationPlate: {
    position: "absolute",
    width: "54%",
    height: "18%",
    bottom: "28%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  illustrationOrb: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  illustrationOrbLeft: {
    left: 16,
    top: 22,
  },
  illustrationOrbRight: {
    right: 16,
    bottom: 22,
  },
  illustrationStroke: {
    position: "absolute",
    height: 4,
    borderRadius: 999,
    opacity: 0.85,
  },
  illustrationStrokeOne: {
    width: 20,
    top: 24,
    left: 30,
    transform: [{ rotate: "28deg" }],
  },
  illustrationStrokeTwo: {
    width: 16,
    top: 34,
    right: 30,
    transform: [{ rotate: "-24deg" }],
  },
  primaryBadge: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212,97,26,0.14)",
  },
  secondaryBadge: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },
  illustrationSpark: {
    position: "absolute",
    top: 20,
    right: 26,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  serviceLabelPill: {
    marginTop: -10,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceLabelText: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 16,
  },
  discoveryPanel: {
    marginTop: -32,
    backgroundColor: "#241F1B",
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    paddingTop: 8,
    minHeight: 214,
  },
  discoveryPanelEdge: {
    alignSelf: "center",
    width: 78,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 8,
  },
  discoveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  discoveryHeaderCompact: {
    paddingBottom: 8,
  },
  discoveryTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: "Poppins_700Bold",
    color: "#FFF9F2",
  },
  discoverySubtitle: {
    marginTop: 4,
    maxWidth: 260,
    fontSize: 9,
    lineHeight: 12,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.68)",
  },
  infoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  promoCanvasRow: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  promoCanvasRowCompact: {
    paddingBottom: 10,
  },
  promoCanvasGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  promoBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  promoBadgeText: {
    fontSize: 9,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  discoveryFeatureCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#2E2722",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    gap: 12,
  },
  discoveryFeatureCardCompact: {
    padding: 12,
    gap: 10,
  },
  discoveryFeatureHeader: {
    gap: 6,
  },
  discoveryFeatureTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Poppins_700Bold",
    color: "#FFF9F2",
  },
  discoveryFeatureTitleCompact: {
    fontSize: 16,
    lineHeight: 20,
  },
  discoveryFeatureSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.68)",
  },
  discoveryFeatureSubtitleCompact: {
    fontSize: 10,
    lineHeight: 15,
  },
  quickDishRow: {
    paddingHorizontal: 24,
    gap: 12,
    paddingBottom: 0,
  },
  quickDishRowCompact: {
    gap: 10,
  },
  quickDishCard: {
    width: 84,
    alignItems: "center",
    gap: 5,
  },
  quickDishVisualWrap: {
    width: 84,
    height: 84,
    borderRadius: 20,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  quickDishVisual: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
  },
  quickDishVisualFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  quickDishName: {
    width: "100%",
    fontSize: 10,
    textAlign: "center",
    fontFamily: "Poppins_500Medium",
    color: "#FFF8F0",
  },
  quickDishPrice: {
    width: "100%",
    marginTop: -4,
    fontSize: 9,
    textAlign: "center",
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.56)",
  },
  discoveryActionList: {
    gap: 10,
  },
  discoveryActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 10,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  discoveryActionLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  discoveryActionImageWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  discoveryActionImage: {
    width: 40,
    height: 40,
  },
  discoveryActionTextBlock: {
    flex: 1,
    gap: 4,
  },
  discoveryActionPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  discoveryActionPillText: {
    fontSize: 9,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.accent,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  discoveryActionTitle: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: "#FFF8F0",
  },
  discoveryActionSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  subsectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  subsectionHeaderCompact: {
    paddingBottom: 8,
  },
  subsectionTitle: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: "#FFF7EE",
  },
  subsectionTitleCompact: {
    fontSize: 15,
  },
  subsectionLink: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.accent,
  },
  suggestionRow: {
    paddingHorizontal: 24,
  },
  suggestionRowCompact: {
    paddingHorizontal: 24,
  },
  discoveryLowerGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    paddingHorizontal: 24,
  },
  discoveryLowerGridCompact: {
    gap: 8,
  },
  discoveryUtilityStack: {
    flex: 1,
    gap: 10,
  },
  discoveryChefCard: {
    flex: 1.08,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  discoveryChefVisualWrap: {
    position: "relative",
  },
  discoveryChefVisual: {
    width: 74,
    height: 66,
    borderRadius: 16,
    backgroundColor: "#362E29",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  discoveryChefVisualImage: {
    width: 74,
    height: 66,
  },
  discoveryChefBody: {
    flex: 1,
    gap: 4,
  },
  discoveryChefTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  discoveryChefInitials: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
  discoveryChefName: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#FFF8F0",
  },
  discoveryChefRatingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  discoveryChefRatingText: {
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    color: "#FFF8F0",
  },
  discoveryChefMeta: {
    fontSize: 10,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.58)",
  },
  discoveryChefLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  discoveryChefLocation: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.54)",
  },
  discoveryUtilityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  discoveryUtilityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  discoveryUtilityTextBlock: {
    flex: 1,
    gap: 2,
  },
  discoveryUtilityTitle: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "#FFF8F0",
  },
  discoveryUtilitySubtitle: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.58)",
  },
});
