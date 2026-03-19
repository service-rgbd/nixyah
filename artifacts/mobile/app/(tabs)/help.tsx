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

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: "1",
    question: "Comment passer une commande ?",
    answer: "Accédez à l'onglet Découvrir, sélectionnez une cuisinière, parcourez son menu et ajoutez des plats à votre panier. Procédez au paiement et confirmez votre commande.",
  },
  {
    id: "2",
    question: "Quels sont les modes de paiement ?",
    answer: "Nous acceptons Wave, Mobile Money, Orange Money et les espèces. Les options disponibles dépendent de la cuisinière et de votre localisation.",
  },
  {
    id: "3",
    question: "Comment devenir cuisinière ?",
    answer: "Cliquez sur 'Rejoindre comme cuisinière' dans votre profil, remplissez votre profil avec vos spécialités, photos et disponibilités. Nous vérifierons votre profil.",
  },
  {
    id: "4",
    question: "Comment signaler une cuisinière ou une commande ?",
    answer: "Accédez au profil de la cuisinière ou à votre commande, appuyez sur les trois points et sélectionnez 'Signaler'. Décrivez le problème et envoyez le rapport.",
  },
  {
    id: "5",
    question: "Quelle est la politique d'annulation ?",
    answer: "Les commandes peuvent être annulées jusqu'à 30 minutes après la confirmation. Les commandes après cette période nécessitent une permission de la cuisinière.",
  },
  {
    id: "6",
    question: "Comment contacter le support ?",
    answer: "Utilisez le formulaire de contact ci-dessous ou envoyez un email à support@nixyah.com. Nous répondons généralement en 24 heures.",
  },
];

const CONTACT_OPTIONS = [
  { icon: "mail", label: "Email", value: "support@nixyah.com" },
  { icon: "phone", label: "Téléphone", value: "+225 XX XX XX XX" },
  { icon: "message-circle", label: "Chat en direct", value: "Disponible 24/7" },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>Aide & Support</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 20 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nous contacter</Text>
          <View style={styles.contactGrid}>
            {CONTACT_OPTIONS.map((option) => (
              <Pressable key={option.label} style={styles.contactCard}>
                <View style={styles.contactIcon}>
                  <Feather name={option.icon as any} size={22} color={Colors.light.tint} />
                </View>
                <Text style={styles.contactLabel}>{option.label}</Text>
                <Text style={styles.contactValue} numberOfLines={1}>{option.value}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Questions fréquentes</Text>
          <View style={styles.faqList}>
            {FAQ_ITEMS.map((item) => (
              <Pressable
                key={item.id}
                style={styles.faqItem}
                onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion} numberOfLines={expandedId === item.id ? undefined : 2}>{item.question}</Text>
                  <Feather
                    name={expandedId === item.id ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={Colors.light.textTertiary}
                  />
                </View>
                {expandedId === item.id && (
                  <Text style={styles.faqAnswer}>{item.answer}</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Besoin de plus d'aide ?</Text>
          <Pressable style={styles.contactFormBtn}>
            <Feather name="send" size={18} color="#fff" />
            <Text style={styles.contactFormBtnText}>Envoyer un message</Text>
          </Pressable>
        </View>
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
  section: { marginBottom: 28, gap: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  contactGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  contactCard: { flex: 1, minWidth: "45%", backgroundColor: Colors.light.card, borderRadius: 14, padding: 16, alignItems: "center", gap: 8, borderWidth: 1, borderColor: Colors.light.cardBorder },
  contactIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  contactLabel: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, textAlign: "center" },
  contactValue: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center" },
  faqList: { gap: 10 },
  faqItem: { backgroundColor: Colors.light.card, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: Colors.light.cardBorder },
  faqHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  faqQuestion: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, flex: 1, lineHeight: 20 },
  faqAnswer: { paddingHorizontal: 14, paddingBottom: 12, fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, lineHeight: 20, borderTopWidth: 1, borderTopColor: Colors.light.divider, marginTop: 4, paddingTop: 12 },
  contactFormBtn: { backgroundColor: Colors.light.tint, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  contactFormBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
});
