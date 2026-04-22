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
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import * as ImagePicker from "expo-image-picker";
import { uploadFile } from "@/constants/api";

const EMOJIS = ["🍲", "🍗", "🐟", "🌶️", "🎂", "🥘", "🍛", "🥩", "🍜", "🥗", "🍤", "🫕", "🌽", "🥦", "🍌"];
const STORY_VIDEO_MAX_DURATION_SECONDS = 30;
const STORY_VIDEO_MAX_SIZE_BYTES = 100 * 1024 * 1024;

export default function PostStoryScreen() {
  const insets = useSafeAreaInsets();
  const { postStory, user, token } = useApp();
  const [caption, setCaption] = useState("");
  const [dishName, setDishName] = useState("");
  const [price, setPrice] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🍲");
  const selectedColor = user?.coverColor ?? Colors.light.tint;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const storyVideoPlayer = useVideoPlayer(videoUri ?? null, (player) => {
    player.loop = true;
    player.muted = true;
  });

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
        imageUrl: imageUri ?? undefined,
        videoUrl: videoUri ?? undefined,
        videoDurationSeconds,
      });
      router.back();
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de la publication");
    } finally {
      setLoading(false);
    }
  };

  const pickMedia = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return setError("Autorisez l'accès aux photos pour ajouter un media");
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 1,
        selectionLimit: 1,
        videoMaxDuration: STORY_VIDEO_MAX_DURATION_SECONDS,
        ...(Platform.OS === "ios"
          ? {
              preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
              videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
            }
          : null),
      });
      if (res.canceled) return;
      const asset = Array.isArray(res.assets) && res.assets.length > 0 ? res.assets[0] : undefined;
      const uri = asset?.uri;
      if (!uri) return;
      const assetType = asset?.type;
      const assetDurationSeconds = typeof asset?.duration === "number" ? asset.duration / 1000 : null;
      const fileSize = typeof asset?.fileSize === "number" ? asset.fileSize : null;
      if (assetType === "video") {
        if (assetDurationSeconds && assetDurationSeconds > STORY_VIDEO_MAX_DURATION_SECONDS) {
          setError(`La video de story doit durer ${STORY_VIDEO_MAX_DURATION_SECONDS} secondes maximum`);
          return;
        }
        if (fileSize && fileSize > STORY_VIDEO_MAX_SIZE_BYTES) {
          setError("La video de story ne doit pas depasser 100 Mo");
          return;
        }
      }
      setUploadingImage(true);
      const filename = asset?.fileName ?? uri.split('/').pop() ?? `story-${Date.now()}.${assetType === "video" ? "mp4" : "jpg"}`;
      const extension = filename.split('.').pop()?.toLowerCase();
      const contentType = asset?.mimeType ?? (assetType === "video"
        ? extension === 'mov' ? 'video/quicktime' : extension === 'webm' ? 'video/webm' : 'video/mp4'
        : extension === 'png'
          ? 'image/png'
          : extension === 'webp'
            ? 'image/webp'
            : extension === 'heic'
              ? 'image/heic'
              : extension === 'heif'
                ? 'image/heif'
                : extension === 'jpg'
                  ? 'image/jpg'
                  : 'image/jpeg');
      const { publicUrl } = await uploadFile({
        fileUri: uri,
        filename,
        contentType,
        purpose: "story",
        token: token ?? undefined,
      });
      if (assetType === "video") {
        setVideoUri(publicUrl ?? null);
        setVideoDurationSeconds(assetDurationSeconds ?? null);
        setImageUri(null);
      } else {
        setImageUri(publicUrl ?? null);
        setVideoUri(null);
        setVideoDurationSeconds(null);
      }
    } catch (err) {
      console.warn('story media upload failed', err);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("PHPhotosErrorDomain")) {
        setError("Impossible de preparer cette video depuis Photos. Reessayez avec une video deja telechargee sur l'iPhone ou une version plus courte.");
      } else {
        setError("Impossible d'uploader le media");
      }
    } finally {
      setUploadingImage(false);
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

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.bodyContent}>
        <View style={styles.introCard}>
          <Text style={styles.introEyebrow}>Studio story</Text>
          <Text style={styles.introTitle}>Partagez une mise en avant claire, appetissante et rapide a lire.</Text>
          <Text style={styles.introText}>
            Mettez en avant un plat, une promo ou une disponibilite du jour avec une story propre, visible pendant 24h.
          </Text>
        </View>

        <View style={styles.previewSection}>
          <View style={[styles.previewCard, { backgroundColor: selectedColor }]}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewMediaImage} />
            ) : videoUri ? (
              <View style={styles.videoPreviewWrap}>
                <VideoView player={storyVideoPlayer} style={styles.videoPreview} contentFit="cover" nativeControls={false} />
              </View>
            ) : null}
            {!videoUri ? <Text style={styles.previewEmoji}>{selectedEmoji}</Text> : null}
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

          <View style={styles.sectionCard}>
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
          </View>

          <View style={styles.sectionCard}>
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
          </View>

          <View style={styles.sectionCard}>
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
          </View>

          <View style={styles.sectionCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Media</Text>
            <View style={{ marginTop: 8 }}>
              <Pressable style={[styles.mediaButton, uploadingImage && styles.mediaButtonDisabled]} onPress={pickMedia}>
                {uploadingImage ? <ActivityIndicator color="#fff" /> : <Text style={styles.mediaButtonText}>{videoUri ? 'Modifier la video' : imageUri ? 'Modifier l\'image' : 'Ajouter une image ou video'}</Text>}
              </Pressable>
              <Text style={styles.mediaHint}>Video story: 30 secondes maximum, taille maximale 100 Mo.</Text>
            </View>
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
  headerTitle: { flex: 1, minWidth: 0, fontSize: 17, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, textAlign: "center" },
  publishBtn: { backgroundColor: Colors.light.tint, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, flexShrink: 0 },
  publishBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  body: { flex: 1, backgroundColor: Colors.light.background },
  bodyContent: { padding: 20, paddingBottom: 40, gap: 18 },
  introCard: { paddingBottom: 2, gap: 6 },
  introEyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint, textTransform: "uppercase", letterSpacing: 0.9 },
  introTitle: { fontSize: 22, lineHeight: 30, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  introText: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  previewSection: { alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderTopColor: "rgba(120,104,96,0.10)", borderBottomColor: "rgba(120,104,96,0.10)" },
  previewCard: {
    width: "100%",
    maxWidth: 280,
    minHeight: 380,
    borderRadius: 28,
    padding: 20,
    justifyContent: "flex-end",
    gap: 8,
    overflow: "hidden",
  },
  previewMediaImage: { position: "absolute", top: 0, left: 0, right: 0, height: 220, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  previewEmoji: { fontSize: 48, textAlign: "center", marginBottom: 8 },
  previewCaption: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: "#fff", lineHeight: 22 },
  previewDish: { backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 14, padding: 10 },
  previewDishText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: "#fff" },
  previewPrice: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.8)" },
  previewAuthor: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  previewAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  previewAvatarText: { fontSize: 11, fontFamily: "Poppins_700Bold", color: "#fff" },
  previewAuthorName: { fontSize: 12, fontFamily: "Poppins_500Medium", color: "rgba(255,255,255,0.85)" },
  previewHint: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  videoPreviewWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 220, overflow: 'hidden', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  videoPreview: { width: '100%', height: '100%' },
  form: { gap: 14 },
  sectionCard: { paddingVertical: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(120,104,96,0.10)" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FCA5A5" },
  errorText: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.error, flex: 1 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  captionInput: { backgroundColor: "transparent", borderRadius: 0, borderBottomWidth: 1, borderColor: "rgba(120,104,96,0.16)", paddingHorizontal: 0, paddingTop: 4, paddingBottom: 14, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.light.text, minHeight: 90 },
  charCount: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, textAlign: "right" },
  row: { flexDirection: "row", gap: 12 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: "transparent", borderBottomWidth: 1, borderColor: "rgba(120,104,96,0.16)", paddingHorizontal: 0, paddingVertical: 13 },
  input: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.light.text, padding: 0 },
  emojisRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "transparent", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(120,104,96,0.16)" },
  emojiBtnActive: { borderColor: Colors.light.tint, backgroundColor: "rgba(196,82,42,0.08)", borderWidth: 1.5 },
  emoji: { fontSize: 22 },
  mediaButton: { backgroundColor: Colors.light.tint, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  mediaButtonDisabled: { backgroundColor: "#C7C7C7" },
  mediaButtonText: { color: "#fff", fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  mediaHint: { marginTop: 10, fontSize: 11, lineHeight: 16, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
});
