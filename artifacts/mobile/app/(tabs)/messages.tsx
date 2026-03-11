import { Ionicons } from "@expo/vector-icons";
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
import { Chat, useApp } from "@/contexts/AppContext";

function ChatRow({ chat }: { chat: Chat }) {
  return (
    <Pressable
      style={styles.chatRow}
      onPress={() => router.push({ pathname: "/chat/[chatId]", params: { chatId: chat.id, chefId: chat.chefId, chefName: chat.chefName, chefSpecialty: chat.chefSpecialty, coverColor: chat.coverColor } })}
    >
      <View style={[styles.chatAvatar, { backgroundColor: chat.coverColor }]}>
        <Text style={styles.chatAvatarText}>
          {chat.chefName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </Text>
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatTopRow}>
          <Text style={styles.chatName}>{chat.chefName}</Text>
          <Text style={styles.chatTime}>{chat.lastMessageTime}</Text>
        </View>
        <Text style={styles.chatSpecialty}>{chat.chefSpecialty}</Text>
        <View style={styles.chatBottom}>
          <Text style={styles.chatLastMsg} numberOfLines={1}>{chat.lastMessage}</Text>
          {chat.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{chat.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { chats } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        {chats.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{chats.reduce((a, c) => a + c.unread, 0)}</Text>
          </View>
        )}
      </View>

      {chats.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={36} color={Colors.light.tabIconDefault} />
          </View>
          <Text style={styles.emptyTitle}>Pas encore de message</Text>
          <Text style={styles.emptyDesc}>
            Discutez avec une cuisinière pour personnaliser votre commande
          </Text>
          <Pressable
            style={styles.exploreBtn}
            onPress={() => router.push("/(tabs)/search")}
          >
            <Text style={styles.exploreBtnText}>Trouver une cuisinière</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 100 }}
          showsVerticalScrollIndicator={false}
        >
          {chats.map((chat) => (
            <ChatRow key={chat.id} chat={chat} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  countBadge: {
    backgroundColor: Colors.light.badge,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  chatAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chatAvatarText: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.9)",
  },
  chatContent: { flex: 1, gap: 3 },
  chatTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatName: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  chatTime: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  chatSpecialty: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  chatBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chatLastMsg: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  unreadBadge: {
    backgroundColor: Colors.light.tint,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.textSecondary,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
    textAlign: "center",
    lineHeight: 20,
  },
  exploreBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 8,
  },
  exploreBtnText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
});
