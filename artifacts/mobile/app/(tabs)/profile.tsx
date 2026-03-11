import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const MENU_ITEMS_CLIENT = [
  { icon: "heart" as const, label: "Mes favoris", sub: "Cuisinières sauvegardées" },
  { icon: "map-pin" as const, label: "Mes adresses", sub: "Abidjan, Cocody..." },
  { icon: "credit-card" as const, label: "Paiement", sub: "Wave, Mobile Money, Espèces" },
  { icon: "bell" as const, label: "Notifications", sub: "Gérer les alertes" },
  { icon: "shield" as const, label: "Confidentialité", sub: "Données et sécurité" },
  { icon: "help-circle" as const, label: "Aide & Support", sub: "FAQ, Contact" },
];

const MENU_ITEMS_CHEF = [
  { icon: "camera" as const, label: "Publier une story", sub: "Montrez vos plats du jour", action: "story" },
  { icon: "package" as const, label: "Mes plats", sub: "Gérer mon menu" },
  { icon: "bar-chart-2" as const, label: "Statistiques", sub: "Ventes et avis clients" },
  { icon: "credit-card" as const, label: "Paiements reçus", sub: "Wave, Mobile Money" },
  { icon: "bell" as const, label: "Notifications", sub: "Nouvelles commandes" },
  { icon: "help-circle" as const, label: "Aide & Support", sub: "FAQ, Contact" },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { chefs, favorites, orders, user, logout } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [loggingOut, setLoggingOut] = useState(false);

  const favoriteChefs = chefs.filter((c) => favorites.includes(c.id));
  const isChef = user?.type === "chef";
  const menuItems = isChef ? MENU_ITEMS_CHEF : MENU_ITEMS_CLIENT;

  const initials = user
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  const avatarColor = user?.coverColor ?? Colors.light.tint;

  const handleMenuPress = (item: typeof MENU_ITEMS_CHEF[0]) => {
    if ((item as any).action === "story") {
      router.push("/chef/post-story");
    }
  };

  const handleLogout = () => {
    Alert.alert("Se déconnecter", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          await logout();
          setLoggingOut(false);
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.guestContainer, { paddingTop: topInset }]}>
        <View style={styles.guestContent}>
          <LinearGradient
            colors={[Colors.light.tint, Colors.light.tintDark]}
            style={styles.guestIcon}
          >
            <Ionicons name="person-outline" size={36} color="#fff" />
          </LinearGradient>
          <Text style={styles.guestTitle}>Connectez-vous</Text>
          <Text style={styles.guestSub}>Accédez à vos commandes, favoris et profil</Text>

          <Pressable style={styles.loginBtn} onPress={() => router.push("/auth/login")}>
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </Pressable>

          <Pressable style={styles.registerBtn} onPress={() => router.push("/auth/register-client")}>
            <Text style={styles.registerBtnText}>Créer un compte client</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Vous cuisinez ?</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.chefBtn} onPress={() => router.push("/auth/register-chef")}>
            <Ionicons name="restaurant-outline" size={18} color={Colors.light.tint} />
            <Text style={styles.chefBtnText}>Rejoindre comme cuisinière</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.editAvatarBtn}>
              <Feather name="edit-2" size={12} color="#fff" />
            </View>
          </View>
          <Text style={styles.profileName}>{user.name}</Text>
          {user.email && <Text style={styles.profileEmail}>{user.email}</Text>}
          {user.phone && !user.email && <Text style={styles.profileEmail}>{user.phone}</Text>}
          <Text style={styles.profileLocation}>
            📍 {user.location}
          </Text>

          {isChef && (
            <View style={styles.chefBadge}>
              <Ionicons name="restaurant" size={12} color={Colors.light.tint} />
              <Text style={styles.chefBadgeText}>Cuisinière Nixyah</Text>
              {user.chefProfile?.isVerified && (
                <View style={styles.verifiedDot}>
                  <Feather name="check" size={9} color="#fff" />
                </View>
              )}
            </View>
          )}

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
              <Text style={styles.statValue}>{isChef ? (user.chefProfile?.reviewCount ?? 0) : "0"}</Text>
              <Text style={styles.statLabel}>{isChef ? "Avis" : "Avis donnés"}</Text>
            </View>
          </View>
        </LinearGradient>

        {isChef && (
          <View style={styles.chefActionsRow}>
            <Pressable style={styles.chefActionBtn} onPress={() => router.push("/chef/post-story")}>
              <LinearGradient colors={[Colors.light.tint, Colors.light.tintDark]} style={styles.chefActionGradient}>
                <Feather name="camera" size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.chefActionLabel}>Story</Text>
            </Pressable>
            <Pressable style={styles.chefActionBtn}>
              <LinearGradient colors={["#8B5CF6", "#6D28D9"]} style={styles.chefActionGradient}>
                <Feather name="package" size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.chefActionLabel}>Mes plats</Text>
            </Pressable>
            <Pressable style={styles.chefActionBtn}>
              <LinearGradient colors={["#059669", "#047857"]} style={styles.chefActionGradient}>
                <Feather name="bar-chart-2" size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.chefActionLabel}>Stats</Text>
            </Pressable>
            <Pressable style={styles.chefActionBtn}>
              <LinearGradient colors={["#D97706", "#B45309"]} style={styles.chefActionGradient}>
                <Feather name="toggle-right" size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.chefActionLabel}>Disponible</Text>
            </Pressable>
          </View>
        )}

        {!isChef && favoriteChefs.length > 0 && (
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
          {menuItems.map((item, idx) => (
            <Pressable
              key={idx}
              style={[styles.menuItem, idx === menuItems.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => handleMenuPress(item as any)}
            >
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

        {!isChef && (
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
              <Pressable style={styles.becomeChefBtn} onPress={() => router.push("/auth/register-chef")}>
                <Text style={styles.becomeChefBtnText}>S'inscrire</Text>
              </Pressable>
            </LinearGradient>
          </View>
        )}

        <Pressable style={styles.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
          {loggingOut ? (
            <ActivityIndicator color={Colors.light.error} size="small" />
          ) : (
            <>
              <Feather name="log-out" size={16} color={Colors.light.error} />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  guestContainer: { justifyContent: "center", alignItems: "center" },
  guestContent: { padding: 32, alignItems: "center", gap: 12, width: "100%" },
  guestIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  guestTitle: { fontSize: 22, fontFamily: "Poppins_700Bold", color: Colors.light.text, textAlign: "center" },
  guestSub: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 12 },
  loginBtn: { width: "100%", backgroundColor: Colors.light.tint, borderRadius: 16, paddingVertical: 15, alignItems: "center", shadowColor: Colors.light.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  loginBtnText: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  registerBtn: { width: "100%", borderWidth: 1.5, borderColor: Colors.light.tint, borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  registerBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%", marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.light.divider },
  dividerText: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  chefBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.backgroundSecondary, borderRadius: 16, paddingVertical: 14, borderWidth: 1, borderColor: Colors.light.cardBorder },
  chefBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  profileHeader: { alignItems: "center", paddingBottom: 24, paddingTop: 12 },
  avatarWrapper: { position: "relative", marginBottom: 14 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 32, fontFamily: "Poppins_700Bold", color: "#fff" },
  editAvatarBtn: { position: "absolute", bottom: 0, right: 0, backgroundColor: Colors.light.text, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  profileName: { fontSize: 20, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  profileEmail: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  profileLocation: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, marginTop: 4 },
  chefBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.light.backgroundSecondary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginTop: 8, borderWidth: 1, borderColor: Colors.light.cardBorder },
  chefBadgeText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  verifiedDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#059669", alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 20, backgroundColor: Colors.light.card, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24, marginHorizontal: 20, borderWidth: 1, borderColor: Colors.light.cardBorder, shadowColor: Colors.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { fontSize: 20, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  statLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.light.divider },
  chefActionsRow: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  chefActionBtn: { flex: 1, alignItems: "center", gap: 6 },
  chefActionGradient: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  chefActionLabel: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary },
  section: { paddingTop: 20 },
  sectionTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, paddingHorizontal: 20, marginBottom: 12 },
  favoritesRow: { paddingHorizontal: 20, gap: 12 },
  favoriteChip: { alignItems: "center", gap: 5, width: 64 },
  favoriteAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  favoriteAvatarText: { fontSize: 18, fontFamily: "Poppins_700Bold", color: "rgba(255,255,255,0.9)" },
  favoriteName: { fontSize: 10, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary, textAlign: "center" },
  menuSection: { backgroundColor: Colors.light.card, borderRadius: 20, marginHorizontal: 20, marginTop: 20, borderWidth: 1, borderColor: Colors.light.cardBorder, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  menuIconWrapper: { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  menuSub: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  becomeChefBanner: { paddingHorizontal: 20, marginTop: 20 },
  becomeChefGradient: { borderRadius: 18, overflow: "hidden" },
  becomeChefContent: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  becomeChefText: { flex: 1 },
  becomeChefTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  becomeChefDesc: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 2 },
  becomeChefBtn: { backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 16, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  becomeChefBtnText: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, marginHorizontal: 20, paddingVertical: 14 },
  logoutText: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.error },
});
