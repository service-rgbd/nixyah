import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";

import Colors from "@/constants/colors";

interface ChefCardProps {
  chef: any;
  variant?: "default" | "compact" | "featured";
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
}

export function ChefCard({ chef, variant = "default", isFavorite, onFavoriteToggle }: ChefCardProps) {
  const handlePress = () => {
    router.push({ pathname: "/chef/[id]", params: { id: chef.id } });
  };

  if (variant === "compact") {
    return (
      <Pressable
        onPress={handlePress}
      >
        <View style={styles.compactCard}>
          <View style={styles.compactAvatarWrapper}>
            {chef.avatarUrl ? (
              <Image source={{ uri: chef.avatarUrl as string }} style={styles.compactAvatarImage} />
            ) : (
              <View style={[styles.compactAvatar, { backgroundColor: chef.coverColor }]}> 
                <Text style={styles.avatarInitials}>
                  {chef.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </Text>
              </View>
            )}
            {chef.isOnline && <View style={styles.onlineDot} />}
          </View>
          <Text style={styles.compactName} numberOfLines={1}>{chef.name.split(" ")[0]}</Text>
          <View style={styles.compactRating}>
            <Ionicons name="star" size={10} color="#F7C27B" />
            <Text style={styles.compactRatingText}>{chef.rating}</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  if (variant === "featured") {
    return (
      <Pressable
        onPress={handlePress}
      >
        <View style={styles.featuredCard}>
          <View style={[styles.featuredBanner, { backgroundColor: chef.coverColor }]}>
            {chef.avatarUrl ? (
              <Image source={{ uri: chef.avatarUrl as string }} style={styles.featuredAvatarImage} />
            ) : (
              <Text style={styles.featuredAvatarText}>
                {chef.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
              </Text>
            )}
            {chef.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
              </View>
            )}
            {chef.isOnline && (
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDotLarge} />
                <Text style={styles.onlineText}>En ligne</Text>
              </View>
            )}
            {onFavoriteToggle && (
              <Pressable style={styles.heartBtn} onPress={onFavoriteToggle} hitSlop={8}>
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={20}
                  color={isFavorite ? "#E74C3C" : "#fff"}
                />
              </Pressable>
            )}
          </View>
          <View style={styles.featuredContent}>
            <View style={styles.featuredRow}>
              <Text style={styles.featuredName} numberOfLines={1}>{chef.name}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={12} color="#F7C27B" />
                <Text style={styles.ratingText}>{chef.rating}</Text>
                <Text style={styles.reviewText}>({chef.reviewCount})</Text>
              </View>
            </View>
            <Text style={styles.featuredSpecialty}>{chef.specialty}</Text>
            <View style={styles.featuredMeta}>
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={11} color={Colors.light.textTertiary} />
                <Text style={styles.metaText}>{chef.location}</Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="clock" size={11} color={Colors.light.textTertiary} />
                <Text style={styles.metaText}>{chef.responseTime}</Text>
              </View>
            </View>
            <Text style={styles.priceRange}>{chef.priceRange}</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
    >
      <View style={styles.card}>
          <View style={[styles.cardBanner, { backgroundColor: chef.coverColor }]}>
          {chef.avatarUrl ? (
            <Image source={{ uri: chef.avatarUrl as string }} style={styles.cardAvatarImage} />
          ) : (
            <Text style={styles.cardAvatarText}>
              {chef.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
            </Text>
          )}
          {chef.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardName}>{chef.name}</Text>
          <Text style={styles.cardSpecialty}>{chef.specialty}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color="#F7C27B" />
            <Text style={styles.ratingText}>{chef.rating}</Text>
            <Text style={styles.reviewText}>• {chef.priceRange}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardBanner: {
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  cardAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cardAvatarText: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.9)",
  },
  cardContent: {
    padding: 10,
    gap: 2,
  },
  cardName: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  cardSpecialty: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  compactCard: {
    alignItems: "center",
    width: 72,
    gap: 4,
  },
  compactAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 22,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.9)",
  },
  compactAvatarWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  compactAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#27AE60",
    borderWidth: 2,
    borderColor: "#fff",
  },
  compactName: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
    textAlign: "center",
  },
  compactRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  compactRatingText: {
    fontSize: 10,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  featuredCard: {
    width: 240,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  featuredBanner: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  featuredAvatarText: {
    fontSize: 44,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.9)",
  },
  featuredAvatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  verifiedBadge: {
    position: "absolute",
    top: 8,
    left: 8,
  },
  onlineBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  onlineDotLarge: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#27AE60",
  },
  onlineText: {
    fontSize: 10,
    color: "#fff",
    fontFamily: "Poppins_500Medium",
  },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredContent: {
    padding: 12,
    gap: 4,
  },
  featuredRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  featuredName: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
    flex: 1,
  },
  featuredSpecialty: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  featuredMeta: {
    flexDirection: "row",
    gap: 12,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  reviewText: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  priceRange: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
    marginTop: 2,
  },
});
