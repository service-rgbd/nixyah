import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";

interface ChefCardProps {
  chef: any;
  variant?: "default" | "compact" | "featured";
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
}

function getChefHeroImage(chef: any): string | null {
  return (
    chef.heroImageUrl ??
    chef.dishes?.find((dish: any) => dish.imageUrls?.[0])?.imageUrls?.[0] ??
    chef.dishes?.find((dish: any) => dish.imageUrl)?.imageUrl ??
    null
  );
}

export function ChefCard({
  chef,
  variant = "default",
  isFavorite,
  onFavoriteToggle,
}: ChefCardProps) {
  const handlePress = () => {
    router.push({ pathname: "/chef/[id]", params: { id: chef.id } });
  };

  const heroImage = getChefHeroImage(chef);
  const firstDish = chef.dishes?.[0] ?? null;
  const initials = chef.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2);

  if (variant === "compact") {
    return (
      <Pressable onPress={handlePress}>
        <View style={styles.compactCard}>
          <View style={styles.compactAvatarWrapper}>
            {chef.avatarUrl ? (
              <Image source={{ uri: chef.avatarUrl as string }} style={styles.compactAvatarImage} />
            ) : (
              <View style={[styles.compactAvatar, { backgroundColor: chef.coverColor }]}> 
                <Text style={styles.avatarInitials}>{initials}</Text>
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
      <Pressable onPress={handlePress}>
        <View style={styles.featuredCard}>
          {heroImage ? (
            <ImageBackground source={{ uri: heroImage }} style={styles.featuredBanner} imageStyle={styles.featuredBannerImage}>
              <View style={styles.featuredOverlay}>
                <View style={styles.bannerTopRow}>
                  {firstDish?.isPopular ? (
                    <View style={styles.selectBadge}>
                      <Text style={styles.selectBadgeText}>Sélection</Text>
                    </View>
                  ) : <View />}
                  {onFavoriteToggle ? (
                    <Pressable style={styles.heartBtn} onPress={onFavoriteToggle} hitSlop={8}>
                      <Ionicons
                        name={isFavorite ? "heart" : "heart-outline"}
                        size={20}
                        color={isFavorite ? "#E74C3C" : "#fff"}
                      />
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.bannerBottomRow}>
                  {chef.avatarUrl ? (
                    <Image source={{ uri: chef.avatarUrl as string }} style={styles.featuredAvatarImage} />
                  ) : (
                    <View style={styles.featuredAvatarFallback}>
                      <Text style={styles.featuredAvatarText}>{initials}</Text>
                    </View>
                  )}
                  {chef.isOnline ? (
                    <View style={styles.onlineBadge}>
                      <View style={styles.onlineDotLarge} />
                      <Text style={styles.onlineText}>En ligne</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </ImageBackground>
          ) : (
            <View style={[styles.featuredBanner, { backgroundColor: chef.coverColor }]}> 
              {chef.avatarUrl ? (
                <Image source={{ uri: chef.avatarUrl as string }} style={styles.featuredAvatarImage} />
              ) : (
                <Text style={styles.featuredAvatarText}>{initials}</Text>
              )}
            </View>
          )}

          {chef.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
            </View>
          )}

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
                <Text style={styles.metaText}>{chef.location.split(",")[0]}</Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="clock" size={11} color={Colors.light.textTertiary} />
                <Text style={styles.metaText}>{chef.responseTime}</Text>
              </View>
            </View>
            <Text style={styles.priceRange}>
              {chef.priceRange || (firstDish ? `${firstDish.price.toLocaleString()} FCFA` : "Disponible")}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress}>
      <View style={styles.card}>
        {heroImage ? (
          <ImageBackground source={{ uri: heroImage }} style={styles.cardBanner} imageStyle={styles.cardBannerImage}>
            <View style={styles.cardBannerOverlay}>
              {firstDish?.isPopular ? (
                <View style={styles.smallBadge}>
                  <Text style={styles.smallBadgeText}>Populaire</Text>
                </View>
              ) : <View />}
              {onFavoriteToggle ? (
                <Pressable style={styles.smallHeartBtn} onPress={onFavoriteToggle} hitSlop={8}>
                  <Ionicons
                    name={isFavorite ? "heart" : "heart-outline"}
                    size={16}
                    color={isFavorite ? "#E74C3C" : "#fff"}
                  />
                </Pressable>
              ) : null}
            </View>
          </ImageBackground>
        ) : (
          <View style={[styles.cardBanner, { backgroundColor: chef.coverColor }]}> 
            {chef.avatarUrl ? (
              <Image source={{ uri: chef.avatarUrl as string }} style={styles.cardAvatarImage} />
            ) : (
              <Text style={styles.cardAvatarText}>{initials}</Text>
            )}
          </View>
        )}

        {chef.isVerified ? (
          <View style={styles.verifiedBadgeSmall}>
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
          </View>
        ) : null}

        <View style={styles.cardContent}>
          <Text style={styles.cardName}>{chef.name}</Text>
          <Text style={styles.cardSpecialty} numberOfLines={1}>{chef.specialty}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color="#F7C27B" />
            <Text style={styles.ratingText}>{chef.rating}</Text>
            <Text style={styles.reviewText}>• {chef.responseTime}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 182,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
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
    height: 128,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBannerImage: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  cardBannerOverlay: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 10,
    backgroundColor: "rgba(26,18,10,0.18)",
  },
  cardAvatarImage: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  cardAvatarText: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.9)",
  },
  cardContent: {
    padding: 12,
    gap: 4,
  },
  cardName: {
    fontSize: 14,
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
    width: 264,
    backgroundColor: Colors.light.card,
    borderRadius: 22,
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
    height: 172,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredBannerImage: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  featuredOverlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "rgba(26,18,10,0.22)",
  },
  bannerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bannerBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  featuredAvatarText: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    color: "rgba(255,255,255,0.9)",
  },
  featuredAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.72)",
  },
  featuredAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  verifiedBadge: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  verifiedBadgeSmall: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  onlineBadge: {
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
    backgroundColor: "rgba(0,0,0,0.24)",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  smallHeartBtn: {
    backgroundColor: "rgba(0,0,0,0.24)",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredContent: {
    padding: 14,
    gap: 6,
  },
  featuredRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  featuredName: {
    fontSize: 15,
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
    flexWrap: "wrap",
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
  selectBadge: {
    backgroundColor: "rgba(255,197,77,0.96)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectBadgeText: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    color: "#1A120A",
  },
  smallBadge: {
    backgroundColor: "rgba(255,197,77,0.96)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  smallBadgeText: {
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
    color: "#1A120A",
  },
});