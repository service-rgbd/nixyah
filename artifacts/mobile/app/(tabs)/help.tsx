import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  { id: "account",     title: "Mon Compte",      icon: "account",     color: "#D4611A", bg: "#FFF0E6" },
  { id: "orders",      title: "Commandes",       icon: "orders",      color: "#C24B36", bg: "#FFF0E9" },
  { id: "payment",     title: "Paiement",        icon: "payment",     color: "#1B8E5F", bg: "#E7F8F1" },
  { id: "delivery",    title: "Livraison",       icon: "delivery",    color: "#5B5BD6", bg: "#EEEEFF" },
  { id: "cuisinieres", title: "Cuisinieres",     icon: "chef",        color: "#D4611A", bg: "#FFF3E6" },
  { id: "courses",     title: "Courses",         icon: "flash",       color: "#C24B36", bg: "#FFF5F0" },
  { id: "supermarche", title: "Supermarché",     icon: "cart",        color: "#1B8E5F", bg: "#E7F8F1" },
  { id: "boutiques",   title: "Boutiques",       icon: "boutique",    color: "#8B5E3C", bg: "#F5EDE4" },
  { id: "stories",     title: "Promos & Stories",icon: "stories",     color: "#B044A0", bg: "#F8E8F6" },
  { id: "security",    title: "Sécurité",        icon: "security",    color: "#4A90E2", bg: "#E8F2FF" },
] as const;

function renderHelpGlyph(icon: (typeof CATEGORIES)[number]["icon"], color: string, size = 20) {
  switch (icon) {
    case "account":
      return <MaterialCommunityIcons name="account-circle-outline" size={size + 1} color={color} />;
    case "orders":
      return <MaterialCommunityIcons name="clipboard-text-clock-outline" size={size} color={color} />;
    case "payment":
      return <MaterialCommunityIcons name="credit-card-check-outline" size={size} color={color} />;
    case "delivery":
      return <MaterialCommunityIcons name="truck-fast-outline" size={size} color={color} />;
    case "chef":
      return <MaterialCommunityIcons name="chef-hat" size={size} color={color} />;
    case "flash":
      return <Ionicons name="flash-outline" size={size - 1} color={color} />;
    case "cart":
      return <MaterialCommunityIcons name="cart-variant" size={size} color={color} />;
    case "boutique":
      return <MaterialCommunityIcons name="shopping-outline" size={size} color={color} />;
    case "stories":
      return <MaterialCommunityIcons name="motion-play-outline" size={size} color={color} />;
    case "security":
      return <MaterialCommunityIcons name="shield-check-outline" size={size} color={color} />;
  }
}

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
            <MaterialCommunityIcons name="clipboard-list-outline" size={22} color={Colors.light.tint} />
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
                <View style={[styles.tileIconInner, { shadowColor: cat.color }]}> 
                  {renderHelpGlyph(cat.icon, cat.color, 20)}
                </View>
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
                <View style={styles.faqBulletWrap}>
                  <Ionicons name="sparkles-outline" size={13} color={Colors.light.tint} />
                </View>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Ionicons
                  name={expandedId === item.id ? "chevron-up-circle" : "chevron-down-circle"}
                  size={18}
                  color={Colors.light.textTertiary}
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(104,83,69,0.10)",
  },
  orderCtaIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  orderCtaBody: { flex: 1, gap: 2 },
  orderCtaTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  orderCtaSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  sectionLabel: { paddingHorizontal: 20, marginBottom: 12, fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  grid: { paddingHorizontal: 20, gap: 0, marginBottom: 28 },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tileIconInner: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  tileTitle: { flex: 1, fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, lineHeight: 17 },
  faqBlock: {
    marginHorizontal: 20,
    marginBottom: 28,
    overflow: "hidden",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.divider,
  },
  faqItem: { padding: 16, gap: 8 },
  faqItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  faqRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  faqBulletWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,97,26,0.1)",
    marginTop: 1,
  },
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
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.divider,
  },
  contactIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  contactTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.light.text, textAlign: "center" },
  contactSub: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center" },
  contactBtn: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 14, backgroundColor: Colors.light.tint, borderRadius: 999 },
  contactBtnText: { fontSize: 15, fontFamily: "Poppins_700Bold", color: "#FFFFFF" },
});
