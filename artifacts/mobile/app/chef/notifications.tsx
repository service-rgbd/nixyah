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

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { notifications, isLoadingNotifications, fetchNotifications, user } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchNotifications();
      }
    }, [user, fetchNotifications])
  );

  const getIcon = (type: string) => {
    switch (type) {
      case "order":
        return <Feather name="shopping-bag" size={18} color={Colors.light.tint} />;
      case "review":
        return <Ionicons name="star" size={18} color="#F59E0B" />;
      case "message":
        return <Feather name="message-circle" size={18} color={Colors.light.tint} />;
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
        <Pressable style={styles.clearBtn}>
          <Feather name="check" size={20} color={Colors.light.tint} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 20 }]} showsVerticalScrollIndicator={false}>
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
                  }
                }}
              >
                <View style={styles.notifIcon}>
                  {getIcon(notif.type)}
                </View>
                <View style={styles.notifContent}>
                  <Text style={styles.notifTitle} numberOfLines={1}>{notif.title}</Text>
                  <Text style={styles.notifMessage} numberOfLines={2}>{notif.message}</Text>
                  <Text style={styles.notifTime}>{new Date(notif.timestamp).toLocaleString('fr-FR')}</Text>
                </View>
                {!notif.isRead && <View style={styles.unreadDot} />}
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off" size={48} color={Colors.light.textTertiary} />
            <Text style={styles.emptyTitle}>Aucune notification</Text>
            <Text style={styles.emptySub}>Vous recevrez des notifications ici</Text>
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
  clearBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingTop: 12 },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  notificationList: { gap: 8 },
  notifItem: { backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.light.cardBorder, flexDirection: "row", alignItems: "center", gap: 12 },
  notifItemUnread: { backgroundColor: Colors.light.backgroundSecondary },
  notifIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  notifContent: { flex: 1, gap: 3 },
  notifTitle: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  notifMessage: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, lineHeight: 18 },
  notifTime: { fontSize: 10, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.light.tint, flexShrink: 0 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 100, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  emptySub: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
});
