import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";

import api from "../../src/config/api";
import { Avatar, BackBar, ErrorState, LoadingScreen, Badge } from "../../src/components/ui";
import { AuthorSkeleton, StoryCardListSkeleton } from "../../src/components/Skeleton";
import { StoryCard } from "../../src/components/StoryCard";
import { Spacing, useTheme } from "../../src/theme";
import { mediaUrl } from "../../src/utils/stories";
import type { Story, User } from "../../src/types";

export default function AuthorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();

  const authorQuery = useQuery({
    queryKey: ["author", id],
    queryFn: async () => {
      const res = await api.get(`/authors/${id}`);
      return res.data.data as User;
    },
  });

  const storiesQuery = useQuery({
    queryKey: ["author", id, "stories"],
    queryFn: async () => {
      const res = await api.get("/stories", { params: { author: id, limit: 20 } });
      return (res.data.data?.stories || []) as Story[];
    },
  });

  const author = authorQuery.data;
  const verified = author?.verification?.status === "approved";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <View style={styles.topBar}>
        <BackBar onPress={() => router.back()} />
      </View>

      {authorQuery.isLoading ? (
        <View style={{ padding: Spacing.lg }}>
          <AuthorSkeleton />
        </View>
      ) : authorQuery.isError || !author ? (
        <ErrorState
          title="Author not found"
          message="We couldn't load this author's profile."
          onRetry={() => authorQuery.refetch()}
        />
      ) : (
        <FlatList
          data={storiesQuery.data || []}
          keyExtractor={(item, i) => String(item._id || item.id || i)}
          renderItem={({ item }) => <StoryCard story={item} />}
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl }}
          ListHeaderComponent={
            <View style={{ marginBottom: Spacing.lg }}>
              <View style={styles.identity}>
                <Avatar uri={mediaUrl(author.avatar)} name={author.fullName} size={72} />
                <View style={{ flex: 1, marginLeft: Spacing.lg }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                      {author.fullName || "Anonymous Author"}
                    </Text>
                    {verified && <Ionicons name="checkmark-circle" size={18} color={theme.info} />}
                  </View>
                  {author.profession ? (
                    <Text style={[styles.meta, { color: theme.textMuted }]}>
                      {author.profession}
                    </Text>
                  ) : null}
                  <View style={{ marginTop: Spacing.sm }}>
                    <Badge
                      label={`${storiesQuery.data?.length || 0} stories`}
                      tone="primary"
                    />
                  </View>
                </View>
              </View>
              {author.bio ? (
                <Text style={[styles.bio, { color: theme.textMuted }]}>{author.bio}</Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            storiesQuery.isLoading ? (
              <StoryCardListSkeleton count={2} />
            ) : (
              <Text style={{ color: theme.textMuted, textAlign: "center", padding: Spacing.xl }}>
                No published stories yet.
              </Text>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  identity: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 20, fontWeight: "800" },
  meta: { fontSize: 13, marginTop: 2 },
  bio: { fontSize: 14, lineHeight: 21, marginTop: Spacing.lg },
});
