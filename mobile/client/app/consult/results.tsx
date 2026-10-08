import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

import { BackBar, Avatar, Button, EmptyState, ErrorState, LoadingScreen } from "../../src/components/ui";
import { ExpertCardSkeleton } from "../../src/components/Skeleton";
import { useToast } from "../../src/components/Toast";
import * as consultApi from "../../src/api/consultation";
import { apiErrorMessage } from "../../src/utils/helpers";
import { getCategoryLabel } from "../../src/utils/consult";
import { mediaUrl } from "../../src/utils/stories";
import { Radius, Spacing, useTheme } from "../../src/theme";
import type { Expert } from "../../src/types";

export default function ConsultResultsScreen() {
  const { problem, category, details } = useLocalSearchParams<{
    problem?: string;
    category?: string;
    details?: string;
  }>();
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const toast = useToast();
  const [bookingId, setBookingId] = useState<string | null>(null);

  const matches = useQuery({
    queryKey: ["consultations", "match", problem, category, details],
    enabled: !!problem,
    queryFn: async () => {
      const data = await consultApi.matchExperts({
        problem: problem as string,
        category: category || undefined,
        limit: 5,
      });
      return data.experts || [];
    },
  });

  async function handleBook(expert: Expert) {
    const expertId = (expert.id || expert._id) as string;
    if (bookingId) return;

    setBookingId(expertId);
    try {
      const consultation = await consultApi.createRequest({
        expertId,
        problem: problem as string,
        category: category || undefined,
        notes: (details || "").trim(),
      });
      const consultationId = (consultation._id || consultation.id) as string;
      if (!consultationId) throw new Error("No consultation id returned");
      toast.success("Request sent — we'll tell you the moment it's confirmed.");
      // Off to the live waiting page: WS confirmation flips it to Pay.
      router.replace({
        pathname: "/consult/waiting",
        params: {
          consultationId,
          expertName: expert.fullName || "Your expert",
          expertAvatar: mediaUrl(expert.avatar),
        },
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send your request. Please try again."));
    } finally {
      setBookingId(null);
    }
  }

  const experts = matches.data || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <BackBar onPress={() => router.back()} />

        {matches.isLoading ? (
          <View style={{ gap: Spacing.lg, marginTop: Spacing.lg }}>
            {[0, 1, 2].map((i) => (
              <ExpertCardSkeleton key={i} />
            ))}
          </View>
        ) : matches.isError ? (
          <ErrorState
            title="Matching failed"
            message="We couldn't reach our experts right now. Please try again."
            onRetry={() => matches.refetch()}
          />
        ) : experts.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="No available expert right now"
            description="No available expert found in this category right now — please try again a bit later."
          />
        ) : (
          <View style={{ gap: Spacing.lg }}>
            <Text style={[styles.count, { color: theme.text }]}>
              {experts.length} expert{experts.length === 1 ? "" : "s"} found for you
            </Text>
            {experts.map((expert, i) => {
              const id = (expert.id || expert._id) as string;
              return (
                <View
                  key={id}
                  style={[styles.expertCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={[styles.rankBadge, { backgroundColor: `${theme.primary}18` }]}>
                    <Text style={[styles.rankText, { color: theme.primary }]}>{i + 1}</Text>
                  </View>
                  <View style={styles.expertTop}>
                    <Avatar uri={mediaUrl(expert.avatar)} name={expert.fullName} size={48} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={[styles.expertName, { color: theme.text }]} numberOfLines={1}>
                          {expert.fullName}
                        </Text>
                        {expert.verification?.status === "approved" && (
                          <Ionicons name="checkmark-circle" size={15} color={theme.info} />
                        )}
                      </View>
                      {expert.headline || expert.profession ? (
                        <Text style={[styles.expertMeta, { color: theme.textMuted }]} numberOfLines={1}>
                          {expert.headline || expert.profession}
                        </Text>
                      ) : null}
                      {typeof expert.rating === "number" && expert.rating > 0 ? (
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={12} color={theme.accent} />
                          <Text style={[styles.ratingText, { color: theme.textMuted }]}>
                            {expert.rating.toFixed(1)}
                            {expert.sessionsCompleted ? ` · ${expert.sessionsCompleted} sessions` : ""}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {expert.bio ? (
                    <Text style={[styles.expertBio, { color: theme.textMuted }]} numberOfLines={3}>
                      {expert.bio}
                    </Text>
                  ) : null}

                  {expert.categories && expert.categories.length > 0 && (
                    <View style={[styles.tagRow, { marginTop: Spacing.md }]}>
                      {expert.categories.slice(0, 3).map((cat) => (
                        <View key={cat} style={[styles.tag, { backgroundColor: `${theme.primary}14` }]}>
                          <Text style={[styles.tagText, { color: theme.primary }]}>{cat}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Button
                    label={bookingId === id ? "Sending request…" : "Request session"}
                    onPress={() => handleBook(expert)}
                    loading={bookingId === id}
                    disabled={bookingId !== null}
                    style={{ marginTop: Spacing.lg }}
                  />
                </View>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={() => router.back()}
          style={{ alignItems: "center", marginTop: Spacing.xl }}
        >
          <Text style={{ color: theme.primary, fontSize: 14, fontWeight: "600" }}>
            Edit my description and search again
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontSize: 26, fontWeight: "800", marginTop: Spacing.sm },
  subtitle: { fontSize: 13, marginTop: 2, marginBottom: Spacing.xl },
  count: { fontSize: 14, fontWeight: "500" },

  expertCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    position: "relative",
  },
  rankBadge: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 12, fontWeight: "800" },
  expertTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  expertName: { fontSize: 16, fontWeight: "700" },
  expertMeta: { fontSize: 13, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingText: { fontSize: 12 },
  expertBio: { fontSize: 13, lineHeight: 19, marginTop: Spacing.md },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  tag: { paddingHorizontal: Spacing.sm + 2, paddingVertical: 4, borderRadius: Radius.pill },
  tagText: { fontSize: 11, fontWeight: "600" },
});
