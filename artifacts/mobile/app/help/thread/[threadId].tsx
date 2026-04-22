import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { apiFetch } from "@/constants/api";
import { useApp } from "@/contexts/AppContext";

type SupportMessage = {
  id: string;
  threadId: string;
  senderId: string;
  isMe: boolean;
  text: string;
  createdAt: string;
};

export default function HelpThreadScreen() {
  const { threadId, title } = useLocalSearchParams<{ threadId: string; title?: string }>();
  const { token } = useApp();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 24 : insets.bottom;

  const loadMessages = useCallback(async () => {
    if (!token || !threadId) {
      setMessages([]);
      return;
    }

    try {
      const data = await apiFetch<{ messages: SupportMessage[] }>(`/support/threads/${threadId}/messages`, { token });
      setMessages(data.messages ?? []);
    } catch (error) {
      console.warn("Failed to load support messages:", error);
    }
  }, [threadId, token]);

  useFocusEffect(
    useCallback(() => {
      void loadMessages();
    }, [loadMessages]),
  );

  const sendMessage = async () => {
    if (!token || !threadId || !text.trim() || isSending) {
      return;
    }

    try {
      setIsSending(true);
      const message = await apiFetch<SupportMessage>(`/support/threads/${threadId}/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({ text: text.trim() }),
      });
      setMessages((current) => [message, ...current]);
      setText("");
    } catch (error) {
      console.warn("Failed to send support message:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{title ?? "Support commande"}</Text>
          <Text style={styles.headerSubtitle}>Conversation liée à votre commande</Text>
        </View>
      </View>

      <FlatList
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.messageRow, item.isMe && styles.messageRowMe]}>
            <View style={[styles.messageBubble, item.isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}>
              <Text style={[styles.messageText, item.isMe && styles.messageTextMe]}>{item.text}</Text>
              <Text style={[styles.messageTime, item.isMe && styles.messageTimeMe]}>
                {new Date(item.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aucun message pour l'instant</Text>
            <Text style={styles.emptyText}>Expliquez votre besoin pour que le bon interlocuteur vous réponde sur cette commande.</Text>
          </View>
        }
      />

      <View style={[styles.inputBar, { paddingBottom: bottomInset + 8 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Décrire le problème ou la question..."
          placeholderTextColor={Colors.light.textTertiary}
          multiline
          maxLength={500}
        />
        <Pressable style={[styles.sendButton, (!text.trim() || isSending) && styles.sendButtonDisabled]} onPress={() => void sendMessage()}>
          <Feather name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { backgroundColor: Colors.light.tint, paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.2)", alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, gap: 2 },
  headerTitle: { color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 16 },
  headerSubtitle: { color: "rgba(255,255,255,0.72)", fontFamily: "Poppins_400Regular", fontSize: 12 },
  listContent: { paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 },
  messageRow: { marginBottom: 10, flexDirection: "row" },
  messageRowMe: { justifyContent: "flex-end" },
  messageBubble: { maxWidth: "80%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  messageBubbleMe: { backgroundColor: Colors.light.tint, borderBottomRightRadius: 6 },
  messageBubbleThem: { backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder, borderBottomLeftRadius: 6 },
  messageText: { color: Colors.light.text, fontFamily: "Poppins_400Regular", lineHeight: 20 },
  messageTextMe: { color: "#fff" },
  messageTime: { marginTop: 4, color: Colors.light.textTertiary, fontFamily: "Poppins_400Regular", fontSize: 10, textAlign: "right" },
  messageTimeMe: { color: "rgba(255,255,255,0.72)" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 48, gap: 8 },
  emptyTitle: { color: Colors.light.text, fontFamily: "Poppins_600SemiBold", fontSize: 15 },
  emptyText: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", textAlign: "center", lineHeight: 20 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.light.divider, backgroundColor: Colors.light.background },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderRadius: 22, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1, borderColor: Colors.light.cardBorder, paddingHorizontal: 16, paddingVertical: 12, color: Colors.light.text, fontFamily: "Poppins_400Regular" },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.light.tint, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { opacity: 0.55 },
});
