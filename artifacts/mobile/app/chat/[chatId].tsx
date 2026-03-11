import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
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
import { ChatMessage, useApp } from "@/contexts/AppContext";

const QUICK_REPLIES = [
  "Bonjour !",
  "Quand êtes-vous disponible ?",
  "Quel est le délai de préparation ?",
  "Livrez-vous ?",
];

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <View style={[styles.bubbleRow, message.isMe && styles.bubbleRowMe]}>
      {!message.isMe && (
        <View style={styles.chefDot} />
      )}
      <View style={[styles.bubble, message.isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, message.isMe && styles.bubbleTextMe]}>
          {message.text}
        </Text>
        <Text style={[styles.bubbleTime, message.isMe && styles.bubbleTimeMe]}>
          {message.timestamp}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { chatId, chefId, chefName, chefSpecialty, coverColor } = useLocalSearchParams<{
    chatId: string;
    chefId: string;
    chefName: string;
    chefSpecialty: string;
    coverColor: string;
  }>();
  const insets = useSafeAreaInsets();
  const { chats, sendMessage } = useApp();
  const [text, setText] = useState("");
  const flatRef = useRef<FlatList>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const chat = chats.find((c) => c.id === chatId);
  const messages: ChatMessage[] = chat?.messages ?? [];

  const handleSend = useCallback(() => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(chatId ?? "", chefId ?? "", text.trim(), chefName ?? "", chefSpecialty ?? "", coverColor ?? "#C4522A");
    setText("");
  }, [text, chatId, chefId, chefName, chefSpecialty, coverColor, sendMessage]);

  const handleQuickReply = (reply: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(chatId ?? "", chefId ?? "", reply, chefName ?? "", chefSpecialty ?? "", coverColor ?? "#C4522A");
  };

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <MessageBubble message={item} />,
    []
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const bgColor = coverColor ?? "#C4522A";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: topInset + 8, backgroundColor: bgColor }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={styles.chefInfo}>
          <View style={[styles.chefAvatar, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
            <Text style={styles.chefAvatarText}>
              {(chefName ?? "??").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
            </Text>
          </View>
          <View>
            <Text style={styles.chefName}>{chefName}</Text>
            <Text style={styles.chefSub}>{chefSpecialty}</Text>
          </View>
        </View>
        <Pressable
          style={styles.orderShortcut}
          onPress={() => router.push({ pathname: "/order/[chefId]", params: { chefId: chefId ?? "" } })}
        >
          <Text style={styles.orderShortcutText}>Commander</Text>
        </Pressable>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyChat}>
          <View style={[styles.emptyChatAvatar, { backgroundColor: bgColor }]}>
            <Text style={styles.emptyChatAvatarText}>
              {(chefName ?? "??").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
            </Text>
          </View>
          <Text style={styles.emptyChatTitle}>{chefName}</Text>
          <Text style={styles.emptyChatDesc}>
            Démarrez la conversation pour personnaliser votre commande
          </Text>
          <View style={styles.quickReplies}>
            {QUICK_REPLIES.map((r) => (
              <Pressable key={r} style={styles.quickReply} onPress={() => handleQuickReply(r)}>
                <Text style={styles.quickReplyText}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatRef}
            data={[...messages].reverse()}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            inverted
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              messages.length > 0 ? (
                <View style={styles.quickRepliesInline}>
                  {QUICK_REPLIES.map((r) => (
                    <Pressable key={r} style={styles.quickReply} onPress={() => handleQuickReply(r)}>
                      <Text style={styles.quickReplyText}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null
            }
          />
        </>
      )}

      <View style={[styles.inputBar, { paddingBottom: bottomInset + 8 }]}>
        <View style={styles.inputWrapper}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Écrire un message..."
            placeholderTextColor={Colors.light.textTertiary}
            style={styles.input}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
        </View>
        <Pressable
          style={[styles.sendBtn, { backgroundColor: text.trim() ? bgColor : Colors.light.backgroundTertiary }]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Feather name="send" size={18} color={text.trim() ? "#fff" : Colors.light.tabIconDefault} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.2)", alignItems: "center", justifyContent: "center",
  },
  chefInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  chefAvatar: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
  },
  chefAvatarText: { fontSize: 14, fontFamily: "Poppins_700Bold", color: "rgba(255,255,255,0.9)" },
  chefName: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  chefSub: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.75)" },
  orderShortcut: {
    backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  orderShortcutText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  messagesList: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexGrow: 1,
  },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 10, gap: 8 },
  bubbleRowMe: { flexDirection: "row-reverse" },
  chefDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.light.tint, marginBottom: 8,
  },
  bubble: {
    maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.light.card, borderWidth: 1, borderColor: Colors.light.cardBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleMe: {
    backgroundColor: Colors.light.tint, borderColor: Colors.light.tint, borderBottomLeftRadius: 18, borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.text, lineHeight: 20 },
  bubbleTextMe: { color: "#fff" },
  bubbleTime: { fontSize: 10, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, marginTop: 4, textAlign: "right" },
  bubbleTimeMe: { color: "rgba(255,255,255,0.65)" },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyChatAvatar: {
    width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyChatAvatarText: { fontSize: 28, fontFamily: "Poppins_700Bold", color: "rgba(255,255,255,0.9)" },
  emptyChatTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  emptyChatDesc: {
    fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary,
    textAlign: "center", lineHeight: 20,
  },
  quickReplies: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 },
  quickRepliesInline: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 12,
  },
  quickReply: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary, borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  quickReplyText: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.light.divider, backgroundColor: Colors.light.background,
  },
  inputWrapper: {
    flex: 1, backgroundColor: Colors.light.backgroundSecondary, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.light.cardBorder,
    paddingHorizontal: 16, paddingVertical: 10, maxHeight: 120,
  },
  input: {
    fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.text, padding: 0,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
  },
});
