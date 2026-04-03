import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Image as RNImage,
  ImageSourcePropType,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CachedRemoteImage, prefetchRemoteImages } from "@/components/CachedRemoteImage";
import Gradient from "@/components/SafeGradient";
import Colors from "@/constants/colors";
import { Dish, useApp } from "@/contexts/AppContext";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

type ServiceItem = {
  id: string;
  label: string;
  action: () => void;
  image: ImageSourcePropType;
  accentColor: string;
};

const SERVICE_IMAGES = {
  cuisinieres: require("@/assets/images/cuisniere.webp"),
  courses: require("@/assets/images/courses.webp"),
  faq: require("@/assets/images/faq.jpg"),
  supermarches: require("@/assets/images/supermarket.webp"),
  boutiques: require("@/assets/images/boutique.webp"),
} as const;

const SERVICES: ServiceItem[] = [
  {
    id: "cuisinieres",
    label: "Cuisinieres",
    image: SERVICE_IMAGES.cuisinieres,
    accentColor: Colors.light.tint,
    action: () => router.push("/(tabs)/search"),
  },
  {
    id: "courses",
    label: "Courses",
    image: SERVICE_IMAGES.courses,
    accentColor: Colors.light.terracotta,
    action: () => router.push("/client/courses"),
  },
  {
    id: "faq",
    label: "FAQ",
    image: SERVICE_IMAGES.faq,
    accentColor: Colors.light.warning,
    action: () => router.push("/(tabs)/help"),
  },
  {
    id: "supermarches",
    label: "Supermarches",
    image: SERVICE_IMAGES.supermarches,
    accentColor: Colors.light.success,
    action: () => router.push("/client/supermarkets"),
  },
  {
    id: "boutiques",
    label: "Boutiques",
    image: SERVICE_IMAGES.boutiques,
    accentColor: "#8B5E3C",
    action: () => router.push("/client/boutiques"),
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
  image,
  accentColor,
  size,
}: {
  image: ImageSourcePropType;
  accentColor: string;
  size: number;
}) {
  const innerSize = size - 16;
  return (
    <View style={[styles.serviceBubbleInner, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
      <RNImage source={image} style={styles.serviceBubbleImage} resizeMode="cover" />
    </View>
  );
}

function ServiceBubble({
  label,
  image,
  accentColor,
  action,
  bubbleSize,
  cardWidth,
  labelMaxWidth,
}: {
  label: string;
  image: ImageSourcePropType;
  accentColor: string;
  action: () => void;
  bubbleSize: number;
  cardWidth: number;
  labelMaxWidth?: number;
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const draggedRef = useRef(false);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          draggedRef.current = false;
        },
        onPanResponderMove: (_, gestureState) => {
          if (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4) {
            draggedRef.current = true;
          }

          pan.setValue({
            x: Math.max(-28, Math.min(28, gestureState.dx)),
            y: Math.max(-28, Math.min(28, gestureState.dy)),
          });
        },
        onPanResponderRelease: () => {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            tension: 120,
            friction: 8,
            useNativeDriver: true,
          }).start(() => {
            draggedRef.current = false;
          });
        },
        onPanResponderTerminate: () => {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            tension: 120,
            friction: 8,
            useNativeDriver: true,
          }).start(() => {
            draggedRef.current = false;
          });
        },
      }),
    [pan],
  );

  return (
    <Animated.View
      style={[
        styles.serviceBubbleItem,
        { width: cardWidth, transform: [{ translateX: pan.x }, { translateY: pan.y }] },
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable onPress={() => {
        if (!draggedRef.current) {
          action();
        }
      }}>
      <View style={[styles.serviceBubbleOuter, { width: bubbleSize, height: bubbleSize, borderRadius: bubbleSize / 2 }]}>
        <ServiceIllustration
          image={image}
          accentColor={accentColor}
          size={bubbleSize}
        />
      </View>
      <View style={[styles.serviceLabelPill, { maxWidth: labelMaxWidth ?? bubbleSize + 8 }]}> 
        <Text style={styles.serviceLabelText} numberOfLines={2}>{label}</Text>
      </View>
      </Pressable>
    </Animated.View>
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
          <CachedRemoteImage uri={item.imageSource} style={styles.quickDishVisual} />
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
    ? Math.max(94, Math.min(106, Math.floor((width - 80) / 2)))
    : Math.max(100, Math.min(114, Math.floor((width - 64) / 2)));
  const sideCardWidth = Math.max(100, Math.min((width - 80) / 2, 130));
  const centerCardWidth = Math.max(120, Math.min(width - 120, 160));
  const topServices = SERVICES.slice(0, 2);
  const faqService = SERVICES[2];
  const bottomServices = SERVICES.slice(3, 5);
  const promoBlink = useRef(new Animated.Value(0.45)).current;

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
  const featuredQuickDishes = quickDishes.slice(0, 4);
  const promoCountdown = useMemo(() => {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 0, 0);
    const diff = Math.max(0, endOfDay.getTime() - now.getTime());
    const totalMinutes = Math.floor(diff / 60000);

    return {
      hours: String(Math.floor(totalMinutes / 60)).padStart(2, "0"),
      minutes: String(totalMinutes % 60).padStart(2, "0"),
    };
  }, []);

  useEffect(() => {
    void prefetchRemoteImages(
      quickDishes
        .map((item) => (typeof item.imageSource === "string" ? item.imageSource : null))
        .slice(0, 6)
    );
  }, [quickDishes]);
  // Content area already excludes the tab bar — bottom:0 = flush above nav bar
  const panelHeight = compactHome ? 218 : 234;
  const panelBottomOffset = 0;
  const heroBottomReserve = panelHeight + 4;

  const onlineCount = chefs.filter((chef) => chef.isOnline).length;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(promoBlink, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(promoBlink, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [promoBlink]);

  return (
    <View style={styles.container}>
      <Gradient
        colors={[Colors.light.accent, Colors.light.tintLight, Colors.light.backgroundSecondary]}
        style={[styles.heroSection, { paddingTop: topInset + (compactHome ? 6 : 10), paddingBottom: heroBottomReserve }]}
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

        <Pressable style={styles.promoSpecialChip} onPress={() => router.push("/(tabs)/search")}>
          <Animated.View style={[styles.promoSpecialBlinkDot, { opacity: promoBlink, transform: [{ scale: promoBlink }] }]} />
          <Ionicons name="pricetag" size={15} color={Colors.light.text} />
          <Text style={styles.promoSpecialChipText}>Promo speciale Paques</Text>
        </Pressable>

        <View style={[styles.serviceMatrix, compactHome ? styles.serviceMatrixCompact : null]}>
          <View style={styles.serviceRow}>
            {topServices.map((service) => (
              <ServiceBubble
                key={service.id}
                label={service.label}
                image={service.image}
                accentColor={service.accentColor}
                action={service.action}
                bubbleSize={bubbleSize}
                cardWidth={sideCardWidth}
                labelMaxWidth={sideCardWidth}
              />
            ))}
          </View>

          <View style={styles.serviceCenterRow}>
            <ServiceBubble
              key={faqService.id}
              label={faqService.label}
              image={faqService.image}
              accentColor={faqService.accentColor}
              action={faqService.action}
              bubbleSize={bubbleSize + (compactHome ? 2 : 10)}
              cardWidth={centerCardWidth}
              labelMaxWidth={centerCardWidth}
            />
          </View>

          <View style={styles.serviceRow}>
            {bottomServices.map((service) => (
              <ServiceBubble
                key={service.id}
                label={service.label}
                image={service.image}
                accentColor={service.accentColor}
                action={service.action}
                bubbleSize={bubbleSize}
                cardWidth={sideCardWidth}
                labelMaxWidth={sideCardWidth}
              />
            ))}
          </View>
        </View>
      </Gradient>

      <View pointerEvents="box-none" style={styles.forYouLayer}>
        <View style={[styles.forYouPanel, { height: panelHeight, bottom: panelBottomOffset }]}> 
          <View style={styles.forYouGlowPrimary} />
          <View style={styles.forYouGlowSecondary} />
          <View style={styles.forYouCurve} />

          <View style={styles.forYouHeader}>
            <Text style={styles.forYouTitle}>Ceci est pour vous</Text>
            <Pressable style={styles.infoButton} onPress={() => router.push("/(tabs)/search")}>
              <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.82)" />
            </Pressable>
          </View>

          {featuredQuickDishes.length > 0 ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickDishRow}>
                {featuredQuickDishes.map((item) => (
                  <QuickDishCard key={`${item.chefId}-${item.name}`} item={item} />
                ))}
              </ScrollView>
              <View style={styles.quickDishDotsRow}>
                <View style={[styles.quickDishDot, styles.quickDishDotActive]} />
                <View style={styles.quickDishDot} />
              </View>
            </>
          ) : null}

          <Pressable style={styles.forYouPromoCard} onPress={() => router.push("/(tabs)/search")}>
            <View style={styles.forYouPromoContent}>
              <View style={styles.forYouTimerRow}>
                <View style={styles.forYouTimerBox}><Text style={styles.forYouTimerText}>{promoCountdown.hours}</Text></View>
                <Text style={styles.forYouTimerColon}>:</Text>
                <View style={styles.forYouTimerBox}><Text style={styles.forYouTimerText}>{promoCountdown.minutes}</Text></View>
              </View>
              <Text style={styles.forYouPromoTitle} numberOfLines={1}>Duree limitee — nouveaux endroits a -30 %</Text>
            </View>
            <View style={styles.forYouPromoBadge}>
              <Text style={styles.forYouPromoBadgeText}>-30%</Text>
            </View>
            <View style={styles.forYouPromoArrow}>
              <Feather name="chevron-right" size={14} color="#FFF9F2" />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: Colors.light.backgroundSecondary,
  },
  heroSection: {
    paddingHorizontal: 20,
  },
  heroTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  heroTopBarCompact: {
    marginBottom: 6,
  },
  promoSpecialChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "rgba(255,250,245,0.66)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.58)",
  },
  promoSpecialBlinkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF5A36",
    shadowColor: "#FF5A36",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  promoSpecialChipText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
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
  serviceMatrix: {
    gap: 6,
    paddingTop: 4,
    paddingBottom: 6,
  },
  serviceMatrixCompact: {
    gap: 4,
    paddingTop: 3,
    paddingBottom: 4,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    gap: 0,
    paddingHorizontal: 0,
  },
  serviceCenterRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  serviceBubbleItem: {
    alignItems: "center",
  },
  serviceBubbleOuter: {
    padding: 7,
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
  },
  serviceBubbleImage: {
    width: "100%",
    height: "100%",
  },
  serviceLabelPill: {
    marginTop: -8,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    minHeight: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceLabelText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 14,
  },
  forYouLayer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "box-none",
  },
  forYouPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#241F1B",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 10,
    overflow: "hidden",
  },
  forYouCurve: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    height: 42,
    borderTopLeftRadius: 64,
    borderTopRightRadius: 64,
    borderWidth: 8,
    borderBottomWidth: 0,
    borderColor: "rgba(255,232,180,0.9)",
    opacity: 0.82,
  },
  forYouGlowPrimary: {
    position: "absolute",
    top: 0,
    left: -18,
    width: 140,
    height: 90,
    borderRadius: 70,
    backgroundColor: "rgba(255,214,126,0.08)",
  },
  forYouGlowSecondary: {
    position: "absolute",
    top: 8,
    right: -20,
    width: 156,
    height: 98,
    borderRadius: 78,
    backgroundColor: "rgba(255,214,126,0.06)",
  },
  forYouHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  forYouTitle: {
    fontSize: 15,
    lineHeight: 18,
    fontFamily: "Poppins_700Bold",
    color: "#FFF9F2",
  },
  infoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  quickDishRow: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 8,
  },
  quickDishDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 10,
  },
  quickDishDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  quickDishDotActive: {
    backgroundColor: "#FFF8F0",
  },
  quickDishCard: {
    width: 90,
    alignItems: "center",
    gap: 5,
  },
  quickDishVisualWrap: {
    width: 90,
    height: 90,
    borderRadius: 20,
    padding: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  quickDishVisual: {
    width: "100%",
    height: "100%",
    borderRadius: 15,
  },
  quickDishVisualFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  quickDishName: {
    width: "100%",
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
    fontFamily: "Poppins_500Medium",
    color: "#FFF8F0",
  },
  forYouPromoCard: {
    marginHorizontal: 16,
    height: 52,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#26211E",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  forYouPromoContent: {
    flex: 1,
    gap: 2,
  },
  forYouTimerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  forYouTimerBox: {
    minWidth: 26,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#FFF8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  forYouTimerText: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  forYouTimerColon: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: "#FFF8F0",
  },
  forYouPromoTitle: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: "Poppins_600SemiBold",
    color: "rgba(255,255,255,0.72)",
  },
  forYouPromoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#D84D43",
    alignItems: "center",
    justifyContent: "center",
  },
  forYouPromoBadgeText: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    color: "#FFF8F0",
  },
  forYouPromoArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#171513",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
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
});
