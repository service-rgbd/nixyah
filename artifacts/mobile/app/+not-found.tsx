import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Page introuvable</Text>
      <Pressable style={styles.btn} onPress={() => router.replace("/(tabs)")}>
        <Text style={styles.btnText}>Retour à l'accueil</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.background,
    gap: 16,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.light.textSecondary,
  },
  btn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  btnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
});
