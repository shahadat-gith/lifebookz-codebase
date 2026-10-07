/**
 * "Talk to an expert" consultation section — feature rows plus the
 * Book-a-session CTA. `onBook` opens the consult brief sheet on Home.
 */
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Radius, Spacing, useTheme } from "../../theme";

const FEATURES = [
  {
    icon: "school-outline" as const,
    title: "Expert guidance",
    desc: "Coaches across education, career, relationships and more.",
  },
  {
    icon: "heart" as const,
    title: "One-on-one sessions",
    desc: "Book private sessions at times that work for you.",
  },
  {
    icon: "shield-checkmark-outline" as const,
    title: "Confidential & safe",
    desc: "Talk freely in a private, judgment-free space.",
  },
];

export function CoachSection({ onBook }: { onBook: () => void }) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>
        Talk to an <Text style={{ color: theme.primary }}>expert</Text>.
      </Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>
        Get guidance, clarity and support for what truly matters to you — from
        education and career to relationships and personal growth.
      </Text>

      <View style={{ gap: Spacing.md }}>
        {FEATURES.map((feature) => (
          <View key={feature.title} style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: `${theme.primary}14` }]}>
              <Ionicons name={feature.icon} size={15} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.featureTitle, { color: theme.text }]}>
                {feature.title}
              </Text>
              <Text style={[styles.featureDesc, { color: theme.textMuted }]}>
                {feature.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onBook}
        style={({ pressed }) => [
          styles.bookButton,
          {
            backgroundColor: theme.primary,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Ionicons name="videocam" size={15} color={theme.primaryForeground} />
        <Text style={[styles.bookText, { color: theme.primaryForeground }]}>
          Book a session
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.lg,
  },
  title: { fontSize: 26, fontWeight: "800", lineHeight: 32 },
  body: { fontSize: 14, lineHeight: 22 },
  featureRow: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  featureTitle: { fontSize: 14, fontWeight: "700" },
  featureDesc: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  bookButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    marginTop: Spacing.xs,
  },
  bookText: { fontSize: 14, fontWeight: "800" },
});
