import { ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { BackBar } from "./ui";
import { Radius, Spacing, useTheme } from "../theme";

export interface PolicySection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

/**
 * Shared renderer for the in-app policy pages (privacy, terms, guidelines)
 * — no web views, the same content the web client renders.
 */
export function PolicyScreen({
  title,
  description,
  updated,
  sections,
}: {
  title: string;
  description?: string;
  updated?: string;
  sections: PolicySection[];
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackBar onPress={() => router.back()} />

        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: theme.textMuted }]}>{description}</Text>
        ) : null}
        {updated ? (
          <Text style={[styles.updated, { color: theme.primary }]}>Last updated {updated}</Text>
        ) : null}

        <View style={{ marginTop: Spacing.xl, gap: Spacing.xl }}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
              {(section.paragraphs || []).map((text, i) => (
                <Text key={i} style={[styles.paragraph, { color: theme.textMuted }]}>
                  {text}
                </Text>
              ))}
              {section.bullets && section.bullets.length > 0 ? (
                <View style={[styles.bulletCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {section.bullets.map((bullet, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <View style={[styles.bulletDot, { backgroundColor: theme.primary }]} />
                      <Text style={[styles.bulletText, { color: theme.text }]}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>

        <Text style={[styles.footer, { color: theme.textMuted }]}>
          Questions? Reach us at support@lifebookz.com
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontSize: 26, fontWeight: "800", marginTop: Spacing.sm },
  description: { fontSize: 14, lineHeight: 20, marginTop: Spacing.sm },
  updated: { fontSize: 12, fontWeight: "700", marginTop: Spacing.md },
  section: { gap: Spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: "800" },
  paragraph: { fontSize: 14, lineHeight: 21 },
  bulletCard: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  bulletRow: { flexDirection: "row", gap: Spacing.md },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { fontSize: 14, lineHeight: 20, flex: 1 },
  footer: { textAlign: "center", fontSize: 12, marginTop: Spacing.xxl },
});
