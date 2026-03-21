import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ImageBackground } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp, Story } from "@/contexts/AppContext";
import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";

export default function StoryViewer() {
  const params = useLocalSearchParams();
  const { id } = params as { id?: string };
  const { stories } = useApp();
  const [story, setStory] = useState<Story | null>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const storyIndex = useMemo(
    () => stories.findIndex((item) => item.id === String(id)),
    [id, stories]
  );
  const hasPrevious = storyIndex > 0;
  const hasNext = storyIndex >= 0 && storyIndex < stories.length - 1;

  useEffect(() => {
    if (id) {
      const s = stories.find((x) => x.id === String(id));
      if (s) setStory(s);
    }
  }, [id, stories]);

  if (!story) return null;

  const bgColor = story.bgColor ?? story.chefCoverColor;
  const videoPlayer = useVideoPlayer(story.videoUrl ?? null, (player) => {
    player.loop = true;
  });
  const cardContent = (
    <>
      <View style={styles.progressRow}>
        {stories.slice(0, Math.min(stories.length, 5)).map((item, index) => {
          const isActive = item.id === story.id;
          const isDone = storyIndex > index;
          return (
            <View key={item.id} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  isDone && styles.progressFillDone,
                  isActive && styles.progressFillActive,
                ]}
              />
            </View>
          );
        })}
      </View>

      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 4 }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="x" size={20} color="#fff" />
          </Pressable>
          <View>
            <Text style={styles.chefName}>{story.chefName}</Text>
            <Text style={styles.time}>{new Date(story.createdAt).toLocaleString()}</Text>
          </View>
        </View>
        <Pressable style={styles.moreBtn}>
          <Feather name="more-horizontal" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.flexSpacer} />

      <View style={styles.content}>
        <View style={styles.storyBadge}>
          <Feather name={story.videoUrl ? "play-circle" : "camera"} size={14} color="#fff" />
          <Text style={styles.storyBadgeText}>{story.videoUrl ? "Story video" : "Story cuisine"}</Text>
        </View>
        {!story.videoUrl ? <Text style={styles.storyEmoji}>{story.emoji ?? "🍲"}</Text> : null}
        <Text style={styles.caption}>{story.caption}</Text>
        {!!story.dishName && (
          <Text style={styles.dish}>
            {story.dishName}
            {story.price ? ` · ${story.price} FCFA` : ""}
          </Text>
        )}

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, !hasPrevious && styles.actionBtnDisabled]}
            onPress={() =>
              hasPrevious &&
              router.replace({ pathname: "/story/[id]", params: { id: stories[storyIndex - 1].id } })
            }
            disabled={!hasPrevious}
          >
            <Feather name="arrow-left" size={18} color="#fff" />
            <Text style={styles.actionLabel}>Prec.</Text>
          </Pressable>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push({ pathname: "/chef/[id]", params: { id: story.chefId } })}
          >
            <Text style={styles.primaryBtnText}>Voir la cuisiniere</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, !hasNext && styles.actionBtnDisabled]}
            onPress={() =>
              hasNext &&
              router.replace({ pathname: "/story/[id]", params: { id: stories[storyIndex + 1].id } })
            }
            disabled={!hasNext}
          >
            <Text style={styles.actionLabel}>Suiv.</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {story.imageUrl ? (
        <ImageBackground source={{ uri: story.imageUrl }} style={styles.imageBg}>
          <View style={[styles.overlay, { backgroundColor: "rgba(26,18,10,0.34)" }]} />
          {cardContent}
        </ImageBackground>
      ) : story.videoUrl ? (
        <View style={styles.imageBg}>
          <VideoView player={videoPlayer} style={styles.videoBg} contentFit="cover" nativeControls={false} allowsFullscreen />
          <View style={[styles.overlay, { backgroundColor: "rgba(26,18,10,0.34)" }]} />
          {cardContent}
        </View>
      ) : (
        <View style={[styles.fallbackBg, { backgroundColor: bgColor }]}>
          <View style={[styles.overlay, { backgroundColor: "rgba(26,18,10,0.22)" }]} />
          {cardContent}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.text },
  imageBg: { flex: 1 },
  videoBg: { ...StyleSheet.absoluteFillObject },
  fallbackBg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "web" ? 18 : 12,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
  },
  progressFill: {
    width: "0%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  progressFillDone: {
    width: "100%",
    backgroundColor: "#fff",
  },
  progressFillActive: {
    width: "72%",
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  chefName: { fontFamily: "Poppins_600SemiBold", color: "#fff", fontSize: 14 },
  time: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.75)" },
  flexSpacer: { flex: 1 },
  content: {
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === "web" ? 36 : 28,
  },
  storyBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginBottom: 14,
  },
  storyBadgeText: { fontSize: 11, fontFamily: "Poppins_500Medium", color: "#fff" },
  storyEmoji: { fontSize: 52, marginBottom: 14 },
  caption: {
    fontSize: 26,
    lineHeight: 34,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
    maxWidth: "92%",
  },
  dish: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    color: "rgba(255,255,255,0.86)",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
    alignItems: "center",
  },
  actionBtn: {
    minWidth: 84,
    height: 46,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionLabel: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  primaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
});
