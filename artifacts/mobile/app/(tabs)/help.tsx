import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
const HELP_OPTIONS = [
  { icon: "shopping-bag", label: "Aide pour une commande", route: "/help/order" },
  { icon: "user", label: "Non liee a une commande", route: "/help/general" },
  { icon: "mail", label: "Boite de reception", route: "/help/inbox" },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>Centre d'aide</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.lead}>Comment pouvons-nous vous aider ?</Text>
        <View style={styles.menuList}>
          {HELP_OPTIONS.map((option) => (
            <Pressable key={option.label} style={styles.menuItem} onPress={() => router.push(option.route as any)}>
              <View style={styles.menuLeft}>
                <Feather name={option.icon as any} size={20} color={Colors.light.text} />
                <Text style={styles.menuText}>{option.label}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.light.textSecondary} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.divider, backgroundColor: Colors.light.card },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text, flex: 1, textAlign: "center" },
  spacer: { width: 40 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  lead: { fontSize: 18, lineHeight: 30, fontFamily: "Poppins_700Bold", color: Colors.light.text, marginBottom: 18 },
  menuList: { backgroundColor: Colors.light.card, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.light.divider },
  menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 16, paddingLeft: 6 },
  menuText: { fontFamily: "Poppins_500Medium", color: Colors.light.text, fontSize: 15 },
});
