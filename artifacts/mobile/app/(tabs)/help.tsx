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

const CATEGORIES = [
  { id: "account",     title: "Mon Compte",      icon: "user",          color: "#D4611A", bg: "#FFF0E6" },
  { id: "orders",      title: "Commandes",        icon: "shopping-bag",  color: "#C24B36", bg: "#FFF0E9" },
  { id: "payment",     title: "Paiement",         icon: "credit-card",   color: "#1B8E5F", bg: "#E7F8F1" },
  { id: "delivery",    title: "Livraison",        icon: "truck",         color: "#5B5BD6", bg: "#EEEEFF" },
  { id: "cuisinieres", title: "Cuisinieres",      icon: "feather",       color: "#D4611A", bg: "#FFF3E6" },
  { id: "courses",     title: "Courses",          icon: "zap",           color: "#C24B36", bg: "#FFF5F0" },
  { id: "supermarche", title: "Supermarché",      icon: "shopping-cart", color: "#1B8E5F", bg: "#E7F8F1" },
  { id: "boutiques",   title: "Boutiques",        icon: "tag",           color: "#8B5E3C", bg: "#F5EDE4" },
  { id: "stories",     title: "Promos & Stories", icon: "star",          color: "#B044A0", bg: "#F8E8F6" },
  { id: "security",    title: "Sécurité",         icon: "shield",        color: "#4A90E2", bg: "#E8F2FF" },
] as const;

const POPULAR_QA = [
  {
    id: "p1",
    question: "Comment annuler une commande ?",
    answer: "Une commande peut être annulée gratuitement avant qu'elle ne soit acceptée par la cuisinière. Une fois la préparation commencée, l'annulation n'est plus possible.",
  },
  {
    id: "p2",
    question: "Comment obtenir un remboursement ?",
    answer: "En cas de commande annulée, incorrecte ou non livrée, le remboursement est initié automatiquement sous 24 à 48 h sur votre moyen de paiement initial.",
  },
  {
    id: "p3",
    question: "Comment suivre ma commande en temps réel ?",
    answer: "Dans l'onglet Commandes, appuyez sur la commande en cours pour voir la position du livreur sur la carte et les étapes de progression.",
  },
  {
    id: "p4",
    question: "Comment contacter ma cuisinière ?",
    answer: "Depuis votre commande en cours ou le profil de la cuisinière, appuyez sur l'icône message pour ouvrir le chat directement.",
  },
  {
    id: "p5",
    question: "Ma commande est incomplète ou incorrecte ?",
    answer: "Allez dans Commandes > Commandes passées, sélectionnez la commande et appuyez sur Signaler un problème pour déclencher un remboursement.",
  },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Centre d'aide</Text>
        <Pressable style={styles.inboxBtn} onPress={() => router.push("/help/inbox" as any)}>
          <Feather name="inbox" size={20} color={Colors.light.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Comment pouvons-nous{"\n"}vous aider ?</Text>
          <Text style={styles.heroSub}>Trouvez rapidement une réponse à votre question</Text>
        </View>

        {/* Commande rapide */}
        <Pressable style={styles.orderCta} onPress={() => router.push("/help/order" as any)}>
          <View style={styles.orderCtaIcon}>
            <Feather name="shopping-bag" size={22} color={Colors.light.tint} />
          </View>
          <View style={styles.orderCtaBody}>
            <Text style={styles.orderCtaTitle}>Aide pour une commande</Text>
            <Text style={styles.orderCtaSub}>Suivre, signaler ou annuler une commande en cours</Text>
          </View>
          <Feather name="chevron-right" size={18} color={Colors.light.textSecondary} />
        </Pressable>

        {/* Catégories */}
        <Text style={styles.sectionLabel}>Parcourir par thème</Text>
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.id}
              style={styles.tile}
              onPress={() => router.push({ pathname: "/help/general", params: { section: cat.id } } as any)}
            >
              <View style={[styles.tileIcon, { backgroundColor: cat.bg }]}>
                <Feather name={cat.icon as any} size={20} color={cat.color} />
              </View>
              <Text style={styles.tileTitle} numberOfLines={2}>{cat.title}</Text>
            </Pressable>
          ))}
        </View>

        {/* Questions fréquentes */}
        <Text style={styles.sectionLabel}>Questions fréquentes</Text>
        <View style={styles.faqBlock}>
          {POPULAR_QA.map((item, index) => (
            <Pressable
              key={item.id}
              style={[styles.faqItem, index < POPULAR_QA.length - 1 && styles.faqItemBorder]}
              onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <View style={styles.faqRow}>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Feather
                  name={expandedId === item.id ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={Colors.light.textSecondary}
                />
              </View>
              {expandedId === item.id && <Text style={styles.faqAnswer}>{item.answer}</Text>}
            </Pressable>
          ))}
          <Pressable style={styles.allBtn} onPress={() => router.push("/help/general" as any)}>
            <Text style={styles.allBtnText}>Voir toutes les questions</Text>
            <Feather name="arrow-right" size={14} color={Colors.light.tint} />
          </Pressable>
        </View>

        {/* Contact CTA */}
        <View style={styles.contactCard}>
          <View style={styles.contactIconWrap}>
            <Feather name="message-circle" size={26} color={Colors.light.tint} />
          </View>
          <Text style={styles.contactTitle}>Vous n'avez pas trouvé ?</Text>
          <Text style={styles.contactSub}>Notre équipe est disponible 7j/7 pour vous répondre.</Text>
          <Pressable style={styles.contactBtn} onPress={() => router.push("/help/inbox" as any)}>
            <Text style={styles.contactBtnText}>Contacter le support</Text>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    backgroundColor: Colors.light.card,
  },
  headerSpacer: { width: 40 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  inboxBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: 48 },
  hero: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  heroTitle: { fontSize: 24, fontFamily: "Poppins_700Bold", color: Colors.light.text, lineHeight: 32, marginBottom: 6 },
  heroSub: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  orderCta: {
    marginHorizontal: 20,
    marginBottom: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  orderCtaIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  orderCtaBody: { flex: 1, gap: 2 },
  orderCtaTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  orderCtaSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  sectionLabel: { paddingHorizontal: 20, marginBottom: 12, fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10, marginBottom: 28 },
  tile: {
    width: "46%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tileTitle: { flex: 1, fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, lineHeight: 17 },
  faqBlock: {
    marginHorizontal: 20,
    marginBottom: 28,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    overflow: "hidden",
  },
  faqItem: { padding: 16, gap: 8 },
  faqItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  faqRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  faqQuestion: { flex: 1, fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, lineHeight: 21 },
  faqAnswer: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, lineHeight: 20 },
  allBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
  },
  allBtnText: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  contactCard: {
    marginHorizontal: 20,
    padding: 24,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 20,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  contactIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  contactTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.text, textAlign: "center" },
  contactSub: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center" },
  contactBtn: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 14, backgroundColor: Colors.light.tint, borderRadius: 14 },
  contactBtnText: { fontSize: 15, fontFamily: "Poppins_700Bold", color: "#FFFFFF" },
});
