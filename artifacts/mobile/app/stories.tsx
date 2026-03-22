import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";

import Colors from "@/constants/colors";
import { Story, useApp, type StoryComment } from "@/contexts/AppContext";

type StoryItemProps = {
  story: Story;
  isActive: boolean;
  isScreenFocused: boolean;
  screenHeight: number;
  screenWidth: number;
  topInset: number;
  bottomInset: number;
  isChef: boolean;
  onOpenComments: (storyId: string) => void;
};

const PREDEFINED_COMMENTS = [
  "Très bon goût",
  "Magnifique présentation",
  "Ça donne vraiment faim",
  "Belle idée de plat",
  "Pas trop mon goût",
  "Visuel un peu chargé",
  "Le dressage pourrait être mieux",
];

function toFiniteNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toSafeString(value: unknown, fallback = "") {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function formatCompact(value: unknown) {
  const safeValue = toFiniteNumber(value, 0);

  if (safeValue >= 1_000_000) {
    return `${(safeValue / 1_000_000).toFixed(1)}M`;
  }

  if (safeValue >= 1_000) {
    return `${(safeValue / 1_000).toFixed(1)}k`;
  }

  return `${safeValue}`;
}

function getChefInitials(value: unknown) {
  return toSafeString(value, "Chef")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getChefHandle(value: unknown) {
  return toSafeString(value, "chef").toLowerCase().replace(/\s+/g, "");
}

function getSafeVideoUrl(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getPlayerPlayingState(player: ReturnType<typeof useVideoPlayer>) {
  try {
    return player.playing;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("NativeSharedObjectNotFoundException")) {
      console.warn("Failed to read player state", error);
    }
    return false;
  }
}

function pausePlayerSafely(player: ReturnType<typeof useVideoPlayer>) {
  try {
    if (getPlayerPlayingState(player)) {
      player.pause();
    }
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("NativeSharedObjectNotFoundException")) {
      console.warn("Failed to pause player", error);
    }
  }
}

function playPlayerSafely(player: ReturnType<typeof useVideoPlayer>) {
  try {
    player.play();
  } catch (error) {
    console.warn("Failed to play player", error);
  }
}

function getStoryStats(story: Story) {
  const seed = toSafeString(story.id, "story").split("").reduce((total, char) => total + char.charCodeAt(0), 0);

  return {
    shares: 8 + (seed % 120),
    views: 4_500 + (seed % 38_000),
  };
}

function StoryItem({
  story,
  isActive,
  isScreenFocused,
  screenHeight,
  screenWidth,
  topInset,
  bottomInset,
  isChef,
  onOpenComments,
}: StoryItemProps) {
  const stats = useMemo(() => getStoryStats(story), [story]);
  const { likeStory } = useApp();
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const lastTapRef = useRef(0);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const safeVideoUrl = getSafeVideoUrl(story.videoUrl);
  const safeLikeCount = toFiniteNumber(story.likeCount, 0);
  const safeCommentCount = toFiniteNumber(story.commentCount, 0);
  const safeChefName = toSafeString(story.chefName, "Chef");
  const safeCaption = toSafeString(story.caption, "");
  const safeDishName = toSafeString(story.dishName, "");
  const safePrice = toFiniteNumber(story.price, 0);
  const safeDurationSeconds = toFiniteNumber(story.videoDurationSeconds, 0);
  const safeChefInitials = getChefInitials(story.chefName);
  const safeChefHandle = getChefHandle(story.chefName);

  const player = useVideoPlayer(safeVideoUrl, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = false;
  });

  useEffect(() => {
    if (!safeVideoUrl) {
      return;
    }

    if (isScreenFocused && isActive && !isPausedByUser) {
      playPlayerSafely(player);
      return;
    }

    pausePlayerSafely(player);
  }, [isActive, isPausedByUser, isScreenFocused, player, safeVideoUrl]);

  useEffect(() => {
    if (!isActive) {
      setIsPausedByUser(false);
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      pausePlayerSafely(player);
    };
  }, [player]);

  useEffect(() => {
    return () => {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
    };
  }, []);

  const animateHeart = () => {
    heartScale.setValue(0.4);
    heartOpacity.setValue(0);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(heartOpacity, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heartOpacity, {
          toValue: 0,
          duration: 260,
          delay: 260,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.spring(heartScale, {
          toValue: 1.1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.spring(heartScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const handleDoubleTap = () => {
    if (!story.likedByMe) {
      void likeStory(story.id);
    }

    animateHeart();
  };

  const handleLikePress = () => {
    void likeStory(story.id);
  };

  const handleSingleTap = () => {
    if (!safeVideoUrl) {
      return;
    }

    setIsPausedByUser((current) => !current);
  };

  const handleMediaTap = () => {
    const now = Date.now();

    if (lastTapRef.current && now - lastTapRef.current < 260) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }

      lastTapRef.current = 0;
      handleDoubleTap();
      return;
    }

    lastTapRef.current = now;
    singleTapTimeoutRef.current = setTimeout(() => {
      handleSingleTap();
      lastTapRef.current = 0;
    }, 260);
  };

  const media = safeVideoUrl ? (
    <View style={styles.mediaLayer}>
      <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} />
    </View>
  ) : story.imageUrl ? (
    <ImageBackground source={{ uri: story.imageUrl }} style={styles.mediaLayer} imageStyle={styles.imageFill} />
  ) : (
    <View
      style={[
        styles.mediaLayer,
        { backgroundColor: story.bgColor ?? story.chefCoverColor },
      ]}
    >
      <Text style={styles.fallbackEmoji}>{story.emoji ?? "🍽️"}</Text>
    </View>
  );

  return (
    <View style={[styles.storyPage, { width: screenWidth, height: screenHeight }]}> 
      <Pressable style={StyleSheet.absoluteFill} onPress={handleMediaTap}>
        {media}
        <View style={styles.darkOverlay} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.heartBurst,
            {
              opacity: heartOpacity,
              transform: [{ scale: heartScale }],
            },
          ]}
        >
          <Feather name="heart" size={92} color="#fff" />
        </Animated.View>
      </Pressable>

      <View style={[styles.topOverlay, { paddingTop: topInset + 10 }]}> 
        <View style={styles.feedBadge}>
          <Text style={styles.feedBadgeText}>Stories</Text>
        </View>
        <View style={styles.topRightActions}>
          {isChef ? (
            <Pressable style={styles.publishBtn} onPress={() => router.push("/chef/post-story")}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.publishBtnText}>Publier</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.bottomOverlay, { paddingBottom: bottomInset + 24 }]}> 
        <View style={styles.metaColumn}>
          <View style={styles.authorRow}>
            <Pressable
              onPress={() => router.push({ pathname: "/chef/[id]", params: { id: story.chefId } })}
              style={[styles.avatarRing, { borderColor: story.chefCoverColor }]}
            >
              <View style={[styles.avatarInner, { backgroundColor: story.chefCoverColor }]}> 
                <Text style={styles.avatarText}>{safeChefInitials}</Text>
              </View>
            </Pressable>
            <View style={styles.authorTextWrap}>
              <Text style={styles.username}>@{safeChefHandle}</Text>
              <Text style={styles.authorName}>{safeChefName}</Text>
            </View>
          </View>

          <Text style={styles.storyTitle}>{safeCaption}</Text>

          {!!safeDishName ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/order/[chefId]",
                  params: {
                    chefId: story.chefId,
                    dishName: safeDishName,
                    price: safePrice > 0 ? `${safePrice}` : undefined,
                    storyCaption: safeCaption,
                  },
                })
              }
              style={styles.dishPill}
            >
              <Feather name="shopping-bag" size={14} color="#fff" />
              <Text style={styles.dishPillText}>
                {safeDishName}
                {safePrice > 0 ? ` · ${safePrice.toLocaleString("fr-FR")} FCFA` : ""}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.statsRow}>
            <Text style={styles.statsText}>{formatCompact(stats.views)} vues</Text>
            <Text style={styles.statsDot}>•</Text>
            <Text style={styles.statsText}>{safeDurationSeconds > 0 ? `${Math.round(safeDurationSeconds)} sec` : "Story"}</Text>
            <Text style={styles.statsDot}>•</Text>
            <Text style={styles.statsText}>{safeVideoUrl ? (isPausedByUser ? "En pause" : isActive ? "Lecture" : getPlayerPlayingState(player) ? "Lecture" : "Prête") : "Image"}</Text>
          </View>
        </View>

        <View style={styles.sideActions}>
          <Pressable style={styles.sideAction} onPress={handleDoubleTap}>
            <View style={[styles.iconCircle, story.likedByMe && styles.iconCircleLiked]}>
              <Feather name="heart" size={22} color="#fff" />
            </View>
            <Text style={styles.sideActionLabel}>{formatCompact(safeLikeCount)}</Text>
          </Pressable>

          <Pressable style={styles.sideAction} onPress={() => onOpenComments(story.id)}>
            <View style={styles.iconCircle}>
              <Feather name="message-circle" size={22} color="#fff" />
            </View>
            <Text style={styles.sideActionLabel}>{formatCompact(safeCommentCount)}</Text>
          </Pressable>

          <Pressable style={styles.sideAction}>
            <View style={styles.iconCircle}>
              <Feather name="send" size={20} color="#fff" />
            </View>
            <Text style={styles.sideActionLabel}>{formatCompact(stats.shares)}</Text>
          </Pressable>

          <Pressable
            style={styles.sideAction}
            onPress={() => router.push({ pathname: "/chef/[id]", params: { id: story.chefId } })}
          >
            <View style={[styles.profileCircle, { borderColor: story.chefCoverColor }]}> 
              <View style={[styles.profileInner, { backgroundColor: story.chefCoverColor }]}> 
                <Text style={styles.profileText}>{safeChefInitials}</Text>
              </View>
            </View>
            <Text style={styles.sideActionLabel}>Profil</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function StoriesFeed() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { stories, user, addStoryComment } = useApp();
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeCommentsStoryId, setActiveCommentsStoryId] = useState<string | null>(null);
  const [customComment, setCustomComment] = useState("");

  const orderedStories = useMemo(
    () =>
      [...stories].sort((left, right) => {
        const videoDiff = Number(Boolean(right.videoUrl)) - Number(Boolean(left.videoUrl));
        if (videoDiff !== 0) {
          return videoDiff;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }),
    [stories]
  );

  useFocusEffect(
    React.useCallback(() => {
      setIsScreenFocused(true);

      if (Platform.OS !== "web") {
        StatusBar.setHidden(true, "fade");
        StatusBar.setBarStyle("light-content");
      }

      return () => {
        setIsScreenFocused(false);

        if (Platform.OS !== "web") {
          StatusBar.setHidden(false, "fade");
          StatusBar.setBarStyle("dark-content");
        }
      };
    }, []),
  );

  useEffect(() => {
    if (!orderedStories.length) {
      setCurrentIndex(0);
      return;
    }

    setCurrentIndex((index) => Math.min(index, orderedStories.length - 1));
  }, [orderedStories.length]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken<Story>> }) => {
    const visibleItem = viewableItems.find((item) => item.isViewable && item.index != null);
    if (visibleItem?.index != null) {
      setCurrentIndex(visibleItem.index);
    }
  });

  const selectedStory = activeCommentsStoryId
    ? orderedStories.find((story) => story.id === activeCommentsStoryId) ?? null
    : null;

  const submitComment = async (storyId: string, body: string) => {
    if (!user) {
      Alert.alert("Connexion requise", "Connectez-vous pour aimer et commenter les stories.");
      return;
    }

    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }

    await addStoryComment(storyId, trimmed);
    setCustomComment("");
  };

  if (!orderedStories.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Aucune story pour l’instant</Text>
        <Text style={styles.emptyDesc}>Dès qu’une cuisinière publie une vidéo, elle apparaîtra ici en plein écran.</Text>
        {user?.type === "chef" ? (
          <Pressable style={styles.emptyPublishBtn} onPress={() => router.push("/chef/post-story")}>
            <Text style={styles.emptyPublishBtnText}>Publier une story</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orderedStories}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <StoryItem
            story={item}
            isActive={index === currentIndex}
            isScreenFocused={isScreenFocused}
            screenHeight={height}
            screenWidth={width}
            topInset={insets.top}
            bottomInset={insets.bottom}
            isChef={user?.type === "chef"}
            onOpenComments={setActiveCommentsStoryId}
          />
        )}
        pagingEnabled
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={2}
        removeClippedSubviews
        disableIntervalMomentum
      />

      <Modal
        visible={Boolean(selectedStory)}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveCommentsStoryId(null)}
      >
        <View style={styles.commentsModalOverlay}>
          <View style={styles.commentsSheet}>
            <View style={styles.commentsHeader}>
              <View>
                <Text style={styles.commentsTitle}>Commentaires</Text>
                <Text style={styles.commentsSubtitle}>
                  {selectedStory ? `${selectedStory.commentCount} avis réels d'utilisateurs` : ""}
                </Text>
              </View>
              <Pressable onPress={() => setActiveCommentsStoryId(null)} style={styles.commentsCloseBtn}>
                <Feather name="x" size={20} color={Colors.light.text} />
              </Pressable>
            </View>

            <Text style={styles.suggestionsLabel}>Commentaires prédéfinis</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
              {PREDEFINED_COMMENTS.map((comment) => (
                <Pressable
                  key={comment}
                  style={styles.suggestionChip}
                  onPress={() => selectedStory && void submitComment(selectedStory.id, comment)}
                >
                  <Text style={styles.suggestionChipText}>{comment}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.commentComposer}>
              <TextInput
                value={customComment}
                onChangeText={setCustomComment}
                placeholder="Ajouter un commentaire personnel"
                placeholderTextColor={Colors.light.textTertiary}
                style={styles.commentInput}
              />
              <Pressable
                style={styles.commentSendBtn}
                onPress={() => selectedStory && void submitComment(selectedStory.id, customComment)}
              >
                <Feather name="send" size={16} color="#fff" />
              </Pressable>
            </View>

            <ScrollView style={styles.commentsList} contentContainerStyle={styles.commentsListContent}>
              {selectedStory?.comments.length ? (
                selectedStory.comments.map((comment: StoryComment) => (
                  <View key={comment.id} style={styles.commentCard}>
                    <View style={styles.commentAvatarWrap}>
                      <View
                        style={[
                          styles.commentAvatar,
                          { backgroundColor: comment.userCoverColor ?? Colors.light.tint },
                        ]}
                      >
                        <Text style={styles.commentAvatarText}>{getChefInitials(comment.userName)}</Text>
                      </View>
                    </View>
                    <View style={styles.commentBodyWrap}>
                      <View style={styles.commentMetaRow}>
                        <Text style={styles.commentAuthor}>{toSafeString(comment.userName, "Utilisateur")}</Text>
                        <Text style={styles.commentDate}>{toSafeString(comment.createdAt) ? new Date(toSafeString(comment.createdAt)).toLocaleDateString() : ""}</Text>
                      </View>
                      <Text style={styles.commentBody}>{toSafeString(comment.body, "")}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noCommentsText}>Aucun commentaire pour le moment. Sois la première personne à réagir.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  storyPage: {
    backgroundColor: "#050505",
  },
  mediaLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#050505",
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  imageFill: {
    width: "100%",
    height: "100%",
  },
  fallbackEmoji: {
    fontSize: 96,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  heartBurst: {
    position: "absolute",
    top: "42%",
    left: "50%",
    marginLeft: -46,
    marginTop: -46,
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  feedBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  feedBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    letterSpacing: 0.4,
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  publishBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(212,97,26,0.94)",
  },
  publishBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
  },
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
  },
  metaColumn: {
    flex: 1,
    justifyContent: "flex-end",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  avatarInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
  },
  authorTextWrap: {
    flex: 1,
  },
  username: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
  },
  authorName: {
    marginTop: 2,
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
  },
  storyTitle: {
    color: "#fff",
    fontSize: 26,
    lineHeight: 34,
    fontFamily: "Poppins_700Bold",
    marginBottom: 14,
    maxWidth: "92%",
  },
  dishPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 14,
  },
  dishPillText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  statsText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
  },
  statsDot: {
    color: "rgba(255,255,255,0.5)",
  },
  sideActions: {
    width: 78,
    alignItems: "center",
    gap: 18,
  },
  sideAction: {
    alignItems: "center",
    gap: 7,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  iconCircleLiked: {
    backgroundColor: "rgba(212,97,26,0.92)",
  },
  sideActionLabel: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
  },
  profileCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  profileInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  profileText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
    textAlign: "center",
  },
  emptyDesc: {
    marginTop: 10,
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Poppins_400Regular",
    textAlign: "center",
    maxWidth: 320,
  },
  emptyPublishBtn: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: Colors.light.tint,
  },
  emptyPublishBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
  },
  commentsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  commentsSheet: {
    minHeight: "58%",
    maxHeight: "78%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "web" ? 18 : 28,
  },
  commentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  commentsTitle: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  commentsSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  commentsCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.backgroundSecondary,
  },
  suggestionsLabel: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  suggestionsRow: {
    gap: 10,
    paddingRight: 20,
    marginBottom: 14,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  suggestionChipText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  commentComposer: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  commentInput: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.text,
  },
  commentSendBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    gap: 12,
    paddingBottom: 8,
  },
  commentCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  commentAvatarWrap: {
    paddingTop: 2,
  },
  commentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
  },
  commentBodyWrap: {
    flex: 1,
    gap: 4,
  },
  commentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  commentAuthor: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  commentDate: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  commentBody: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  noCommentsText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginTop: 24,
  },
});
