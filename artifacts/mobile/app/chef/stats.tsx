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
    thisMonth: { orders: 0, revenue: 0 },
    reviews: 0,
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
          <View>
        <View style={styles.statsGrid}>
          <Gradient colors={[Colors.light.tint, Colors.light.tintDark]} style={styles.statCard}>
            <Feather name="shopping-bag" size={24} color="#fff" />
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Commandes au total</Text>
          </Gradient>

          <Gradient colors={["#10B981", "#059669"]} style={styles.statCard}>
            <Feather name="trending-up" size={24} color="#fff" />
            <Text style={styles.statValue}>{stats.totalRevenue.toLocaleString()}</Text>
            <Text style={styles.statLabel}>FCFA gagnés</Text>
          </Gradient>

          <Gradient colors={["#F59E0B", "#D97706"]} style={styles.statCard}>
            <Ionicons name="star" size={24} color="#fff" />
            <Text style={styles.statValue}>{stats.averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Note moyenne</Text>
          </Gradient>

          <Gradient colors={["#8B5CF6", "#6D28D9"]} style={styles.statCard}>
            <Feather name="check-circle" size={24} color="#fff" />
            <Text style={styles.statValue}>{stats.completionRate}%</Text>
            <Text style={styles.statLabel}>Taux completion</Text>
          </Gradient>
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
          <Text style={styles.sectionTitle}>Détails des commandes</Text>
          {[
            { status: "Livrées", count: 40, color: "#059669" },
            { status: "En cours", count: 2, color: "#F59E0B" },
            { status: "Annulées", count: 0, color: "#EF4444" },
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

        <Pressable style={styles.downloadBtn}>
          <Feather name="download" size={18} color="#fff" />
          <Text style={styles.downloadBtnText}>Télécharger le rapport</Text>
        </Pressable>
        </View>
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
  content: { paddingHorizontal: 20, paddingTop: 20 },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  statCard: { flex: 1, minWidth: "45%", borderRadius: 16, padding: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  statValue: { fontSize: 18, fontFamily: "Poppins_700Bold", color: "#fff" },
  statLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.85)", textAlign: "center" },
  section: { marginBottom: 20, gap: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  monthCard: { backgroundColor: Colors.light.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.light.cardBorder, flexDirection: "row", alignItems: "center" },
  monthItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  monthIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  monthInfo: { gap: 3 },
  monthLabel: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  monthValue: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  monthDivider: { width: 1, height: 40, backgroundColor: Colors.light.divider, marginHorizontal: 12 },
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.light.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.light.cardBorder, marginBottom: 8 },
  detailLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailDot: { width: 10, height: 10, borderRadius: 5 },
  detailLabel: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  detailPill: { backgroundColor: Colors.light.backgroundSecondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  detailCount: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  downloadBtn: { backgroundColor: Colors.light.tint, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 20 },
  downloadBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
});
