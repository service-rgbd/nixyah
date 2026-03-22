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
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { Dish, Story, useApp } from "@/contexts/AppContext";

const TABS = ["Plats rapides", "Menu", "Stories", "A propos"] as const;

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
  if (Number.isNaN(date.getTime())) {
    return "Publication recente";
  }

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
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

function DishCard({
  dish,
  quantity,
  onAdd,
  onRemove,
  isLoading,
  orderingEnabled,
}: {
  dish: Dish;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  isLoading?: boolean;
  orderingEnabled: boolean;
}) {
  const imageUri = getDishPrimaryImage(dish);
  const currentPrice = getDishCurrentPrice(dish);
  const basePrice = getDishBasePrice(dish);
  const discountPercent = getDishDiscountPercent(dish);

  return (
    <View style={styles.dishCard}>
      <View style={styles.dishVisualWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.dishImage} />
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
      </View>

      <View style={styles.dishBody}>
        <View style={styles.dishHeaderRow}>
          <View style={styles.dishHeaderMeta}>
            <Text style={styles.dishName}>{dish.name}</Text>
            <Text style={styles.dishDescription} numberOfLines={3}>
              {dish.description || "Description a completer"}
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
            <Text style={styles.dishActionHint}>Ajout direct au panier client</Text>
            {quantity > 0 ? (
              <View style={styles.qtyControl}>
                <Pressable style={styles.qtyBtn} onPress={onRemove} disabled={isLoading}>
                  <Feather name="minus" size={15} color={Colors.light.tint} />
                </Pressable>
                <Text style={styles.qtyText}>{quantity}</Text>
                <Pressable style={styles.qtyBtn} onPress={onAdd} disabled={isLoading}>
                  <Feather name="plus" size={15} color={Colors.light.tint} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.addBtn} onPress={onAdd} disabled={isLoading}>
                <Feather name="plus" size={17} color="#fff" />
                <Text style={styles.addBtnText}>Ajouter</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.readOnlyBanner}>
            <Feather name="eye" size={14} color={Colors.light.textSecondary} />
            <Text style={styles.readOnlyBannerText}>Profil consultatif pour livreur</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function StoryCard({ story, prominent = false }: { story: Story; prominent?: boolean }) {
  return (
    <Pressable
      style={[styles.storyCard, prominent && styles.storyCardProminent]}
      onPress={() => router.push("/stories")}
    >
      {story.imageUrl ? (
        <Image source={{ uri: story.imageUrl }} style={[styles.storyImage, prominent && styles.storyImageProminent]} />
      ) : story.videoUrl ? (
        <View style={[styles.storyVideoFallback, prominent && styles.storyImageProminent]}>
          <Feather name="play-circle" size={32} color="#fff" />
          <Text style={styles.storyVideoText}>
            {story.videoDurationSeconds ? `${Math.round(story.videoDurationSeconds)} sec` : "Video"}
          </Text>
        </View>
      ) : null}

      <View style={styles.storyContent}>
        <View style={styles.storyMetaTop}>
          <Text style={styles.storyDate}>{formatStoryDate(story.createdAt)}</Text>
          <View style={styles.storyCountsRow}>
            <View style={styles.storyCountPill}>
              <Feather name="heart" size={12} color={Colors.light.textSecondary} />
              <Text style={styles.storyCountText}>{story.likeCount}</Text>
            </View>
            <View style={styles.storyCountPill}>
              <Feather name="message-circle" size={12} color={Colors.light.textSecondary} />
              <Text style={styles.storyCountText}>{story.commentCount}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.storyCaption} numberOfLines={prominent ? 4 : 3}>
          {story.caption || "Story de la cheffe"}
        </Text>

        {(story.dishName || story.price) ? (
          <View style={styles.storyDishCard}>
            <Text style={styles.storyDishName}>{story.dishName || "Plat mis en avant"}</Text>
            {typeof story.price === "number" ? (
              <Text style={styles.storyDishPrice}>{formatPrice(story.price)}</Text>
            ) : null}
          </View>
        ) : null}
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
}: {
  dish: Dish;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  isLoading?: boolean;
  orderingEnabled: boolean;
}) {
  const imageUri = getDishPrimaryImage(dish);

  return (
    <View style={styles.menuTile}>
      <View style={styles.menuTileVisual}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.menuTileImage} />
        ) : (
          <View style={styles.menuTileFallback}>
            <Feather name="image" size={18} color={Colors.light.textTertiary} />
          </View>
        )}
        {dish.isPopular ? (
          <View style={styles.menuTileBadge}>
            <Text style={styles.menuTileBadgeText}>Rapide</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.menuTileBody}>
        <Text style={styles.menuTileName} numberOfLines={2}>{dish.name}</Text>
        <Text style={styles.menuTileMeta}>{dish.prepTime}</Text>
        <Text style={styles.menuTilePrice}>{formatPrice(getDishCurrentPrice(dish))}</Text>
        {orderingEnabled ? (
          quantity > 0 ? (
            <View style={styles.menuQtyControl}>
              <Pressable style={styles.qtyBtn} onPress={onRemove} disabled={isLoading}>
                <Feather name="minus" size={15} color={Colors.light.tint} />
              </Pressable>
              <Text style={styles.qtyText}>{quantity}</Text>
              <Pressable style={styles.qtyBtn} onPress={onAdd} disabled={isLoading}>
                <Feather name="plus" size={15} color={Colors.light.tint} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.menuTileBtn} onPress={onAdd} disabled={isLoading}>
              <Text style={styles.menuTileBtnText}>Ajouter</Text>
            </Pressable>
          )
        ) : null}
      </View>
    </View>
  );
}

function StoryTile({ story }: { story: Story }) {
  return (
    <Pressable style={styles.storyTile} onPress={() => router.push("/(tabs)/stories")}>
      {story.imageUrl ? (
        <Image source={{ uri: story.imageUrl }} style={styles.storyTileImage} />
      ) : (
        <View style={styles.storyTileFallback}>
          <Feather name={story.videoUrl ? "play-circle" : "camera"} size={28} color="#fff" />
        </View>
      )}
      <View style={styles.storyTileOverlay}>
        <View style={styles.storyTileTopRow}>
          <Text style={styles.storyTileDate}>{formatStoryDate(story.createdAt)}</Text>
          {story.videoUrl ? (
            <View style={styles.storyTileVideoPill}>
              <Feather name="play" size={10} color="#fff" />
              <Text style={styles.storyTileVideoText}>
                {story.videoDurationSeconds ? `${Math.round(story.videoDurationSeconds)}s` : "Video"}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.storyTileCaption} numberOfLines={3}>{story.caption || "Story de la cheffe"}</Text>
      </View>
    </Pressable>
  );
}

export default function ChefDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getChef, favorites, toggleFavorite, user, token } = useApp();
  const [activeTab, setActiveTab] = useState(0);
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [cart, setCart] = useState<Record<string, { itemId: number; quantity: number }>>({});
  const [changingDishId, setChangingDishId] = useState<string | null>(null);

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

  const summaryCards = [
    { label: "plats actifs", value: String(menuDishes.length), icon: "grid" as const },
    { label: "categories", value: String(Math.max(0, categoryOrder.length - 1)), icon: "layers" as const },
    { label: "promos", value: String(discountedCount), icon: "tag" as const },
    { label: hasCustomService ? "formules" : "stories", value: String(hasCustomService ? customPackages.length : stories.length), icon: hasCustomService ? "briefcase" as const : "camera" as const },
  ];

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
        <Gradient
          colors={[chef.coverColor, "#2B1C0E"]}
          style={[styles.hero, { paddingTop: topInset }]}
        >
          {heroImage ? (
            <ImageBackground source={{ uri: heroImage }} style={styles.heroImageBg} imageStyle={styles.heroImageBgStyle}>
              <View style={styles.heroImageOverlay} />
            </ImageBackground>
          ) : null}

          <View style={styles.heroActions}>
            <Pressable style={styles.heroIconBtn} onPress={() => router.back()}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </Pressable>

            <View style={styles.heroActionRight}>
              <Pressable
                style={styles.heroIconBtn}
                onPress={() => {
                  toggleFavorite(chef.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
              >
                <Ionicons name={isFav ? "heart" : "heart-outline"} size={20} color={isFav ? "#FF6B57" : "#fff"} />
              </Pressable>
              <Pressable
                style={styles.heroIconBtn}
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
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroContent}>
            <View style={styles.avatarWrap}>
              {chef.avatarUrl ? (
                <Image source={{ uri: chef.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>

            <View style={styles.heroTextWrap}>
              <View style={styles.heroTitleRow}>
                <Text style={styles.heroName}>{chef.name}</Text>
                {chef.isVerified ? <Ionicons name="checkmark-circle" size={18} color="#fff" /> : null}
              </View>
              <Text style={styles.heroSubtitle}>{chef.specialty}</Text>

              <View style={styles.heroPillRow}>
                <View style={styles.heroPill}>
                  <Ionicons name="star" size={12} color="#F7C27B" />
                  <Text style={styles.heroPillText}>{chef.rating.toFixed(1)} · {chef.reviewCount} avis</Text>
                </View>
                <View style={styles.heroPill}>
                  <Feather name="map-pin" size={12} color="rgba(255,255,255,0.82)" />
                  <Text style={styles.heroPillText}>{chef.location}</Text>
                </View>
                {chef.isOnline ? (
                  <View style={[styles.heroPill, styles.heroPillOnline]}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.heroPillText}>En ligne</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.heroSpotlightCard}>
            <View style={styles.heroSpotlightCopy}>
              <Text style={styles.heroSpotlightEyebrow}>Vitrine menu</Text>
              <Text style={styles.heroSpotlightTitle}>
                {highlightedDishes[0]?.name || "Carte de la cheffe"}
              </Text>
              <Text style={styles.heroSpotlightBody} numberOfLines={2}>
                {highlightedDishes[0]?.description || "Plats rapides, categories claires et stories structurees."}
              </Text>
            </View>
            <View style={styles.heroSpotlightPriceWrap}>
              <Text style={styles.heroSpotlightPrice}>
                {highlightedDishes[0] ? formatPrice(getDishCurrentPrice(highlightedDishes[0])) : chef.priceRange}
              </Text>
              <Text style={styles.heroSpotlightMeta}>{discountedCount > 0 ? `${discountedCount} promo(s)` : "Menu stable"}</Text>
            </View>
          </View>
        </Gradient>

        <View style={styles.summaryStrip}>
          {summaryCards.map((card) => (
            <View key={card.label} style={styles.summaryCard}>
              <Feather name={card.icon} size={16} color={Colors.light.tint} />
              <Text style={styles.summaryValue}>{card.value}</Text>
              <Text style={styles.summaryLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

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
              <Text style={styles.sectionTitle}>Les choix qui comptent tout de suite</Text>
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
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Feather name="coffee" size={42} color={Colors.light.textTertiary} />
                <Text style={styles.emptyStateTitle}>Aucun plat visible</Text>
                <Text style={styles.emptyStateText}>Cette cuisiniere n'a pas encore publie de carte.</Text>
              </View>
            )}

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Repères rapides</Text>
              <View style={styles.categoryPreviewList}>
                {topCategories.length > 0 ? (
                  topCategories.map(([category, count]) => (
                    <View key={category} style={styles.categoryPreviewItem}>
                      <Text style={styles.categoryPreviewName}>{category}</Text>
                      <Text style={styles.categoryPreviewCount}>{count}</Text>
                    </View>
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
              <Text style={styles.sectionTitle}>Mosaïque vidéo de la cheffe</Text>
            </View>

            {stories.length > 0 ? (
              <View style={styles.storyGrid}>
                {stories.map((story) => (
                  <StoryTile key={story.id} story={story} />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Feather name="camera" size={42} color={Colors.light.textTertiary} />
                <Text style={styles.emptyStateTitle}>Aucune story pour le moment</Text>
                <Text style={styles.emptyStateText}>La section s'activera automatiquement des qu'une publication sera disponible.</Text>
              </View>
            )}
          </View>
        ) : null}

        {activeTab === 3 ? (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>A propos</Text>
              <Text style={styles.sectionTitle}>Tout le détail du profil</Text>
            </View>

            <View style={styles.aboutCard}>
              <Text style={styles.aboutTitle}>Presentation</Text>
              <Text style={styles.aboutBody}>{chef.bio}</Text>

              <View style={styles.specialtyRow}>
                {(chef.specialties?.length ? chef.specialties : [chef.specialty]).map((item) => (
                  <View key={item} style={styles.specialtyChip}>
                    <Text style={styles.specialtyChipText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.aboutCard}>
              <Text style={styles.aboutTitle}>Services</Text>
              <View style={styles.aboutInfoGrid}>
                <View style={styles.aboutInfoItem}>
                  <Text style={styles.aboutInfoLabel}>Menu</Text>
                  <Text style={styles.aboutInfoValue}>{menuDishes.length} plats</Text>
                </View>
                <View style={styles.aboutInfoItem}>
                  <Text style={styles.aboutInfoLabel}>Stories</Text>
                  <Text style={styles.aboutInfoValue}>{stories.length} publiées</Text>
                </View>
                <View style={styles.aboutInfoItem}>
                  <Text style={styles.aboutInfoLabel}>Sur-mesure</Text>
                  <Text style={styles.aboutInfoValue}>{hasCustomService ? `${customPackages.length} formule(s)` : "Non proposé"}</Text>
                </View>
                <View style={styles.aboutInfoItem}>
                  <Text style={styles.aboutInfoLabel}>Catégories fortes</Text>
                  <Text style={styles.aboutInfoValue}>{topCategories.map(([category]) => category).join(", ") || "À venir"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Feather name="clock" size={16} color={Colors.light.tint} />
                <Text style={styles.statLabel}>Temps de reponse moyen</Text>
                <Text style={styles.statValue}>{chef.responseTime}</Text>
              </View>
              <View style={styles.statRow}>
                <Ionicons name="star" size={16} color="#F7C27B" />
                <Text style={styles.statLabel}>Note globale</Text>
                <Text style={styles.statValue}>{chef.rating.toFixed(1)}/5</Text>
              </View>
              <View style={styles.statRow}>
                <Feather name="message-circle" size={16} color={Colors.light.tint} />
                <Text style={styles.statLabel}>Avis clients</Text>
                <Text style={styles.statValue}>{chef.reviewCount}</Text>
              </View>
              <View style={styles.statRow}>
                <Feather name="map-pin" size={16} color={Colors.light.tint} />
                <Text style={styles.statLabel}>Zone de service</Text>
                <Text style={styles.statValue}>{chef.location}</Text>
              </View>
              <View style={styles.statRow}>
                <Feather name="dollar-sign" size={16} color={Colors.light.success} />
                <Text style={styles.statLabel}>Gamme de prix</Text>
                <Text style={styles.statValue}>{chef.priceRange}</Text>
              </View>
            </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  emptyScreen: { flex: 1, backgroundColor: Colors.light.background, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  emptyScreenText: { fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center" },
  hero: { paddingHorizontal: 20, paddingBottom: 28, overflow: "hidden" },
  heroImageBg: { ...StyleSheet.absoluteFillObject },
  heroImageBgStyle: { opacity: 0.88 },
  heroImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(27,18,10,0.52)" },
  heroActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  heroActionRight: { flexDirection: "row", gap: 8 },
  heroIconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  heroContent: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatarWrap: { width: 82, height: 82, borderRadius: 41, backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 2, borderColor: "rgba(255,255,255,0.38)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: 82, height: 82, borderRadius: 41 },
  avatarInitials: { fontSize: 28, fontFamily: "Poppins_700Bold", color: "#fff" },
  heroTextWrap: { flex: 1, gap: 6 },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroName: { fontSize: 23, fontFamily: "Poppins_700Bold", color: "#fff", flexShrink: 1 },
  heroSubtitle: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.88)" },
  heroPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  heroPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.14)" },
  heroPillOnline: { backgroundColor: "rgba(39,174,96,0.28)" },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2ECC71" },
  heroPillText: { fontSize: 11, fontFamily: "Poppins_500Medium", color: "#fff" },
  heroSpotlightCard: { marginTop: 20, borderRadius: 22, padding: 16, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", flexDirection: "row", justifyContent: "space-between", gap: 16 },
  heroSpotlightCopy: { flex: 1, gap: 4 },
  heroSpotlightEyebrow: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Poppins_600SemiBold", color: "rgba(255,255,255,0.72)" },
  heroSpotlightTitle: { fontSize: 17, fontFamily: "Poppins_700Bold", color: "#fff" },
  heroSpotlightBody: { fontSize: 12, lineHeight: 19, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.86)" },
  heroSpotlightPriceWrap: { alignItems: "flex-end", justifyContent: "space-between" },
  heroSpotlightPrice: { fontSize: 16, fontFamily: "Poppins_700Bold", color: "#fff" },
  heroSpotlightMeta: { fontSize: 11, fontFamily: "Poppins_500Medium", color: "rgba(255,255,255,0.72)" },
  summaryStrip: { marginTop: -18, paddingHorizontal: 20, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "47%", minWidth: 148, borderRadius: 20, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 14, gap: 6, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2 },
  summaryValue: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  summaryLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  tabs: { flexDirection: "row", paddingHorizontal: 20, marginTop: 18, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  tab: { paddingVertical: 14, paddingHorizontal: 4, marginRight: 24, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: Colors.light.tint },
  tabText: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary },
  tabTextActive: { color: Colors.light.tint, fontFamily: "Poppins_600SemiBold" },
  sectionWrap: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  sectionHeader: { gap: 6 },
  sectionEyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint, textTransform: "uppercase", letterSpacing: 1 },
  sectionTitle: { fontSize: 21, lineHeight: 28, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  sectionBody: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  dishCard: { borderRadius: 24, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, overflow: "hidden" },
  dishVisualWrap: { position: "relative" },
  dishImage: { width: "100%", height: 184, backgroundColor: Colors.light.backgroundSecondary },
  dishImageFallback: { width: "100%", height: 184, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  dishBadgeRow: { position: "absolute", left: 12, right: 12, top: 12, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  categoryBadge: { backgroundColor: "rgba(255,244,233,0.96)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  categoryBadgeText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  quickBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  quickBadgeText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  dishBody: { padding: 16, gap: 14 },
  dishHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dishHeaderMeta: { flex: 1, gap: 6 },
  dishName: { fontSize: 17, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  dishDescription: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  priceWrap: { alignItems: "flex-end", gap: 4 },
  priceCurrent: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  pricePrevious: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary, textDecorationLine: "line-through" },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: Colors.light.backgroundSecondary },
  metaPillText: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  discountBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#ECFDF5" },
  discountBadgeText: { fontSize: 12, fontFamily: "Poppins_700Bold", color: "#047857" },
  dishActionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  dishActionHint: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, backgroundColor: Colors.light.tint, paddingHorizontal: 14, paddingVertical: 11 },
  addBtnText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  qtyControl: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.light.backgroundSecondary, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 6 },
  qtyBtn: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  qtyText: { minWidth: 20, textAlign: "center", fontSize: 14, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  readOnlyBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, backgroundColor: Colors.light.backgroundSecondary, paddingHorizontal: 12, paddingVertical: 10 },
  readOnlyBannerText: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  panelCard: { borderRadius: 22, backgroundColor: "#F7F1EA", borderWidth: 1, borderColor: "rgba(156,109,82,0.12)", padding: 16, gap: 12 },
  panelTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  categoryPreviewList: { gap: 10 },
  categoryPreviewItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, backgroundColor: "rgba(255,255,255,0.76)", paddingHorizontal: 14, paddingVertical: 12 },
  categoryPreviewName: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  categoryPreviewCount: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  categoryPreviewEmpty: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  serviceGrid: { gap: 12 },
  serviceCard: { borderRadius: 22, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 16, gap: 10 },
  serviceTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  serviceBody: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  serviceBtn: { alignSelf: "flex-start", borderRadius: 14, backgroundColor: Colors.light.tint, paddingHorizontal: 14, paddingVertical: 11 },
  serviceBtnSecondary: { backgroundColor: Colors.light.tintDark },
  serviceBtnText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  serviceCardCompact: { borderRadius: 22, backgroundColor: "#2A2017", padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  serviceCardCompactCopy: { flex: 1, gap: 4 },
  serviceCardCompactEyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: 0.8 },
  serviceCardCompactTitle: { fontSize: 17, fontFamily: "Poppins_700Bold", color: "#fff" },
  serviceCardCompactMeta: { fontSize: 12, fontFamily: "Poppins_500Medium", color: "rgba(255,255,255,0.78)" },
  filterRow: { gap: 10, paddingRight: 12 },
  filterChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.light.cardBorder, backgroundColor: Colors.light.card },
  filterChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  filterChipText: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  filterChipTextActive: { color: "#fff" },
  menuInsightCard: { borderRadius: 18, backgroundColor: Colors.light.backgroundSecondary, padding: 14, gap: 4 },
  menuInsightTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  menuInsightBody: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  menuTile: { width: "48%", borderRadius: 20, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, overflow: "hidden" },
  menuTileVisual: { position: "relative" },
  menuTileImage: { width: "100%", height: 122, backgroundColor: Colors.light.backgroundSecondary },
  menuTileFallback: { width: "100%", height: 122, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  menuTileBadge: { position: "absolute", top: 10, left: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 9, paddingVertical: 5 },
  menuTileBadgeText: { fontSize: 10, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  menuTileBody: { padding: 12, gap: 6 },
  menuTileName: { fontSize: 14, fontFamily: "Poppins_700Bold", color: Colors.light.text, minHeight: 38 },
  menuTileMeta: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  menuTilePrice: { fontSize: 14, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  menuTileBtn: { marginTop: 4, borderRadius: 12, backgroundColor: Colors.light.tint, alignItems: "center", paddingVertical: 9 },
  menuTileBtnText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  menuQtyControl: { marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.light.backgroundSecondary, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 6 },
  storyList: { gap: 12 },
  storyCard: { borderRadius: 22, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, overflow: "hidden" },
  storyCardProminent: { shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2 },
  storyImage: { width: "100%", height: 180, backgroundColor: Colors.light.backgroundSecondary },
  storyImageProminent: { height: 224 },
  storyVideoFallback: { width: "100%", height: 180, backgroundColor: "#1F2937", alignItems: "center", justifyContent: "center", gap: 8 },
  storyVideoText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  storyContent: { padding: 16, gap: 10 },
  storyMetaTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  storyDate: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
  storyCountsRow: { flexDirection: "row", gap: 8 },
  storyCountPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: Colors.light.backgroundSecondary },
  storyCountText: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  storyCaption: { fontSize: 15, lineHeight: 22, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  storyDishCard: { borderRadius: 14, backgroundColor: Colors.light.backgroundSecondary, padding: 12, gap: 4 },
  storyDishName: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  storyDishPrice: { fontSize: 12, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  storyGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  storyTile: { width: "48%", height: 220, borderRadius: 22, overflow: "hidden", backgroundColor: "#1F2937" },
  storyTileImage: { width: "100%", height: "100%" },
  storyTileFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1F2937" },
  storyTileOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: "rgba(0,0,0,0.34)", gap: 8 },
  storyTileTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  storyTileDate: { fontSize: 10, fontFamily: "Poppins_600SemiBold", color: "rgba(255,255,255,0.86)", textTransform: "uppercase", letterSpacing: 0.6 },
  storyTileVideoPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 4 },
  storyTileVideoText: { fontSize: 10, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  storyTileCaption: { fontSize: 13, lineHeight: 18, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  aboutCard: { borderRadius: 22, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 16, gap: 12 },
  aboutTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  aboutBody: { fontSize: 13, lineHeight: 21, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  aboutInfoGrid: { gap: 10 },
  aboutInfoItem: { borderRadius: 14, backgroundColor: Colors.light.backgroundSecondary, padding: 12, gap: 4 },
  aboutInfoLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.textTertiary, textTransform: "uppercase", letterSpacing: 0.6 },
  aboutInfoValue: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  specialtyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  specialtyChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: Colors.light.backgroundSecondary },
  specialtyChipText: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  statsCard: { borderRadius: 22, backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 16, gap: 14 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statLabel: { flex: 1, fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  statValue: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 52, gap: 10 },
  emptyStateTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  emptyStateText: { fontSize: 13, lineHeight: 19, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center" },
  cartBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.light.background },
  cartBarInner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14 },
  cartBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.28)" },
  cartBadgeText: { fontSize: 12, fontFamily: "Poppins_700Bold", color: "#fff" },
  cartText: { flex: 1, fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  cartPrice: { fontSize: 15, fontFamily: "Poppins_700Bold", color: "#fff" },
  stickyActions: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.light.background, borderTopWidth: 1, borderTopColor: Colors.light.divider },
  messageBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.light.tint, paddingHorizontal: 18, paddingVertical: 13 },
  messageBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  orderBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: Colors.light.tint, paddingVertical: 13 },
  orderBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
});
