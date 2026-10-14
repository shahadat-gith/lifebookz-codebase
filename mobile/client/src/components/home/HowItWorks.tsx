/**
 * "How does Lifebookz work?" — the eight-step journey, numbered 1–8,
 * mirroring the web home page section and its WhatIsLifebookz styling.
 */
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Radius, Spacing, useTheme } from "../../theme";

type Step = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const STEPS: Step[] = [
  {
    title: "Create your Lifebook",
    description:
      "Set up your personal lifebook — a home for your memories, page by page.",
    icon: "book-outline",
  },
  {
    title: "Preserve your experiences",
    description:
      "Capture the moments, struggles and achievements as they happened.",
    icon: "shield-checkmark-outline",
  },
  {
    title: "Organize your stories and memories",
    description:
      "Sort everything into chapters so your story reads the way you lived it.",
    icon: "pencil-outline",
  },
  {
    title: "Choose what you want to share",
    description:
      "Public, or just you — you decide who sees what, chapter by chapter.",
    icon: "eye-outline",
  },
  {
    title: "Discover stories from other people",
    description:
      "Read real lifebooks from every walk of life — the ordinary and the extraordinary.",
    icon: "compass-outline",
  },
  {
    title: "Search by topic, experience, profession, place, or life challenge",
    description:
      "Find exactly the stories that matter to you, however you look for them.",
    icon: "search-outline",
  },
  {
    title: "Learn from real human experiences",
    description:
      "Find comfort and guidance in how others faced their hardest days.",
    icon: "bulb-outline",
  },
  {
    title: "Seek guidance from life coaches and experts when needed",
    description:
      "Book a verified coach or expert for the moments you want a hand through.",
    icon: "school-outline",
  },
];

export function HowItWorks() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");

  return (
    <View style={{ gap: Spacing.lg }}>
      {/* Section heading */}
      <View style={{ gap: Spacing.sm }}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          How does{" "}
          <Text style={{ color: theme.primary }}>Lifebookz</Text> work?
        </Text>
        <Text style={[styles.sectionBody, { color: theme.textMuted }]}>
          From writing your first memory to getting the right guidance — this
          is your journey in eight steps.
        </Text>
      </View>

      {/* The eight steps */}
      <View style={{ gap: Spacing.md }}>
        {STEPS.map((step, index) => (
          <View
            key={step.title}
            style={[
              styles.stepCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {/* Number rail */}
            <View
              style={[
                styles.numberRail,
                { backgroundColor: `${theme.accent}0d` },
              ]}
            >
              <View
                style={[
                  styles.numberBadge,
                  {
                    borderColor: `${theme.accent}44`,
                    backgroundColor: `${theme.accent}0f`,
                  },
                ]}
              >
                <Text
                  style={[styles.numberText, { color: theme.accent }]}
                >
                  {index + 1}
                </Text>
              </View>
            </View>

            <View style={styles.stepBody}>
              <View
                style={[
                  styles.stepIcon,
                  { backgroundColor: `${theme.primary}0f` },
                ]}
              >
                <Ionicons name={step.icon} size={18} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: theme.text }]}>                  {step.title}
                </Text>
                <Text
                  style={[styles.stepDescription, { color: theme.textMuted }]}
                >
                  {step.description}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 28, fontWeight: "800", lineHeight: 34 },
  sectionBody: { fontSize: 14, lineHeight: 21 },

  stepCard: {
    flexDirection: "row",
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  numberRail: {
    width: 52,
    alignItems: "center",
    paddingTop: Spacing.lg,
  },
  numberBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontSize: 13, fontWeight: "800" },
  stepBody: {
    flex: 1,
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  stepDescription: { fontSize: 13, lineHeight: 19, marginTop: 3 },
});

export default HowItWorks;
