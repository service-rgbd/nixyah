import { useEvent, useEventListener } from "expo";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ImageBackground,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp, Story } from "@/contexts/AppContext";
import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";

const STORY_LOOPS_BEFORE_ADVANCE = 2;
const STORY_PREVIEW_WINDOW = 4;

function getPreviewStories(stories: Story[], activeIndex: number) {
  if (stories.length <= STORY_PREVIEW_WINDOW) {
    return stories;
  }

  const maxStart = Math.max(0, stories.length - STORY_PREVIEW_WINDOW);
  const start = Math.max(0, Math.min(activeIndex, maxStart));
  return stories.slice(start, start + STORY_PREVIEW_WINDOW);
}

function normalizePrice(price?: number | null) {
  if (typeof price !== "number" || Number.isNaN(price)) {
    return null;
  }

  return `${price.toLocaleString("fr-FR")} FCFA`;
}

export default function StoryViewer() {
  const params = useLocalSearchParams();
  const { id } = params as { id?: string };
  const { stories } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const storyIndex = useMemo(
    () => stories.findIndex((item) => item.id === String(id)),
    [id, stories]
  );
  const story = useMemo<Story | null>(
    () => stories.find((item) => item.id === String(id)) ?? null,
    [id, stories]
  );
  const previewStories = useMemo(() => getPreviewStories(stories, storyIndex), [stories, storyIndex]);
  const hasPrevious = storyIndex > 0;
  const hasNext = storyIndex >= 0 && storyIndex < stories.length - 1;
  const [completedLoops, setCompletedLoops] = useState(0);
  const [pendingStoryIndex, setPendingStoryIndex] = useState<number | null>(null);
  const completedLoopsRef = useRef(0);

  const videoPlayer = useVideoPlayer(story?.videoUrl ?? null, (player) => {
    player.loop = false;
    player.timeUpdateEventInterval = 0.2;
  });

  const { currentTime } = useEvent(videoPlayer, "timeUpdate", {
    currentTime: 0,
    bufferedPosition: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });

  const goToStory = useCallback(
    (targetIndex: number) => {
      const nextStory = stories[targetIndex];
      if (!nextStory) {
        return;
      }

      router.replace({ pathname: "/story/[id]", params: { id: nextStory.id } });
    },
    [router, stories]
  );

  useEffect(() => {
    completedLoopsRef.current = completedLoops;
  }, [completedLoops]);

  useEffect(() => {
    setCompletedLoops(0);
    completedLoopsRef.current = 0;
    setPendingStoryIndex(null);

    if (!story?.videoUrl) {
      return;
    }

    videoPlayer.currentTime = 0;
    videoPlayer.play();
  }, [story?.id, story?.videoUrl, videoPlayer]);

  useEffect(() => {
    if (pendingStoryIndex == null) {
      return;
    }

    goToStory(pendingStoryIndex);
    setPendingStoryIndex(null);
  }, [goToStory, pendingStoryIndex]);

  useEventListener(videoPlayer, "playToEnd", () => {
    if (!story?.videoUrl) {
      return;
    }

    const nextLoops = completedLoopsRef.current + 1;

    if (nextLoops < STORY_LOOPS_BEFORE_ADVANCE) {
      completedLoopsRef.current = nextLoops;
      setCompletedLoops(nextLoops);
      videoPlayer.replay();
      videoPlayer.play();
      return;
    }

    if (hasNext) {
      completedLoopsRef.current = 0;
      setCompletedLoops(0);
      setPendingStoryIndex(storyIndex + 1);
      return;
    }

    completedLoopsRef.current = nextLoops;
    setCompletedLoops(nextLoops);
  });

  if (!story) return null;

  const bgColor = story.bgColor ?? story.chefCoverColor;
  const playbackProgress = story.videoUrl && videoPlayer.duration > 0
    ? Math.min(
        100,
        ((completedLoops + Math.min(currentTime / videoPlayer.duration, 1)) /
          STORY_LOOPS_BEFORE_ADVANCE) * 100
      )
    : 72;
  const dishPrice = normalizePrice(story.price);
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
                  isActive ? { width: `${Math.max(playbackProgress, 8)}%` } : null,
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

      <View style={styles.previewRailWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRail}>
          {previewStories.map((previewStory) => {
            const isPreviewActive = previewStory.id === story.id;

            return (
              <Pressable
                key={previewStory.id}
                style={[styles.previewDot, isPreviewActive && styles.previewDotActive]}
                onPress={() => goToStory(stories.findIndex((item) => item.id === previewStory.id))}
              >
                {previewStory.imageUrl ? (
                  <ImageBackground
                    source={{ uri: previewStory.imageUrl }}
                    style={styles.previewDotMedia}
                    imageStyle={styles.previewDotRadius}
                  >
                    <View style={styles.previewDotOverlay} />
                    {previewStory.videoUrl ? (
                      <View style={styles.previewDotPlayBadge}>
                        <Feather name="play" size={10} color="#fff" />
                      </View>
                    ) : null}
                  </ImageBackground>
                ) : (
                  <View
                    style={[
                      styles.previewDotMedia,
                      styles.previewDotFallback,
                      { backgroundColor: previewStory.bgColor ?? previewStory.chefCoverColor },
                    ]}
                  >
                    <View style={styles.previewDotOverlay} />
                    <Text style={styles.previewDotEmoji}>{previewStory.emoji ?? "🍽️"}</Text>
                    {previewStory.videoUrl ? (
                      <View style={styles.previewDotPlayBadge}>
                        <Feather name="play" size={10} color="#fff" />
                      </View>
                    ) : null}
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.flexSpacer} />

      <View style={styles.content}>
        <View style={styles.storyBadge}>
          <Feather name={story.videoUrl ? "play-circle" : "camera"} size={14} color="#fff" />
          <Text style={styles.storyBadgeText}>{story.videoUrl ? "Story video" : "Story cuisine"}</Text>
        </View>
        {story.videoUrl ? (
          <View style={styles.loopBadge}>
            <Text style={styles.loopBadgeText}>Lecture {Math.min(completedLoops + 1, STORY_LOOPS_BEFORE_ADVANCE)}/{STORY_LOOPS_BEFORE_ADVANCE}</Text>
          </View>
        ) : null}
        {!story.videoUrl ? <Text style={styles.storyEmoji}>{story.emoji ?? "🍲"}</Text> : null}
        <Text style={styles.caption}>{story.caption}</Text>
        {!!story.dishName && (
          <Text style={styles.dish}>
            {story.dishName}
            {dishPrice ? ` · ${dishPrice}` : ""}
          </Text>
        )}

        <View style={styles.ctaRow}>
          {!!story.dishName ? (
            <Pressable
              style={styles.primaryBtn}
              onPress={() =>
                router.push({
                  pathname: "/order/[chefId]",
                  params: {
                    chefId: story.chefId,
                    dishName: story.dishName,
                    price: story.price != null ? String(story.price) : undefined,
                    storyCaption: story.caption,
                  },
                })
              }
            >
              <Text style={styles.primaryBtnText}>Commander ce plat</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.secondaryPrimaryBtn, !story.dishName && styles.secondaryPrimaryBtnFull]}
            onPress={() => router.push({ pathname: "/chef/[id]", params: { id: story.chefId } })}
          >
            <Text style={styles.secondaryPrimaryBtnText}>Voir la cuisiniere</Text>
          </Pressable>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, !hasPrevious && styles.actionBtnDisabled]}
            onPress={() => hasPrevious && goToStory(storyIndex - 1)}
            disabled={!hasPrevious}
          >
            <Feather name="arrow-left" size={18} color="#fff" />
            <Text style={styles.actionLabel}>Prec.</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnCenter, !hasNext && styles.actionBtnDisabled]}
            onPress={() => hasNext && goToStory(storyIndex + 1)}
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
      {story.videoUrl ? (
        <View style={styles.imageBg}>
          <VideoView player={videoPlayer} style={styles.videoBg} contentFit="cover" nativeControls={false} />
          <View style={[styles.overlay, { backgroundColor: "rgba(26,18,10,0.34)" }]} />
          {cardContent}
        </View>
      ) : story.imageUrl ? (
        <ImageBackground source={{ uri: story.imageUrl }} style={styles.imageBg}>
          <View style={[styles.overlay, { backgroundColor: "rgba(26,18,10,0.34)" }]} />
          {cardContent}
        </ImageBackground>
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
  previewRailWrap: {
    paddingTop: 2,
    paddingBottom: 14,
  },
  previewRail: {
    gap: 8,
    paddingHorizontal: 14,
    paddingRight: 20,
  },
  previewDot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
  },
  previewDotActive: {
    borderColor: "rgba(255,255,255,0.92)",
    transform: [{ scale: 1.08 }],
    shadowColor: "#fff",
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  previewDotMedia: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  previewDotRadius: {
    borderRadius: 21,
  },
  previewDotOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,8,5,0.14)",
  },
  previewDotFallback: {
    position: "relative",
  },
  previewDotEmoji: {
    fontSize: 18,
  },
  previewDotPlayBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.46)",
    alignItems: "center",
    justifyContent: "center",
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
  loopBadge: {
    alignSelf: "flex-start",
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(212,97,26,0.88)",
  },
  loopBadgeText: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
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
  ctaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    alignItems: "center",
  },
  actionBtn: {
    flex: 1,
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
  actionBtnCenter: {
    justifyContent: "center",
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
  secondaryPrimaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryPrimaryBtnFull: {
    flex: 1,
  },
  secondaryPrimaryBtnText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
});
