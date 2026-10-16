import { useQuery } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import api from "../../src/config/api";
import { Spacing, useTheme } from "../../src/theme";
import { StoryCard } from "../../src/components/StoryCard";
import { EmptyState, ErrorState, LoadingScreen } from "../../src/components/ui";
import { StoryCardListSkeleton } from "../../src/components/Skeleton";
import type { Story } from "../../src/types";

export default function TrendingScreen() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");

  const trending = useQuery({
    queryKey: ["stories", "trending"],
    queryFn: async () => {
      const res = await api.get("/stories/trending");
      return (res.data.data?.stories || []) as Story[];
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <FlatList
        data={trending.data || []}
        keyExtractor={(item, i) => String(item._id || item.id || i)}
        renderItem={({ item }) => <StoryCard story={item} />}
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl }}
        refreshControl={
          <RefreshControl
            onRefresh={() => trending.refetch()}
            refreshing={trending.isFetching}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Trending stories</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              The most engaging narratives right now, ranked by reader interactions.
            </Text>
          </View>
        }
        ListEmptyComponent={
          trending.isLoading ? (
            <View style={{ marginTop: Spacing.lg }}>
              <StoryCardListSkeleton count={3} />
            </View>
          ) : trending.isError ? (
            <ErrorState
              title="Trending didn't load"
              message="We couldn't reach the trending list. Please try again."
              onRetry={() => trending.refetch()}
            />
          ) : (
            <EmptyState
              icon="flame-outline"
              title="No trending stories yet"
              description="Stories with active reader engagement and discussions will be featured here."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: Spacing.md },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: Spacing.xs, lineHeight: 18 },
});
