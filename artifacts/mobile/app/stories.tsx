import { Feather } from "@expo/vector-icons";
import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, Image, ImageBackground } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useApp, Story } from "@/contexts/AppContext";

function StoryBubble({ story }: { story: Story }) {
  const initials = story.chefName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const bg = story.bgColor ?? story.chefCoverColor;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/story/[id]", params: { id: story.id } })}
      style={styles.bubbleWrapper}
    >
      <View style={[styles.bubbleRing, { borderColor: bg }]}>
        <View style={[styles.bubbleInner, { backgroundColor: bg }]}>
          {story.imageUrl ? (
            <Image source={{ uri: story.imageUrl }} style={styles.bubbleImage} />
          ) : story.emoji ? (
            <Text style={styles.bubbleEmoji}>{story.emoji}</Text>
          ) : (
            <Text style={styles.bubbleInitials}>{initials}</Text>
          )}
        </View>
      </View>
      <Text style={styles.bubbleLabel} numberOfLines={1}>
        {story.chefName.split(" ")[0]}
      </Text>
    </Pressable>
  );
}

function StoryCard({ story }: { story: Story }) {
  const bg = story.imageUrl ? undefined : (story.bgColor ?? story.chefCoverColor);
  const content = (
    <View style={[styles.cardContent, { backgroundColor: bg }]}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardChefRow}>
          <View style={[styles.cardChefAvatar, { backgroundColor: story.chefCoverColor }]}>
            <Text style={styles.cardChefAvatarText}>
              {story.chefName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.chef}>{story.chefName}</Text>
            <Text style={styles.cardMeta}>Il y a quelques instants</Text>
          </View>
        </View>
        <Feather name="more-horizontal" size={18} color="#fff" />
      </View>
      <Text style={styles.emoji}>{story.emoji ?? "🍲"}</Text>
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
      {story.imageUrl ? (
        <ImageBackground source={{ uri: story.imageUrl }} style={styles.cardImage} imageStyle={{ borderRadius: 24 }}>
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
  const { stories, user } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const uniqueStories: Story[] = [];
  const seen = new Set<string>();

  for (const story of stories) {
    if (!seen.has(story.chefId)) {
      seen.add(story.chefId);
      uniqueStories.push(story);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>Stories des cuisinieres</Text>
            <Text style={styles.title}>Ce qui sort de la cuisine</Text>
          </View>
          {user?.type === "chef" && (
            <Pressable style={styles.publishBtn} onPress={() => router.push("/chef/post-story")}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.publishBtnText}>Publier</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.bubblesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bubblesRow}>
            {uniqueStories.map((story) => (
              <StoryBubble key={story.id} story={story} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.feedHeader}>
          <Text style={styles.feedTitle}>A la une</Text>
          <Text style={styles.feedSub}>Des stories immersives a consulter comme un fil du jour.</Text>
        </View>

        <View style={styles.grid}>
          {stories.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: 20, paddingBottom: Platform.OS === "web" ? 120 : 110 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headerTextWrap: { flex: 1, minWidth: 0, paddingRight: 4 },
  eyebrow: { fontSize: 12, fontFamily: "Poppins_500Medium", color: Colors.light.textTertiary, marginBottom: 4 },
  title: { fontSize: 24, fontFamily: "Poppins_700Bold", color: Colors.light.text, lineHeight: 30 },
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
  bubblesSection: { marginTop: 18, marginBottom: 18 },
  bubblesRow: { gap: 14, paddingRight: 20 },
  bubbleWrapper: { width: 76, alignItems: "center", gap: 7 },
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
  bubbleEmoji: { fontSize: 28 },
  bubbleInitials: { fontSize: 18, fontFamily: "Poppins_700Bold", color: "#fff" },
  bubbleLabel: { fontSize: 11, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary, textAlign: "center" },
  feedHeader: { marginBottom: 12 },
  feedTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  feedSub: { marginTop: 4, fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary, lineHeight: 18 },
  grid: { gap: 14 },
  cardWrapper: { width: "100%", borderRadius: 24, overflow: "hidden" },
  cardImage: { width: "100%", minHeight: 220, justifyContent: "flex-end" },
  cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 24 },
  cardContent: { padding: 18, justifyContent: "flex-end", minHeight: 220, borderRadius: 24 },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  cardChefRow: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  emoji: { fontSize: 34, color: "#fff" },
  chef: { fontFamily: "Poppins_600SemiBold", color: "#fff" },
  caption: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: "#fff", marginTop: 10, lineHeight: 24, maxWidth: "88%" },
  cardDish: { marginTop: 10, fontSize: 12, fontFamily: "Poppins_500Medium", color: "rgba(255,255,255,0.88)" },
});
