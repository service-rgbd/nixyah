import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";

import Colors from "@/constants/colors";
import { Story, useApp } from "@/contexts/AppContext";

function isFreshVideoStory(story: Story) {
  if (!story.videoUrl) {
    return false;
  }

  const createdAt = new Date(story.createdAt).getTime();
  return Date.now() - createdAt < 6 * 60 * 60 * 1000;
}

function StoryBubble({ story }: { story: Story }) {
  const initials = story.chefName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const bg = story.bgColor ?? story.chefCoverColor;
  const hasNewVideo = isFreshVideoStory(story);

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/story/[id]", params: { id: story.id } })}
      style={styles.bubbleWrapper}
    >
      <View style={[styles.bubbleRing, { borderColor: bg }]}>
        <View style={[styles.bubbleInner, { backgroundColor: bg }]}> 
          {story.imageUrl ? (
            <Image source={{ uri: story.imageUrl }} style={styles.bubbleImage} />
          ) : story.videoUrl ? (
            <View style={styles.videoBubbleFallback}>
              <Feather name="play" size={20} color="#fff" />
            </View>
          ) : story.emoji ? (
            <Text style={styles.bubbleEmoji}>{story.emoji}</Text>
          ) : (
            <Text style={styles.bubbleInitials}>{initials}</Text>
          )}
        </View>
      </View>
      {hasNewVideo ? (
        <View style={styles.newVideoBadge}>
          <Text style={styles.newVideoBadgeText}>Nouvelle vidéo</Text>
        </View>
      ) : null}
      <Text style={styles.bubbleLabel} numberOfLines={1}>
        {story.chefName.split(" ")[0]}
      </Text>
    </Pressable>
  );
}

function StoryCard({ story, isActive, cardHeight }: { story: Story; isActive: boolean; cardHeight: number }) {
  const bg = story.imageUrl ? undefined : story.bgColor ?? story.chefCoverColor;
  const player = useVideoPlayer(story.videoUrl ?? null, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });

  useEffect(() => {
    if (!story.videoUrl) {
      return;
    }

    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player, story.videoUrl]);

  const content = (
    <View style={[styles.cardContent, { backgroundColor: bg, minHeight: cardHeight }]}> 
      <View style={styles.cardTopRow}>
        <View style={styles.cardChefRow}>
          <View style={[styles.cardChefAvatar, { backgroundColor: story.chefCoverColor }]}> 
            <Text style={styles.cardChefAvatarText}>
              {story.chefName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.chef}>{story.chefName}</Text>
            <Text style={styles.cardMeta}>{story.videoUrl ? "Vidéo du moment" : "Publication du jour"}</Text>
          </View>
        </View>
        {isFreshVideoStory(story) ? (
          <View style={styles.cardFreshBadge}>
            <Text style={styles.cardFreshBadgeText}>Nouveau</Text>
          </View>
        ) : null}
      </View>

      {story.videoUrl ? (
        <View style={styles.videoBadge}>
          <Feather name="play-circle" size={18} color="#fff" />
          <Text style={styles.videoBadgeText}>{story.videoDurationSeconds ? `${Math.round(story.videoDurationSeconds)} sec` : "Vidéo"}</Text>
          <Text style={styles.videoBadgeDot}>•</Text>
          <Text style={styles.videoBadgeText}>{isActive ? "Lecture" : "Pause"}</Text>
        </View>
      ) : (
        <Text style={styles.emoji}>{story.emoji ?? "🍲"}</Text>
      )}

      <Text style={styles.caption} numberOfLines={3}>{story.caption}</Text>
      {!!story.dishName && (
        <Text style={styles.cardDish}>
          {story.dishName}
          {story.price ? ` · ${story.price} FCFA` : ""}
        </Text>
      )}
    </View>
  );

  return (
    <Pressable onPress={() => router.push({ pathname: "/story/[id]", params: { id: story.id } })} style={styles.cardWrapper}>
      {story.videoUrl ? (
        <View style={[styles.cardImage, { minHeight: cardHeight }]}> 
          <VideoView player={player} style={styles.cardVideo} contentFit="cover" nativeControls={false} />
          <View style={styles.cardOverlay} />
          {content}
        </View>
      ) : story.imageUrl ? (
        <ImageBackground source={{ uri: story.imageUrl }} style={[styles.cardImage, { minHeight: cardHeight }]} imageStyle={styles.cardImageRadius}>
          <View style={styles.cardOverlay} />
          {content}
        </ImageBackground>
      ) : (
        content
      )}
    </Pressable>
  );
}

export default function StoriesFeed() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { stories, user } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const cardHeight = Math.max(420, Math.floor(height * 0.62));
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);

  const orderedStories = useMemo(
    () =>
      [...stories].sort((left, right) => {
        const videoDiff = Number(Boolean(right.videoUrl)) - Number(Boolean(left.videoUrl));
        if (videoDiff !== 0) return videoDiff;
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }),
    [stories]
  );

  const uniqueStories = useMemo(() => {
    const result: Story[] = [];
    const seen = new Set<string>();

    for (const story of orderedStories) {
      if (!seen.has(story.chefId)) {
        seen.add(story.chefId);
        result.push(story);
      }
    }

    return result;
  }, [orderedStories]);

  useEffect(() => {
    if (!orderedStories.length) {
      setActiveStoryId(null);
      return;
    }

    setActiveStoryId((current) => current ?? orderedStories[0].id);
  }, [orderedStories]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken<Story>> }) => {
    const firstVisible = viewableItems.find((item) => item.isViewable && item.item)?.item ?? null;
    setActiveStoryId(firstVisible?.id ?? null);
  });

  return (
    <View style={[styles.container, { paddingTop: topInset }]}> 
      <FlatList
        data={orderedStories}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged.current}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.eyebrow}>Stories food</Text>
                <Text style={styles.title}>Reels des cuisinières</Text>
                <Text style={styles.headerSub}>Les vidéos récentes passent en premier et se lisent quand elles entrent vraiment dans l’écran.</Text>
              </View>
              {user?.type === "chef" ? (
                <Pressable style={styles.publishBtn} onPress={() => router.push("/chef/post-story") }>
                  <Feather name="plus" size={16} color="#fff" />
                  <Text style={styles.publishBtnText}>Publier</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.bubblesSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bubblesRow}>
                {uniqueStories.map((story) => (
                  <StoryBubble key={story.id} story={story} />
                ))}
              </ScrollView>
            </View>

            <View style={styles.feedHeader}>
              <Text style={styles.feedTitle}>À regarder</Text>
              <Text style={styles.feedSub}>Glisse dans les vidéos du jour, cuisine par cuisine.</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <StoryCard story={item} isActive={activeStoryId === item.id} cardHeight={cardHeight} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aucune story pour l’instant</Text>
            <Text style={styles.emptyDesc}>Dès qu’une cuisinière publie une vidéo, elle apparaîtra ici en premier.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: 20, paddingBottom: Platform.OS === "web" ? 120 : 110 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headerTextWrap: { flex: 1, minWidth: 0, paddingRight: 4 },
  eyebrow: { fontSize: 12, fontFamily: "Poppins_700Bold", color: Colors.light.tint, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 },
  title: { fontSize: 28, fontFamily: "Poppins_700Bold", color: Colors.light.text, lineHeight: 34 },
  headerSub: { marginTop: 6, fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, lineHeight: 18, maxWidth: 290 },
  publishBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    flexShrink: 0,
  },
  publishBtnText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  bubblesSection: { marginTop: 18, marginBottom: 20 },
  bubblesRow: { gap: 14, paddingRight: 20 },
  bubbleWrapper: { width: 88, alignItems: "center", gap: 7 },
  bubbleRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  bubbleInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bubbleImage: { width: 60, height: 60, borderRadius: 30 },
  videoBubbleFallback: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.22)" },
  bubbleEmoji: { fontSize: 28 },
  bubbleInitials: { fontSize: 18, fontFamily: "Poppins_700Bold", color: "#fff" },
  newVideoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.light.tint, marginTop: -2 },
  newVideoBadgeText: { fontSize: 9, fontFamily: "Poppins_700Bold", color: "#fff", textTransform: "uppercase", letterSpacing: 0.4 },
  bubbleLabel: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary, textAlign: "center" },
  feedHeader: { marginBottom: 12 },
  feedTitle: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  feedSub: { marginTop: 4, fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, lineHeight: 18 },
  cardWrapper: { width: "100%", borderRadius: 28, overflow: "hidden" },
  cardImage: { width: "100%", justifyContent: "flex-end", borderRadius: 28, overflow: "hidden" },
  cardImageRadius: { borderRadius: 28 },
  cardVideo: { ...StyleSheet.absoluteFillObject },
  cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)", borderRadius: 28 },
  cardContent: { padding: 20, justifyContent: "flex-end", borderRadius: 28 },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12 },
  cardChefRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  cardChefAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
  },
  cardChefAvatarText: { fontSize: 12, fontFamily: "Poppins_700Bold", color: "#fff" },
  cardMeta: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.75)" },
  cardFreshBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(212,97,26,0.92)" },
  cardFreshBadgeText: { fontSize: 10, fontFamily: "Poppins_700Bold", color: "#fff", textTransform: "uppercase", letterSpacing: 0.4 },
  videoBadge: { alignSelf: "flex-start", flexDirection: "row", gap: 8, alignItems: "center", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)" },
  videoBadgeText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  videoBadgeDot: { fontSize: 12, color: "rgba(255,255,255,0.72)" },
  emoji: { fontSize: 34, color: "#fff" },
  chef: { fontFamily: "Poppins_600SemiBold", color: "#fff" },
  caption: { fontSize: 20, fontFamily: "Poppins_700Bold", color: "#fff", marginTop: 12, lineHeight: 28, maxWidth: "92%" },
  cardDish: { marginTop: 12, fontSize: 13, fontFamily: "Poppins_500Medium", color: "rgba(255,255,255,0.88)" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  emptyDesc: { maxWidth: 280, textAlign: "center", fontSize: 13, lineHeight: 19, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
});
