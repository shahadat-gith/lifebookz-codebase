import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import api from "../../src/config/api";
import { Radius, Spacing, useTheme } from "../../src/theme";
import { StoryCard } from "../../src/components/StoryCard";
import { Button, EmptyState, ErrorState, Input, SelectField } from "../../src/components/ui";
import { StoryCardListSkeleton } from "../../src/components/Skeleton";
import {
  EMPTY_FILTERS,
  GENDER_OPTIONS,
  activeFilterCount,
  feedQuery,
  type FeedFilters,
} from "../../src/utils/feedFilters";
import type { Pagination, Story } from "../../src/types";

const PAGE_SIZE = 10;

export default function StoriesScreen() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const insets = useSafeAreaInsets();

  // Committed filters drive the request; `draft` is what the modal edits.
  const [filters, setFilters] = useState<FeedFilters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<FeedFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  const [stories, setStories] = useState<Story[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // `filtersKey` changes whenever committed filters change → the query reruns.
  const filtersKey = JSON.stringify(filters);
  const first = useQuery({
    queryKey: ["stories", "list", filtersKey],
    queryFn: async () => {
      setError("");
      try {
        const res = await api.get("/stories", {
          params: { page: 1, limit: PAGE_SIZE, ...feedQuery(filters) },
        });
        const data = res.data.data;
        const batch: Story[] = data.stories || [];
        const pagination: Pagination | undefined = data.pagination;
        setStories(batch);
        setPage(1);
        setHasMore(pagination ? 1 < pagination.pages : batch.length === PAGE_SIZE);
        return true;
      } catch (err: any) {
        setStories([]);
        setHasMore(false);
        setError(err.response?.data?.error?.message || "We couldn't load the stories. Please try again.");
        return false;
      }
    },
  });

  // The API returns professions as { value, label, count } objects.
  const professions = useQuery({
    queryKey: ["stories", "professions"],
    queryFn: async () => {
      const res = await api.get("/stories/professions");
      const rows = (res.data.data || []) as
        | { value?: string; label?: string }[]
        | string[];
      return (rows as unknown[]).map((row) =>
        typeof row === "string"
          ? row
          : (row as { value?: string; label?: string }).value ||
            (row as { label?: string }).label ||
            "",
      ).filter(Boolean) as string[];
    },
  });

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || first.isLoading) return;
    setLoadingMore(true);
    try {
      const res = await api.get("/stories", {
        params: { page: page + 1, limit: PAGE_SIZE, ...feedQuery(filters) },
      });
      const data = res.data.data;
      const batch: Story[] = data.stories || [];
      setStories((prev) => [...prev, ...batch]);
      setPage((p) => p + 1);
      const pagination: Pagination | undefined = data.pagination;
      setHasMore(
        pagination ? page + 1 < pagination.pages : batch.length === PAGE_SIZE,
      );
    } catch {
      // A failed page load just stops the scroll — the list stays usable.
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, first.isLoading, page, filters]);

  const appliedCount = useMemo(() => activeFilterCount(filters), [filters]);

  function openFilters() {
    setDraft(filters);
    setFilterOpen(true);
  }

  function applyFilters() {
    setFilters(draft);
    setFilterOpen(false);
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setFilterOpen(false);
  }

  const setDraftFilter = (key: keyof FeedFilters, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Explore stories</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Real lifebooks from authors around the world
          </Text>
        </View>
        <Pressable
          onPress={openFilters}
          style={[styles.filterBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <Ionicons name="options-outline" size={18} color={theme.text} />
          {appliedCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.filterBadgeText}>{appliedCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {first.isLoading && stories.length === 0 ? (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}>
          <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: Spacing.lg }}>
            Loading stories…
          </Text>
          <StoryCardListSkeleton count={4} />
        </ScrollView>
      ) : error ? (
        <ErrorState title="Stories didn't load" message={error} onRetry={() => first.refetch()} />
      ) : stories.length === 0 ? (
        <EmptyState
          icon="book-outline"
          title={appliedCount > 0 ? "No matching stories" : "No stories found"}
          description={
            appliedCount > 0
              ? "Try adjusting or clearing your filters."
              : "Check back soon — authors are writing."
          }
        />
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(item, i) => String(item._id || item.id || i)}
          renderItem={({ item }) => <StoryCard story={item} />}
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              onRefresh={() => first.refetch()}
              refreshing={first.isFetching}
              tintColor={theme.primary}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: Spacing.lg }} color={theme.primary} />
            ) : null
          }
        />
      )}

      {/* FILTERS — bottom sheet, only as tall as its content */}
      <Modal visible={filterOpen} animationType="slide" transparent onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetDismiss} onPress={() => setFilterOpen(false)} />
          <SafeAreaView edges={["bottom"]} style={styles.sheetWrap}>
            <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={[styles.handle, { backgroundColor: theme.border }]} />
              <View style={styles.sheetHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Filters</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.lg }}>
                  <Pressable onPress={clearFilters} hitSlop={8}>
                    <Text style={[styles.modalClear, { color: theme.danger }]}>Clear all</Text>
                  </Pressable>
                  <Pressable onPress={() => setFilterOpen(false)} hitSlop={8}>
                    <Ionicons name="close" size={22} color={theme.text} />
                  </Pressable>
                </View>
              </View>

              <Input
                label="Author name"
                value={draft.authorName}
                onChangeText={(v) => setDraftFilter("authorName", v)}
                placeholder="e.g. Priya"
                icon="person-outline"
              />

              <SelectField
                label="Profession"
                value={draft.profession}
                onChange={(v) => setDraftFilter("profession", v)}
                options={(professions.data || []).map((p) => ({ value: p, label: p }))}
                placeholder={professions.isLoading ? "Loading professions…" : "Any profession"}
              />

              <SelectField
                label="Author gender"
                value={draft.gender}
                onChange={(v) => setDraftFilter("gender", v)}
                options={GENDER_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
                placeholder="Any gender"
              />

              <Button
                label={`Show ${appliedCount ? "filtered" : "all"} stories`}
                fullWidth
                size="lg"
                onPress={applyFilters}
                style={{ marginTop: Spacing.sm, marginBottom: Spacing.lg }}
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },
  filterBtn: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    position: "relative",
  },
  filterBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  // Bottom-sheet filters
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetDismiss: { flex: 1 },
  sheetWrap: { backgroundColor: "transparent" },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalClear: { fontSize: 13, fontWeight: "600" },
});
