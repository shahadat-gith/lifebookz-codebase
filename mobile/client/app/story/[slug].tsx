import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

import api from "../../src/config/api";
import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/components/Toast";
import { Avatar, BackBar, Button, EmptyState, ErrorState, LoadingScreen } from "../../src/components/ui";
import { StoryDetailSkeleton } from "../../src/components/Skeleton";
import { Radius, Spacing, useTheme } from "../../src/theme";
import { apiErrorMessage, stripHtml, timeAgo } from "../../src/utils/helpers";
import {
  authorName,
  commentLikeCount,
  commentLikedByMe,
  isVerifiedAuthor,
  mediaUrl,
  storyId,
} from "../../src/utils/stories";
import type { Comment, Story } from "../../src/types";

export default function StoryDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentsKey, setCommentsKey] = useState(0);

  const storyQuery = useQuery({
    queryKey: ["story", slug],
    queryFn: async () => {
      const res = await api.get(`/stories/${slug}`);
      const data = res.data.data as Story;
      return data;
    },
  });

  const story = storyQuery.data;

  // Seed the like state during render, from the freshest server data. This
  // mirrors the server until the local user taps, without an effect.
  const [seededStoryId, setSeededStoryId] = useState<string | null>(null);
  const currentStoryId = String(story?._id || story?.id || "");
  if (story && seededStoryId !== currentStoryId) {
    setSeededStoryId(currentStoryId);
    setLiked(!!story.likedByUser);
    setLikeCount(story.stats?.likes || 0);
  }

  async function handleLike() {
    if (!isAuthenticated) {
      toast.showToast("Sign in to like stories");
      router.push("/login");
      return;
    }
    const id = storyId(story);
    if (!id) return;

    const next = !liked;
    setLiked(next);
    setLikeCount((c) => (next ? c + 1 : c - 1));

    try {
      const res = await api.post(`/stories/${id}/like`);
      const serverLiked = res.data?.data?.liked;
      if (typeof serverLiked === "boolean" && serverLiked !== next) {
        setLiked(serverLiked);
        setLikeCount((c) => (serverLiked ? c + 1 : c - 1));
      }
    } catch {
      setLiked(!next);
      setLikeCount((c) => (next ? c - 1 : c + 1));
      toast.error("Failed to update like");
    }
  }

  if (storyQuery.isLoading)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={"top" as never}>
        <View style={styles.topBar}>
          <BackBar onPress={() => router.back()} />
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
          <StoryDetailSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  if (storyQuery.isError || !story) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
        <ErrorState
          title="Story not found"
          message={apiErrorMessage(storyQuery.error, "This story may have been removed.")}
          onRetry={() => storyQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  const commentCount = story.stats?.comments || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <View style={styles.topBar}>
        <BackBar onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: theme.primary }]}>
          {story.title || "Untitled Story"}
        </Text>
        <View style={[styles.rule, { backgroundColor: theme.accent }]} />

        {/* Byline */}
        <Pressable
          style={styles.byline}
          onPress={() => {
            const authorId = story.author?._id || story.author?.id;
            if (authorId) router.push(`/author/${authorId}` as never);
          }}
        >
          <Avatar uri={mediaUrl(story.author?.avatar)} name={authorName(story.author)} size={32} />
          <Text style={[styles.bylineText, { color: theme.textMuted }]}>
            By <Text style={{ color: theme.text, fontWeight: "700" }}>{authorName(story.author)}</Text>
          </Text>
          {isVerifiedAuthor(story.author) && (
            <Ionicons name="checkmark-circle" size={16} color={theme.info} />
          )}
        </Pressable>

        {/* Meta: when / where + type + chapter */}
        <View style={styles.metaRow}>
          {story.chapterName ? (
            <Text style={[styles.metaChip, { color: theme.textMuted }]}>
              {story.chapterName}
            </Text>
          ) : null}
          {story.storyType ? (
            <Text style={[styles.metaChip, { color: theme.accent }]}>
              {story.storyType.replace(/_/g, " ").toUpperCase()}
            </Text>
          ) : null}
        </View>

        {/* The banner stays on cards only — the reader opens at the text. */}
        {(() => {
          const shownMedia = (story.media || []).filter(
            (m: any) => m.type === "image" && mediaUrl(m),
          );
          return shownMedia.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.mediaRow}
            >
              {shownMedia.map((m: any, i: number) => (
                <Image
                  key={i}
                  source={{ uri: mediaUrl(m) }}
                  style={styles.mediaItem}
                  contentFit="cover"
                  transition={200}
                />
              ))}
            </ScrollView>
          ) : null;
        })()}

        {/* The story itself */}
        <Text style={[styles.chapterBody, { color: theme.text }]}>
          {stripHtml(story.content)}
        </Text>

        {/* Actions */}
        <View style={[styles.actions, { borderTopColor: theme.border }]}>
          <ActionChip
            icon={liked ? "heart" : "heart-outline"}
            label={String(likeCount)}
            active={liked}
            color={liked ? theme.danger : theme.textMuted}
            onPress={handleLike}
          />
          <ActionChip
            icon="chatbubble-outline"
            label={String(commentCount)}
            color={theme.textMuted}
            onPress={() => setCommentsKey((k) => k + 1)}
          />
        </View>

        {/* Comments */}
        <Text style={[styles.commentsTitle, { color: theme.text }]}>Comments</Text>
        <CommentSection
          storyId={storyId(story)}
          refreshKey={commentsKey}
          onCommentAdded={() => setCommentsKey((k) => k)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
  active = false,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  color: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.chip}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.chipLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

function CommentSection({
  storyId: id,
  refreshKey,
}: {
  storyId: string;
  refreshKey: number;
  onCommentAdded?: () => void;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const meId = user?._id || user?.id || null;
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localKey, setLocalKey] = useState(0);

  const comments = useQuery({
    queryKey: ["comments", id, refreshKey, localKey],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get(`/stories/${id}/comments`, { params: { limit: 50 } });
      const data = res.data.data;
      return (data.comments || data || []) as Comment[];
    },
  });

  async function submit() {
    const content = text.trim();
    if (!content) return;
    setSubmitting(true);
    try {
      await api.post(`/stories/${id}/comments`, { content });
      setText("");
      setLocalKey((k) => k + 1);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not post your comment."));
    } finally {
      setSubmitting(false);
    }
  }

  async function likeComment(commentId: string) {
    try {
      await api.post(`/stories/comments/${commentId}/like`);
      setLocalKey((k) => k + 1);
    } catch {
      toast.error("Could not update like");
    }
  }

  return (
    <View style={{ gap: Spacing.lg }}>
      {isAuthenticated ? (
        <View
          style={[
            styles.commentComposer,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.composerRow}>
            <View style={styles.composerInputWrap}>
              <CommentInput value={text} onChangeText={setText} placeholder="Write a comment…" />
            </View>
            <Button label="Post" onPress={submit} loading={submitting} disabled={!text.trim()} />
          </View>
        </View>
      ) : (
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
          Sign in to join the conversation.
        </Text>
      )}

      {comments.isLoading ? (
        <LoadingScreen message="Loading comments…" />
      ) : (comments.data?.length || 0) === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="No comments yet" description="Be the first to share your thoughts." />
      ) : (
        comments.data!.map((comment, i) => {
          const cid = (comment._id || comment.id) as string;
          const author = comment.user || comment.author;
          const likeCount = commentLikeCount(comment);
          const likedByMe = commentLikedByMe(comment, meId);
          return (
            <View key={cid || i} style={styles.comment}>
              <Avatar uri={mediaUrl(author?.avatar)} name={author?.fullName} size={32} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                  <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>
                    {author?.fullName || "Reader"}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                    {timeAgo(comment.createdAt)}
                  </Text>
                </View>
                <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20, marginTop: 2 }}>
                  {comment.content}
                </Text>
                <Pressable
                  onPress={() => cid && likeComment(cid)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    marginTop: Spacing.sm,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Ionicons
                    name={likedByMe ? "heart" : "heart-outline"}
                    size={13}
                    color={likedByMe ? theme.danger : theme.textMuted}
                  />
                  <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                    {likeCount > 0 ? likeCount : ""}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

/**
 * The real comment input, multiline and theme-aware.
 */
function CommentInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  return (
    <TextInput
      style={{ color: theme.text, fontSize: 14, paddingVertical: Spacing.md, minHeight: 48 }}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.textMuted}
      multiline
      textAlignVertical="top"
    />
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: { padding: Spacing.sm },

  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontSize: 26, fontWeight: "800", lineHeight: 32 },
  rule: { height: 4, width: 56, borderRadius: 2, marginTop: Spacing.md },
  byline: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.lg },
  bylineText: { fontSize: 13 },
  noChapters: { fontStyle: "italic", marginTop: Spacing.xl, fontSize: 14 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },
  metaChip: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  mediaRow: { marginTop: Spacing.lg },
  mediaItem: {
    width: 300,
    height: 180,
    borderRadius: Radius.lg,
    marginRight: Spacing.md,
  },

  chapter: { marginTop: Spacing.xl },
  chapterTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  chapterBody: { fontSize: 15, lineHeight: 24 },
  entry: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  entryTitle: { fontSize: 15, fontWeight: "700" },
  entryMeta: { fontSize: 12, marginTop: 2, marginBottom: Spacing.sm },

  actions: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chip: { flexDirection: "row", alignItems: "center", gap: 6 },
  chipLabel: { fontSize: 13, fontWeight: "600" },

  commentsTitle: { fontSize: 18, fontWeight: "800", marginTop: Spacing.xl, marginBottom: Spacing.lg },

  commentComposer: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    padding: Spacing.sm,
  },
  composerInputWrap: { flex: 1 },

  comment: { flexDirection: "row", gap: Spacing.md },
});
