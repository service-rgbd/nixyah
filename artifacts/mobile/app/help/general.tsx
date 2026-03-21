import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
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

const FAQ_ITEMS = [
  {
    id: "delivery-delay",
    question: "Pourquoi ma livraison prend du retard ?",
    answer: "Le retard peut venir du temps de preparation en cuisine, de la circulation ou de l'attribution du livreur. Le suivi se met a jour en temps reel des qu'un livreur accepte la course.",
  },
  {
    id: "address-update",
    question: "Comment changer mon adresse de livraison ?",
    answer: "Ouvrez Mes adresses depuis Compte, enregistrez votre position actuelle ou saisissez votre adresse. Cette adresse sera reprise automatiquement lors de la prochaine commande.",
  },
  {
    id: "offers",
    question: "Comment profiter des offres ?",
    answer: "Les offres et stories du moment apparaissent dans l'onglet Stories et dans la section Offres de votre compte client.",
  },
  {
    id: "account",
    question: "Comment supprimer mon compte ?",
    answer: "Passez par le support pour toute suppression definitive afin que nous puissions verifier les commandes et paiements en cours avant cloture.",
  },
];

export default function GeneralHelpScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [expandedId, setExpandedId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}> 
      <View style={styles.header}>
        <Pressable style={styles.headerIconBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Support general</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>Aide non liee a une commande</Text>
        {FAQ_ITEMS.map((item) => (
          <Pressable key={item.id} style={styles.faqCard} onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}>
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <Feather name={expandedId === item.id ? "chevron-up" : "chevron-down"} size={18} color={Colors.light.textSecondary} />
            </View>
            {expandedId === item.id ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
          </Pressable>
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
  lead: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: Colors.light.text, marginBottom: 4 },
  faqCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.light.cardBorder, gap: 12 },
  faqHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  faqQuestion: { flex: 1, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, lineHeight: 22 },
  faqAnswer: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", lineHeight: 21 },
});
