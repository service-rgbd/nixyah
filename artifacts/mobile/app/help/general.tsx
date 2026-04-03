import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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

type FaqEntry = { id: string; question: string; answer: string };
type FaqSection = { id: string; title: string; icon: string; color: string; items: FaqEntry[] };

const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "account",
    title: "Mon Compte",
    icon: "user",
    color: "#D4611A",
    items: [
      { id: "acc-1", question: "Comment créer un compte ?", answer: "Téléchargez Nixyah et appuyez sur S'inscrire. Renseignez votre nom, numéro de téléphone ou e-mail et choisissez un mot de passe. Un code de vérification SMS valide votre inscription." },
      { id: "acc-2", question: "Comment modifier mes informations personnelles ?", answer: "Allez dans l'onglet Compte > Modifier le profil. Vous pouvez y changer votre nom, photo, e-mail, numéro de téléphone et adresses de livraison enregistrées." },
      { id: "acc-3", question: "J'ai oublié mon mot de passe, que faire ?", answer: "Sur l'écran de connexion, appuyez sur Mot de passe oublié. Entrez votre numéro ou e-mail et recevez un code de réinitialisation par SMS valable 10 minutes." },
      { id: "acc-4", question: "Comment supprimer mon compte ?", answer: "La suppression définitive est gérée par notre support pour contrôler les commandes et paiements en cours. Contactez-nous via Centre d'aide > Contacter le support." },
      { id: "acc-5", question: "Mon compte a été suspendu, pourquoi ?", answer: "Un compte peut être suspendu suite à une violation des CGU, un signalement ou une activité suspecte. Contactez le support pour régulariser votre situation." },
      { id: "acc-6", question: "Comment changer mon numéro de téléphone ?", answer: "Allez dans Compte > Modifier le profil > Numéro de téléphone. Un SMS de vérification est envoyé au nouveau numéro pour confirmer la modification." },
    ],
  },
  {
    id: "orders",
    title: "Commandes",
    icon: "shopping-bag",
    color: "#C24B36",
    items: [
      { id: "ord-1", question: "Comment passer une commande ?", answer: "Depuis l'accueil, choisissez Cuisinieres, Supermarché ou Boutiques. Sélectionnez vos articles, ajoutez-les au panier, choisissez votre adresse et confirmez le paiement." },
      { id: "ord-2", question: "Comment annuler une commande ?", answer: "Une commande peut être annulée gratuitement avant qu'elle ne soit acceptée par la cuisinière. Une fois la préparation commencée, l'annulation n'est plus possible." },
      { id: "ord-3", question: "Puis-je modifier ma commande après validation ?", answer: "Non, une commande validée ne peut plus être modifiée. Si vous avez fait une erreur, annulez rapidement avant acceptation et recommandez." },
      { id: "ord-4", question: "Comment suivre ma commande en temps réel ?", answer: "Dans l'onglet Commandes, appuyez sur la commande en cours. Vous verrez : En attente → Acceptée → En préparation → Livreur en route → Livré. La position du livreur s'affiche sur la carte." },
      { id: "ord-5", question: "Ma commande n'est pas arrivée, que faire ?", answer: "Si le délai estimé est largement dépassé, vérifiez l'état dans Commandes. Contactez le support depuis Centre d'aide > Aide pour une commande." },
      { id: "ord-6", question: "Ma commande est incomplète ou incorrecte ?", answer: "Allez dans Commandes > Commandes passées, sélectionnez la commande et appuyez sur Signaler un problème. Ajoutez une photo si possible pour accélérer le remboursement." },
      { id: "ord-7", question: "Comment évaluer ma commande ?", answer: "Après chaque livraison réussie, une notification vous invite à noter la cuisinière et le livreur de 1 à 5 étoiles. Les avis sont visibles sur leurs profils." },
    ],
  },
  {
    id: "payment",
    title: "Paiement",
    icon: "credit-card",
    color: "#1B8E5F",
    items: [
      { id: "pay-1", question: "Quels modes de paiement sont acceptés ?", answer: "Nixyah accepte les cartes bancaires (Visa, Mastercard), Mobile Money (Orange Money, Wave, MTN) et le paiement en espèces à la livraison selon votre zone." },
      { id: "pay-2", question: "Comment obtenir un remboursement ?", answer: "En cas de commande annulée, incorrecte ou non livrée, le remboursement est initié automatiquement sous 24 à 48 h sur votre moyen de paiement initial." },
      { id: "pay-3", question: "Ma transaction a échoué, que faire ?", answer: "Vérifiez que votre carte ou compte Mobile Money est valide et approvisionné. En cas d'échec persistant, essayez un autre mode de paiement. Si le montant a été débité sans commande confirmée, contactez le support en urgence." },
      { id: "pay-4", question: "Où trouver mes factures et reçus ?", answer: "Chaque commande livrée génère un reçu accessible via Commandes > Commandes passées > Voir la facture. Vous pouvez le télécharger ou le partager directement." },
      { id: "pay-5", question: "Mes informations bancaires sont-elles sécurisées ?", answer: "Nixyah ne stocke jamais vos données bancaires. Les paiements sont traités par des prestataires certifiés PCI-DSS. Toutes les transactions sont chiffrées (TLS)." },
      { id: "pay-6", question: "Comment saisir un code promo ?", answer: "Lors de la validation du panier, appuyez sur Ajouter un code promo. Entrez votre code et appuyez sur Appliquer. La réduction s'affiche immédiatement sur le total." },
    ],
  },
  {
    id: "delivery",
    title: "Livraison",
    icon: "truck",
    color: "#5B5BD6",
    items: [
      { id: "liv-1", question: "Comment estimer le temps de livraison ?", answer: "Le délai estimé s'affiche avant validation. Il tient compte du temps de préparation et de la distance. En général 25 à 50 minutes selon la zone." },
      { id: "liv-2", question: "Pourquoi ma livraison prend du retard ?", answer: "Le retard peut venir de la préparation en cuisine, de la circulation ou de la recherche d'un livreur disponible. Vous serez notifié en cas de retard significatif." },
      { id: "liv-3", question: "Comment changer mon adresse de livraison ?", answer: "Avant de valider votre commande, appuyez sur l'adresse affichée pour la modifier. Gérez vos adresses enregistrées dans Compte > Mes adresses." },
      { id: "liv-4", question: "Le livreur ne trouve pas mon adresse ?", answer: "Votre livreur peut vous appeler ou vous écrire via la messagerie intégrée. Vous pouvez aussi lui envoyer un point de repère depuis la carte dans l'écran de suivi." },
      { id: "liv-5", question: "Je suis absent lors de la livraison, que faire ?", answer: "Le livreur vous contactera par téléphone ou messagerie. Si vous ne répondez pas dans le délai imparti, la commande sera marquée non livrée et un remboursement partiel sera traité." },
      { id: "liv-6", question: "Comment évaluer mon livreur ?", answer: "Après chaque livraison réussie, une notification vous invite à noter votre livreur de 1 à 5 étoiles et laisser un commentaire." },
    ],
  },
  {
    id: "cuisinieres",
    title: "Cuisinieres",
    icon: "feather",
    color: "#D4611A",
    items: [
      { id: "cui-1", question: "Comment fonctionne le service Cuisinieres ?", answer: "Des cuisinières certifiées préparent des plats maison à la demande. Parcourez les profils, consultez les menus, passez commande et un livreur vous apporte votre plat frais." },
      { id: "cui-2", question: "Les plats sont-ils préparés à la commande ?", answer: "Oui. Chaque plat est préparé à la commande, sans stocks ni plats réchauffés. Les ingrédients sont sourcés localement et renouvelés quotidiennement." },
      { id: "cui-3", question: "Comment contacter directement ma cuisinière ?", answer: "Depuis votre commande en cours ou le profil de la cuisinière, appuyez sur l'icône message pour ouvrir le chat. Vous pouvez y indiquer des préférences culinaires." },
      { id: "cui-4", question: "Comment devenir cuisinière partenaire ?", answer: "Créez un compte et choisissez le type Chef/Cuisinière lors de l'inscription. Complétez votre profil, ajoutez vos plats avec photos et prix. Le dossier est examiné sous 48 h." },
      { id: "cui-5", question: "Comment évaluer une cuisinière ?", answer: "Après chaque commande livrée, notez la cuisinière de 1 à 5 étoiles et déposez un avis public visible sur son profil." },
      { id: "cui-6", question: "Puis-je indiquer des allergies ou préférences ?", answer: "Oui. Dans le chat avec la cuisinière (accessible depuis la commande), précisez vos restrictions alimentaires avant la préparation. Elle confirmera la prise en compte." },
    ],
  },
  {
    id: "courses",
    title: "Courses & Livraison express",
    icon: "zap",
    color: "#C24B36",
    items: [
      { id: "cou-1", question: "Comment fonctionne le service Courses ?", answer: "Le service Courses permet de faire livrer des articles du quotidien rapidement. Un livreur se déplace à votre place pour récupérer vos articles depuis un lieu de votre choix." },
      { id: "cou-2", question: "Quelle est la zone de livraison ?", answer: "La zone couvre les principales communes d'Abidjan. Les zones disponibles s'affichent automatiquement en fonction de votre position lors de la sélection du service." },
      { id: "cou-3", question: "Y a-t-il un montant minimum de commande ?", answer: "Non, il n'y a pas de minimum. Les frais de livraison sont fixes ou calculés selon la distance et s'affichent avant votre confirmation." },
      { id: "cou-4", question: "Puis-je ajouter des instructions au livreur ?", answer: "Oui. Lors de la saisie de votre demande dans le service Courses, un champ Remarques vous permet de préciser l'adresse exacte, le nom du vendeur ou toute instruction spécifique." },
    ],
  },
  {
    id: "supermarche",
    title: "Supermarché",
    icon: "shopping-cart",
    color: "#1B8E5F",
    items: [
      { id: "sup-1", question: "Comment commander depuis le supermarché ?", answer: "Appuyez sur Supermarché depuis l'accueil. Parcourez les rayons (épicerie, boissons, frais…), ajoutez vos articles au panier et confirmez. Un livreur partenaire récupère et livre." },
      { id: "sup-2", question: "Les stocks sont-ils mis à jour en temps réel ?", answer: "Les disponibilités sont synchronisées régulièrement. Si un article est indisponible après validation, vous en êtes informé et remboursé automatiquement pour cet article." },
      { id: "sup-3", question: "Puis-je retourner un produit endommagé ?", answer: "Signalez le produit endommagé dans Commandes > Signaler un problème dans les 2 h suivant la livraison. Un remboursement ou remplacement sera organisé." },
      { id: "sup-4", question: "Puis-je commander depuis plusieurs supermarchés à la fois ?", answer: "Non, une commande est associée à un seul partenaire à la fois. Vous pouvez passer plusieurs commandes séparées depuis différents partenaires." },
    ],
  },
  {
    id: "boutiques",
    title: "Boutiques",
    icon: "tag",
    color: "#8B5E3C",
    items: [
      { id: "bou-1", question: "Quels types de produits sont disponibles ?", answer: "Les boutiques partenaires proposent des vêtements, accessoires, cosmétiques, produits artisanaux et cadeaux. Chaque boutique a son catalogue consultable depuis son profil." },
      { id: "bou-2", question: "Comment passer commande dans une boutique ?", answer: "Appuyez sur Boutiques depuis l'accueil, choisissez votre boutique, sélectionnez vos articles, ajoutez-les au panier et confirmez. La livraison est assurée par nos livreurs partenaires." },
      { id: "bou-3", question: "Puis-je échanger ou retourner un article ?", answer: "Les politiques de retour varient selon les boutiques. Consultez la page de la boutique pour leurs conditions. Notre support peut intervenir en médiateur en cas de litige." },
      { id: "bou-4", question: "Les articles sont-ils disponibles en plusieurs tailles ?", answer: "Cela dépend de chaque boutique. Les options de taille, couleur ou quantité disponibles sont indiquées sur la fiche produit au moment de la sélection." },
    ],
  },
  {
    id: "stories",
    title: "Stories & Promotions",
    icon: "star",
    color: "#B044A0",
    items: [
      { id: "sto-1", question: "Comment accéder aux stories du moment ?", answer: "Appuyez sur l'onglet Stories dans la barre de navigation. Les stories sont classées par nouveautés, cuisinieres du moment et offres spéciales." },
      { id: "sto-2", question: "Comment profiter des promotions ?", answer: "Les offres s'affichent dans l'onglet Stories et dans Ceci est pour vous à l'accueil. Certaines promotions sont appliquées automatiquement au panier, d'autres via un code promo." },
      { id: "sto-3", question: "Comment partager une story ?", answer: "Dans une story, appuyez sur l'icône Partager. Vous pouvez partager vers vos contacts, réseaux sociaux ou copier le lien direct." },
      { id: "sto-4", question: "Comment créer une story (cuisinière) ?", answer: "Depuis votre tableau de bord Cuisinière, appuyez sur Nouvelle story, ajoutez une photo ou vidéo de votre plat du jour, un texte et une durée d'affichage." },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: "bell",
    color: "#E6A817",
    items: [
      { id: "not-1", question: "Quels types de notifications puis-je recevoir ?", answer: "Confirmation de commande, mise à jour de statut (en préparation, livreur en route, livré), messages de cuisinières, offres personnalisées et alertes de sécurité." },
      { id: "not-2", question: "Comment activer ou désactiver les notifications ?", answer: "Allez dans Compte > Paramètres > Notifications. Vous pouvez activer/désactiver chaque type indépendamment. Les alertes de sécurité ne peuvent pas être désactivées." },
      { id: "not-3", question: "Je ne reçois plus de notifications, pourquoi ?", answer: "Vérifiez que les notifications sont autorisées dans les réglages de votre téléphone (Réglages > Notifications > Nixyah) et activées dans l'app. Redémarrez l'app si le problème persiste." },
    ],
  },
  {
    id: "security",
    title: "Sécurité & Confidentialité",
    icon: "shield",
    color: "#4A90E2",
    items: [
      { id: "sec-1", question: "Comment protéger mon compte ?", answer: "Utilisez un mot de passe fort et unique. Activez la vérification à deux facteurs dans Compte > Sécurité. Ne partagez jamais votre mot de passe ou code SMS." },
      { id: "sec-2", question: "Comment gérer mes données personnelles ?", answer: "Vous pouvez consulter, exporter ou demander la suppression de vos données depuis Compte > Confidentialité. Nixyah respecte les réglementations locales de protection des données." },
      { id: "sec-3", question: "Comment signaler un comportement inapproprié ?", answer: "Sur le profil concerné, appuyez sur les trois points (•••) et sélectionnez Signaler. L'équipe de modération examine chaque signalement sous 24 h." },
      { id: "sec-4", question: "Mon compte a été piraté, que faire ?", answer: "Changez immédiatement votre mot de passe depuis Compte > Sécurité. Si vous ne pouvez plus vous connecter, utilisez Mot de passe oublié puis contactez le support en urgence." },
      { id: "sec-5", question: "Les livraisons sont-elles sécurisées ?", answer: "Tous nos livreurs sont vérifiés et notés par la communauté. Vous pouvez voir leur photo, nom et évaluation depuis l'écran de suivi avant de leur ouvrir votre porte." },
    ],
  },
];

const TOTAL_QUESTIONS = FAQ_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);

export default function GeneralHelpScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const params = useLocalSearchParams<{ section?: string }>();
  const sectionParam = Array.isArray(params.section) ? params.section[0] : params.section;

  const [expandedSection, setExpandedSection] = useState<string | null>(sectionParam ?? null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
    setExpandedItemId(null);
  };

  const activeTitle = sectionParam
    ? (FAQ_SECTIONS.find((s) => s.id === sectionParam)?.title ?? "Toutes les questions")
    : "Toutes les questions";

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{activeTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>{TOTAL_QUESTIONS} questions répertoriées dans {FAQ_SECTIONS.length} catégories</Text>

        {FAQ_SECTIONS.map((section) => (
          <View key={section.id} style={styles.sectionCard}>
            {/* Section header */}
            <Pressable style={styles.sectionHeader} onPress={() => toggleSection(section.id)}>
              <View style={[styles.sectionIconWrap, { backgroundColor: `${section.color}18` }]}>
                <Feather name={section.icon as any} size={18} color={section.color} />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionCount}>
                <Text style={styles.sectionCountText}>{section.items.length}</Text>
              </View>
              <Feather
                name={expandedSection === section.id ? "chevron-up" : "chevron-down"}
                size={18}
                color={Colors.light.textSecondary}
              />
            </Pressable>

            {/* FAQ items */}
            {expandedSection === section.id && (
              <View style={styles.itemsList}>
                {section.items.map((item, idx) => (
                  <Pressable
                    key={item.id}
                    style={[styles.faqItem, idx < section.items.length - 1 && styles.faqItemBorder]}
                    onPress={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                  >
                    <View style={styles.faqRow}>
                      <Text style={styles.faqQuestion}>{item.question}</Text>
                      <Feather
                        name={expandedItemId === item.id ? "chevron-up" : "chevron-down"}
                        size={15}
                        color={Colors.light.textSecondary}
                      />
                    </View>
                    {expandedItemId === item.id && (
                      <Text style={styles.faqAnswer}>{item.answer}</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Contact CTA */}
        <Pressable style={styles.contactRow} onPress={() => router.push("/help/inbox" as any)}>
          <Feather name="message-circle" size={18} color={Colors.light.tint} />
          <Text style={styles.contactText}>Vous n'avez pas trouvé ? Contacter le support</Text>
          <Feather name="chevron-right" size={16} color={Colors.light.textSecondary} />
        </Pressable>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    backgroundColor: Colors.light.card,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontFamily: "Poppins_700Bold", fontSize: 17, color: Colors.light.text },
  headerSpacer: { width: 40 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  subtitle: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, marginBottom: 4 },
  sectionCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionTitle: { flex: 1, fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  sectionCount: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  sectionCountText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.textSecondary },
  itemsList: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
  },
  faqItem: { padding: 16, gap: 10 },
  faqItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  faqRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  faqQuestion: { flex: 1, fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, lineHeight: 21 },
  faqAnswer: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, lineHeight: 21 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginTop: 6,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  contactText: { flex: 1, fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.tint },
});
