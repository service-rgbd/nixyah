import { Feather } from "@expo/vector-icons";
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

const MESSAGES = [
  {
    id: "1",
    title: "Bienvenue sur le support Nixyah",
    preview: "Utilisez cette boite pour retrouver vos echanges avec l'assistance.",
    timestamp: "Aujourd'hui",
  },
];

export default function HelpInboxScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

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
        {MESSAGES.map((message) => (
          <View key={message.id} style={styles.messageCard}>
            <View style={styles.messageHeader}>
              <Text style={styles.messageTitle}>{message.title}</Text>
              <Text style={styles.messageTime}>{message.timestamp}</Text>
            </View>
            <Text style={styles.messagePreview}>{message.preview}</Text>
          </View>
        ))}
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
  messageCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.light.cardBorder, gap: 8 },
  messageHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  messageTitle: { flex: 1, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  messageTime: { fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, fontSize: 12 },
  messagePreview: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", lineHeight: 20 },
});
