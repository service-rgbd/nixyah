import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
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

import { CachedRemoteBackground, CachedRemoteImage, prefetchRemoteImages } from "@/components/CachedRemoteImage";
import { apiFetch } from "@/constants/api";
import Colors from "@/constants/colors";
import { Story, useApp, type StoryComment } from "@/contexts/AppContext";

type FeedStory = Story & {
  isIntroStory?: boolean;
  localVideoSource?: number;
};

const NIXYAH_INTRO_STORY_ID = "nixyah-intro-story";
const NIXYAH_INTRO_VIDEO = require("../assets/nixyah.mp4");

type StoryItemProps = {
  story: FeedStory;
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
  "Appétissant",
  "Très beau",
  "J'aime bien",
  "À revoir",
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

function buildIntroStory(): FeedStory {
  const now = new Date();
  return {
    id: NIXYAH_INTRO_STORY_ID,
    chefId: NIXYAH_INTRO_STORY_ID,
    chefName: "Nixyah",
    chefCoverColor: Colors.light.tint,
    caption: "Nixyah",
    dishName: null,
    price: null,
    emoji: null,
    bgColor: Colors.light.tintDark,
    imageUrl: null,
    videoUrl: null,
    videoDurationSeconds: null,
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    comments: [],
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    isIntroStory: true,
    localVideoSource: NIXYAH_INTRO_VIDEO,
  };
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
  const { getChef, likeStory, token, user } = useApp();
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [isOrderingDish, setIsOrderingDish] = useState(false);
  const lastTapRef = useRef(0);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const isIntroStory = Boolean(story.isIntroStory);
  const safeVideoUrl = getSafeVideoUrl(story.videoUrl);
  const videoSource = story.localVideoSource ?? safeVideoUrl;
  const safeLikeCount = toFiniteNumber(story.likeCount, 0);
  const safeCommentCount = toFiniteNumber(story.commentCount, 0);
  const safeChefName = toSafeString(story.chefName, "Chef");
  const safeCaption = toSafeString(story.caption, "");
  const safeDishName = toSafeString(story.dishName, "");
  const safePrice = toFiniteNumber(story.price, 0);
  const safeChefInitials = getChefInitials(story.chefName);
  const safeChefHandle = getChefHandle(story.chefName);
  const isCompactViewport = screenWidth < 390 || screenHeight < 760;
  const storyChefAvatarUrl = getChef(story.chefId)?.avatarUrl ?? null;
  const promotedDish = useMemo(() => {
    if (!safeDishName) {
      return null;
    }

    const chef = getChef(story.chefId);
    return (
      chef?.dishes.find((dish) => {
        const sameName = dish.name.trim().toLowerCase() === safeDishName.trim().toLowerCase();
        const samePrice = safePrice <= 0 || Math.abs(dish.price - safePrice) < 1;
        return sameName && samePrice;
      }) ?? null
    );
  }, [getChef, safeDishName, safePrice, story.chefId]);

  const player = useVideoPlayer(videoSource as any, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = false;
  });

  useEffect(() => {
    if (!videoSource) {
      return;
    }

    if (isScreenFocused && isActive && !isPausedByUser) {
      playPlayerSafely(player);
      return;
    }

    pausePlayerSafely(player);
  }, [isActive, isPausedByUser, isScreenFocused, player, videoSource]);

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
    if (isIntroStory) {
      return;
    }

    if (!story.likedByMe) {
      void likeStory(story.id);
    }

    animateHeart();
  };

  const handleLikePress = () => {
    if (isIntroStory) {
      return;
    }

    void likeStory(story.id);
  };

  const handleSingleTap = () => {
    if (!videoSource) {
      return;
    }

    setIsPausedByUser((current) => !current);
  };

  const handleOrderPress = async () => {
    if (!promotedDish) {
      router.push({ pathname: "/chef/[id]", params: { id: story.chefId, dishId: safeDishName } });
      return;
    }

    if (!user) {
      router.push("/auth/login");
      return;
    }

    if (user.type !== "client" || !token) {
      Alert.alert("Commande indisponible", "Seuls les clients peuvent commander directement depuis les stories.");
      return;
    }

    try {
      setIsOrderingDish(true);
      await apiFetch("/cart/items", {
        method: "POST",
        token,
        body: JSON.stringify({ dishId: Number(promotedDish.id), quantity: 1 }),
      });
      router.push("/(tabs)/cart");
    } catch (error: any) {
      Alert.alert("Erreur", error?.message ?? "Impossible d'ajouter ce plat au panier");
    } finally {
      setIsOrderingDish(false);
    }
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

  const media = videoSource ? (
    <View style={styles.mediaLayer}>
      <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} />
    </View>
  ) : story.imageUrl ? (
    <CachedRemoteBackground uri={story.imageUrl} style={styles.mediaLayer} imageStyle={styles.imageFill} />
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
        {!isIntroStory ? <View style={styles.bottomScrim} /> : null}
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
          <Text style={styles.feedBadgeText}>{isIntroStory ? "Presentation" : "Stories"}</Text>
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

      <View
        style={[
          styles.bottomOverlay,
          isCompactViewport && styles.bottomOverlayCompact,
          { paddingBottom: bottomInset + 10 },
        ]}
      > 
        <View style={[styles.metaColumn, !isIntroStory && styles.metaColumnCard, isCompactViewport && styles.metaColumnCompact]}>
          {!isIntroStory ? (
            <View style={styles.authorRow}>
              <Pressable
                disabled={isIntroStory}
                onPress={() => {
                  if (!isIntroStory) {
                    router.push({ pathname: "/chef/[id]", params: { id: story.chefId } });
                  }
                }}
                style={[styles.avatarRing, { borderColor: story.chefCoverColor }]}
              >
                <View style={[styles.avatarInner, { backgroundColor: story.chefCoverColor }]}> 
                  {storyChefAvatarUrl ? (
                    <CachedRemoteImage uri={storyChefAvatarUrl} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{safeChefInitials}</Text>
                  )}
                </View>
              </Pressable>
              <View style={styles.authorTextWrap}>
                <Text style={styles.username}>@{safeChefHandle}</Text>
                <Text style={styles.authorName}>{safeChefName}</Text>
              </View>
            </View>
          ) : null}

          <Text
            numberOfLines={isIntroStory ? 1 : 3}
            style={[
              styles.storyTitle,
              isIntroStory && styles.introStoryTitle,
              isIntroStory && isCompactViewport && styles.introStoryTitleCompact,
            ]}
          >
            {safeCaption}
          </Text>

          {!!safeDishName && !isIntroStory ? (
            <View style={styles.storyCommerceCard}>
              <View style={styles.storyCommerceMeta}>
                <Text style={styles.storyCommerceLabel}>Commande rapide</Text>
                <Text style={styles.storyCommerceTitle} numberOfLines={1}>{safeDishName}</Text>
                {safePrice > 0 ? (
                  <Text style={styles.storyCommercePrice}>{safePrice.toLocaleString("fr-FR")} FCFA</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => void handleOrderPress()}
                disabled={isOrderingDish}
                style={styles.storyCommerceButton}
              >
                {isOrderingDish ? (
                  <Text style={styles.storyCommerceButtonText}>Ajout...</Text>
                ) : (
                  <>
                    <Feather name="shopping-bag" size={14} color={Colors.light.text} />
                    <Text style={styles.storyCommerceButtonText}>Commander</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}

        </View>

        <View
          style={[
            styles.sideActions,
            isCompactViewport && styles.sideActionsCompact,
            isIntroStory && styles.introSideActions,
          ]}
        >
          {isIntroStory ? (
            <View style={[styles.introPanel, isCompactViewport && styles.introPanelCompact]}>
              <Text style={styles.introPanelEyebrow}>Nixyah</Text>
              <Text style={styles.introPanelTitle}>Video officielle</Text>
            </View>
          ) : null}

          {!isIntroStory ? (
            <>
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
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function StoriesFeed() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tabBarBottomInset = Platform.OS === "ios" ? Math.max(insets.bottom - 6, 10) : Math.max(insets.bottom, 8);
  const tabBarHeight = Platform.OS === "web" ? 66 : 50 + tabBarBottomInset;
  const { stories, user, addStoryComment, deleteStoryComment } = useApp();
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeCommentsStoryId, setActiveCommentsStoryId] = useState<string | null>(null);
  const [customComment, setCustomComment] = useState("");

  const orderedStories = useMemo<FeedStory[]>(
    () => {
      const introStory = buildIntroStory();
      const sortedStories = [...stories].sort((left, right) => {
        const videoDiff = Number(Boolean(right.videoUrl)) - Number(Boolean(left.videoUrl));
        if (videoDiff !== 0) {
          return videoDiff;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });

      return [introStory, ...sortedStories];
    },
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

  useEffect(() => {
    const nearbyStories = orderedStories.slice(Math.max(0, currentIndex - 1), currentIndex + 4);
    void prefetchRemoteImages(nearbyStories.map((story) => story.imageUrl));
  }, [currentIndex, orderedStories]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken<FeedStory>> }) => {
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

    if (storyId === NIXYAH_INTRO_STORY_ID) {
      return;
    }

    await addStoryComment(storyId, trimmed);
    setCustomComment("");
  };

  const handleDeleteComment = (storyId: string, commentId: string) => {
    Alert.alert("Supprimer ce commentaire", "Ce commentaire sera retire de la story.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          void deleteStoryComment(storyId, commentId).catch((error) => {
            const message = error instanceof Error && error.message ? error.message : "Le commentaire n'a pas pu etre supprime.";
            Alert.alert("Suppression impossible", message);
          });
        },
      },
    ]);
  };

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
            screenHeight={Math.max(height - tabBarHeight, 1)}
            screenWidth={width}
            topInset={insets.top}
            bottomInset={Math.max(insets.bottom, tabBarHeight)}
            isChef={user?.type === "chef"}
            onOpenComments={setActiveCommentsStoryId}
          />
        )}
        pagingEnabled
        snapToInterval={Math.max(height - tabBarHeight, 1)}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        getItemLayout={(_, index) => {
          const itemHeight = Math.max(height - tabBarHeight, 1);
          return { length: itemHeight, offset: itemHeight * index, index };
        }}
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

            <ScrollView style={styles.commentsList} contentContainerStyle={styles.commentsListContent}>
              {selectedStory?.comments.length ? (
                selectedStory.comments.map((comment: StoryComment) => (
                  <View key={comment.id} style={styles.commentCard}>
                    <View style={styles.commentAvatarWrap}>
                      {comment.userAvatarUrl ? (
                        <CachedRemoteImage uri={comment.userAvatarUrl} style={styles.commentAvatarImage} />
                      ) : (
                        <View
                          style={[
                            styles.commentAvatar,
                            { backgroundColor: comment.userCoverColor ?? Colors.light.tint },
                          ]}
                        >
                          <Text style={styles.commentAvatarText}>{getChefInitials(comment.userName)}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.commentBodyWrap}>
                      <View style={styles.commentMetaRow}>
                        <View style={styles.commentMetaMain}>
                          <Text style={styles.commentAuthor}>{toSafeString(comment.userName, "Utilisateur")}</Text>
                          <Text style={styles.commentDate}>{toSafeString(comment.createdAt) ? new Date(toSafeString(comment.createdAt)).toLocaleDateString() : ""}</Text>
                        </View>
                        {user?.id === comment.userId ? (
                          <Pressable
                            onPress={() => handleDeleteComment(selectedStory.id, comment.id)}
                            style={styles.commentDeleteBtn}
                            hitSlop={10}
                          >
                            <Feather name="trash-2" size={14} color={Colors.light.textTertiary} />
                          </Pressable>
                        ) : null}
                      </View>
                      <Text style={styles.commentBody}>{toSafeString(comment.body, "")}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noCommentsText}>Aucun commentaire pour le moment. Sois la première personne à réagir.</Text>
              )}
            </ScrollView>

            <View style={styles.suggestionsSection}>
              <Text style={styles.suggestionsLabel}>Reponses rapides</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
                {PREDEFINED_COMMENTS.map((comment) => (
                  <Pressable
                    key={comment}
                    style={styles.suggestionChip}
                    onPress={() => selectedStory && void submitComment(selectedStory.id, comment)}
                  >
                    <View style={styles.suggestionChipAccent} />
                    <Text style={styles.suggestionChipText}>{comment}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

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
  bottomScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    backgroundColor: "rgba(0,0,0,0.22)",
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
    gap: 14,
  },
  bottomOverlayCompact: {
    paddingHorizontal: 14,
    gap: 10,
  },
  metaColumn: {
    flex: 1,
    justifyContent: "flex-end",
    maxWidth: "76%",
  },
  metaColumnCard: {
    alignSelf: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 22,
    backgroundColor: "rgba(10,10,10,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  metaColumnCompact: {
    maxWidth: "72%",
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 8,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
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
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
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
    fontSize: 24,
    lineHeight: 31,
    fontFamily: "Poppins_700Bold",
    marginBottom: 6,
    maxWidth: "92%",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  introStoryTitle: {
    fontSize: 34,
    lineHeight: 40,
    maxWidth: "70%",
    marginBottom: 0,
  },
  introStoryTitleCompact: {
    fontSize: 28,
    lineHeight: 34,
    maxWidth: "76%",
  },
  storyCommerceCard: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 8,
  },
  storyCommerceMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  storyCommerceLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  storyCommerceTitle: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
  },
  storyCommercePrice: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
  },
  storyCommerceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#FFF4E5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 0,
    minWidth: 108,
    justifyContent: "center",
  },
  storyCommerceButtonText: {
    color: Colors.light.text,
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    opacity: 0.92,
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
    width: 72,
    alignItems: "center",
    gap: 12,
  },
  sideActionsCompact: {
    width: 58,
    gap: 10,
  },
  introSideActions: {
    width: "auto",
    alignItems: "flex-end",
  },
  introPanel: {
    width: 132,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.34)",
    gap: 2,
  },
  introPanelCompact: {
    width: 116,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 18,
  },
  introPanelEyebrow: {
    color: Colors.light.accent,
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  introPanelTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
  },
  sideAction: {
    alignItems: "center",
    gap: 5,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
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
    backgroundColor: "rgba(0,0,0,0.62)",
    justifyContent: "flex-end",
  },
  commentsSheet: {
    minHeight: "62%",
    maxHeight: "82%",
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
  suggestionsSection: {
    marginBottom: 6,
  },
  suggestionsLabel: {
    fontSize: 9,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.textTertiary,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.2,
    marginTop: 2,
  },
  suggestionsRow: {
    gap: 3,
    paddingRight: 12,
    paddingBottom: 0,
    marginBottom: 0,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(196,82,42,0.08)",
    borderWidth: 1,
    borderColor: "rgba(196,82,42,0.1)",
    minHeight: 24,
  },
  suggestionChipAccent: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.tint,
  },
  suggestionChipText: {
    fontSize: 9,
    lineHeight: 11,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
  commentComposer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 10,
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
    paddingBottom: 10,
  },
  commentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
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
    overflow: "hidden",
  },
  commentAvatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  commentAvatarText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
  },
  commentBodyWrap: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  commentMetaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  commentMetaMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
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
    flexShrink: 0,
  },
  commentDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  commentBody: {
    fontSize: 13,
    lineHeight: 18,
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
