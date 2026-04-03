import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Gradient from "@/components/SafeGradient";
import {
  CHEF_MENU_CATEGORIES,
  formatPrice,
  getDishBasePrice,
  getDishCurrentPrice,
  getDishDiscountPercent,
  getDishPrimaryImage,
} from "@/constants/chef-menu";
import { apiFetch } from "@/constants/api";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CachedRemoteBackground, CachedRemoteImage, prefetchRemoteImages } from "@/components/CachedRemoteImage";
import Colors from "@/constants/colors";
import { Dish, Story, useApp } from "@/contexts/AppContext";

const TABS = ["Plats rapides", "Menu", "Stories", "À propos"] as const;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatStoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Récent";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function getTopCategories(dishes: Dish[]) {
  const counts = new Map<string, number>();
  for (const dish of dishes) {
    const category = dish.category?.trim();
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);
}

// ─── Dish Detail Bottom-Sheet Modal ─────────────────────────────────────────
function DishDetailModal({
  dish,
  visible,
  onClose,
  quantity,
  onAdd,
  onRemove,
  isLoading,
  orderingEnabled,
}: {
  dish: Dish | null;
  visible: boolean;
  onClose: () => void;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  isLoading?: boolean;
  orderingEnabled: boolean;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
  }, [visible, slideAnim]);

  if (!dish) return null;

  const imageUri = getDishPrimaryImage(dish);
  const currentPrice = getDishCurrentPrice(dish);
  const basePrice = getDishBasePrice(dish);
  const discountPercent = getDishDiscountPercent(dish);
  const allImages = [...(dish.imageUrls ?? [])].filter(Boolean);
  if (imageUri && !allImages.includes(imageUri)) allImages.unshift(imageUri);

  // Parse description into visual composition list
  const compositionLines = (dish.description ?? "")
    .split(/[;,\n•·]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  const hasComposition = compositionLines.length > 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={styles.dishModalSheet}>
        {/* Drag handle */}
        <View style={styles.sheetHandle} />

        {/* Image */}
        {imageUri ? (
          <View style={styles.dishModalImageWrap}>
            <CachedRemoteImage uri={imageUri} style={styles.dishModalImage} />
            {discountPercent > 0 && (
              <View style={styles.dishModalDiscountBadge}>
                <Text style={styles.dishModalDiscountText}>-{discountPercent}%</Text>
              </View>
            )}
            {dish.isPopular && (
              <View style={styles.dishModalPopularBadge}>
                <Ionicons name="flash" size={11} color="#fff" />
                <Text style={styles.dishModalPopularText}>Populaire</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.dishModalImagePlaceholder}>
            <Feather name="image" size={36} color={Colors.light.textTertiary} />
          </View>
        )}

        <ScrollView style={styles.dishModalScroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.dishModalHeader}>
            <View style={styles.dishModalCategoryRow}>
              <View style={styles.dishModalCategoryBadge}>
                <Text style={styles.dishModalCategoryText}>{dish.category}</Text>
              </View>
              <View style={styles.dishModalTimeRow}>
                <Feather name="clock" size={12} color={Colors.light.textTertiary} />
                <Text style={styles.dishModalTimeTxt}>{dish.prepTime}</Text>
              </View>
            </View>
            <Text style={styles.dishModalName}>{dish.name}</Text>
            <View style={styles.dishModalPriceRow}>
              <Text style={styles.dishModalPrice}>{formatPrice(currentPrice)}</Text>
              {discountPercent > 0 && basePrice > currentPrice ? (
                <Text style={styles.dishModalPriceOld}>{formatPrice(basePrice)}</Text>
              ) : null}
            </View>
          </View>

          {/* Composition / Description */}
          {dish.description ? (
            <View style={styles.dishModalSection}>
              <View style={styles.dishModalSectionHeader}>
                <View style={styles.dishModalSectionDot} />
                <Text style={styles.dishModalSectionTitle}>
                  {hasComposition ? "Composition" : "Description"}
                </Text>
              </View>
              {hasComposition ? (
                <View style={styles.compositionGrid}>
                  {compositionLines.map((line, idx) => (
                    <View key={idx} style={styles.compositionTag}>
                      <Feather name="check-circle" size={12} color={Colors.light.tint} />
                      <Text style={styles.compositionTagText}>{line}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.dishModalDesc}>{dish.description}</Text>
              )}
            </View>
          ) : null}

          {/* Multiple images strip */}
          {allImages.length > 1 ? (
            <View style={styles.dishModalSection}>
              <View style={styles.dishModalSectionHeader}>
                <View style={styles.dishModalSectionDot} />
                <Text style={styles.dishModalSectionTitle}>Photos</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dishModalImagesRow}>
                {allImages.map((uri, idx) => (
                  <CachedRemoteImage key={idx} uri={uri} style={styles.dishModalThumb} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* CTA */}
        <View style={styles.dishModalCTA}>
          {orderingEnabled ? (
            quantity > 0 ? (
              <View style={styles.dishModalQtyRow}>
                <Pressable style={styles.dishModalQtyBtn} onPress={onRemove} disabled={isLoading}>
                  <Feather name="minus" size={18} color={Colors.light.tint} />
                </Pressable>
                <Text style={styles.dishModalQtyText}>{quantity}</Text>
                <Pressable style={styles.dishModalQtyBtn} onPress={onAdd} disabled={isLoading}>
                  <Feather name="plus" size={18} color={Colors.light.tint} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.dishModalAddBtn, isLoading && { opacity: 0.6 }]}
                onPress={onAdd}
                disabled={isLoading}
              >
                <Feather name="shopping-bag" size={16} color="#fff" />
                <Text style={styles.dishModalAddBtnText}>Ajouter au panier · {formatPrice(currentPrice)}</Text>
              </Pressable>
            )
          ) : (
            <View style={styles.dishModalReadOnly}>
              <Feather name="eye" size={14} color={Colors.light.textSecondary} />
              <Text style={styles.dishModalReadOnlyText}>Profil consultatif</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Dish Cards ───────────────────────────────────────────────────────────────
function DishCard({
  dish,
  quantity,
  onAdd,
  onRemove,
  isLoading,
  orderingEnabled,
  onOpenDetail,
}: {
  dish: Dish;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  isLoading?: boolean;
  orderingEnabled: boolean;
  onOpenDetail: () => void;
}) {
  const imageUri = getDishPrimaryImage(dish);
  const currentPrice = getDishCurrentPrice(dish);
  const basePrice = getDishBasePrice(dish);
  const discountPercent = getDishDiscountPercent(dish);

  return (
    <Pressable style={styles.dishCard} onPress={onOpenDetail}>
      <View style={styles.dishVisualWrap}>
        {imageUri ? (
          <CachedRemoteImage uri={imageUri} style={styles.dishImage} />
        ) : (
          <View style={styles.dishImageFallback}>
            <Feather name="image" size={22} color={Colors.light.textTertiary} />
          </View>
        )}
        <View style={styles.dishBadgeRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{dish.category}</Text>
          </View>
          {dish.isPopular ? (
            <View style={styles.quickBadge}>
              <Ionicons name="flash" size={12} color={Colors.light.tint} />
              <Text style={styles.quickBadgeText}>Rapide</Text>
            </View>
          ) : null}
        </View>
        {/* Tap hint */}
        <View style={styles.dishDetailHint}>
          <Feather name="info" size={12} color="rgba(255,255,255,0.9)" />
        </View>
      </View>

      <View style={styles.dishBody}>
        <View style={styles.dishHeaderRow}>
          <View style={styles.dishHeaderMeta}>
            <Text style={styles.dishName}>{dish.name}</Text>
            <Text style={styles.dishDescription} numberOfLines={2}>
              {dish.description || "Appuyez pour voir la composition"}
            </Text>
          </View>
          <View style={styles.priceWrap}>
            <Text style={styles.priceCurrent}>{formatPrice(currentPrice)}</Text>
            {discountPercent > 0 && basePrice > currentPrice ? (
              <Text style={styles.pricePrevious}>{formatPrice(basePrice)}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Feather name="clock" size={12} color={Colors.light.textTertiary} />
            <Text style={styles.metaPillText}>{dish.prepTime}</Text>
          </View>
          {discountPercent > 0 ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
            </View>
          ) : null}
        </View>

        {orderingEnabled ? (
          <View style={styles.dishActionRow}>
            {quantity > 0 ? (
              <View style={styles.qtyControl}>
                <Pressable style={styles.qtyBtn} onPress={(e) => { e.stopPropagation?.(); onRemove(); }} disabled={isLoading}>
                  <Feather name="minus" size={15} color={Colors.light.tint} />
                </Pressable>
                <Text style={styles.qtyText}>{quantity}</Text>
                <Pressable style={styles.qtyBtn} onPress={(e) => { e.stopPropagation?.(); onAdd(); }} disabled={isLoading}>
                  <Feather name="plus" size={15} color={Colors.light.tint} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.addBtn} onPress={(e) => { e.stopPropagation?.(); onAdd(); }} disabled={isLoading}>
                <Feather name="plus" size={17} color="#fff" />
                <Text style={styles.addBtnText}>Ajouter</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.readOnlyBanner}>
            <Feather name="eye" size={14} color={Colors.light.textSecondary} />
            <Text style={styles.readOnlyBannerText}>Consultatif livreur</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function MenuTile({
  dish,
  quantity,
  onAdd,
  onRemove,
  isLoading,
  orderingEnabled,
  onOpenDetail,
}: {
  dish: Dish;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  isLoading?: boolean;
  orderingEnabled: boolean;
  onOpenDetail: () => void;
}) {
  const imageUri = getDishPrimaryImage(dish);

  return (
    <Pressable style={styles.menuTile} onPress={onOpenDetail}>
      <View style={styles.menuTileVisual}>
        {imageUri ? (
          <CachedRemoteImage uri={imageUri} style={styles.menuTileImage} />
        ) : (
          <View style={styles.menuTileFallback}>
            <Feather name="image" size={18} color={Colors.light.textTertiary} />
          </View>
        )}
        <View style={styles.menuTileTopBadges}>
          {dish.isPopular ? (
            <View style={styles.menuTileBadge}>
              <Text style={styles.menuTileBadgeText}>⚡ Rapide</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.menuTileInfoIcon}>
          <Feather name="info" size={12} color="rgba(255,255,255,0.9)" />
        </View>
      </View>
      <View style={styles.menuTileBody}>
        <Text style={styles.menuTileName} numberOfLines={2}>{dish.name}</Text>
        <Text style={styles.menuTileCategory} numberOfLines={1}>{dish.category}</Text>
        <View style={styles.menuTileBottomRow}>
          <Text style={styles.menuTilePrice}>{formatPrice(getDishCurrentPrice(dish))}</Text>
          {orderingEnabled ? (
            quantity > 0 ? (
              <View style={styles.menuQtyControl}>
                <Pressable style={styles.qtyBtn} onPress={(e) => { e.stopPropagation?.(); onRemove(); }} disabled={isLoading}>
                  <Feather name="minus" size={13} color={Colors.light.tint} />
                </Pressable>
                <Text style={styles.qtyText}>{quantity}</Text>
                <Pressable style={styles.qtyBtn} onPress={(e) => { e.stopPropagation?.(); onAdd(); }} disabled={isLoading}>
                  <Feather name="plus" size={13} color={Colors.light.tint} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.menuTileBtn} onPress={(e) => { e.stopPropagation?.(); onAdd(); }} disabled={isLoading}>
                <Feather name="plus" size={13} color="#fff" />
              </Pressable>
            )
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Story tiles ──────────────────────────────────────────────────────────────
function StoryTile({ story, size = "half" }: { story: Story; size?: "half" | "full" }) {
  const isVideo = Boolean(story.videoUrl);
  return (
    <Pressable
      style={[styles.storyTile, size === "full" && styles.storyTileFull]}
      onPress={() => router.push({ pathname: "/story/[id]", params: { id: story.id } })}
    >
      {story.imageUrl ? (
        <CachedRemoteImage uri={story.imageUrl} style={StyleSheet.absoluteFillObject as any} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject as any, { backgroundColor: story.bgColor ?? story.chefCoverColor ?? "#1F2937" }]}>
          <Text style={styles.storyTileFallbackEmoji}>{story.emoji ?? "🍽️"}</Text>
        </View>
      )}
      {/* Gradient overlay */}
      <View style={styles.storyTileGradient} />
      <View style={styles.storyTileOverlay}>
        {isVideo ? (
          <View style={styles.storyTilePlayBtn}>
            <Feather name="play" size={14} color="#fff" />
          </View>
        ) : null}
        <View style={styles.storyTileBottom}>
          <Text style={styles.storyTileDate}>{formatStoryDate(story.createdAt)}</Text>
          <Text style={styles.storyTileCaption} numberOfLines={2}>{story.caption || "Story"}</Text>
          <View style={styles.storyTileStats}>
            <Feather name="heart" size={11} color="rgba(255,255,255,0.7)" />
            <Text style={styles.storyTileStatsTxt}>{story.likeCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function ChefDetailScreen() {
  const { id, dishId } = useLocalSearchParams<{ id: string; dishId?: string }>();
  const insets = useSafeAreaInsets();
  const { getChef, favorites, toggleFavorite, user, token } = useApp();
  const [activeTab, setActiveTab] = useState(0);
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [cart, setCart] = useState<Record<string, { itemId: number; quantity: number }>>({});
  const [changingDishId, setChangingDishId] = useState<string | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const openDishModal = useCallback((dish: Dish) => {
    setSelectedDish(dish);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const closeDishModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const chef = getChef(id ?? "");
  const isFav = favorites.includes(id ?? "");
  const isCourier = user?.type === "courier";
  const orderingEnabled = Boolean(user?.type === "client" || !user);
  const chefDishes = chef?.dishes ?? [];
  const chefStories = chef?.stories ?? [];

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

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

  // Deep-link: navigate to a specific dish if dishId param is provided
  useEffect(() => {
    if (!dishId || !chef) return;
    const target = chef.dishes?.find((d) => d.id === dishId);
    if (!target) return;
    setActiveTab(1); // open Menu tab
    setActiveCategory("Tous");
    // slight delay so tab switch renders first
    const t = setTimeout(() => openDishModal(target), 200);
    return () => clearTimeout(t);
  }, [dishId, chef, openDishModal]);

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
      Alert.alert("Erreur", error?.message ?? "Impossible de mettre a jour le panier");
    } finally {
      setChangingDishId(null);
    }
  }, [cart, loadCart, token]);

  const heroImage =
    chef?.heroImageUrl ??
    chefDishes.find((dish) => dish.imageUrls?.[0])?.imageUrls?.[0] ??
    chefDishes.find((dish) => dish.imageUrl)?.imageUrl ??
    chefStories.find((story) => story.imageUrl)?.imageUrl ??
    null;

  const initials = getInitials(chef?.name ?? "Cuisiniere");
  const stories = [...chefStories].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  const customPackages = chefDishes.filter((dish) => dish.category === "Evenements");
  const hasCustomService = customPackages.length > 0;
  const menuDishes = chefDishes.filter((dish) => dish.category !== "Evenements");
  const highlightedDishes = [...menuDishes]
    .sort((left, right) => {
      const leftScore = (left.isPopular ? 3 : 0) + (getDishDiscountPercent(left) > 0 ? 1 : 0);
      const rightScore = (right.isPopular ? 3 : 0) + (getDishDiscountPercent(right) > 0 ? 1 : 0);
      return rightScore - leftScore;
    })
    .slice(0, 4);

  const categoryOrder = useMemo(() => {
    const usedCategories = new Set(
      chefDishes.map((dish) => dish.category?.trim()).filter(Boolean) as string[],
    );
    const ordered = CHEF_MENU_CATEGORIES.filter((category) => usedCategories.has(category));
    const extras = [...usedCategories].filter(
      (category) => !CHEF_MENU_CATEGORIES.includes(category as (typeof CHEF_MENU_CATEGORIES)[number]),
    );
    return ["Tous", ...ordered, ...extras.sort((left, right) => left.localeCompare(right, "fr"))];
  }, [chefDishes]);

  useEffect(() => {
    if (!categoryOrder.includes(activeCategory)) {
      setActiveCategory("Tous");
    }
  }, [activeCategory, categoryOrder]);

  useEffect(() => {
    void prefetchRemoteImages([
      heroImage,
      chef?.avatarUrl,
      ...chefDishes.flatMap((dish) => [dish.imageUrls?.[0], dish.imageUrl]),
      ...chefStories.map((story) => story.imageUrl),
    ]);
  }, [chef?.avatarUrl, chefDishes, chefStories, heroImage]);

  const filteredMenuDishes = useMemo(() => {
    const source = activeCategory === "Tous" ? menuDishes : chefDishes.filter((dish) => dish.category === activeCategory);
    const visibleDishes = source.filter((dish) => activeCategory === "Evenements" || dish.category !== "Evenements");

    return [...visibleDishes].sort((left, right) => {
      const leftScore = (left.isPopular ? 2 : 0) + (getDishDiscountPercent(left) > 0 ? 1 : 0);
      const rightScore = (right.isPopular ? 2 : 0) + (getDishDiscountPercent(right) > 0 ? 1 : 0);
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return getDishCurrentPrice(left) - getDishCurrentPrice(right);
    });
  }, [activeCategory, chefDishes, menuDishes]);

  const topCategories = useMemo(() => getTopCategories(menuDishes), [menuDishes]);
  const discountedCount = chefDishes.filter((dish) => getDishDiscountPercent(dish) > 0).length;
  const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = chefDishes.reduce(
    (sum, dish) => sum + (cart[dish.id]?.quantity || 0) * dish.price,
    0,
  );

  if (!chef) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyScreenText}>Cuisiniere introuvable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: totalItems > 0 ? 120 : 96 }}
      >
        {/* ─── Compact Hero ─────────────────────────────────────────── */}
        <View style={[styles.hero, { paddingTop: topInset }]}>
          {heroImage ? (
            <CachedRemoteBackground uri={heroImage} style={StyleSheet.absoluteFillObject} imageStyle={styles.heroImageBgStyle}>
              <View style={styles.heroImageOverlay} />
            </CachedRemoteBackground>
          ) : (
            <Gradient colors={[chef.coverColor ?? "#7C3D1E", "#2B1C0E"]} style={StyleSheet.absoluteFillObject} />
          )}

          {/* Back / actions row */}
          <View style={styles.heroActions}>
            <Pressable style={styles.heroIconBtn} onPress={() => router.back()}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </Pressable>
            <View style={styles.heroActionRight}>
              <Pressable
                style={styles.heroIconBtn}
                onPress={() => { toggleFavorite(chef.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
              >
                <Ionicons name={isFav ? "heart" : "heart-outline"} size={20} color={isFav ? "#FF6B57" : "#fff"} />
              </Pressable>
              <Pressable
                style={styles.heroIconBtn}
                onPress={() => router.push({ pathname: "/chat/[chatId]", params: { chatId: `chat-${chef.id}`, chefId: chef.id, chefName: chef.name, chefSpecialty: chef.specialty, coverColor: chef.coverColor } })}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Avatar + info compact row */}
          <View style={styles.heroContent}>
            <View style={styles.avatarWrap}>
              {chef.avatarUrl ? (
                <CachedRemoteImage uri={chef.avatarUrl} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
              {chef.isOnline ? <View style={styles.avatarOnlineDot} /> : null}
            </View>
            <View style={styles.heroTextWrap}>
              <View style={styles.heroTitleRow}>
                <Text style={styles.heroName} numberOfLines={1}>{chef.name}</Text>
                {chef.isVerified ? <Ionicons name="checkmark-circle" size={16} color="#7FDBBF" /> : null}
                {chef.isOnline ? (
                  <View style={styles.heroPillOnline}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.heroPillOnlineText}>En ligne</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.heroSubtitle} numberOfLines={1}>{chef.specialty}</Text>
              <View style={styles.heroPillRow}>
                <View style={styles.heroPill}>
                  <Ionicons name="star" size={11} color="#F7C27B" />
                  <Text style={styles.heroPillText}>{chef.rating.toFixed(1)}</Text>
                </View>
                <View style={styles.heroPill}>
                  <Feather name="map-pin" size={11} color="rgba(255,255,255,0.72)" />
                  <Text style={styles.heroPillText} numberOfLines={1}>{chef.location}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Compact stats strip */}
          <View style={styles.heroStatsStrip}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{menuDishes.length}</Text>
              <Text style={styles.heroStatLabel}>Plats</Text>
            </View>
            <View style={styles.heroStatSep} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{chef.reviewCount}</Text>
              <Text style={styles.heroStatLabel}>Avis</Text>
            </View>
            <View style={styles.heroStatSep} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{stories.length}</Text>
              <Text style={styles.heroStatLabel}>Stories</Text>
            </View>
          </View>
        </View>

        {/* ─── Tabs ────────────────────────────────────────────────── */}
        <View style={styles.tabs}>
          {TABS.map((tab, index) => {
            const selected = index === activeTab;
            return (
              <Pressable
                key={tab}
                style={[styles.tab, selected && styles.tabActive]}
                onPress={() => setActiveTab(index)}
              >
                <Text style={[styles.tabText, selected && styles.tabTextActive]}>{tab}</Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 0 ? (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Plats rapides</Text>
              <Text style={styles.sectionTitle}>Les incontournables du moment</Text>
            </View>

            {highlightedDishes.length > 0 ? (
              highlightedDishes.map((dish) => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  quantity={isCourier ? 0 : (cart[dish.id]?.quantity || 0)}
                  onAdd={() => addToCart(dish.id)}
                  onRemove={() => removeFromCart(dish.id)}
                  isLoading={changingDishId === dish.id}
                  orderingEnabled={orderingEnabled && !isCourier}
                  onOpenDetail={() => openDishModal(dish)}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Feather name="coffee" size={42} color={Colors.light.textTertiary} />
                <Text style={styles.emptyStateTitle}>Aucun plat visible</Text>
                <Text style={styles.emptyStateText}>Cette cuisinière n'a pas encore publié de carte.</Text>
              </View>
            )}

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Catégories disponibles</Text>
              <View style={styles.categoryPreviewList}>
                {topCategories.length > 0 ? (
                  topCategories.map(([category, count]) => (
                    <Pressable key={category} style={styles.categoryPreviewItem} onPress={() => { setActiveTab(1); setActiveCategory(category); }}>
                      <Text style={styles.categoryPreviewName}>{category}</Text>
                      <View style={styles.categoryPreviewRight}>
                        <Text style={styles.categoryPreviewCount}>{count} plat{count > 1 ? "s" : ""}</Text>
                        <Feather name="chevron-right" size={14} color={Colors.light.textTertiary} />
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.categoryPreviewEmpty}>Les catégories du menu apparaîtront ici.</Text>
                )}
              </View>
            </View>

            {hasCustomService ? (
              <View style={styles.serviceCardCompact}>
                <View style={styles.serviceCardCompactCopy}>
                  <Text style={styles.serviceCardCompactEyebrow}>Sur-mesure</Text>
                  <Text style={styles.serviceCardCompactTitle}>{customPackages.length} formule(s) événement publiées</Text>
                  <Text style={styles.serviceCardCompactMeta}>
                    À partir de {formatPrice(Math.min(...customPackages.map((dish) => getDishCurrentPrice(dish))))} / pers.
                  </Text>
                </View>
                {!isCourier ? (
                  <Pressable
                    style={styles.serviceBtn}
                    onPress={() => router.push({ pathname: "/order/[chefId]", params: { chefId: chef.id } })}
                  >
                    <Text style={styles.serviceBtnText}>Demander un devis</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {activeTab === 1 ? (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Menu</Text>
              <Text style={styles.sectionTitle}>Carte simple à parcourir</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {categoryOrder.map((category) => {
                const selected = category === activeCategory;
                return (
                  <Pressable
                    key={category}
                    style={[styles.filterChip, selected && styles.filterChipActive]}
                    onPress={() => setActiveCategory(category)}
                  >
                    <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{category}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.menuInsightCard}>
              <Text style={styles.menuInsightTitle}>{activeCategory === "Tous" ? "Toute la carte" : activeCategory}</Text>
              <Text style={styles.menuInsightBody}>
                {filteredMenuDishes.length} choix · {discountedCount > 0 ? `${discountedCount} promo(s)` : "aucune promo"}
              </Text>
            </View>

            {filteredMenuDishes.length > 0 ? (
              <View style={styles.menuGrid}>
                {filteredMenuDishes.map((dish) => (
                  <MenuTile
                  key={dish.id}
                  dish={dish}
                  quantity={isCourier ? 0 : (cart[dish.id]?.quantity || 0)}
                  onAdd={() => addToCart(dish.id)}
                  onRemove={() => removeFromCart(dish.id)}
                  isLoading={changingDishId === dish.id}
                  orderingEnabled={orderingEnabled && !isCourier}
                  onOpenDetail={() => openDishModal(dish)}
                />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Feather name="layers" size={42} color={Colors.light.textTertiary} />
                <Text style={styles.emptyStateTitle}>Categorie vide</Text>
                <Text style={styles.emptyStateText}>Aucun plat n'est disponible dans ce filtre pour le moment.</Text>
              </View>
            )}
          </View>
        ) : null}

        {activeTab === 2 ? (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>Stories</Text>
              <Text style={styles.sectionTitle}>Coulisses de la cheffe</Text>
            </View>

            {stories.length > 0 ? (
              <>
                {/* Featured first story */}
                <StoryTile story={stories[0]} size="full" />
                {/* Grid for the rest */}
                {stories.length > 1 ? (
                  <View style={styles.storyGrid}>
                    {stories.slice(1).map((story) => (
                      <StoryTile key={story.id} story={story} size="half" />
                    ))}
                  </View>
                ) : null}
                <Pressable style={styles.storiesAllBtn} onPress={() => router.push("/stories")}>
                  <Feather name="play-circle" size={16} color={Colors.light.tint} />
                  <Text style={styles.storiesAllBtnText}>Voir toutes les stories</Text>
                  <Feather name="chevron-right" size={16} color={Colors.light.tint} />
                </Pressable>
              </>
            ) : (
              <View style={styles.emptyState}>
                <Feather name="camera" size={42} color={Colors.light.textTertiary} />
                <Text style={styles.emptyStateTitle}>Aucune story pour le moment</Text>
                <Text style={styles.emptyStateText}>La section s'activera automatiquement dès qu'une publication sera disponible.</Text>
              </View>
            )}
          </View>
        ) : null}

        {activeTab === 3 ? (
          <View style={styles.sectionWrap}>
            {/* Chef hero card — identity + trust */}
            <View style={styles.aboutHeroCard}>
              <View style={[styles.aboutHeroBanner, { backgroundColor: chef.coverColor ?? "#7C3D1E" }]}>
                {heroImage ? <CachedRemoteImage uri={heroImage} style={StyleSheet.absoluteFillObject as any} /> : null}
                <View style={styles.aboutHeroOverlay} />
              </View>
              <View style={styles.aboutHeroBody}>
                <View style={styles.aboutHeroAvatarWrap}>
                  {chef.avatarUrl ? (
                    <CachedRemoteImage uri={chef.avatarUrl} style={styles.aboutHeroAvatarImg} />
                  ) : (
                    <Text style={styles.aboutHeroInitials}>{initials}</Text>
                  )}
                </View>
                <View style={styles.aboutHeroMeta}>
                  <View style={styles.aboutHeroNameRow}>
                    <Text style={styles.aboutHeroName}>{chef.name}</Text>
                    {chef.isVerified ? <Ionicons name="checkmark-circle" size={18} color={Colors.light.tint} /> : null}
                  </View>
                  <Text style={styles.aboutHeroSpecialty}>{chef.specialty}</Text>
                  <View style={styles.aboutHeroTrustRow}>
                    {chef.isVerified ? (
                      <View style={styles.trustBadge}>
                        <Ionicons name="shield-checkmark" size={12} color="#047857" />
                        <Text style={[styles.trustBadgeText, { color: "#047857" }]}>Vérifiée</Text>
                      </View>
                    ) : null}
                    {chef.isOnline ? (
                      <View style={[styles.trustBadge, styles.trustBadgeOnline]}>
                        <View style={styles.onlineDot} />
                        <Text style={[styles.trustBadgeText, { color: "#059669" }]}>En ligne</Text>
                      </View>
                    ) : null}
                    <View style={styles.trustBadge}>
                      <Ionicons name="star" size={12} color="#D97706" />
                      <Text style={[styles.trustBadgeText, { color: "#92400E" }]}>{chef.rating.toFixed(1)} / 5</Text>
                    </View>
                    <View style={styles.trustBadge}>
                      <Feather name="clock" size={12} color={Colors.light.textSecondary} />
                      <Text style={styles.trustBadgeText}>{chef.responseTime}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Bio */}
            <View style={styles.aboutCard}>
              <View style={styles.aboutCardHeader}>
                <View style={[styles.aboutCardIconWrap, { backgroundColor: "#FFF4E8" }]}>
                  <Feather name="user" size={16} color={Colors.light.tint} />
                </View>
                <Text style={styles.aboutTitle}>À propos</Text>
              </View>
              <Text style={styles.aboutBody}>{chef.bio || "Cette cheffe n'a pas encore rédigé sa présentation."}</Text>
            </View>

            {/* Spécialités */}
            <View style={styles.aboutCard}>
              <View style={styles.aboutCardHeader}>
                <View style={[styles.aboutCardIconWrap, { backgroundColor: "#F0FDF4" }]}>
                  <Feather name="award" size={16} color="#059669" />
                </View>
                <Text style={styles.aboutTitle}>Spécialités</Text>
              </View>
              <View style={styles.specialtyRow}>
                {(chef.specialties?.length ? chef.specialties : [chef.specialty]).map((item) => (
                  <View key={item} style={styles.specialtyChip}>
                    <Text style={styles.specialtyChipText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Stats grid 2×2 */}
            <View style={styles.aboutStatsGrid}>
              <View style={styles.aboutStatItem}>
                <Text style={styles.aboutStatValue}>{menuDishes.length}</Text>
                <Text style={styles.aboutStatLabel}>Plats au menu</Text>
              </View>
              <View style={styles.aboutStatItem}>
                <Text style={styles.aboutStatValue}>{stories.length}</Text>
                <Text style={styles.aboutStatLabel}>Stories publiées</Text>
              </View>
              <View style={styles.aboutStatItem}>
                <Text style={styles.aboutStatValue}>{chef.reviewCount}</Text>
                <Text style={styles.aboutStatLabel}>Avis clients</Text>
              </View>
              <View style={styles.aboutStatItem}>
                <Text style={styles.aboutStatValue}>{hasCustomService ? customPackages.length : "—"}</Text>
                <Text style={styles.aboutStatLabel}>Formules événement</Text>
              </View>
            </View>

            {/* Zone & prix */}
            <View style={styles.aboutCard}>
              <View style={styles.aboutCardHeader}>
                <View style={[styles.aboutCardIconWrap, { backgroundColor: "#EFF6FF" }]}>
                  <Feather name="map-pin" size={16} color="#3B82F6" />
                </View>
                <Text style={styles.aboutTitle}>Zone & gamme de prix</Text>
              </View>
              <View style={styles.aboutInfoGrid}>
                <View style={styles.aboutInfoItem}>
                  <Text style={styles.aboutInfoLabel}>Zone de livraison</Text>
                  <Text style={styles.aboutInfoValue}>{chef.location}</Text>
                </View>
                <View style={styles.aboutInfoItem}>
                  <Text style={styles.aboutInfoLabel}>Gamme de prix</Text>
                  <Text style={styles.aboutInfoValue}>{chef.priceRange}</Text>
                </View>
              </View>
            </View>

            {/* Top catégories */}
            {topCategories.length > 0 ? (
              <View style={styles.aboutCard}>
                <View style={styles.aboutCardHeader}>
                  <View style={[styles.aboutCardIconWrap, { backgroundColor: "#FDF4FF" }]}>
                    <Feather name="grid" size={16} color="#9333EA" />
                  </View>
                  <Text style={styles.aboutTitle}>Catégories fortes</Text>
                </View>
                {topCategories.map(([category, count]) => (
                  <View key={category} style={styles.aboutInfoItem}>
                    <Text style={styles.aboutInfoLabel}>{category}</Text>
                    <Text style={styles.aboutInfoValue}>{count} plat{count > 1 ? "s" : ""}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* CTA contact */}
            {!isCourier ? (
              <Pressable
                style={styles.aboutContactBtn}
                onPress={() => router.push({ pathname: "/chat/[chatId]", params: { chatId: `chat-${chef.id}`, chefId: chef.id, chefName: chef.name, chefSpecialty: chef.specialty, coverColor: chef.coverColor } })}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
                <Text style={styles.aboutContactBtnText}>Envoyer un message à {chef.name.split(" ")[0]}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {totalItems > 0 ? (
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
              <Text style={styles.cartPrice}>{formatPrice(totalPrice)}</Text>
            </Gradient>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.stickyActions, { paddingBottom: bottomInset + 8 }]}> 
          <Pressable
            style={styles.messageBtn}
            onPress={() =>
              router.push({
                pathname: "/chat/[chatId]",
                params: {
                  chatId: `chat-${chef.id}`,
                  chefId: chef.id,
                  chefName: chef.name,
                  chefSpecialty: chef.specialty,
                  coverColor: chef.coverColor,
                },
              })
            }
          >
            <Ionicons name="chatbubble-outline" size={18} color={Colors.light.tint} />
            <Text style={styles.messageBtnText}>Message</Text>
          </Pressable>

          {!isCourier && hasCustomService ? (
            <Pressable
              style={styles.orderBtn}
              onPress={() => router.push({ pathname: "/order/[chefId]", params: { chefId: chef.id } })}
            >
              <Text style={styles.orderBtnText}>Demande sur-mesure</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {/* ─── Dish Detail Modal ──────────────────── */}
      <DishDetailModal
        dish={selectedDish}
        visible={modalVisible}
        onClose={closeDishModal}
        quantity={selectedDish ? (isCourier ? 0 : (cart[selectedDish.id]?.quantity || 0)) : 0}
        onAdd={() => selectedDish && addToCart(selectedDish.id)}
        onRemove={() => selectedDish && removeFromCart(selectedDish.id)}
        isLoading={selectedDish ? changingDishId === selectedDish.id : false}
        orderingEnabled={orderingEnabled && !isCourier}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Container & Screen ──────────────────────────────────────────────────
  container: { flex: 1, backgroundColor: Colors.light.background },
  emptyScreen: { flex: 1, backgroundColor: Colors.light.background, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  emptyScreenText: { fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center" },

  // ── Compact Hero ────────────────────────────────────────────────────────
  hero: { paddingHorizontal: 20, paddingBottom: 20, overflow: "hidden", minHeight: 200 },
  heroImageBgStyle: { opacity: 0.9 },
  heroImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,12,5,0.58)" },
  heroActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  heroActionRight: { flexDirection: "row", gap: 8 },
  heroIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  heroContent: { flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 16 },
  avatarWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 2.5, borderColor: "rgba(255,255,255,0.42)", alignItems: "center", justifyContent: "center", overflow: "visible" },
  avatarImage: { width: 76, height: 76, borderRadius: 38 },
  avatarInitials: { fontSize: 26, fontFamily: "Poppins_700Bold", color: "#fff" },
  avatarOnlineDot: { position: "absolute", bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: "#2ECC71", borderWidth: 2, borderColor: "#fff" },
  heroTextWrap: { flex: 1, gap: 4 },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  heroName: { fontSize: 20, fontFamily: "Poppins_700Bold", color: "#fff", flexShrink: 1 },
  heroSubtitle: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.82)" },
  heroPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  heroPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "rgba(255,255,255,0.15)" },
  heroPillOnline: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "rgba(39,174,96,0.3)" },
  heroPillOnlineText: { fontSize: 10, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  heroPillText: { fontSize: 11, fontFamily: "Poppins_500Medium", color: "rgba(255,255,255,0.92)" },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2ECC71" },
  heroStatsStrip: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8 },
  heroStatItem: { flex: 1, alignItems: "center", gap: 2 },
  heroStatValue: { fontSize: 18, fontFamily: "Poppins_700Bold", color: "#fff" },
  heroStatLabel: { fontSize: 10, fontFamily: "Poppins_500Medium", color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: 0.6 },
  heroStatSep: { width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 4 },

  // ── Tabs ────────────────────────────────────────────────────────────────
  tabs: { flexDirection: "row", paddingHorizontal: 20, marginTop: 4, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  tab: { paddingVertical: 14, paddingHorizontal: 4, marginRight: 22, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: Colors.light.tint },
  tabText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  tabTextActive: { color: Colors.light.tint, fontFamily: "Poppins_600SemiBold" },

  // ── Section wrappers ────────────────────────────────────────────────────
  sectionWrap: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  sectionHeader: { gap: 4 },
  sectionEyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint, textTransform: "uppercase", letterSpacing: 1 },
  sectionTitle: { fontSize: 20, lineHeight: 27, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  sectionBody: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },

  // ── Dish cards ───────────────────────────────────────────────────────────
  dishCard: { borderRadius: 24, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, overflow: "hidden", shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 1 },
  dishVisualWrap: { position: "relative" },
  dishImage: { width: "100%", height: 178, backgroundColor: Colors.light.backgroundSecondary },
  dishImageFallback: { width: "100%", height: 178, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  dishBadgeRow: { position: "absolute", left: 12, right: 12, top: 12, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  categoryBadge: { backgroundColor: "rgba(255,244,233,0.96)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  categoryBadgeText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  quickBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  quickBadgeText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  dishDetailHint: { position: "absolute", bottom: 12, right: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  dishBody: { padding: 16, gap: 12 },
  dishHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dishHeaderMeta: { flex: 1, gap: 5 },
  dishName: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  dishDescription: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  priceWrap: { alignItems: "flex-end", gap: 3 },
  priceCurrent: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  pricePrevious: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary, textDecorationLine: "line-through" },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: Colors.light.backgroundSecondary },
  metaPillText: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  discountBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#ECFDF5" },
  discountBadgeText: { fontSize: 11, fontFamily: "Poppins_700Bold", color: "#047857" },
  dishActionRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 13, backgroundColor: Colors.light.tint, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  qtyControl: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.light.backgroundSecondary, borderRadius: 18, paddingHorizontal: 8, paddingVertical: 5 },
  qtyBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  qtyText: { minWidth: 20, textAlign: "center", fontSize: 14, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  readOnlyBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, backgroundColor: Colors.light.backgroundSecondary, paddingHorizontal: 12, paddingVertical: 10 },
  readOnlyBannerText: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },

  // ── Panel card (quick-dish tab) ─────────────────────────────────────────
  panelCard: { borderRadius: 20, backgroundColor: "#F7F1EA", borderWidth: 1, borderColor: "rgba(156,109,82,0.12)", padding: 16, gap: 12 },
  panelTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  categoryPreviewList: { gap: 8 },
  categoryPreviewItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, backgroundColor: "rgba(255,255,255,0.76)", paddingHorizontal: 14, paddingVertical: 11 },
  categoryPreviewName: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  categoryPreviewRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  categoryPreviewCount: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  categoryPreviewEmpty: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  serviceCardCompact: { borderRadius: 22, backgroundColor: "#2A2017", padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  serviceCardCompactCopy: { flex: 1, gap: 4 },
  serviceCardCompactEyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: 0.8 },
  serviceCardCompactTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: "#fff" },
  serviceCardCompactMeta: { fontSize: 12, fontFamily: "Poppins_500Medium", color: "rgba(255,255,255,0.78)" },
  serviceBtn: { alignSelf: "flex-start", borderRadius: 13, backgroundColor: Colors.light.tint, paddingHorizontal: 14, paddingVertical: 10 },
  serviceBtnText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#fff" },

  // ── Menu tab ────────────────────────────────────────────────────────────
  filterRow: { gap: 10, paddingRight: 12 },
  filterChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.light.cardBorder, backgroundColor: Colors.light.card },
  filterChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  filterChipText: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  filterChipTextActive: { color: "#fff" },
  menuInsightCard: { borderRadius: 18, backgroundColor: Colors.light.backgroundSecondary, padding: 14, gap: 3 },
  menuInsightTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  menuInsightBody: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  menuTile: { width: "48%", borderRadius: 20, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, overflow: "hidden", shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1 },
  menuTileVisual: { position: "relative" },
  menuTileImage: { width: "100%", height: 118, backgroundColor: Colors.light.backgroundSecondary },
  menuTileFallback: { width: "100%", height: 118, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  menuTileTopBadges: { position: "absolute", top: 8, left: 8, flexDirection: "row", gap: 4 },
  menuTileBadge: { borderRadius: 999, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 7, paddingVertical: 4 },
  menuTileBadgeText: { fontSize: 9, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  menuTileInfoIcon: { position: "absolute", bottom: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.38)", alignItems: "center", justifyContent: "center" },
  menuTileBody: { padding: 10, gap: 3 },
  menuTileName: { fontSize: 13, fontFamily: "Poppins_700Bold", color: Colors.light.text, minHeight: 34 },
  menuTileCategory: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  menuTileBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  menuTilePrice: { fontSize: 14, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  menuTileBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.light.tint, alignItems: "center", justifyContent: "center" },
  menuQtyControl: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.light.backgroundSecondary, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 3 },

  // ── Stories tab ─────────────────────────────────────────────────────────
  storyGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  storyTile: { width: "48%", height: 220, borderRadius: 22, overflow: "hidden", backgroundColor: "#1F2937" },
  storyTileFull: { width: "100%", height: 280 },
  storyTileGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent", // rendered as linear gradient via overlay
    // actual gradient effect via the bottom overlay below
  },
  storyTileFallbackEmoji: { fontSize: 48, textAlign: "center", marginTop: 60 },
  storyTileOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between", padding: 14, backgroundColor: "transparent" },
  storyTilePlayBtn: { alignSelf: "center", marginTop: "auto", width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.24)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center" },
  storyTileBottom: { gap: 4 },
  storyTileDate: { fontSize: 10, fontFamily: "Poppins_600SemiBold", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 0.8 },
  storyTileCaption: { fontSize: 13, lineHeight: 18, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  storyTileStats: { flexDirection: "row", alignItems: "center", gap: 4 },
  storyTileStatsTxt: { fontSize: 11, fontFamily: "Poppins_500Medium", color: "rgba(255,255,255,0.72)" },
  storiesAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.cardBorder },
  storiesAllBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },

  // ── À propos tab ────────────────────────────────────────────────────────
  aboutHeroCard: { borderRadius: 24, overflow: "hidden", backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 14, elevation: 2 },
  aboutHeroBanner: { height: 88, position: "relative" },
  aboutHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  aboutHeroBody: { flexDirection: "row", padding: 16, paddingTop: 8, gap: 14, alignItems: "flex-end" },
  aboutHeroAvatarWrap: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: "#fff", overflow: "hidden", backgroundColor: Colors.light.backgroundSecondary, marginTop: -36 },
  aboutHeroAvatarImg: { width: 72, height: 72, borderRadius: 36 },
  aboutHeroInitials: { fontSize: 24, fontFamily: "Poppins_700Bold", color: Colors.light.text, textAlign: "center", lineHeight: 72 },
  aboutHeroMeta: { flex: 1, gap: 5, paddingBottom: 4 },
  aboutHeroNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  aboutHeroName: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text, flexShrink: 1 },
  aboutHeroSpecialty: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  aboutHeroTrustRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  trustBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: Colors.light.backgroundSecondary },
  trustBadgeOnline: { backgroundColor: "#ECFDF5" },
  trustBadgeText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.textSecondary },
  aboutCard: { borderRadius: 22, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 16, gap: 12 },
  aboutCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  aboutCardIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  aboutTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  aboutBody: { fontSize: 13, lineHeight: 21, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  aboutStatsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  aboutStatItem: { width: "48%", borderRadius: 18, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 14, gap: 4, alignItems: "center" },
  aboutStatValue: { fontSize: 24, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  aboutStatLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center" },
  aboutInfoGrid: { gap: 8 },
  aboutInfoItem: { borderRadius: 14, backgroundColor: Colors.light.backgroundSecondary, padding: 12, gap: 3 },
  aboutInfoLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.textTertiary, textTransform: "uppercase", letterSpacing: 0.6 },
  aboutInfoValue: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  specialtyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  specialtyChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.light.backgroundSecondary },
  specialtyChipText: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  aboutContactBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, backgroundColor: Colors.light.tint, paddingVertical: 15, marginBottom: 10 },
  aboutContactBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },

  // ── Empty state ──────────────────────────────────────────────────────────
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 52, gap: 10 },
  emptyStateTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  emptyStateText: { fontSize: 13, lineHeight: 19, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center" },

  // ── Cart bar & sticky actions ─────────────────────────────────────────────
  cartBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.light.background },
  cartBarInner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14 },
  cartBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.28)" },
  cartBadgeText: { fontSize: 12, fontFamily: "Poppins_700Bold", color: "#fff" },
  cartText: { flex: 1, fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  cartPrice: { fontSize: 15, fontFamily: "Poppins_700Bold", color: "#fff" },
  stickyActions: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.light.background, borderTopWidth: 1, borderTopColor: Colors.light.divider },
  messageBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.light.tint, paddingHorizontal: 18, paddingVertical: 12 },
  messageBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  orderBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: Colors.light.tint, paddingVertical: 12 },
  orderBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },

  // ── Dish Detail Modal ────────────────────────────────────────────────────
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.52)" },
  dishModalSheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: Colors.light.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: "88%", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.light.divider, alignSelf: "center", marginTop: 12, marginBottom: 6 },
  dishModalImageWrap: { position: "relative" },
  dishModalImage: { width: "100%", height: 220, backgroundColor: Colors.light.backgroundSecondary },
  dishModalImagePlaceholder: { width: "100%", height: 180, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  dishModalDiscountBadge: { position: "absolute", top: 14, left: 14, borderRadius: 999, backgroundColor: "#047857", paddingHorizontal: 10, paddingVertical: 6 },
  dishModalDiscountText: { fontSize: 12, fontFamily: "Poppins_700Bold", color: "#fff" },
  dishModalPopularBadge: { position: "absolute", top: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: Colors.light.tint, paddingHorizontal: 10, paddingVertical: 6 },
  dishModalPopularText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  dishModalScroll: { flex: 1 },
  dishModalHeader: { padding: 20, gap: 8 },
  dishModalCategoryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dishModalCategoryBadge: { borderRadius: 999, backgroundColor: Colors.light.backgroundSecondary, paddingHorizontal: 10, paddingVertical: 6 },
  dishModalCategoryText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  dishModalTimeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dishModalTimeTxt: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  dishModalName: { fontSize: 22, fontFamily: "Poppins_700Bold", color: Colors.light.text, lineHeight: 28 },
  dishModalPriceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dishModalPrice: { fontSize: 20, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  dishModalPriceOld: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary, textDecorationLine: "line-through" },
  dishModalSection: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  dishModalSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  dishModalSectionDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.light.tint },
  dishModalSectionTitle: { fontSize: 13, fontFamily: "Poppins_700Bold", color: Colors.light.text, textTransform: "uppercase", letterSpacing: 0.8 },
  dishModalDesc: { fontSize: 14, lineHeight: 22, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  compositionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  compositionTag: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.light.backgroundSecondary },
  compositionTagText: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  dishModalImagesRow: { gap: 10, paddingRight: 20 },
  dishModalThumb: { width: 96, height: 96, borderRadius: 16, backgroundColor: Colors.light.backgroundSecondary },
  dishModalCTA: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.light.divider, backgroundColor: Colors.light.background },
  dishModalQtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, borderRadius: 18, backgroundColor: Colors.light.backgroundSecondary, paddingVertical: 12 },
  dishModalQtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.light.background, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: Colors.light.tint },
  dishModalQtyText: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text, minWidth: 28, textAlign: "center" },
  dishModalAddBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 18, backgroundColor: Colors.light.tint, paddingVertical: 16 },
  dishModalAddBtnText: { fontSize: 15, fontFamily: "Poppins_700Bold", color: "#fff" },
  dishModalReadOnly: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  dishModalReadOnlyText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },

  // ── Summaries / panels (unused but kept for compat) ──────────────────────
  summaryStrip: { marginTop: -18, paddingHorizontal: 20, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "47%", minWidth: 148, borderRadius: 20, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 14, gap: 6, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  summaryValue: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  summaryLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
});
