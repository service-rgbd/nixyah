import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

export default function MyDishesScreen() {
  const insets = useSafeAreaInsets();
  const { user, chefDishes, isLoadingNotifications, fetchChefDishes, deleteChefDish } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const [deletingDishId, setDeletingDishId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchChefDishes(user.id);
    }
  }, [user?.id, fetchChefDishes]);

  const photoCount = useMemo(
    () => chefDishes.reduce((count, dish) => count + (dish.imageUrls?.length ?? (dish.imageUrl ? 1 : 0)), 0),
    [chefDishes]
  );

  const handleDelete = (dishId: string, dishName: string) => {
    Alert.alert("Supprimer le plat", `Voulez-vous retirer ${dishName} du menu ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingDishId(dishId);
            await deleteChefDish(dishId);
          } catch (error: any) {
            Alert.alert("Erreur", error?.message ?? "Impossible de supprimer le plat");
          } finally {
            setDeletingDishId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}> 
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>Mes plats</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push("/chef/create-dish")}>
          <Feather name="plus" size={20} color={Colors.light.tint} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 20 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroValue}>{chefDishes.length}</Text>
            <Text style={styles.heroLabel}>plats au menu</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroMetric}>
            <Text style={styles.heroValue}>{photoCount}</Text>
            <Text style={styles.heroLabel}>photos publiées</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroMetric}>
            <Text style={styles.heroValue}>Prix verrouillé</Text>
            <Text style={styles.heroLabel}>édition sécurisée</Text>
          </View>
        </View>

        {isLoadingNotifications ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
          </View>
        ) : chefDishes.length > 0 ? (
          <View style={styles.dishList}>
            {chefDishes.map((dish) => (
              <View key={dish.id} style={styles.dishItem}>
                <View style={styles.dishInfo}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dishName}>{dish.name}</Text>
                      <Text style={styles.dishSubtitle}>{dish.category} · {dish.prepTime}</Text>
                    </View>
                    <View style={styles.pricePill}>
                      <Text style={styles.dishPrice}>{dish.price.toLocaleString()} FCFA</Text>
                    </View>
                  </View>

                  {(dish.imageUrls?.length ?? 0) > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesRow}>
                      {(dish.imageUrls ?? []).map((uri, index) => (
                        <View key={`${dish.id}-${uri}`} style={styles.imageWrap}>
                          <Image source={{ uri }} style={styles.dishImage} />
                          <View style={styles.imageChip}>
                            <Text style={styles.imageChipText}>{index === 0 ? "Principale" : `${index + 1}/3`}</Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  ) : dish.imageUrl ? (
                    <Image source={{ uri: dish.imageUrl }} style={styles.dishImage} />
                  ) : null}

                  <Text style={styles.dishDesc} numberOfLines={3}>{dish.description}</Text>

                  <View style={styles.footerRow}>
                    <Text style={styles.lockedPriceNote}>Le prix reste fixe après publication.</Text>
                    <View style={styles.dishActions}>
                      <Pressable style={styles.actionBtn} onPress={() => router.push({ pathname: "/chef/create-dish", params: { dishId: dish.id } })}>
                        <Feather name="edit" size={16} color={Colors.light.tint} />
                        <Text style={styles.actionLabel}>Modifier</Text>
                      </Pressable>
                      <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(dish.id, dish.name)} disabled={deletingDishId === dish.id}>
                        {deletingDishId === dish.id ? (
                          <ActivityIndicator size="small" color={Colors.light.error} />
                        ) : (
                          <>
                            <Feather name="trash-2" size={16} color={Colors.light.error} />
                            <Text style={[styles.actionLabel, { color: Colors.light.error }]}>Supprimer</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color={Colors.light.textTertiary} />
            <Text style={styles.emptyTitle}>Aucun plat publié</Text>
            <Text style={styles.emptySub}>Créez un premier plat avec jusqu'à 3 photos pour enrichir votre menu.</Text>
            <Pressable style={styles.createBtn} onPress={() => router.push("/chef/create-dish") }>
              <Text style={styles.createBtnText}>Créer un plat</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, flex: 1, textAlign: "center" },
  addBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  heroCard: { flexDirection: "row", alignItems: "stretch", backgroundColor: Colors.light.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: Colors.light.cardBorder },
  heroMetric: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  heroValue: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text, textAlign: "center" },
  heroLabel: { fontSize: 11, lineHeight: 16, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center" },
  heroDivider: { width: 1, backgroundColor: Colors.light.divider, marginHorizontal: 10 },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  dishList: { gap: 12 },
  dishItem: { backgroundColor: Colors.light.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: Colors.light.cardBorder },
  dishInfo: { gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dishName: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  dishSubtitle: { marginTop: 3, fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  pricePill: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: Colors.light.backgroundSecondary },
  dishPrice: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  imagesRow: { gap: 10, paddingRight: 12 },
  imageWrap: { position: "relative" },
  dishImage: { width: 132, height: 90, borderRadius: 12, backgroundColor: Colors.light.backgroundSecondary },
  imageChip: { position: "absolute", left: 8, bottom: 6, backgroundColor: "rgba(17,24,39,0.72)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  imageChipText: { color: "#fff", fontSize: 10, fontFamily: "Poppins_500Medium" },
  dishDesc: { fontSize: 13, lineHeight: 19, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  footerRow: { gap: 12 },
  lockedPriceNote: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  dishActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, backgroundColor: Colors.light.backgroundSecondary, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.light.cardBorder },
  deleteBtn: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  actionLabel: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  emptySub: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, textAlign: "center" },
  createBtn: { backgroundColor: Colors.light.tint, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  createBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
});