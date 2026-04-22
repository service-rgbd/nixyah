import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import {
  CHEF_MENU_CATEGORIES,
  formatPrice,
  getDishBasePrice,
  getDishCurrentPrice,
  getDishDiscountPercent,
  getDishPrimaryImage,
  getDishSavingsAmount,
} from "@/constants/chef-menu";
import { Dish, useApp } from "@/contexts/AppContext";

function DishPriceBlock({ dish }: { dish: Dish }) {
  const currentPrice = getDishCurrentPrice(dish);
  const basePrice = getDishBasePrice(dish);
  const discountPercent = getDishDiscountPercent(dish);

  return (
    <View style={styles.priceStack}>
      <Text style={styles.priceCurrent}>{formatPrice(currentPrice)}</Text>
      {discountPercent > 0 && basePrice > currentPrice ? (
        <Text style={styles.pricePrevious}>{formatPrice(basePrice)}</Text>
      ) : null}
    </View>
  );
}

export default function MyDishesScreen() {
  const insets = useSafeAreaInsets();
  const { user, chefDishes, isLoadingNotifications, fetchChefDishes, deleteChefDish } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const [deletingDishId, setDeletingDishId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");

  useEffect(() => {
    if (user?.id) {
      fetchChefDishes(user.id);
    }
  }, [user?.id, fetchChefDishes]);

  const discountedCount = useMemo(
    () => chefDishes.filter((dish) => getDishDiscountPercent(dish) > 0).length,
    [chefDishes]
  );

  const highlightedCount = useMemo(
    () => chefDishes.filter((dish) => dish.isPopular).length,
    [chefDishes]
  );

  const availableCategories = useMemo(() => {
    const usedCategories = new Set(chefDishes.map((dish) => dish.category));
    return ["Tous", ...CHEF_MENU_CATEGORIES.filter((category) => usedCategories.has(category))];
  }, [chefDishes]);

  const filteredDishes = useMemo(() => {
    const source = selectedCategory === "Tous"
      ? chefDishes
      : chefDishes.filter((dish) => dish.category === selectedCategory);

    return [...source].sort((left, right) => {
      const leftPriority = (left.isPopular ? 2 : 0) + (getDishDiscountPercent(left) > 0 ? 1 : 0);
      const rightPriority = (right.isPopular ? 2 : 0) + (getDishDiscountPercent(right) > 0 ? 1 : 0);
      return rightPriority - leftPriority;
    });
  }, [chefDishes, selectedCategory]);

  const menuSummary = useMemo(() => {
    const totalSavings = chefDishes.reduce((sum, dish) => sum + getDishSavingsAmount(dish), 0);
    return [
      { label: "plats actifs", value: String(chefDishes.length) },
      { label: "promos visibles", value: String(discountedCount) },
      { label: "plats rapides", value: String(highlightedCount) },
      { label: "gain client cumule", value: totalSavings > 0 ? formatPrice(totalSavings) : "Aucun" },
    ];
  }, [chefDishes, discountedCount, highlightedCount]);

  const handleDelete = (dishId: string, dishName: string) => {
    Alert.alert("Supprimer le plat", `Voulez-vous retirer ${dishName} du menu ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingDishId(dishId);
            await deleteChefDish(dishId);
          } catch (error: any) {
            Alert.alert("Erreur", error?.message ?? "Impossible de supprimer le plat");
          } finally {
            setDeletingDishId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}> 
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>Menu cuisinière</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push("/chef/create-dish")}>
          <Feather name="plus" size={20} color={Colors.light.tint} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 28 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroEyebrow}>Pilotage du menu</Text>
              <Text style={styles.heroTitle}>Exposez les plats rapides, les categories et les reductions</Text>
            </View>
            <Pressable style={styles.heroCta} onPress={() => router.push("/chef/create-dish")}>
              <Text style={styles.heroCtaText}>Ajouter un plat</Text>
            </Pressable>
          </View>

          <Text style={styles.heroDescription}>
            Votre carte est maintenant pensee pour les filtres clients. Publiez vos formules sur-mesure dans Evenements, puis gardez le reste du menu clair, visible et bien classe.
          </Text>

          <View style={styles.summaryGrid}>
            {menuSummary.map((item) => (
              <View key={item.label} style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{item.value}</Text>
                <Text style={styles.summaryLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.filterBlock}>
          <Text style={styles.sectionTitle}>Filtres du menu</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {availableCategories.map((category) => {
              const selected = selectedCategory === category;
              return (
                <Pressable
                  key={category}
                  style={[styles.filterChip, selected && styles.filterChipActive]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{category}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {isLoadingNotifications ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
          </View>
        ) : filteredDishes.length > 0 ? (
          <View style={styles.dishList}>
            {filteredDishes.map((dish) => {
              const primaryImage = getDishPrimaryImage(dish);
              const gallery = dish.imageUrls?.length ? dish.imageUrls : primaryImage ? [primaryImage] : [];
              const discountPercent = getDishDiscountPercent(dish);
              const savingsAmount = getDishSavingsAmount(dish);

              return (
                <View key={dish.id} style={styles.dishCard}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardMetaWrap}>
                      <View style={styles.tagRow}>
                        <View style={styles.categoryPill}>
                          <Text style={styles.categoryPillText}>{dish.category}</Text>
                        </View>
                        {dish.isPopular ? (
                          <View style={styles.highlightPill}>
                            <Ionicons name="flash" size={12} color={Colors.light.tint} />
                            <Text style={styles.highlightPillText}>Plat rapide</Text>
                          </View>
                        ) : null}
                        {discountPercent > 0 ? (
                          <View style={styles.discountPill}>
                            <Text style={styles.discountPillText}>-{discountPercent}%</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.dishName}>{dish.name}</Text>
                      <Text style={styles.dishSubtitle}>{dish.prepTime} · {dish.description || "Description a completer"}</Text>
                    </View>
                    <DishPriceBlock dish={dish} />
                  </View>

                  {gallery.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesRow}>
                      {gallery.map((uri, index) => (
                        <View key={`${dish.id}-${uri}`} style={styles.imageWrap}>
                          <Image source={{ uri }} style={styles.dishImage} />
                          <View style={styles.imageChip}>
                            <Text style={styles.imageChipText}>{index === 0 ? "Couverture" : `Photo ${index + 1}`}</Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.emptyVisualCard}>
                      <Feather name="image" size={18} color={Colors.light.textTertiary} />
                      <Text style={styles.emptyVisualText}>Ajoutez une photo pour mieux exposer ce plat.</Text>
                    </View>
                  )}

                  {discountPercent > 0 ? (
                    <View style={styles.promoCard}>
                      <View style={styles.promoTextWrap}>
                        <Text style={styles.promoTitle}>{dish.discountLabel?.trim() || "Reduction active"}</Text>
                        <Text style={styles.promoSub}>Le client economise {formatPrice(savingsAmount)} sur ce plat.</Text>
                      </View>
                      <Text style={styles.promoValue}>-{discountPercent}%</Text>
                    </View>
                  ) : null}

                  <View style={styles.footerRow}>
                    <Text style={styles.lockedPriceNote}>Le prix de base reste verrouille apres publication. La reduction peut rester active ou etre retiree.</Text>
                    <View style={styles.dishActions}>
                      <Pressable style={styles.actionBtn} onPress={() => router.push({ pathname: "/chef/create-dish", params: { dishId: dish.id } })}>
                        <Feather name="edit-3" size={16} color={Colors.light.tint} />
                        <Text style={styles.actionLabel}>Modifier</Text>
                      </Pressable>
                      <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(dish.id, dish.name)} disabled={deletingDishId === dish.id}>
                        {deletingDishId === dish.id ? (
                          <ActivityIndicator size="small" color={Colors.light.error} />
                        ) : (
                          <>
                            <Feather name="trash-2" size={16} color={Colors.light.error} />
                            <Text style={[styles.actionLabel, styles.deleteLabel]}>Supprimer</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={52} color={Colors.light.textTertiary} />
            <Text style={styles.emptyTitle}>Aucun plat dans cette categorie</Text>
            <Text style={styles.emptySub}>Ajoutez un plat avec categorie, mise en avant et promo optionnelle pour structurer votre menu.</Text>
            <Pressable style={styles.createBtn} onPress={() => router.push("/chef/create-dish") }>
              <Text style={styles.createBtnText}>Ajouter un plat</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.helperCard}>
          <Text style={styles.helperTitle}>Categories gerees pour les filtres clients</Text>
          <Text style={styles.helperText}>{CHEF_MENU_CATEGORIES.join(" · ")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, flex: 1, textAlign: "center" },
  addBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: "rgba(120,104,96,0.16)" },
  content: { paddingHorizontal: 20, paddingTop: 18, gap: 18 },
  heroCard: { paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: "rgba(120,104,96,0.10)", gap: 14 },
  heroHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 },
  heroEyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint, textTransform: "uppercase", letterSpacing: 1 },
  heroTitle: { marginTop: 6, fontSize: 22, lineHeight: 30, fontFamily: "Poppins_700Bold", color: Colors.light.text, maxWidth: 240 },
  heroCta: { backgroundColor: "transparent", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(120,104,96,0.16)" },
  heroCtaText: { color: Colors.light.tint, fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  heroDescription: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { width: "47%", minWidth: 140, paddingVertical: 14, gap: 4, borderBottomWidth: 1, borderBottomColor: "rgba(120,104,96,0.10)" },
  summaryValue: { fontSize: 17, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  summaryLabel: { fontSize: 11, lineHeight: 16, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  filterBlock: { gap: 10 },
  sectionTitle: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  filterRow: { gap: 10, paddingRight: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderColor: "rgba(120,104,96,0.16)", backgroundColor: "transparent" },
  filterChipActive: { backgroundColor: "rgba(196,82,42,0.08)", borderColor: Colors.light.tint },
  filterChipText: { color: Colors.light.text, fontFamily: "Poppins_500Medium", fontSize: 12 },
  filterChipTextActive: { color: Colors.light.tint },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 72 },
  dishList: { gap: 14 },
  dishCard: { paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: "rgba(120,104,96,0.10)", gap: 14 },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardMetaWrap: { flex: 1, gap: 8 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryPill: { backgroundColor: "#FFF4E9", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  categoryPillText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  highlightPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F3EEE8", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  highlightPillText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  discountPill: { backgroundColor: "#ECFDF5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  discountPillText: { fontSize: 11, fontFamily: "Poppins_700Bold", color: "#047857" },
  dishName: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  dishSubtitle: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  priceStack: { alignItems: "flex-end", gap: 4 },
  priceCurrent: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.light.tint },
  pricePrevious: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary, textDecorationLine: "line-through" },
  imagesRow: { gap: 10, paddingRight: 8 },
  imageWrap: { position: "relative" },
  dishImage: { width: 168, height: 112, borderRadius: 16, backgroundColor: Colors.light.backgroundSecondary },
  imageChip: { position: "absolute", left: 8, bottom: 8, backgroundColor: "rgba(17,24,39,0.66)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  imageChipText: { color: "#fff", fontSize: 10, fontFamily: "Poppins_500Medium" },
  emptyVisualCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(120,104,96,0.16)", borderStyle: "dashed", paddingVertical: 22, alignItems: "center", gap: 8, backgroundColor: "transparent" },
  emptyVisualText: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  promoCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderTopColor: "#BBF7D0", borderBottomColor: "#BBF7D0", paddingVertical: 14 },
  promoTextWrap: { flex: 1, gap: 3 },
  promoTitle: { fontSize: 13, fontFamily: "Poppins_700Bold", color: "#065F46" },
  promoSub: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: "#166534" },
  promoValue: { fontSize: 16, fontFamily: "Poppins_700Bold", color: "#047857" },
  footerRow: { gap: 12 },
  lockedPriceNote: { fontSize: 11, lineHeight: 17, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  dishActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: "transparent", paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: "rgba(120,104,96,0.16)" },
  actionLabel: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  deleteBtn: { backgroundColor: "transparent", borderColor: "#FECACA" },
  deleteLabel: { color: Colors.light.error },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 84, gap: 12 },
  emptyTitle: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  emptySub: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center" },
  createBtn: { backgroundColor: Colors.light.tint, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 13, marginTop: 6 },
  createBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  helperCard: { paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderTopColor: "rgba(120,104,96,0.10)", borderBottomColor: "rgba(120,104,96,0.10)", gap: 6 },
  helperTitle: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  helperText: { fontSize: 12, lineHeight: 19, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
});