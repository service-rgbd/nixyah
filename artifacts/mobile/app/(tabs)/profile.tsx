import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
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
import { useApp } from "@/contexts/AppContext";

const MENU_ITEMS = [
  { icon: "heart" as const, label: "Mes favoris", sub: "Cuisinières sauvegardées" },
  { icon: "map-pin" as const, label: "Mes adresses", sub: "Abidjan, Cocody..." },
  { icon: "credit-card" as const, label: "Paiement", sub: "Wave, Mobile Money, Espèces" },
  { icon: "bell" as const, label: "Notifications", sub: "Gérer les alertes" },
  { icon: "shield" as const, label: "Confidentialité", sub: "Données et sécurité" },
  { icon: "help-circle" as const, label: "Aide & Support", sub: "FAQ, Contact" },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { chefs, favorites, orders } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const favoriteChefs = chefs.filter((c) => favorites.includes(c.id));

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 100 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.light.backgroundSecondary, Colors.light.background]}
          style={styles.profileHeader}
        >
          <View style={styles.avatarWrapper}>
            <LinearGradient
              colors={[Colors.light.tint, Colors.light.tintDark]}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>KD</Text>
            </LinearGradient>
            <View style={styles.editAvatarBtn}>
              <Feather name="edit-2" size={12} color="#fff" />
            </View>
          </View>
          <Text style={styles.profileName}>Kouamé Diallo</Text>
          <Text style={styles.profileEmail}>kouame.d@gmail.com</Text>
          <Text style={styles.profileLocation}>
            <Feather name="map-pin" size={11} color={Colors.light.textTertiary} /> Cocody, Abidjan
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{orders.length}</Text>
              <Text style={styles.statLabel}>Commandes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{favorites.length}</Text>
              <Text style={styles.statLabel}>Favoris</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>4</Text>
              <Text style={styles.statLabel}>Avis donnés</Text>
            </View>
          </View>
        </LinearGradient>

        {favoriteChefs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mes cuisinières favorites</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoritesRow}>
              {favoriteChefs.map((chef) => (
                <Pressable
                  key={chef.id}
                  style={styles.favoriteChip}
                  onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
                >
                  <View style={[styles.favoriteAvatar, { backgroundColor: chef.coverColor }]}>
                    <Text style={styles.favoriteAvatarText}>
                      {chef.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </Text>
                  </View>
                  <Text style={styles.favoriteName} numberOfLines={1}>{chef.name.split(" ")[0]}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item, idx) => (
            <Pressable key={idx} style={styles.menuItem}>
              <View style={styles.menuIconWrapper}>
                <Feather name={item.icon} size={18} color={Colors.light.tint} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSub}>{item.sub}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={Colors.light.tabIconDefault} />
            </Pressable>
          ))}
        </View>

        <View style={styles.becomeChefBanner}>
          <LinearGradient
            colors={[Colors.light.tint, Colors.light.tintDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.becomeChefGradient}
          >
            <View style={styles.becomeChefContent}>
              <Ionicons name="restaurant-outline" size={24} color="#fff" />
              <View style={styles.becomeChefText}>
                <Text style={styles.becomeChefTitle}>Vous cuisinez ?</Text>
                <Text style={styles.becomeChefDesc}>Rejoignez Nixyah et monétisez votre talent</Text>
              </View>
            </View>
            <Pressable style={styles.becomeChefBtn}>
              <Text style={styles.becomeChefBtnText}>S'inscrire</Text>
            </Pressable>
          </LinearGradient>
        </View>

        <Pressable style={styles.logoutBtn}>
          <Feather name="log-out" size={16} color={Colors.light.error} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  profileHeader: {
    alignItems: "center",
    paddingBottom: 24,
    paddingTop: 12,
  },
  avatarWrapper: { position: "relative", marginBottom: 14 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 32,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
  editAvatarBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: Colors.light.text,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  profileName: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  profileLocation: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statValue: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.light.divider,
  },
  section: { paddingTop: 20 },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  favoritesRow: { paddingHorizontal: 20, gap: 12 },
  favoriteChip: { alignItems: "center", gap: 5, width: 64 },
  favoriteAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteAvatarText: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.9)",
  },
  favoriteName: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  menuSection: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  menuIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: { flex: 1 },
  menuLabel: {
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
  },
  menuSub: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  becomeChefBanner: { paddingHorizontal: 20, marginTop: 20 },
  becomeChefGradient: { borderRadius: 18, overflow: "hidden" },
  becomeChefContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  becomeChefText: { flex: 1 },
  becomeChefTitle: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
  becomeChefDesc: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  becomeChefBtn: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  becomeChefBtnText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 14,
  },
  logoutText: {
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.error,
  },
});
