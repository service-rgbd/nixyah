import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Gradient from "@/components/SafeGradient";
import { apiFetch } from "@/constants/api";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { Dish, useApp } from "@/contexts/AppContext";

const TABS = ["Plats rapides", "Menus", "Stories", "À propos"];

function getDishImage(dish: Dish) {
  return dish.imageUrls?.[0] ?? dish.imageUrl ?? null;
}

function DishCard({
  dish,
  onAdd,
  onRemove,
  quantity,
  isLoading,
}: {
  dish: Dish;
  onAdd: () => void;
  onRemove: () => void;
  quantity: number;
  isLoading?: boolean;
}) {
  const dishImage = getDishImage(dish);

  return (
    <View style={styles.dishCard}>
      {dishImage ? (
        <Image source={{ uri: dishImage }} style={styles.dishImage} />
      ) : null}
      <View style={styles.dishInfo}>
        {dish.isPopular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>Populaire</Text>
          </View>
        )}
        <Text style={styles.dishName}>{dish.name}</Text>
        <Text style={styles.dishDesc} numberOfLines={2}>{dish.description}</Text>
        <View style={styles.dishMeta}>
          <View style={styles.metaChip}>
            <Feather name="clock" size={11} color={Colors.light.textTertiary} />
            <Text style={styles.metaChipText}>{dish.prepTime}</Text>
          </View>
          <Text style={styles.dishPrice}>{dish.price.toLocaleString()} FCFA</Text>
        </View>
      </View>
      <View style={styles.dishActions}>
        {quantity > 0 ? (
          <View style={styles.qtyControl}>
            <Pressable
              style={styles.qtyBtn}
              onPress={onRemove}
              disabled={isLoading}
            >
              <Feather name="minus" size={14} color={Colors.light.tint} />
            </Pressable>
            <Text style={styles.qtyText}>{quantity}</Text>
            <Pressable style={styles.qtyBtn} onPress={onAdd} disabled={isLoading}>
              <Feather name="plus" size={14} color={Colors.light.tint} />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addBtn} onPress={onAdd} disabled={isLoading}>
            <Feather name="plus" size={18} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function ChefDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getChef, favorites, toggleFavorite, user, token } = useApp();
  const [activeTab, setActiveTab] = useState(0);
  const [cart, setCart] = useState<Record<string, { itemId: number; quantity: number }>>({});
  const [changingDishId, setChangingDishId] = useState<string | null>(null);

  const chef = getChef(id ?? "");
  const isFav = favorites.includes(id ?? "");
  const isCourier = user?.type === "courier";

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (!chef) {
    return (
      <View style={styles.container}>
        <Text style={{ fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, marginTop: 100, textAlign: "center" }}>
          Cuisinière introuvable
        </Text>
      </View>
    );
  }

  const heroImage =
    chef.heroImageUrl ??
    chef.dishes.find((dish) => dish.imageUrls?.[0])?.imageUrls?.[0] ??
    chef.dishes.find((dish) => dish.imageUrl)?.imageUrl ??
    chef.stories?.find((story) => story.imageUrl)?.imageUrl ??
    null;
  const initials = chef.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = chef.dishes.reduce(
    (sum, dish) => sum + (cart[dish.id]?.quantity || 0) * dish.price,
    0
  );

  const loadCart = useCallback(async () => {
    if (!user || user.type !== "client" || !token) {
      setCart({});
      return;
    }

    try {
      const data = await apiFetch<{ cart?: { items?: Array<{ id: number; dishId?: number | null; quantity: number }> } }>("/cart", { token });
      const nextCart = Object.fromEntries(
        (data.cart?.items ?? [])
          .filter((item) => typeof item.dishId === "number")
          .map((item) => [String(item.dishId), { itemId: item.id, quantity: item.quantity }]),
      );
      setCart(nextCart);
    } catch (error) {
      console.warn("Failed to load restaurant cart", error);
    }
  }, [token, user]);

  useFocusEffect(
    useCallback(() => {
      loadCart();
    }, [loadCart]),
  );

  const addToCart = useCallback(async (dishId: string) => {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if (user.type !== "client" || !token) {
      return;
    }

    const numericDishId = Number(dishId);
    if (!Number.isInteger(numericDishId)) {
      Alert.alert("Erreur", "Plat invalide");
      return;
    }

    try {
      setChangingDishId(dishId);
      await apiFetch("/cart/items", {
        method: "POST",
        token,
        body: JSON.stringify({ dishId: numericDishId, quantity: 1 }),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await loadCart();
    } catch (error: any) {
      Alert.alert("Erreur", error?.message ?? "Impossible d'ajouter ce plat au panier");
    } finally {
      setChangingDishId(null);
    }
  }, [loadCart, token, user]);

  const removeFromCart = useCallback(async (dishId: string) => {
    const currentItem = cart[dishId];
    if (!currentItem || !token) {
      return;
    }

    try {
      setChangingDishId(dishId);
      if (currentItem.quantity <= 1) {
        await apiFetch(`/cart/items/${currentItem.itemId}`, {
          method: "DELETE",
          token,
        });
      } else {
        await apiFetch(`/cart/items/${currentItem.itemId}`, {
          method: "PUT",
          token,
          body: JSON.stringify({ quantity: currentItem.quantity - 1 }),
        });
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await loadCart();
    } catch (error: any) {
      Alert.alert("Erreur", error?.message ?? "Impossible de mettre à jour le panier");
    } finally {
      setChangingDishId(null);
    }
  }, [cart, loadCart, token]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: totalItems > 0 ? 120 : 60 }}>
        <Gradient
          colors={[chef.coverColor, chef.coverColor + "CC"]}
          style={[styles.hero, { paddingTop: topInset }]}
        >
          {heroImage ? (
            <ImageBackground source={{ uri: heroImage }} style={styles.heroImageBg} imageStyle={styles.heroImageBgStyle}>
              <View style={styles.heroImageOverlay} />
            </ImageBackground>
          ) : null}
          <View style={styles.heroActions}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </Pressable>
            <View style={styles.heroRight}>
              <Pressable
                style={styles.iconBtn}
                onPress={() => {
                  toggleFavorite(chef.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
              >
                <Ionicons name={isFav ? "heart" : "heart-outline"} size={20} color={isFav ? "#E74C3C" : "#fff"} />
              </Pressable>
              <Pressable
                style={styles.iconBtn}
                onPress={() => router.push({ pathname: "/chat/[chatId]", params: { chatId: `chat-${chef.id}`, chefId: chef.id, chefName: chef.name, chefSpecialty: chef.specialty, coverColor: chef.coverColor } })}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroContent}>
            <View style={styles.chefAvatarLarge}>
              {chef.avatarUrl ? (
                <Image source={{ uri: chef.avatarUrl as string }} style={styles.chefAvatarLargeImage} />
              ) : (
                <Text style={styles.chefAvatarText}>{initials}</Text>
              )}
            </View>
            <View style={styles.heroInfo}>
              <View style={styles.heroNameRow}>
                <Text style={styles.heroName}>{chef.name}</Text>
                {chef.isVerified && (
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                )}
              </View>
              <Text style={styles.heroSpecialty}>{chef.specialty}</Text>
              {chef.dishes[0] ? (
                <View style={styles.heroSpotlight}>
                  <Text style={styles.heroSpotlightLabel}>À découvrir</Text>
                  <Text style={styles.heroSpotlightText} numberOfLines={1}>
                    {chef.dishes[0].name} • {chef.dishes[0].price.toLocaleString()} FCFA
                  </Text>
                </View>
              ) : null}
              <View style={styles.heroMeta}>
                <View style={styles.heroBadge}>
                  <Ionicons name="star" size={12} color="#F7C27B" />
                  <Text style={styles.heroBadgeText}>{chef.rating} ({chef.reviewCount})</Text>
                </View>
                <View style={styles.heroBadge}>
                  <Feather name="map-pin" size={12} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.heroBadgeText}>{chef.location}</Text>
                </View>
                {chef.isOnline && (
                  <View style={[styles.heroBadge, styles.onlineBadge]}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.heroBadgeText}>En ligne</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Gradient>

        <View style={styles.tabs}>
          {TABS.map((tab, i) => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === i && styles.tabActive]}
              onPress={() => setActiveTab(i)}
            >
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{tab}</Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 0 && (
          <View style={styles.dishesSection}>
            {chef.dishes.map((dish) => (
              <DishCard
                key={dish.id}
                dish={dish}
                quantity={isCourier ? 0 : (cart[dish.id]?.quantity || 0)}
                onAdd={() => {
                  if (isCourier) return;
                  addToCart(dish.id);
                }}
                onRemove={() => {
                  if (isCourier) return;
                  removeFromCart(dish.id);
                }}
                isLoading={changingDishId === dish.id}
              />
            ))}
          </View>
        )}

        {activeTab === 1 && (
          <View style={styles.menuSection}>
            <View style={styles.menuCard}>
              <Text style={styles.menuCardTitle}>Repas personnalisé</Text>
              <Text style={styles.menuCardDesc}>
                Demandez un menu sur-mesure pour votre occasion spéciale. {chef.name} s'adapte à vos besoins.
              </Text>
              {!isCourier ? (
                <Pressable
                  style={styles.menuOrderBtn}
                  onPress={() => router.push({ pathname: "/order/[chefId]", params: { chefId: chef.id } })}
                >
                  <Text style={styles.menuOrderBtnText}>Créer ma demande</Text>
                  <Feather name="arrow-right" size={16} color="#fff" />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.menuCard}>
              <Text style={styles.menuCardTitle}>Chef à domicile</Text>
              <Text style={styles.menuCardDesc}>
                Invitez {chef.name.split(" ")[0]} chez vous pour cuisiner en direct pour votre événement.
              </Text>
              {!isCourier ? (
                <Pressable
                  style={[styles.menuOrderBtn, { backgroundColor: Colors.light.tintDark }]}
                  onPress={() => router.push({ pathname: "/order/[chefId]", params: { chefId: chef.id } })}
                >
                  <Text style={styles.menuOrderBtnText}>Réserver un chef</Text>
                  <Feather name="arrow-right" size={16} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        {activeTab === 2 && (
          <View style={styles.storiesSection}>
            {(chef.stories && chef.stories.length > 0) ? (
              chef.stories.map((story) => (
                <Pressable key={story.id} style={[styles.storyCard, { backgroundColor: story.bgColor || Colors.light.card }]}>
                  {story.imageUrl ? (
                    <Image source={{ uri: story.imageUrl }} style={styles.storyImage} />
                  ) : story.videoUrl ? (
                    <View style={[styles.storyImage, styles.storyVideoFallback]}>
                      <Feather name="play-circle" size={30} color="#fff" />
                      <Text style={styles.storyVideoText}>{story.videoDurationSeconds ? `${Math.round(story.videoDurationSeconds)} sec` : 'Video'}</Text>
                    </View>
                  ) : null}
                  <View style={styles.storyHeader}>
                    <Text style={styles.storyCaption} numberOfLines={3}>{story.caption}</Text>
                    {story.emoji && <Text style={styles.storyEmoji}>{story.emoji}</Text>}
                  </View>
                  {story.dishName && (
                    <View style={styles.storyDish}>
                      <Text style={styles.storyDishName}>{story.dishName}</Text>
                      {story.price && <Text style={styles.storyDishPrice}>{story.price.toLocaleString()} FCFA</Text>}
                    </View>
                  )}
                  <Text style={styles.storyTime}>{new Date(story.createdAt).toLocaleDateString('fr-FR')}</Text>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Feather name="image" size={48} color={Colors.light.textTertiary} />
                <Text style={styles.emptyStateText}>Aucune story pour le moment</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 3 && (
          <View style={styles.aboutSection}>
            <View style={styles.aboutCard}>
              <Text style={styles.aboutLabel}>À propos</Text>
              <Text style={styles.aboutBio}>{chef.bio}</Text>
            </View>
            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Feather name="clock" size={16} color={Colors.light.tint} />
                <Text style={styles.statLabel}>Temps de réponse moyen</Text>
                <Text style={styles.statValue}>{chef.responseTime}</Text>
              </View>
              <View style={styles.statRow}>
                <Ionicons name="star" size={16} color="#F7C27B" />
                <Text style={styles.statLabel}>Note globale</Text>
                <Text style={styles.statValue}>{chef.rating}/5</Text>
              </View>
              <View style={styles.statRow}>
                <Feather name="message-circle" size={16} color={Colors.light.tint} />
                <Text style={styles.statLabel}>Avis clients</Text>
                <Text style={styles.statValue}>{chef.reviewCount}</Text>
              </View>
              <View style={styles.statRow}>
                <Feather name="dollar-sign" size={16} color={Colors.light.success} />
                <Text style={styles.statLabel}>Gamme de prix</Text>
                <Text style={styles.statValue}>{chef.priceRange}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {totalItems > 0 && (
        <View style={[styles.cartBar, { paddingBottom: bottomInset + 12 }]}>
          <Pressable onPress={() => router.push("/(tabs)/cart")}>
            <Gradient
              colors={[Colors.light.tint, Colors.light.tintDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cartBarInner}
            >
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems}</Text>
              </View>
              <Text style={styles.cartText}>Voir mon panier</Text>
              <Text style={styles.cartPrice}>{totalPrice.toLocaleString()} FCFA</Text>
            </Gradient>
          </Pressable>
        </View>
      )}

      {totalItems === 0 && (
        <View style={[styles.stickyActions, { paddingBottom: bottomInset + 8 }]}>
          <Pressable
            style={styles.messageBtn}
            onPress={() => router.push({ pathname: "/chat/[chatId]", params: { chatId: `chat-${chef.id}`, chefId: chef.id, chefName: chef.name, chefSpecialty: chef.specialty, coverColor: chef.coverColor } })}
          >
            <Ionicons name="chatbubble-outline" size={18} color={Colors.light.tint} />
            <Text style={styles.messageBtnText}>Message</Text>
          </Pressable>
          <Pressable
            style={styles.orderBtn}
            onPress={() => router.push({ pathname: "/order/[chefId]", params: { chefId: chef.id } })}
          >
            <Text style={styles.orderBtnText}>Demande sur-mesure</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  hero: { paddingHorizontal: 20, paddingBottom: 24, position: "relative", overflow: "hidden" },
  heroImageBg: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImageBgStyle: {
    opacity: 0.95,
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(43,28,14,0.42)",
  },
  heroActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  heroRight: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  heroContent: { flexDirection: "row", gap: 14, alignItems: "flex-end" },
  chefAvatarLarge: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "rgba(255,255,255,0.5)",
    overflow: "hidden",
  },
  chefAvatarLargeImage: { width: 80, height: 80, borderRadius: 40 },
  chefAvatarText: { fontSize: 28, fontFamily: "Poppins_700Bold", color: "#fff" },
  heroInfo: { flex: 1, gap: 4 },
  heroNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroName: { fontSize: 20, fontFamily: "Poppins_700Bold", color: "#fff" },
  heroSpecialty: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.85)" },
  heroSpotlight: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  heroSpotlightLabel: {
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    color: "rgba(255,255,255,0.72)",
    textTransform: "uppercase",
  },
  heroSpotlightText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#fff", marginTop: 1 },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.2)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  onlineBadge: { backgroundColor: "rgba(39,174,96,0.3)" },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#27AE60" },
  heroBadgeText: { fontSize: 11, fontFamily: "Poppins_500Medium", color: "#fff" },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    paddingHorizontal: 20,
  },
  tab: { paddingVertical: 14, paddingHorizontal: 4, marginRight: 24, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: Colors.light.tint },
  tabText: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  tabTextActive: { color: Colors.light.tint, fontFamily: "Poppins_600SemiBold" },
  dishesSection: { padding: 20, gap: 12 },
  dishCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.light.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.light.cardBorder,
    shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  dishImage: {
    width: 88,
    height: 88,
    borderRadius: 14,
    marginRight: 12,
  },
  dishInfo: { flex: 1, gap: 4 },
  popularBadge: {
    alignSelf: "flex-start", backgroundColor: Colors.light.accent + "40",
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 2,
  },
  popularText: { fontSize: 10, fontFamily: "Poppins_600SemiBold", color: Colors.light.tintDark },
  dishName: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  dishDesc: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, lineHeight: 18 },
  dishMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaChipText: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  dishPrice: { fontSize: 14, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  dishActions: { marginLeft: 12, alignItems: "center", justifyContent: "center" },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.light.tint,
    alignItems: "center", justifyContent: "center",
  },
  qtyControl: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 6,
  },
  qtyBtn: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  qtyText: { fontSize: 14, fontFamily: "Poppins_700Bold", color: Colors.light.text, minWidth: 20, textAlign: "center" },
  menuSection: { padding: 20, gap: 14 },
  menuCard: {
    backgroundColor: Colors.light.card, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: Colors.light.cardBorder, gap: 10,
  },
  menuCardTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  menuCardDesc: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, lineHeight: 20 },
  menuOrderBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.light.tint, borderRadius: 14, paddingVertical: 13, marginTop: 4,
  },
  menuOrderBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  aboutSection: { padding: 20, gap: 14 },
  aboutCard: { backgroundColor: Colors.light.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.light.cardBorder },
  aboutLabel: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.textTertiary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  aboutBio: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.text, lineHeight: 22 },
  statsCard: { backgroundColor: Colors.light.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.light.cardBorder, gap: 16 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statLabel: { flex: 1, fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  statValue: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  cartBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.light.background },
  cartBarInner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18,
  },
  cartBadge: {
    backgroundColor: "rgba(255,255,255,0.3)", width: 26, height: 26,
    borderRadius: 13, alignItems: "center", justifyContent: "center",
  },
  cartBadgeText: { fontSize: 12, fontFamily: "Poppins_700Bold", color: "#fff" },
  cartText: { flex: 1, fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  cartPrice: { fontSize: 15, fontFamily: "Poppins_700Bold", color: "#fff" },
  stickyActions: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: Colors.light.background, borderTopWidth: 1, borderTopColor: Colors.light.divider,
  },
  messageBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderColor: Colors.light.tint, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 13,
  },
  messageBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  orderBtn: {
    flex: 1, backgroundColor: Colors.light.tint, borderRadius: 14,
    paddingVertical: 13, alignItems: "center", justifyContent: "center",
  },
  orderBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  storiesSection: { padding: 20, gap: 12 },
  storyCard: {
    borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: Colors.light.cardBorder,
    shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 2, gap: 10,
  },
  storyImage: {
    width: "100%",
    height: 180,
    borderRadius: 14,
  },
  storyVideoFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(36,31,27,0.82)",
    gap: 8,
  },
  storyVideoText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
  storyHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, justifyContent: "space-between" },
  storyCaption: { flex: 1, fontSize: 15, fontFamily: "Poppins_500Medium", color: Colors.light.text, lineHeight: 22 },
  storyEmoji: { fontSize: 36 },
  storyDish: { backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 12, padding: 12, gap: 4 },
  storyDishName: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  storyDishPrice: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  storyTime: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyStateText: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
});
