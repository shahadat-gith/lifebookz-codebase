/**
 * Testimonials — full community voices with client-side pagination (10 per
 * page; the API has no page param, so a bounded batch is fetched once) plus
 * the share-your-experience form.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import api from "../src/config/api";
import { Radius, Spacing, useTheme } from "../src/theme";
import { ScreenHeader, EmptyState } from "../src/components/ui";
import {
  TestimonialCard,
} from "../src/components/home/Testimonials";
import { ShareTestimonial } from "../src/components/home/ShareTestimonial";
import type { Testimonial } from "../src/types";

const PAGE_SIZE = 10;
/** Bounded batch — larger than the home rail, but not "everything". */
const FETCH_LIMIT = 60;

export default function TestimonialsPage() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const [page, setPage] = useState(1);

  const testimonials = useQuery({
    queryKey: ["testimonials", FETCH_LIMIT, "all"],
    queryFn: async () => {
      const res = await api.get("/testimonials", {
        params: { limit: FETCH_LIMIT },
      });
      return (res.data.data || []) as Testimonial[];
    },
  });

  const list = useMemo(() => {
    const all = testimonials.data || [];
    const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    return {
      pages,
      safePage: Math.min(page, pages),
      slice: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    };
  }, [testimonials.data, page]);

  const { pages, safePage, slice } = list;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={["top"]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="Testimonials"
          subtitle="What our community says"
          onBack={() => router.back()}
        />

        {testimonials.isLoading ? (
          <View style={{ gap: Spacing.lg }}>
            {[1, 2, 3].map((n) => (
              <TestimonialCard
                key={n}
                testimonial={{ message: "", rating: 0 }}
                style={{ opacity: 0.4 }}
              />
            ))}
          </View>
        ) : slice.length === 0 ? (
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title="No testimonials yet"
            description="Be the first to share your experience below."
          />
        ) : (
          <>
            <View style={{ gap: Spacing.lg }}>
              {slice.map((t) => (
                <TestimonialCard key={t._id || t.id} testimonial={t} />
              ))}
            </View>

            {/* Pagination — Prev / page indicator / Next */}
            {pages > 1 && (
              <View style={styles.pagination}>
                <Pressable
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  style={({ pressed }) => [
                    styles.pageButton,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      opacity: safePage <= 1 ? 0.4 : pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons name="chevron-back" size={16} color={theme.text} />
                  <Text style={[styles.pageButtonText, { color: theme.text }]}>
                    Prev
                  </Text>
                </Pressable>

                <Text style={[styles.pageIndicator, { color: theme.textMuted }]}>
                  Page {safePage} of {pages}
                </Text>

                <Pressable
                  onPress={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={safePage >= pages}
                  style={({ pressed }) => [
                    styles.pageButton,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      opacity: safePage >= pages ? 0.4 : pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.pageButtonText, { color: theme.text }]}>
                    Next
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.text}
                  />
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* Share your experience — moved here from the home page */}
        <ShareTestimonial />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
  },
  pageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pageButtonText: { fontSize: 13, fontWeight: "700" },
  pageIndicator: { fontSize: 12, fontWeight: "600" },
});
