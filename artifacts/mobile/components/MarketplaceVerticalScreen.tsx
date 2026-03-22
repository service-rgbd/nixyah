import { Feather, Ionicons } from "@expo/vector-icons";
import { type Href, router } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Gradient from "@/components/SafeGradient";
import Colors from "@/constants/colors";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

type MarketplaceVerticalScreenProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  primaryIcon: IoniconsName;
  secondaryIcon: IoniconsName;
  accentColor: string;
  accentSoftColor: string;
  availabilityLabel: string;
  highlights: string[];
  categories: string[];
  primaryActionLabel: string;
  primaryActionHref: Href;
  secondaryActionLabel: string;
  secondaryActionHref: Href;
};

export default function MarketplaceVerticalScreen({
  eyebrow,
  title,
  subtitle,
  description,
  primaryIcon,
  secondaryIcon,
  accentColor,
  accentSoftColor,
  availabilityLabel,
  highlights,
  categories,
  primaryActionLabel,
  primaryActionHref,
  secondaryActionLabel,
  secondaryActionHref,
}: MarketplaceVerticalScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={18} color={Colors.light.text} />
          </Pressable>
          <View style={styles.headerTextBlock}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.screenTitle}>{title}</Text>
          </View>
        </View>

        <Gradient
          colors={[accentSoftColor, Colors.light.backgroundSecondary, Colors.light.card]}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIconWrap, { backgroundColor: `${accentColor}16` }]}> 
              <Ionicons name={primaryIcon} size={28} color={accentColor} />
            </View>
            <View style={[styles.availabilityPill, { backgroundColor: `${accentColor}14` }]}> 
              <Text style={[styles.availabilityText, { color: accentColor }]}>{availabilityLabel}</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{subtitle}</Text>
          <Text style={styles.heroDescription}>{description}</Text>

          <View style={styles.heroBadgeRow}>
            <View style={[styles.heroMiniBadge, { backgroundColor: `${accentColor}12` }]}> 
              <Ionicons name={secondaryIcon} size={15} color={accentColor} />
              <Text style={[styles.heroMiniBadgeText, { color: accentColor }]}>Ouverture preparee proprement</Text>
            </View>
          </View>
        </Gradient>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Ce que cette entree va apporter</Text>
          <View style={styles.highlightList}>
            {highlights.map((highlight) => (
              <View key={highlight} style={styles.highlightRow}>
                <View style={[styles.highlightDot, { backgroundColor: accentColor }]} />
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Univers prevus</Text>
          <View style={styles.categoryWrap}>
            {categories.map((category) => (
              <View key={category} style={[styles.categoryPill, { borderColor: `${accentColor}20` }]}> 
                <Text style={styles.categoryText}>{category}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.noteCard}>
          <Feather name="info" size={16} color={accentColor} />
          <Text style={styles.noteText}>
            Cette section est preparee pour la prochaine phase produit. L'entree est deja visible dans l'accueil afin de poser une navigation claire des maintenant.
          </Text>
        </View>

        <View style={styles.actionColumn}>
          <Pressable style={[styles.primaryButton, { backgroundColor: accentColor }]} onPress={() => router.push(primaryActionHref)}>
            <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push(secondaryActionHref)}>
            <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  headerTextBlock: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  screenTitle: {
    marginTop: 4,
    fontSize: 24,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    overflow: "hidden",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  heroIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  availabilityPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  availabilityText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
  },
  heroTitle: {
    marginTop: 18,
    fontSize: 22,
    lineHeight: 30,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  heroDescription: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  heroBadgeRow: {
    marginTop: 18,
    flexDirection: "row",
  },
  heroMiniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroMiniBadgeText: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
  },
  sectionCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  highlightList: {
    gap: 12,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  highlightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
  },
  highlightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  actionColumn: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: "#FFFFFF",
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
});