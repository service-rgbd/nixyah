import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
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
import { apiFetch } from "@/constants/api";
import { useApp } from "@/contexts/AppContext";

type SupportThread = {
  id: string;
  orderId: string;
  targetRole: "chef" | "courier" | "platform";
  subject: string;
  participantLabel: string;
  lastMessage: string;
  lastMessageAt: string;
};

export default function HelpInboxScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadThreads = useCallback(async () => {
    if (!token) {
      setThreads([]);
      return;
    }

    try {
      setIsLoading(true);
      const data = await apiFetch<{ threads: SupportThread[] }>("/support/threads", { token });
      setThreads(data.threads ?? []);
    } catch (error) {
      console.warn("Failed to load support threads:", error);
      setThreads([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadThreads();
    }, [loadThreads]),
  );

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable style={styles.headerIconBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Boite de reception</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>Support lié aux commandes</Text>
            <Text style={styles.summaryText}>Retrouvez ici vos échanges avec la cuisinière ou le livreur selon la commande.</Text>
          </View>
          <Pressable style={styles.summaryButton} onPress={() => router.push("/help/order")}>
            <Text style={styles.summaryButtonText}>Nouvelle aide</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.light.tint} />
          </View>
        ) : threads.length > 0 ? (
          threads.map((thread) => (
            <Pressable
              key={thread.id}
              style={styles.messageCard}
              onPress={() => router.push({ pathname: "/help/thread/[threadId]", params: { threadId: thread.id, title: thread.participantLabel } })}
            >
              <View style={styles.messageHeader}>
                <Text style={styles.messageTitle}>{thread.participantLabel}</Text>
                <Text style={styles.messageTime}>{new Date(thread.lastMessageAt).toLocaleDateString("fr-FR")}</Text>
              </View>
              <Text style={styles.messageMeta}>{thread.subject}</Text>
              <Text style={styles.messagePreview}>{thread.lastMessage || "Conversation ouverte"}</Text>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucune conversation</Text>
            <Text style={styles.emptyText}>Ouvrez une aide depuis une commande pour démarrer un échange utile avec la bonne personne.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.divider, backgroundColor: Colors.light.card },
  headerIconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontFamily: "Poppins_700Bold", fontSize: 17, color: Colors.light.text },
  headerSpacer: { width: 32 },
  content: { padding: 16, gap: 12 },
  summaryCard: { backgroundColor: Colors.light.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 16, gap: 14 },
  summaryCopy: { gap: 6 },
  summaryTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: Colors.light.text },
  summaryText: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", lineHeight: 20 },
  summaryButton: { alignSelf: "flex-start", backgroundColor: Colors.light.tint, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  summaryButtonText: { color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  loadingWrap: { paddingVertical: 32, alignItems: "center" },
  messageCard: { paddingVertical: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  messageHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  messageTitle: { flex: 1, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  messageMeta: { fontFamily: "Poppins_500Medium", color: Colors.light.tint, fontSize: 12 },
  messageTime: { fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, fontSize: 12 },
  messagePreview: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", lineHeight: 20 },
  emptyCard: { paddingVertical: 18, gap: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.light.divider },
  emptyTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: Colors.light.text },
  emptyText: { fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, lineHeight: 20 },
});
