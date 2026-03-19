import React, { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Alert, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";

import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { apiFetch } from "@/constants/api";

export default function CreateDishScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const { user, fetchChefDishes, token } = useApp();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Plats Principaux");
  const [prepTime, setPrepTime] = useState("30 min");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const onSubmit = useCallback(async () => {
    if (!user?.id) return Alert.alert("Erreur", "Utilisateur non connecté");
    if (!name || !price) return Alert.alert("Erreur", "Veuillez renseigner le nom et le prix");
    setIsSubmitting(true);
    try {
      const body: any = { name, description, price: Number(price), category, prepTime };
      if (imageUri) body.imageUrl = imageUri;
      await apiFetch(`/chef/${user.id}/dishes`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify(body),
      });
      await fetchChefDishes(user.id);
      router.back();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de créer le plat");
    } finally {
      setIsSubmitting(false);
    }
  }, [name, description, price, category, prepTime, user?.id, token]);

  const pickImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert("Permission requise", "Autorisez l'accès aux photos");
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (res.canceled) return;
      const uri = Array.isArray(res.assets) && res.assets.length > 0 ? res.assets[0].uri : undefined;
      if (!uri) return;
      setUploadingImage(true);
      // upload via helper
      const filename = uri.split('/').pop() ?? `photo-${Date.now()}.jpg`;
      const contentType = 'image/jpeg';
      const { publicUrl } = await (await import("@/constants/api")).uploadFile({
        fileUri: uri,
        filename,
        contentType,
        purpose: "dish",
        token: token ?? undefined,
      });
      setImageUri(publicUrl ?? null);
    } catch (err: any) {
      console.warn('Image upload failed', err);
      Alert.alert('Erreur', 'Impossible d\'uploader l\'image');
    } finally {
      setUploadingImage(false);
    }
  }, [token]);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}> 
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>Créer un plat</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Nom</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Attiéké poisson" />

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, { height: 90 }]} multiline value={description} onChangeText={setDescription} placeholder="Brève description" />

        <Text style={styles.label}>Prix (FCFA)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={price} onChangeText={setPrice} placeholder="5000" />

        <Text style={styles.label}>Catégorie</Text>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} />

        <Text style={styles.label}>Temps de préparation</Text>
        <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime} />

          <Text style={styles.label}>Image du plat (optionnel)</Text>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: 120, height: 80, borderRadius: 8, marginBottom: 8 }} />
          ) : null}
          <Pressable style={[styles.submitBtn, { backgroundColor: uploadingImage ? '#ccc' : Colors.light.backgroundSecondary }]} onPress={pickImage} disabled={uploadingImage}>
            <Text style={{ color: uploadingImage ? '#333' : Colors.light.text }}>{uploadingImage ? 'Téléchargement...' : (imageUri ? 'Modifier l\'image' : 'Ajouter une image')}</Text>
          </Pressable>

        <Pressable style={styles.submitBtn} onPress={onSubmit} disabled={isSubmitting}>
          <Text style={styles.submitText}>{isSubmitting ? "Enregistrement..." : "Créer"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, flex: 1, textAlign: "center" },
  form: { padding: 20, gap: 12 },
  label: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  input: { backgroundColor: Colors.light.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.light.cardBorder },
  submitBtn: { marginTop: 12, backgroundColor: Colors.light.tint, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  submitText: { color: "#fff", fontFamily: "Poppins_600SemiBold" },
});
