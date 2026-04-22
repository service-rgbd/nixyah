import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React from "react";
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

export default function NotificationsCenterScreen() {
  const insets = useSafeAreaInsets();
  const { notifications, isLoadingNotifications, fetchNotifications, user } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        void fetchNotifications();
      }
    }, [fetchNotifications, user]),
  );

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const getIcon = (type: string) => {
    switch (type) {
      case "order":
        return <Feather name="shopping-bag" size={18} color={Colors.light.tint} />;
      case "review":
        return <Ionicons name="star" size={18} color="#F59E0B" />;
      case "message":
        return <Feather name="message-circle" size={18} color={Colors.light.tint} />;
      case "payment":
        return <Feather name="credit-card" size={18} color="#059669" />;
      default:
        return <Feather name="bell" size={18} color={Colors.light.textTertiary} />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.clearBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 20 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryEyebrow}>Centre d'alertes</Text>
            <Text style={styles.summaryTitle}>{unreadCount} notification{unreadCount !== 1 ? "s" : ""} à surveiller</Text>
          </View>
          <Pressable
            style={styles.summaryCta}
            onPress={() => router.push(user?.type === "chef" || user?.type === "courier" ? "/(tabs)/orders" : "/(tabs)/orders")}
          >
            <Text style={styles.summaryCtaText}>Voir le suivi</Text>
          </Pressable>
        </View>

        {isLoadingNotifications ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
          </View>
        ) : notifications.length > 0 ? (
          <View style={styles.notificationList}>
            {notifications.map((notif) => (
              <Pressable
                key={notif.id}
                style={[styles.notifItem, !notif.isRead && styles.notifItemUnread]}
                onPress={() => {
                  if (notif.deliveryJobId) {
                    router.push({ pathname: "/delivery/job/[id]", params: { id: notif.deliveryJobId } });
                    return;
                  }
                  if (notif.orderId) {
                    router.push("/(tabs)/orders");
                    return;
                  }
                  router.push("/(tabs)/stories");
                }}
              >
                <View style={styles.notifIcon}>{getIcon(notif.type)}</View>
                <View style={styles.notifContent}>
                  <View style={styles.titleRow}>
                    <Text style={styles.notifTitle} numberOfLines={1}>{notif.title}</Text>
                    {!notif.isRead && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notifMessage} numberOfLines={3}>{notif.message}</Text>
                  <Text style={styles.notifTime}>{new Date(notif.timestamp).toLocaleString("fr-FR")}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off" size={48} color={Colors.light.textTertiary} />
            <Text style={styles.emptyTitle}>Aucune notification</Text>
            <Text style={styles.emptySub}>Vos publications suivies, commandes et messages importants apparaîtront ici.</Text>
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
  clearBtn: { width: 40, height: 40 },
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  summaryCard: { backgroundColor: Colors.light.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  summaryEyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint, textTransform: "uppercase" },
  summaryTitle: { marginTop: 4, fontSize: 15, lineHeight: 21, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  summaryCta: { backgroundColor: Colors.light.backgroundSecondary, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.light.cardBorder },
  summaryCtaText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  notificationList: { gap: 10 },
  notifItem: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.light.cardBorder, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  notifItemUnread: { backgroundColor: Colors.light.backgroundSecondary },
  notifIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  notifContent: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  notifTitle: { flex: 1, fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  notifMessage: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, lineHeight: 18 },
  notifTime: { fontSize: 10, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.light.tint, flexShrink: 0 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 100, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  emptySub: { fontSize: 13, lineHeight: 19, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center" },
});
