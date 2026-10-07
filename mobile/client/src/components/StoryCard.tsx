import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Radius, Spacing, useTheme } from "../theme";
import { timeAgo } from "../utils/helpers";
import { authorName, isVerifiedAuthor, mediaUrl, storyId, storyImage } from "../utils/stories";
import { Avatar } from "./ui";
import type { Story } from "../types";

export function StoryCard({ story }: { story: Story }) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const slug = story.slug || storyId(story);
  const cover = storyImage(story);

  return (
    <Pressable
      onPress={() => slug && router.push(`/story/${slug}` as never)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={styles.cover}
          contentFit="cover"
          recyclingKey={cover}
          transition={150}
        />
      ) : (
        <View style={[styles.coverPlaceholder, { backgroundColor: `${theme.primary}14` }]}>
          <Ionicons name="book" size={30} color={theme.primary} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.tagRow}>
          {story.featured ? (
            <View style={[styles.tag, { backgroundColor: `${theme.accent}22` }]}>
              <Text style={[styles.tagText, { color: theme.accent }]}>★ Featured</Text>
            </View>
          ) : null}
    
        </View>

        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {story.title || "Untitled Story"}
        </Text>

        <View style={styles.metaRow}>
          <Pressable
            style={styles.authorRow}
            onPress={() => {
              const authorId = story.author?._id || story.author?.id;
              if (authorId) router.push(`/author/${authorId}` as never);
            }}
          >
            <Avatar uri={mediaUrl(story.author?.avatar)} name={authorName(story.author)} size={22} />
            <Text style={[styles.author, { color: theme.text }]} numberOfLines={1}>
              {authorName(story.author)}
            </Text>
            {isVerifiedAuthor(story.author) && (
              <Ionicons name="checkmark-circle" size={13} color={theme.info} />
            )}
          </Pressable>
          <View style={styles.statsRow}>
            <Ionicons name="heart" size={13} color={theme.textMuted} />
            <Text style={[styles.stat, { color: theme.textMuted }]}>
              {story.stats?.likes || 0}
            </Text>
            <Ionicons name="chatbubble" size={13} color={theme.textMuted} />
            <Text style={[styles.stat, { color: theme.textMuted }]}>
              {story.stats?.comments || 0}
            </Text>
          </View>
        </View>

        {story.publishedAt ? (
          <Text style={[styles.date, { color: theme.textMuted }]}>
            {timeAgo(story.publishedAt)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Compact horizontal-rail variant used on the home screen. */
export function StoryRailCard({ story, width = 220 }: { story: Story; width?: number }) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const slug = story.slug || storyId(story);
  const cover = storyImage(story);

  return (
    <Pressable
      onPress={() => slug && router.push(`/story/${slug}` as never)}
      style={({ pressed }) => [
        styles.railCard,
        { width, backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={styles.railCover}
          contentFit="cover"
          recyclingKey={cover}
          transition={150}
        />
      ) : (
        <View style={[styles.railCover, { backgroundColor: `${theme.primary}14` }, styles.railCoverCenter]}>
          <Ionicons name="book" size={26} color={theme.primary} />
        </View>
      )}
      <View style={styles.railBody}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {story.title || "Untitled Story"}
        </Text>
        <Text style={[styles.author, { color: theme.textMuted }]} numberOfLines={1}>
          {authorName(story.author)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cover: { width: "100%", height: 150 },
  coverPlaceholder: {
    width: "100%",
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: Spacing.lg },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
  tag: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    maxWidth: 160,
  },
  tagText: { fontSize: 11, fontWeight: "700" },
  title: { fontSize: 17, fontWeight: "700", lineHeight: 22 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1, minWidth: 0 },
  author: { fontSize: 13, fontWeight: "600", flexShrink: 1 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stat: { fontSize: 12 },
  date: { fontSize: 11, marginTop: Spacing.sm },

  railCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  railCover: { width: "100%", height: 110 },
  railCoverCenter: { alignItems: "center", justifyContent: "center" },
  railBody: { padding: Spacing.md },
});
