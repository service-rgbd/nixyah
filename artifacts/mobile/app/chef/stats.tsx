import { Feather, Ionicons } from "@expo/vector-icons";
import Gradient from "@/components/SafeGradient";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
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

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { user, chefStats, isLoadingNotifications, fetchChefStats } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (user?.id) {
      fetchChefStats(user.id);
    }
  }, [user?.id, fetchChefStats]);

  const stats = chefStats || {
    totalOrders: 0,
    totalRevenue: 0,
    averageRating: 0,
    completionRate: 0,
    activeOrders: 0,
    averageBasket: 0,
    breakdown: { pending: 0, accepted: 0, preparing: 0, ready: 0, delivered: 0 },
    thisMonth: { orders: 0, revenue: 0 },
    reviews: 0,
    stars: 0,
    complaintCount: 0,
    activeInvestigations: 0,
    isFeatured: false,
    featureThreshold: 200,
    deliveryRevenue: 0,
    promoOrders: 0,
    referralOrders: 0,
    complaintBreakdown: {},
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}> 
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>Statistiques</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 20 }]} showsVerticalScrollIndicator={false}>
        {isLoadingNotifications ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
          </View>
        ) : (
          <>
            <Gradient colors={[Colors.light.tint, Colors.light.tintDark]} style={styles.overviewCard}>
              <Text style={styles.overviewEyebrow}>Vue d'ensemble</Text>
              <Text style={styles.overviewValue}>{stats.totalRevenue.toLocaleString()} FCFA</Text>
              <Text style={styles.overviewSub}>revenu cumulé sur {stats.totalOrders} commande{stats.totalOrders !== 1 ? "s" : ""}</Text>
              <View style={styles.overviewMiniRow}>
                <View style={styles.overviewMiniItem}>
                  <Text style={styles.overviewMiniValue}>{stats.averageBasket.toLocaleString()}</Text>
                  <Text style={styles.overviewMiniLabel}>Panier moyen</Text>
                </View>
                <View style={styles.overviewMiniDivider} />
                <View style={styles.overviewMiniItem}>
                  <Text style={styles.overviewMiniValue}>{stats.activeOrders}</Text>
                  <Text style={styles.overviewMiniLabel}>Actives</Text>
                </View>
                <View style={styles.overviewMiniDivider} />
                <View style={styles.overviewMiniItem}>
                  <Text style={styles.overviewMiniValue}>{stats.stars ?? 0}</Text>
                  <Text style={styles.overviewMiniLabel}>Étoiles</Text>
                </View>
              </View>
            </Gradient>

            <View style={styles.statsGrid}>
              <Gradient colors={["#10B981", "#059669"]} style={styles.statCard}>
                <Feather name="shopping-bag" size={22} color="#fff" />
                <Text style={styles.statValue}>{stats.thisMonth.orders}</Text>
                <Text style={styles.statLabel}>Commandes ce mois-ci</Text>
              </Gradient>

              <Gradient colors={["#F59E0B", "#D97706"]} style={styles.statCard}>
                <Ionicons name="star" size={22} color="#fff" />
                <Text style={styles.statValue}>{stats.averageRating.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Note moyenne</Text>
              </Gradient>

              <Gradient colors={["#8B5CF6", "#6D28D9"]} style={styles.statCard}>
                <Feather name="check-circle" size={22} color="#fff" />
                <Text style={styles.statValue}>{stats.completionRate}%</Text>
                <Text style={styles.statLabel}>Taux de complétion</Text>
              </Gradient>

              <Gradient colors={["#2563EB", "#1D4ED8"]} style={styles.statCard}>
                <Feather name="activity" size={22} color="#fff" />
                <Text style={styles.statValue}>{stats.activeOrders}</Text>
                <Text style={styles.statLabel}>En cours de service</Text>
              </Gradient>

              <Gradient colors={["#DC2626", "#B91C1C"]} style={styles.statCard}>
                <Feather name="alert-triangle" size={22} color="#fff" />
                <Text style={styles.statValue}>{stats.activeInvestigations ?? 0}</Text>
                <Text style={styles.statLabel}>Enquêtes ouvertes</Text>
              </Gradient>

              <Gradient colors={["#0F766E", "#115E59"]} style={styles.statCard}>
                <Feather name="award" size={22} color="#fff" />
                <Text style={styles.statValue}>{stats.isFeatured ? "Oui" : "Bientôt"}</Text>
                <Text style={styles.statLabel}>Premier plan</Text>
              </Gradient>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Réputation et litiges</Text>
              <View style={styles.monthCard}>
                <View style={styles.monthItem}>
                  <View style={styles.monthIcon}>
                    <Feather name="star" size={18} color={Colors.light.tint} />
                  </View>
                  <View style={styles.monthInfo}>
                    <Text style={styles.monthLabel}>Étoiles cumulées</Text>
                    <Text style={styles.monthValue}>{stats.stars ?? 0}</Text>
                  </View>
                </View>
                <View style={styles.monthDivider} />
                <View style={styles.monthItem}>
                  <View style={styles.monthIcon}>
                    <Feather name="alert-circle" size={18} color="#DC2626" />
                  </View>
                  <View style={styles.monthInfo}>
                    <Text style={styles.monthLabel}>Réclamations</Text>
                    <Text style={styles.monthValue}>{stats.complaintCount ?? 0}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <View style={[styles.detailDot, { backgroundColor: stats.isFeatured ? "#0F766E" : "#D97706" }]} />
                  <Text style={styles.detailLabel}>
                    {stats.isFeatured
                      ? "Votre cuisine est déjà mise en premier plan"
                      : `${Math.max(0, (stats.featureThreshold ?? 200) - (stats.stars ?? 0))} étoiles restantes avant mise en avant`}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ce mois-ci</Text>
              <View style={styles.monthCard}>
                <View style={styles.monthItem}>
                  <View style={styles.monthIcon}>
                    <Feather name="shopping-bag" size={18} color={Colors.light.tint} />
                  </View>
                  <View style={styles.monthInfo}>
                    <Text style={styles.monthLabel}>Commandes</Text>
                    <Text style={styles.monthValue}>{stats.thisMonth.orders}</Text>
                  </View>
                </View>
                <View style={styles.monthDivider} />
                <View style={styles.monthItem}>
                  <View style={styles.monthIcon}>
                    <Feather name="dollar-sign" size={18} color="#10B981" />
                  </View>
                  <View style={styles.monthInfo}>
                    <Text style={styles.monthLabel}>Chiffre d'affaires</Text>
                    <Text style={styles.monthValue}>{stats.thisMonth.revenue.toLocaleString()} FCFA</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Livraison et avantages</Text>
              <View style={styles.monthCard}>
                <View style={styles.monthItem}>
                  <View style={styles.monthIcon}>
                    <Feather name="truck" size={18} color="#2563EB" />
                  </View>
                  <View style={styles.monthInfo}>
                    <Text style={styles.monthLabel}>CA livraison</Text>
                    <Text style={styles.monthValue}>{Number(stats.deliveryRevenue ?? 0).toLocaleString()} FCFA</Text>
                  </View>
                </View>
                <View style={styles.monthDivider} />
                <View style={styles.monthItem}>
                  <View style={styles.monthIcon}>
                    <Feather name="gift" size={18} color="#0F766E" />
                  </View>
                  <View style={styles.monthInfo}>
                    <Text style={styles.monthLabel}>Livraisons offertes</Text>
                    <Text style={styles.monthValue}>{stats.promoOrders ?? 0}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <View style={[styles.detailDot, { backgroundColor: "#8B5CF6" }]} />
                  <Text style={styles.detailLabel}>{`${stats.referralOrders ?? 0} commande(s) ont utilisé un avantage parrainage.`}</Text>
                </View>
              </View>
            </View>

            {(stats.complaintBreakdown && Object.keys(stats.complaintBreakdown).length > 0) ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Motifs signalés</Text>
                {Object.entries(stats.complaintBreakdown).map(([category, count]) => (
                  <View key={category} style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <View style={[styles.detailDot, { backgroundColor: "#DC2626" }]} />
                      <Text style={styles.detailLabel}>{category.replace(/_/g, " ")}</Text>
                    </View>
                    <View style={styles.detailPill}>
                      <Text style={styles.detailCount}>{count}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Flux des commandes</Text>
              {[
                { status: "En attente", count: stats.breakdown.pending, color: "#F39C12" },
                { status: "Acceptées", count: stats.breakdown.accepted, color: Colors.light.tint },
                { status: "En préparation", count: stats.breakdown.preparing, color: "#8B5CF6" },
                { status: "Prêtes", count: stats.breakdown.ready, color: "#059669" },
                { status: "Finalisées", count: stats.breakdown.delivered, color: "#374151" },
              ].map((item) => (
                <View key={item.status} style={styles.detailRow}>
                  <View style={styles.detailLeft}>
                    <View style={[styles.detailDot, { backgroundColor: item.color }]} />
                    <Text style={styles.detailLabel}>{item.status}</Text>
                  </View>
                  <View style={styles.detailPill}>
                    <Text style={styles.detailCount}>{item.count}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, flex: 1, textAlign: "center" },
  spacer: { width: 40 },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 18 },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  overviewCard: { borderRadius: 22, padding: 18, gap: 8 },
  overviewEyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "rgba(255,255,255,0.72)", textTransform: "uppercase" },
  overviewValue: { fontSize: 28, fontFamily: "Poppins_700Bold", color: "#fff" },
  overviewSub: { fontSize: 13, lineHeight: 19, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.86)" },
  overviewMiniRow: { marginTop: 8, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 8 },
  overviewMiniItem: { flex: 1, alignItems: "center", gap: 3 },
  overviewMiniValue: { fontSize: 16, fontFamily: "Poppins_700Bold", color: "#fff" },
  overviewMiniLabel: { fontSize: 10, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.76)", textAlign: "center" },
  overviewMiniDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.18)" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "47%", borderRadius: 16, padding: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  statValue: { fontSize: 18, fontFamily: "Poppins_700Bold", color: "#fff" },
  statLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.85)", textAlign: "center" },
  section: { gap: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  monthCard: { backgroundColor: Colors.light.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.light.cardBorder, flexDirection: "row", alignItems: "center" },
  monthItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  monthIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  monthInfo: { gap: 3 },
  monthLabel: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  monthValue: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  monthDivider: { width: 1, height: 40, backgroundColor: Colors.light.divider, marginHorizontal: 12 },
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.light.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.light.cardBorder },
  detailLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailDot: { width: 10, height: 10, borderRadius: 5 },
  detailLabel: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  detailPill: { backgroundColor: Colors.light.backgroundSecondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  detailCount: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
});