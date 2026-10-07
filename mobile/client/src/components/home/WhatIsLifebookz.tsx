/**
 * "What is Lifebookz?" — the definition block plus the two audience panels
 * (For Authors / For Readers), mirroring the web home page.
 */
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Radius, Spacing, useTheme } from "../../theme";

const AUTHOR_PORTAL =
  process.env.EXPO_PUBLIC_AUTHOR_PORTAL || "https://author.lifebookz.com";

const AUTHOR_POINTS = [
  {
    title: "Write your life, your way",
    description:
      "Capture your memories chapter by chapter — in your own words and language, at your own pace.",
  },
  {
    title: "Publish to the world",
    description:
      "Share your finished lifebook with family, friends, or readers everywhere.",
  },
  {
    title: "Leave a legacy",
    description:
      "Your story stays preserved, so the people you love can return to it for generations.",
  },
];

const READER_POINTS = [
  {
    title: "Discover real lives",
    description:
      "Wander through stories from every walk of life — the ordinary and the extraordinary.",
  },
  {
    title: "Learn from lived lessons",
    description:
      "Find comfort and guidance in how others faced their hardest days and biggest turns.",
  },
  {
    title: "Get inspired, any day",
    description:
      "Trending and featured lifebooks bring fresh perspectives to your feed, whenever you need them.",
  },
];

function AudiencePanel({
  icon,
  label,
  subtitle,
  items,
  cta,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  items: { title: string; description: string }[];
  cta: string;
  onPress: () => void;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");

  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      {/* Panel header */}
      <View style={[styles.panelHeader, { borderBottomColor: theme.border }]}>
        <View
          style={[styles.panelIcon, { backgroundColor: `${theme.accent}1f` }]}
        >
          <Ionicons name={icon} size={18} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.panelTitle, { color: theme.text }]}>
            {label}
          </Text>
          <Text style={[styles.panelSubtitle, { color: theme.textMuted }]}>
            {subtitle}
          </Text>
        </View>
      </View>

      {/* Numbered items */}
      {items.map((item, index) => (
        <View
          key={item.title}
          style={[
            styles.itemRow,
            index > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.itemBadge,
              {
                borderColor: `${theme.accent}44`,
                backgroundColor: `${theme.accent}0f`,
              },
            ]}
          >
            <Text style={[styles.itemBadgeText, { color: theme.accent }]}>
              {index + 1}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemTitle, { color: theme.text }]}>
              {item.title}
            </Text>
            <Text style={[styles.itemDescription, { color: theme.textMuted }]}>
              {item.description}
            </Text>
          </View>
        </View>
      ))}

      {/* Panel CTA */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.panelCta,
          { borderTopColor: theme.border, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.panelCtaText, { color: theme.primary }]}>
          {cta}
        </Text>
        <Ionicons name="arrow-forward" size={14} color={theme.primary} />
      </Pressable>
    </View>
  );
}

export function WhatIsLifebookz() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();

  return (
    <View style={{ gap: Spacing.xl }}>
      {/* Definition */}
      <View style={{ gap: Spacing.md }}>
        <View
          style={[
            styles.ideaBadge,
            {
              borderColor: `${theme.accent}26`,
              backgroundColor: `${theme.accent}14`,
            },
          ]}
        ></View>
        <Text style={[styles.definitionTitle, { color: theme.text }]}>
          What is <Text style={{ color: theme.primary }}>Lifebookz</Text>?
        </Text>
        <Text style={[styles.definitionBody, { color: theme.textMuted }]}>
          A digital home for life stories. Write your own memories and leave a
          legacy — or read the lives of others and learn from the lessons they
          lived.
        </Text>
        <View
          style={[
            styles.writeReadChip,
            { borderColor: theme.border, backgroundColor: theme.surface },
          ]}
        >

        </View>
      </View>

      {/* Two audiences */}
      <View style={{ gap: Spacing.lg }}>
        <AudiencePanel
          icon="create-outline"
          label="For Authors"
          subtitle="Write · Preserve · Pass on"
          items={AUTHOR_POINTS}
          cta="Join as Author"
          onPress={() => Linking.openURL(AUTHOR_PORTAL).catch(() => {})}
        />
        <AudiencePanel
          icon="book-outline"
          label="For Readers"
          subtitle="Discover · Learn · Be inspired"
          items={READER_POINTS}
          cta="Explore life stories"
          onPress={() => router.push("/(tabs)/stories")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ideaBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ideaBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  definitionTitle: { fontSize: 30, fontWeight: "800", lineHeight: 36 },
  definitionBody: { fontSize: 15, lineHeight: 24 },
  writeReadChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  writeReadChipText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },

  panel: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  panelIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  panelTitle: { fontSize: 16, fontWeight: "800" },
  panelSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginTop: 1,
  },
  itemRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  itemBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  itemBadgeText: { fontSize: 10, fontWeight: "800" },
  itemTitle: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  itemDescription: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  panelCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  panelCtaText: { fontSize: 13, fontWeight: "800" },
});
