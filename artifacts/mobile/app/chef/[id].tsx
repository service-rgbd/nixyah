import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
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

const TABS = ["Plats rapides", "Menus", "À propos"];

function DishCard({
  dish,
  onAdd,
  quantity,
}: {
  dish: Dish;
  onAdd: () => void;
  quantity: number;
}) {
  return (
    <View style={styles.dishCard}>
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
              onPress={() => {}}
            >
              <Feather name="minus" size={14} color={Colors.light.tint} />
            </Pressable>
            <Text style={styles.qtyText}>{quantity}</Text>
            <Pressable style={styles.qtyBtn} onPress={onAdd}>
              <Feather name="plus" size={14} color={Colors.light.tint} />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addBtn} onPress={onAdd}>
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
  const { getChef, favorites, toggleFavorite } = useApp();
  const [activeTab, setActiveTab] = useState(0);
  const [cart, setCart] = useState<Record<string, number>>({});

  const chef = getChef(id ?? "");
  const isFav = favorites.includes(id ?? "");

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

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalPrice = chef.dishes.reduce(
    (sum, dish) => sum + (cart[dish.id] || 0) * dish.price,
    0
  );

  const addToCart = (dishId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart((prev) => ({ ...prev, [dishId]: (prev[dishId] || 0) + 1 }));
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: totalItems > 0 ? 120 : 60 }}>
        <LinearGradient
          colors={[chef.coverColor, chef.coverColor + "CC"]}
          style={[styles.hero, { paddingTop: topInset }]}
        >
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
              <Text style={styles.chefAvatarText}>
                {chef.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </Text>
            </View>
            <View style={styles.heroInfo}>
              <View style={styles.heroNameRow}>
                <Text style={styles.heroName}>{chef.name}</Text>
                {chef.isVerified && (
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                )}
              </View>
              <Text style={styles.heroSpecialty}>{chef.specialty}</Text>
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
        </LinearGradient>

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
                quantity={cart[dish.id] || 0}
                onAdd={() => addToCart(dish.id)}
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
              <Pressable
                style={styles.menuOrderBtn}
                onPress={() => router.push({ pathname: "/order/[chefId]", params: { chefId: chef.id } })}
              >
                <Text style={styles.menuOrderBtnText}>Créer ma demande</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.menuCard}>
              <Text style={styles.menuCardTitle}>Chef à domicile</Text>
              <Text style={styles.menuCardDesc}>
                Invitez {chef.name.split(" ")[0]} chez vous pour cuisiner en direct pour votre événement.
              </Text>
              <Pressable
                style={[styles.menuOrderBtn, { backgroundColor: Colors.light.tintDark }]}
                onPress={() => router.push({ pathname: "/order/[chefId]", params: { chefId: chef.id } })}
              >
                <Text style={styles.menuOrderBtnText}>Réserver un chef</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}

        {activeTab === 2 && (
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
          <LinearGradient
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
          </LinearGradient>
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
  hero: { paddingHorizontal: 20, paddingBottom: 24 },
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
  },
  chefAvatarText: { fontSize: 28, fontFamily: "Poppins_700Bold", color: "#fff" },
  heroInfo: { flex: 1, gap: 4 },
  heroNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroName: { fontSize: 20, fontFamily: "Poppins_700Bold", color: "#fff" },
  heroSpecialty: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.85)" },
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
});
