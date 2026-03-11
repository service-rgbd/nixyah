import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

const EMOJIS = ["🍲", "🍗", "🐟", "🌶️", "🎂", "🥘", "🍛", "🥩", "🍜", "🥗", "🍤", "🫕", "🌽", "🥦", "🍌"];
const BG_COLORS = [
  "#C4522A", "#8B5CF6", "#059669", "#D97706", "#DC2626",
  "#BE185D", "#1D4ED8", "#0891B2", "#7C3AED", "#065F46"
];

export default function PostStoryScreen() {
  const insets = useSafeAreaInsets();
  const { postStory, user } = useApp();
  const [caption, setCaption] = useState("");
  const [dishName, setDishName] = useState("");
  const [price, setPrice] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🍲");
  const [selectedColor, setSelectedColor] = useState(user?.coverColor ?? "#C4522A");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePost = async () => {
    if (!caption.trim()) {
      setError("La description de votre story est requise");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await postStory({
        caption: caption.trim(),
        dishName: dishName.trim() || undefined,
        price: price ? parseFloat(price) : undefined,
        emoji: selectedEmoji,
        bgColor: selectedColor,
      });
      router.back();
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de la publication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Publier une story</Text>
        <Pressable
          style={[styles.publishBtn, (!caption.trim() || loading) && { opacity: 0.5 }]}
          onPress={handlePost}
          disabled={!caption.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.publishBtnText}>Publier</Text>
          )}
        </Pressable>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.preview}>
          <View style={[styles.previewCard, { backgroundColor: selectedColor }]}>
            <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
            <Text style={styles.previewCaption} numberOfLines={3}>
              {caption || "Votre description ici..."}
            </Text>
            {dishName ? (
              <View style={styles.previewDish}>
                <Text style={styles.previewDishText}>{dishName}</Text>
                {price ? <Text style={styles.previewPrice}>{parseFloat(price).toLocaleString("fr-FR")} FCFA</Text> : null}
              </View>
            ) : null}
            <View style={styles.previewAuthor}>
              <View style={[styles.previewAvatar, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                <Text style={styles.previewAvatarText}>
                  {user?.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
                </Text>
              </View>
              <Text style={styles.previewAuthorName}>{user?.name ?? "Vous"}</Text>
            </View>
          </View>
          <Text style={styles.previewHint}>Aperçu de votre story • Visible 24h</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={15} color={Colors.light.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={styles.captionInput}
              value={caption}
              onChangeText={setCaption}
              placeholder="Ex: Mon kedjenou du jour est prêt! Commandez avant 20h..."
              placeholderTextColor={Colors.light.textTertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={200}
            />
            <Text style={styles.charCount}>{caption.length}/200</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Nom du plat</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={dishName}
                  onChangeText={setDishName}
                  placeholder="Ex: Kedjenou"
                  placeholderTextColor={Colors.light.textTertiary}
                  autoCapitalize="words"
                />
              </View>
            </View>
            <View style={[styles.fieldGroup, { width: 110 }]}>
              <Text style={styles.label}>Prix (FCFA)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="3500"
                  placeholderTextColor={Colors.light.textTertiary}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Emoji</Text>
            <View style={styles.emojisRow}>
              {EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  style={[styles.emojiBtn, selectedEmoji === e && styles.emojiBtnActive]}
                  onPress={() => setSelectedEmoji(e)}
                >
                  <Text style={styles.emoji}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Couleur de fond</Text>
            <View style={styles.colorsRow}>
              {BG_COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, selectedColor === c && styles.colorDotSelected]}
                  onPress={() => setSelectedColor(c)}
                >
                  {selectedColor === c && <Feather name="check" size={12} color="#fff" />}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    backgroundColor: Colors.light.background,
    gap: 12,
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, textAlign: "center" },
  publishBtn: { backgroundColor: Colors.light.tint, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  publishBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  body: { flex: 1, backgroundColor: Colors.light.background },
  preview: { alignItems: "center", paddingVertical: 24, gap: 10, backgroundColor: Colors.light.backgroundSecondary },
  previewCard: {
    width: 220,
    height: 340,
    borderRadius: 24,
    padding: 20,
    justifyContent: "flex-end",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    gap: 8,
  },
  previewEmoji: { fontSize: 48, textAlign: "center", marginBottom: 8 },
  previewCaption: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: "#fff", lineHeight: 22 },
  previewDish: { backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 10, padding: 8 },
  previewDishText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: "#fff" },
  previewPrice: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.8)" },
  previewAuthor: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  previewAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  previewAvatarText: { fontSize: 11, fontFamily: "Poppins_700Bold", color: "#fff" },
  previewAuthorName: { fontSize: 12, fontFamily: "Poppins_500Medium", color: "rgba(255,255,255,0.85)" },
  previewHint: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  form: { padding: 20, gap: 16 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FCA5A5" },
  errorText: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.error, flex: 1 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  captionInput: { backgroundColor: Colors.light.backgroundSecondary, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.cardBorder, padding: 14, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.light.text, minHeight: 90 },
  charCount: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, textAlign: "right" },
  row: { flexDirection: "row", gap: 12 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.backgroundSecondary, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.cardBorder, paddingHorizontal: 14, paddingVertical: 13 },
  input: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.light.text, padding: 0 },
  emojisRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.light.backgroundSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.light.cardBorder },
  emojiBtnActive: { borderColor: Colors.light.tint, backgroundColor: Colors.light.backgroundSecondary, borderWidth: 2 },
  emoji: { fontSize: 22 },
  colorsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  colorDotSelected: { borderWidth: 2.5, borderColor: Colors.light.text },
});
