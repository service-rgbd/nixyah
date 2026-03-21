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
import { Chef, useApp } from "@/contexts/AppContext";

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
    action: () => router.push("/(tabs)/search"),
  },
  {
    id: "livraison",
    label: "Livraison",
    primaryIcon: "bicycle",
    secondaryIcon: "cube",
    accentColor: Colors.light.warning,
    action: () => router.push("/(tabs)/orders?mode=delivery"),
  },
  {
    id: "support",
    label: "Support",
    primaryIcon: "headset",
    secondaryIcon: "chatbubble-ellipses",
    accentColor: Colors.light.success,
    action: () => router.push("/(tabs)/help"),
  },
];

const PROMOS = [
  {
    id: "livraison",
    title: "Livraison suivie",
    subtitle: "Commandes prises en charge plus rapidement",
    image: courierPromoImage,
    action: () => router.push("/(tabs)/orders?mode=delivery"),
  },
  {
    id: "courses",
    title: "Courses minute",
    subtitle: "Une course, une cheffe et un suivi simple",
    image: cashierPromoImage,
    action: () => router.push("/(tabs)/search"),
  },
];

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

function SuggestionCard({
  chef,
  isFavorite,
  onFavoriteToggle,
}: {
  chef: Chef;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
}) {
  const imageUrl = chef.heroImageUrl ?? chef.avatarUrl ?? chef.dishes[0]?.imageUrl ?? null;
  const initials = chef.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Pressable
      style={styles.suggestionCard}
      onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
    >
      <View style={styles.suggestionVisualWrap}>
        <View
          style={[
            styles.suggestionVisual,
            !imageUrl ? { backgroundColor: chef.coverColor } : null,
          ]}
        >
          {imageUrl ? (
            <RNImage source={{ uri: imageUrl }} style={styles.suggestionVisualImage} />
          ) : (
            <Text style={styles.suggestionInitials}>{initials}</Text>
          )}
        </View>
        <Pressable style={styles.favoriteButton} onPress={onFavoriteToggle}>
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={14}
            color={isFavorite ? Colors.light.error : Colors.light.textSecondary}
          />
        </Pressable>
      </View>
      <Text style={styles.suggestionName} numberOfLines={1}>
        {chef.name}
      </Text>
      <Text style={styles.suggestionMeta} numberOfLines={1}>
        {chef.specialty}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { chefs, favorites, toggleFavorite, user } = useApp();
  const topInset = Platform.OS === "web" ? 64 : insets.top;
  const locationLabel = user?.location || "Abidjan";
  const bubbleSize = Math.max(112, Math.min(136, Math.floor((width - 88) / 2)));

  const recommendedChefs = [...chefs]
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
    .slice(0, 8);

  const onlineCount = chefs.filter((chef) => chef.isOnline).length;
  const verifiedCount = chefs.filter((chef) => chef.isVerified).length;
  const paginationDots = Math.max(1, Math.min(3, Math.ceil(recommendedChefs.length / 4)));

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 110 }}
      >
        <Gradient
          colors={[Colors.light.accent, Colors.light.tintLight, Colors.light.backgroundSecondary]}
          style={[styles.heroSection, { paddingTop: topInset + 12 }]}
        >
          <View style={styles.heroTopBar}>
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

          <View style={styles.serviceBubbleGrid}>
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

        <View style={styles.discoveryPanel}>
          <View style={styles.discoveryPanelEdge} />

          <View style={styles.discoveryHeader}>
            <View>
              <Text style={styles.discoveryTitle}>Ceci est pour vous</Text>
              <Text style={styles.discoverySubtitle}>
                Promos du moment, profils utiles et suggestions simples a parcourir.
              </Text>
            </View>
            <Pressable style={styles.infoButton} onPress={() => router.push("/(tabs)/search")}>
              <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.82)" />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promoCanvasRow}
          >
            {PROMOS.map((promo) => (
              <Pressable key={promo.id} style={styles.promoCanvasCard} onPress={promo.action}>
                <Gradient
                  colors={["rgba(247,194,123,0.26)", "rgba(212,97,26,0.10)"]}
                  style={styles.promoCanvasGlow}
                />
                <View style={styles.promoCanvasContent}>
                  <View style={styles.promoCanvasTextBlock}>
                    <View style={styles.promoBadge}>
                      <Text style={styles.promoBadgeText}>Promo</Text>
                    </View>
                    <Text style={styles.promoCanvasTitle}>{promo.title}</Text>
                    <Text style={styles.promoCanvasSubtitle}>{promo.subtitle}</Text>
                    <View style={styles.promoCanvasCta}>
                      <Text style={styles.promoCanvasCtaText}>Voir</Text>
                      <Feather name="arrow-up-right" size={14} color={Colors.light.text} />
                    </View>
                  </View>
                  <View style={styles.promoCanvasArtWrap}>
                    <View style={styles.promoCanvasArtHalo} />
                    <RNImage source={promo.image} style={styles.promoCanvasArt} resizeMode="contain" />
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.subsectionHeader}>
            <Text style={styles.subsectionTitle}>Cheffes en vue</Text>
            <Pressable onPress={() => router.push("/(tabs)/search")}>
              <Text style={styles.subsectionLink}>Explorer</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionRow}
          >
            {recommendedChefs.map((chef) => (
              <SuggestionCard
                key={chef.id}
                chef={chef}
                isFavorite={favorites.includes(chef.id)}
                onFavoriteToggle={() => toggleFavorite(chef.id)}
              />
            ))}
          </ScrollView>

          <View style={styles.paginationRow}>
            {Array.from({ length: paginationDots }).map((_, index) => (
              <View
                key={index}
                style={[styles.paginationDot, index === 0 ? styles.paginationDotActive : null]}
              />
            ))}
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{recommendedChefs.length}</Text>
              <Text style={styles.summaryLabel}>cheffes mises en avant</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{verifiedCount}</Text>
              <Text style={styles.summaryLabel}>profils verifies</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingBottom: 92,
    minHeight: 500,
  },
  heroTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 42,
  },
  locationPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 18,
    borderRadius: 27,
    backgroundColor: "rgba(255,250,245,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
  },
  locationText: {
    flex: 1,
    maxWidth: 190,
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  serviceBubbleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 22,
    columnGap: 12,
    paddingHorizontal: 4,
    paddingTop: 28,
  },
  serviceBubbleItem: {
    width: "48%",
    alignItems: "center",
  },
  serviceBubbleOuter: {
    padding: 8,
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
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  illustrationOrbLeft: {
    left: 18,
    top: 26,
  },
  illustrationOrbRight: {
    right: 18,
    bottom: 24,
  },
  illustrationStroke: {
    position: "absolute",
    height: 4,
    borderRadius: 999,
    opacity: 0.85,
  },
  illustrationStrokeOne: {
    width: 22,
    top: 28,
    left: 34,
    transform: [{ rotate: "28deg" }],
  },
  illustrationStrokeTwo: {
    width: 18,
    top: 38,
    right: 34,
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
    right: 24,
    bottom: 26,
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
    top: 24,
    right: 30,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  serviceLabelPill: {
    marginTop: -10,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    paddingHorizontal: 16,
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
    lineHeight: 17,
  },
  discoveryPanel: {
    marginTop: -46,
    backgroundColor: "#241F1B",
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    paddingTop: 18,
    paddingBottom: 26,
  },
  discoveryPanelEdge: {
    alignSelf: "center",
    width: 78,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 18,
  },
  discoveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  discoveryTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Poppins_700Bold",
    color: "#FFF9F2",
  },
  discoverySubtitle: {
    marginTop: 4,
    maxWidth: 260,
    fontSize: 13,
    lineHeight: 20,
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
    gap: 14,
    paddingBottom: 20,
  },
  promoCanvasCard: {
    width: 286,
    minHeight: 156,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#2E2722",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  promoCanvasGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  promoCanvasContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    gap: 12,
  },
  promoCanvasTextBlock: {
    flex: 1,
    gap: 8,
  },
  promoBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  promoBadgeText: {
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.accent,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  promoCanvasTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontFamily: "Poppins_700Bold",
    color: "#FFF9F2",
  },
  promoCanvasSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.72)",
  },
  promoCanvasCta: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  promoCanvasCtaText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: "#FFF2E2",
  },
  promoCanvasArtWrap: {
    width: 102,
    height: 102,
    alignItems: "center",
    justifyContent: "center",
  },
  promoCanvasArtHalo: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  promoCanvasArt: {
    width: 96,
    height: 96,
  },
  subsectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  subsectionTitle: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: "#FFF7EE",
  },
  subsectionLink: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.accent,
  },
  suggestionRow: {
    paddingHorizontal: 24,
    gap: 14,
  },
  suggestionCard: {
    width: 112,
    gap: 10,
  },
  suggestionVisualWrap: {
    position: "relative",
  },
  suggestionVisual: {
    width: 112,
    height: 100,
    borderRadius: 24,
    backgroundColor: "#362E29",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  suggestionVisualImage: {
    width: 112,
    height: 100,
  },
  suggestionInitials: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
  favoriteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionName: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: "#FFF8F0",
  },
  suggestionMeta: {
    marginTop: -6,
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.58)",
  },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingTop: 20,
  },
  paginationDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  paginationDotActive: {
    width: 22,
    backgroundColor: "#FFF4E7",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: "#FFF8F0",
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Poppins_500Medium",
    color: "rgba(255,255,255,0.64)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
