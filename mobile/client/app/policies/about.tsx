import { Image } from "expo-image";
import { ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { BackBar } from "../../src/components/ui";
import { Radius, Spacing, useTheme } from "../../src/theme";

const LOGO = require("../../assets/images/logo.png");

const VALUES = [
  {
    icon: "book" as const,
    title: "Authentic Storytelling",
    description:
      "Real lives, real voices. We help people capture their journeys in their own words, exactly as they lived them.",
  },
  {
    icon: "shield-checkmark" as const,
    title: "Privacy First",
    description:
      "Personal history deserves protection. We treat every memory with the care and confidentiality it deserves.",
  },
  {
    icon: "sparkles" as const,
    title: "Legacy, Preserved",
    description:
      "From family recipes to life lessons, we make it effortless to pass your story on to future generations.",
  },
  {
    icon: "globe" as const,
    title: "A Community of Lives",
    description:
      "Read, connect, and celebrate the extraordinary within the ordinary — together, one life at a time.",
  },
];

const MISSION = [
  "Lifebookz began as a simple idea: our most important stories were being lost. Photographs fade, voices grow quiet, and the little details that make a life remarkable slip away with time.",
  "We built Lifebookz so that no one's story has to disappear. Whether it's a grandmother's childhood in another country, a hard-won career milestone, or the everyday moments that made you who you are — we give you a beautiful, lasting place to keep them.",
  "And because the best stories deserve to be heard, we pair every legacy with a community of readers who can read along, learn, and be moved by the lives of others.",
];

export default function AboutPage() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackBar onPress={() => router.back()} />

        {/* HERO */}
        <View style={styles.hero}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" />
          <Text style={[styles.title, { color: theme.text }]}>About Lifebookz</Text>
          <Text style={[styles.tagline, { color: theme.textMuted }]}>
            Every life has a story worth telling — and worth keeping.
          </Text>
        </View>

        {/* MISSION */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Our mission</Text>
        <View style={{ gap: Spacing.md }}>
          {MISSION.map((text, i) => (
            <Text key={i} style={[styles.paragraph, { color: theme.textMuted }]}>
              {text}
            </Text>
          ))}
        </View>

        {/* VALUES */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>What we believe</Text>
        <View style={{ gap: Spacing.md }}>
          {VALUES.map((value) => (
            <View
              key={value.title}
              style={[styles.valueCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={[styles.valueIcon, { backgroundColor: `${theme.primary}14` }]}>
                <Ionicons name={value.icon} size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.valueTitle, { color: theme.text }]}>{value.title}</Text>
                <Text style={[styles.valueBody, { color: theme.textMuted }]}>{value.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.footer, { color: theme.textMuted }]}>
          Lifebookz · Real stories. Real guidance.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  hero: { alignItems: "center", paddingVertical: Spacing.xl, gap: Spacing.md },
  logo: { width: 64, height: 64 },
  title: { fontSize: 26, fontWeight: "800" },
  tagline: { fontSize: 14, textAlign: "center", maxWidth: 300 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: Spacing.xl, marginBottom: Spacing.md },
  paragraph: { fontSize: 14, lineHeight: 21 },
  valueCard: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  valueIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  valueTitle: { fontSize: 15, fontWeight: "700" },
  valueBody: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  footer: { textAlign: "center", fontSize: 12, marginTop: Spacing.xxl },
});
