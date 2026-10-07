/**
 * Home testimonials rail — 10 latest community voices in a horizontal
 * scroller, with an "Explore more" CTA to the full testimonials page.
 */
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useRouter } from "expo-router";

import api from "../../config/api";
import { Radius, Spacing, useTheme } from "../../theme";
import { Avatar } from "../ui";
import { mediaUrl } from "../../utils/stories";
import type { Testimonial } from "../../types";

export const HOME_TESTIMONIAL_LIMIT = 10;

export function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name="star"
          size={size}
          color={n <= rating ? "#fbbf24" : "rgba(148,163,184,0.35)"}
        />
      ))}
    </View>
  );
}

export function roleLabel(personType?: string) {
  if (personType === "Expert") return "Verified Expert";
  if (personType === "Author") return "Author";
  return "Reader";
}

export function TestimonialCard({
  testimonial,
  style,
}: {
  testimonial: Testimonial;
  style?: object;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const person = testimonial.person || {};
  const name = person.fullName || "Community Member";
  const role = roleLabel(testimonial.personType);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      <Stars rating={Number(testimonial.rating) || 0} />
      <Text style={[styles.message, { color: theme.textMuted }]} numberOfLines={6}>
        &ldquo;{testimonial.message}&rdquo;
      </Text>
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Avatar uri={mediaUrl(person.avatar)} name={name} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.personRole, { color: theme.textMuted }]} numberOfLines={1}>
            {person.profession || role}
          </Text>
        </View>
        <View style={[styles.roleChip, { backgroundColor: `${theme.accent}1a` }]}>
          <Text style={[styles.roleChipText, { color: theme.accent }]}>{role}</Text>
        </View>
      </View>
    </View>
  );
}

/** Rail card skeleton matching the TestimonialCard footprint. */
function RailCardSkeleton() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  return (
    <View
      style={[
        styles.card,
        { width: 280, backgroundColor: theme.surface, borderColor: theme.border, gap: Spacing.md },
      ]}
    >
      <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted, width: 90, height: 13 }]} />
      <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted, width: "100%", height: 12 }]} />
      <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted, width: "80%", height: 12 }]} />
      <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted, width: "60%", height: 12 }]} />
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <View style={[styles.skeletonAvatar, { backgroundColor: theme.surfaceMuted }]} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted, width: 100, height: 11 }]} />
          <View style={[styles.skeletonLine, { backgroundColor: theme.surfaceMuted, width: 70, height: 10 }]} />
        </View>
      </View>
    </View>
  );
}

export function TestimonialsRail() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();

  const testimonials = useQuery({
    queryKey: ["testimonials", HOME_TESTIMONIAL_LIMIT],
    queryFn: async () => {
      const res = await api.get("/testimonials", {
        params: { limit: HOME_TESTIMONIAL_LIMIT },
      });
      return (res.data.data || []) as Testimonial[];
    },
  });

  const list = testimonials.data || [];

  return (
    <View style={{ gap: Spacing.lg }}>
      {/* Header */}
      <View style={{ alignItems: "center", gap: Spacing.sm }}>
        <Text style={[styles.title, { color: theme.text }]}>
          What Our Community Says
        </Text>
       
      </View>

      {testimonials.isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: Spacing.lg, paddingHorizontal: Spacing.lg }}
        >
          {[1, 2, 3].map((n) => (
            <RailCardSkeleton key={n} />
          ))}
        </ScrollView>
      ) : list.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>
          No testimonials yet — be the first to share yours!
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: Spacing.lg, paddingHorizontal: Spacing.lg }}
        >
          {list.map((t) => (
            <TestimonialCard
              key={t._id || t.id}
              testimonial={t}
              style={{ width: 280 }}
            />
          ))}

          {/* Explore more tile at the end of the rail */}
          <Pressable
            onPress={() => router.push("/testimonials")}
            style={({ pressed }) => [
              styles.exploreTile,
              {
                borderColor: `${theme.accent}59`,
                backgroundColor: `${theme.accent}0a`,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={[styles.exploreIcon, { backgroundColor: `${theme.accent}1a` }]}>
              <Ionicons name="arrow-forward" size={18} color={theme.accent} />
            </View>
            <Text style={[styles.exploreText, { color: theme.accent }]}>
              Explore more
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  card: {
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  message: { fontSize: 14, lineHeight: 22 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 14, fontWeight: "700" },
  personRole: { fontSize: 12, marginTop: 1 },
  roleChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  roleChipText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  empty: { textAlign: "center", fontSize: 14, paddingVertical: Spacing.xl },
  skeletonLine: { borderRadius: 6 },
  skeletonAvatar: { width: 34, height: 34, borderRadius: 17 },
  exploreTile: {
    width: 180,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  exploreIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreText: { fontSize: 13, fontWeight: "800" },
});
