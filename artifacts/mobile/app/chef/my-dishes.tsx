import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

export default function MyDishesScreen() {
  const insets = useSafeAreaInsets();
  const { user, chefDishes, isLoadingNotifications, fetchChefDishes } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (user?.id) {
      fetchChefDishes(user.id);
    }
  }, [user?.id, fetchChefDishes]);

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
        {isLoadingNotifications ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
          </View>
        ) : chefDishes.length > 0 ? (
          <View style={styles.dishList}>
            {chefDishes.map((dish) => (
              <View key={dish.id} style={styles.dishItem}>
                <View style={styles.dishInfo}>
                  <Text style={styles.dishName}>{dish.name}</Text>
                  {dish.imageUrl ? (
                    <Image source={{ uri: dish.imageUrl }} style={{ width: 96, height: 64, borderRadius: 8, marginTop: 8 }} />
                  ) : null}
                  <Text style={styles.dishDesc} numberOfLines={2}>{dish.description}</Text>
                  <View style={styles.dishFooter}>
                    <Text style={styles.dishCategory}>{dish.category}</Text>
                    <Text style={styles.dishPrice}>{dish.price.toLocaleString()} FCFA</Text>
                  </View>
                </View>
                <View style={styles.dishActions}>
                  <Pressable style={styles.actionBtn} onPress={() => { /* TODO: edit dish */ }}>
                    <Feather name="edit" size={16} color={Colors.light.tint} />
                  </Pressable>
                        <Pressable style={styles.actionBtn} onPress={() => { /* TODO: delete dish */ }}>
                          <Feather name="trash-2" size={16} color={Colors.light.error} />
                        </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color={Colors.light.textTertiary} />
            <Text style={styles.emptyTitle}>Aucun plat yet</Text>
            <Text style={styles.emptySub}>Créez un plat pour commencer à servir</Text>
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
  content: { paddingHorizontal: 20, paddingTop: 20 },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  dishList: { gap: 12 },
  dishItem: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.light.cardBorder },
  dishInfo: { flex: 1, gap: 6 },
  dishName: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  dishDesc: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  dishFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  dishCategory: { fontSize: 10, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, backgroundColor: Colors.light.backgroundSecondary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  dishPrice: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  dishActions: { flexDirection: "row", gap: 8, marginLeft: 12 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  emptySub: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  createBtn: { backgroundColor: Colors.light.tint, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  createBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
});
