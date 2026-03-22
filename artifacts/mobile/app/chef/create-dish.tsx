import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Alert, Image, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import Colors from "@/constants/colors";
import { CHEF_MENU_CATEGORIES, DISCOUNT_OPTIONS, PREP_TIME_OPTIONS, formatPrice, getDishBasePrice, getDishCurrentPrice, getDishDiscountPercent } from "@/constants/chef-menu";
import { useApp } from "@/contexts/AppContext";
import { apiFetch, uploadFile } from "@/constants/api";

type ChefMenuCategory = (typeof CHEF_MENU_CATEGORIES)[number];
type PrepTimeOption = (typeof PREP_TIME_OPTIONS)[number];

export default function CreateDishScreen() {
  const params = useLocalSearchParams<{ dishId?: string }>();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const { user, chefDishes, fetchChefDishes, refreshChefs, updateChefDish, token } = useApp();
  const isEditMode = Boolean(params.dishId);
  const editingDish = chefDishes.find((dish) => dish.id === params.dishId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<ChefMenuCategory>(CHEF_MENU_CATEGORIES[0]);
  const [prepTime, setPrepTime] = useState<PrepTimeOption>("30 min");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [discountLabel, setDiscountLabel] = useState("");
  const [isPopular, setIsPopular] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const remainingSlots = useMemo(() => Math.max(0, 3 - imageUris.length), [imageUris.length]);
  const normalizedDiscountPercent = useMemo(() => {
    const parsed = Number(discountPercent);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(0, Math.min(80, Math.round(parsed)));
  }, [discountPercent]);
  const basePrice = useMemo(() => {
    if (isEditMode && editingDish) {
      return getDishBasePrice(editingDish);
    }

    const parsed = Number(price);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [editingDish, isEditMode, price]);
  const previewPrice = useMemo(() => {
    if (!basePrice) {
      return 0;
    }

    return Math.round(basePrice * (100 - normalizedDiscountPercent)) / 100;
  }, [basePrice, normalizedDiscountPercent]);

  useEffect(() => {
    if (isEditMode && user?.id && !editingDish) {
      fetchChefDishes(user.id);
    }
  }, [editingDish, fetchChefDishes, isEditMode, user?.id]);

  useEffect(() => {
    if (!editingDish) return;
    setName(editingDish.name);
    setDescription(editingDish.description);
    setPrice(String(getDishBasePrice(editingDish)));
    setCategory((CHEF_MENU_CATEGORIES.includes(editingDish.category as ChefMenuCategory) ? editingDish.category : CHEF_MENU_CATEGORIES[0]) as ChefMenuCategory);
    setPrepTime((PREP_TIME_OPTIONS.includes(editingDish.prepTime as PrepTimeOption) ? editingDish.prepTime : "30 min") as PrepTimeOption);
    setDiscountPercent(String(getDishDiscountPercent(editingDish)));
    setDiscountLabel(editingDish.discountLabel ?? "");
    setIsPopular(Boolean(editingDish.isPopular));
    setImageUris(editingDish.imageUrls?.length ? editingDish.imageUrls : editingDish.imageUrl ? [editingDish.imageUrl] : []);
  }, [editingDish]);

  const inferContentType = useCallback((filename: string, mimeType?: string | null) => {
    if (mimeType && ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"].includes(mimeType)) {
      return mimeType;
    }

    const extension = filename.split(".").pop()?.toLowerCase();
    if (extension === "png") return "image/png";
    if (extension === "webp") return "image/webp";
    if (extension === "heic") return "image/heic";
    if (extension === "heif") return "image/heif";
    if (extension === "jpg") return "image/jpg";
    return "image/jpeg";
  }, []);

  const onSubmit = useCallback(async () => {
    if (!user?.id) return Alert.alert("Erreur", "Utilisateur non connecté");
    if (!name.trim()) return Alert.alert("Erreur", "Veuillez renseigner le nom du plat");
    if (!isEditMode && !price) return Alert.alert("Erreur", "Veuillez renseigner le prix");
    if (!description.trim()) return Alert.alert("Erreur", "Ajoutez une courte description pour structurer le menu");
    setIsSubmitting(true);
    try {
      if (isEditMode && params.dishId) {
        await updateChefDish(params.dishId, {
          name,
          description,
          category,
          prepTime,
          imageUrls: imageUris,
          isPopular,
          discountPercent: normalizedDiscountPercent,
          discountLabel,
        });
      } else {
        const body: any = {
          name,
          description,
          price: Number(price),
          category,
          prepTime,
          isPopular,
          discountPercent: normalizedDiscountPercent,
          discountLabel,
        };
        if (imageUris.length > 0) {
          body.imageUrl = imageUris[0];
          body.imageUrls = imageUris;
        }
        await apiFetch(`/chef/${user.id}/dishes`, {
          method: "POST",
          token: token ?? undefined,
          body: JSON.stringify(body),
        });
        await fetchChefDishes(user.id);
      }
      await refreshChefs();
      router.back();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? (isEditMode ? "Impossible de modifier le plat" : "Impossible de créer le plat"));
    } finally {
      setIsSubmitting(false);
    }
  }, [category, description, discountLabel, fetchChefDishes, imageUris, isEditMode, isPopular, name, normalizedDiscountPercent, params.dishId, prepTime, price, refreshChefs, token, updateChefDish, user?.id]);

  const pickImages = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert("Permission requise", "Autorisez l'accès aux photos");
      if (remainingSlots === 0) {
        Alert.alert("Limite atteinte", "Vous pouvez ajouter jusqu'à 3 photos par plat.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
      });
      if (res.canceled) return;
      const assets = Array.isArray(res.assets) ? res.assets.slice(0, remainingSlots) : [];
      if (assets.length === 0) return;
      setUploadingImage(true);
      const uploadedUrls: string[] = [];

      for (const asset of assets) {
        const uri = asset.uri;
        const filename = asset.fileName ?? uri.split("/").pop() ?? `photo-${Date.now()}.jpg`;
        const contentType = inferContentType(filename, asset.mimeType);
        const { publicUrl } = await uploadFile({
          fileUri: uri,
          filename,
          contentType,
          purpose: "dish",
          token: token ?? undefined,
        });
        if (publicUrl) {
          uploadedUrls.push(publicUrl);
        }
      }

      setImageUris((prev) => Array.from(new Set([...prev, ...uploadedUrls])).slice(0, 3));
    } catch (err: any) {
      console.warn("Image upload failed", err);
      Alert.alert("Erreur", "Impossible d'uploader les photos");
    } finally {
      setUploadingImage(false);
    }
  }, [inferContentType, remainingSlots, token]);

  const removeImage = useCallback((uriToRemove: string) => {
    setImageUris((prev) => prev.filter((uri) => uri !== uriToRemove));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}> 
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>{isEditMode ? "Modifier le plat" : "Créer un plat"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{isEditMode ? "Ajustez votre fiche plat" : "Construisez un plat proprement classe"}</Text>
          <Text style={styles.heroSub}>
            {isEditMode
              ? "Vous pouvez modifier le nom, la description, la categorie, la mise en avant, la reduction et les photos. Le prix de base reste verrouille."
              : "Chaque plat doit entrer dans une categorie client. Vous pouvez aussi activer une reduction sans casser le prix de base."}
          </Text>
          <View style={styles.previewPriceCard}>
            <View style={styles.previewPriceMeta}>
              <Text style={styles.previewPriceLabel}>Prix client affiche</Text>
              <Text style={styles.previewPriceValue}>{previewPrice > 0 ? formatPrice(previewPrice) : "A renseigner"}</Text>
            </View>
            {normalizedDiscountPercent > 0 && basePrice > previewPrice ? (
              <View style={styles.previewDiscountBadge}>
                <Text style={styles.previewDiscountBadgeText}>-{normalizedDiscountPercent}%</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Identite du plat</Text>
          <Text style={styles.label}>Nom</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Attieke poisson" />

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.textarea]} multiline value={description} onChangeText={setDescription} placeholder="Texture, accompagnement, format, experience client" />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Categorie et rythme</Text>
          <Text style={styles.label}>Categorie du filtre client</Text>
          <View style={styles.chipWrap}>
            {CHEF_MENU_CATEGORIES.map((item) => {
              const selected = category === item;
              return (
                <Pressable key={item} style={[styles.choiceChip, selected && styles.choiceChipActive]} onPress={() => setCategory(item)}>
                  <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Temps de preparation</Text>
          <View style={styles.chipWrap}>
            {PREP_TIME_OPTIONS.map((item) => {
              const selected = prepTime === item;
              return (
                <Pressable key={item} style={[styles.choiceChip, selected && styles.choiceChipActive]} onPress={() => setPrepTime(item)}>
                  <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={[styles.toggleCard, isPopular && styles.toggleCardActive]} onPress={() => setIsPopular((current) => !current)}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Mettre en avant dans les plats rapides</Text>
              <Text style={styles.toggleSub}>Pratique pour la vitrine rapide et les cartes les plus visibles.</Text>
            </View>
            <View style={[styles.toggleKnob, isPopular && styles.toggleKnobActive]}>
              {isPopular ? <Feather name="check" size={14} color="#fff" /> : null}
            </View>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Prix et reduction</Text>
          <Text style={styles.label}>Prix de base (FCFA)</Text>
          <TextInput
            style={[styles.input, isEditMode && styles.disabledInput]}
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
            placeholder="5000"
            editable={!isEditMode}
          />
          {isEditMode ? <Text style={styles.lockedHint}>Le prix de base est verrouille apres publication pour eviter les ecarts involontaires.</Text> : null}

          <Text style={styles.label}>Reduction suggeree</Text>
          <View style={styles.chipWrap}>
            {DISCOUNT_OPTIONS.map((option) => {
              const selected = normalizedDiscountPercent === option;
              return (
                <Pressable key={option} style={[styles.choiceChip, selected && styles.choiceChipActive]} onPress={() => setDiscountPercent(String(option))}>
                  <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>{option === 0 ? "Aucune" : `-${option}%`}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            value={discountPercent}
            onChangeText={setDiscountPercent}
            placeholder="Ex: 15"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Libelle promo</Text>
          <TextInput
            style={styles.input}
            value={discountLabel}
            onChangeText={setDiscountLabel}
            placeholder="Ex: Offre du soir, formule midi, promo week-end"
          />
        </View>

        <View style={styles.mediaCard}>
          <View style={styles.mediaHeader}>
            <Text style={styles.label}>Photos du plat</Text>
            <Text style={styles.mediaCounter}>{imageUris.length}/3</Text>
          </View>
          {imageUris.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
              {imageUris.map((uri, index) => (
                <View key={uri} style={styles.galleryItem}>
                  <Image source={{ uri }} style={styles.galleryImage} />
                  <View style={styles.galleryBadge}>
                    <Text style={styles.galleryBadgeText}>{index === 0 ? "Principale" : `Photo ${index + 1}`}</Text>
                  </View>
                  <Pressable style={styles.removeImageBtn} onPress={() => removeImage(uri)}>
                    <Feather name="x" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyMediaState}>
              <Feather name="image" size={22} color={Colors.light.textTertiary} />
              <Text style={styles.emptyMediaText}>Aucune photo ajoutée pour l'instant.</Text>
            </View>
          )}
          <Pressable
            style={[styles.secondaryBtn, uploadingImage && styles.secondaryBtnDisabled, remainingSlots === 0 && styles.secondaryBtnDisabled]}
            onPress={pickImages}
            disabled={uploadingImage || remainingSlots === 0}
          >
            <Text style={styles.secondaryBtnText}>
              {uploadingImage ? "Téléchargement..." : remainingSlots === 0 ? "3 photos ajoutées" : imageUris.length > 0 ? "Ajouter d'autres photos" : "Ajouter des photos"}
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.submitBtn} onPress={onSubmit} disabled={isSubmitting}>
          <Text style={styles.submitText}>{isSubmitting ? (isEditMode ? "Mise à jour..." : "Enregistrement...") : isEditMode ? "Enregistrer les modifications" : "Créer"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, flex: 1, textAlign: "center" },
  form: { padding: 20, gap: 12 },
  heroCard: { backgroundColor: "#FBF5EF", borderRadius: 24, padding: 18, borderWidth: 1, borderColor: "rgba(156,109,82,0.14)", marginBottom: 4, gap: 12 },
  heroTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  heroSub: { marginTop: 6, fontSize: 13, lineHeight: 19, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  previewPriceCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "rgba(156,109,82,0.12)" },
  previewPriceMeta: { gap: 4 },
  previewPriceLabel: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary, textTransform: "uppercase", letterSpacing: 0.8 },
  previewPriceValue: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  previewDiscountBadge: { backgroundColor: "#ECFDF5", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  previewDiscountBadgeText: { fontSize: 12, fontFamily: "Poppins_700Bold", color: "#047857" },
  sectionCard: { backgroundColor: Colors.light.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.light.cardBorder, gap: 10 },
  sectionTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  label: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  input: { backgroundColor: Colors.light.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.light.cardBorder },
  textarea: { height: 90 },
  disabledInput: { color: Colors.light.textTertiary, backgroundColor: Colors.light.backgroundSecondary },
  lockedHint: { marginTop: -4, fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: Colors.light.cardBorder, backgroundColor: Colors.light.backgroundSecondary },
  choiceChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  choiceChipText: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  choiceChipTextActive: { color: "#fff" },
  toggleCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.light.cardBorder, backgroundColor: Colors.light.backgroundSecondary, padding: 14 },
  toggleCardActive: { backgroundColor: "#FFF4E9", borderColor: "rgba(196,82,42,0.24)" },
  toggleTextWrap: { flex: 1, gap: 4 },
  toggleTitle: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  toggleSub: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  toggleKnob: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.cardBorder, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  toggleKnobActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  mediaCard: { backgroundColor: Colors.light.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: Colors.light.cardBorder, gap: 12 },
  mediaHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mediaCounter: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  galleryRow: { gap: 12, paddingRight: 12 },
  galleryItem: { width: 156, position: "relative" },
  galleryImage: { width: 156, height: 108, borderRadius: 14, backgroundColor: Colors.light.backgroundSecondary },
  galleryBadge: { position: "absolute", left: 8, bottom: 8, backgroundColor: "rgba(17,24,39,0.68)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  galleryBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Poppins_500Medium" },
  removeImageBtn: { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(17,24,39,0.72)", alignItems: "center", justifyContent: "center" },
  emptyMediaState: { borderRadius: 14, borderWidth: 1, borderColor: Colors.light.cardBorder, borderStyle: "dashed", paddingVertical: 20, alignItems: "center", gap: 8, backgroundColor: Colors.light.backgroundSecondary },
  emptyMediaText: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  secondaryBtn: { backgroundColor: Colors.light.backgroundSecondary, paddingVertical: 13, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.light.cardBorder },
  secondaryBtnText: { color: Colors.light.text, fontFamily: "Poppins_600SemiBold" },
  secondaryBtnDisabled: { opacity: 0.6 },
  submitBtn: { marginTop: 12, backgroundColor: Colors.light.tint, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  submitText: { color: "#fff", fontFamily: "Poppins_600SemiBold" },
});