import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { setHomeReloadHandler } from "../../src/utils/homeReload";

import api from "../../src/config/api";
import { Radius, Spacing, useTheme } from "../../src/theme";
import { StoryCard, StoryRailCard } from "../../src/components/StoryCard";
import { EmptyState, Reveal } from "../../src/components/ui";
import { ConsultFormSheet } from "../../src/components/ConsultFormSheet";
import { WhatIsLifebookz } from "../../src/components/home/WhatIsLifebookz";
import { HowItWorks } from "../../src/components/home/HowItWorks";
import { CoachSection } from "../../src/components/home/CoachSection";
import { TestimonialsRail } from "../../src/components/home/Testimonials";
import {
  HeroSkeleton,
  HomeSkeleton,
  StoryCardListSkeleton,
} from "../../src/components/Skeleton";
import { storyImage } from "../../src/utils/stories";
import { useAuth } from "../../src/context/AuthContext";
import type { Story } from "../../src/types";

const LOGO = require("../../assets/images/logo.png");
const HERO = require("../../assets/images/hero.png");

export default function HomeScreen() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const [consultOpen, setConsultOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const latest = useQuery({
    queryKey: ["stories", "latest", 1],
    queryFn: async () => {
      const res = await api.get("/stories", { params: { limit: 8, page: 1 } });
      return (res.data.data?.stories || []) as Story[];
    },
  });

  // Tapping Home while already on it → scroll up and refresh the feed.
  const refetchLatest = latest.refetch;
  useEffect(() => {
    setHomeReloadHandler(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      refetchLatest();
    });
    return () => setHomeReloadHandler(null);
  }, [refetchLatest]);

  const stories = latest.data || [];
  // The first story with cover art leads the hero; the rest feed the rails.
  const featured = stories.find((s) => storyImage(s));
  const rail = stories.filter((s) => s !== featured).slice(0, 4);
  const list = stories.filter((s) => s !== featured && !rail.includes(s));

  const quickActions = [
    {
      icon: "book" as const,
      label: "Explore",
      tint: theme.primary,
      onPress: () => router.push("/(tabs)/stories"),
    },
    {
      icon: "flame" as const,
      label: "Trending",
      tint: theme.danger,
      onPress: () => router.push("/(tabs)/trending"),
    },
    {
      icon: "chatbubbles" as const,
      label: "Consult",
      tint: theme.accent,
      onPress: () => setConsultOpen(true),
    },
    {
      icon: "calendar" as const,
      label: "Bookings",
      tint: theme.info,
      onPress: () => router.push("/bookings"),
    },
  ];

  // While the app restores its session on launch, show a full-page skeleton
  // that mirrors the home layout so the reveal feels seamless.
  if (authLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
        <View style={styles.scroll}>
          <HomeSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={latest.isFetching}
            onRefresh={() => latest.refetch()}
            tintColor={theme.primary}
          />
        }
      >
        {/* BRAND ROW */}
        <Reveal>
          <View style={styles.brandRow}>
            <Image source={LOGO} style={styles.brandLogo} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.brandName, { color: theme.text }]}>Lifebookz</Text>
              <Text style={[styles.brandTag, { color: theme.textMuted }]}>
                Real stories. Real guidance.
              </Text>
            </View>
          </View>
        </Reveal>

        {/* FEATURED HERO — full-bleed cover with gradient overlay */}
        {latest.isLoading ? (
          <HeroSkeleton />
        ) : featured ? (
          <Pressable
            style={({ pressed }) => [styles.hero, { opacity: pressed ? 0.94 : 1 }]}
            onPress={() => {
              const slug = featured.slug || featured._id || featured.id;
              if (slug) router.push(`/story/${slug}` as never);
            }}
          >
            <Image
              source={storyImage(featured) ? { uri: storyImage(featured) } : HERO}
              style={styles.heroImage}
              contentFit="cover"
              transition={200}
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.88)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroOverlay}>
              <View style={styles.heroBadge}>
                <Ionicons name="star" size={11} color="#fbbf24" />
                <Text style={styles.heroBadgeText}>FEATURED STORY</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {featured.title || "Untitled Story"}
              </Text>
              <Text style={styles.heroAuthor} numberOfLines={1}>
                {featured.author?.fullName || "Anonymous Author"}
                {featured.author?.profession ? ` · ${featured.author.profession}` : ""}
              </Text>
              <View style={styles.heroTapHint}>
                <Text style={styles.heroTapHintText}>Tap to read the full story →</Text>
              </View>
            </View>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.hero, { opacity: pressed ? 0.94 : 1 }]}
            onPress={() => router.push("/(tabs)/stories")}
          >
            <Image source={HERO} style={styles.heroImage} contentFit="cover" transition={200} />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.88)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroOverlay}>
              <Text style={styles.heroTitle}>Every life has a story worth telling.</Text>
              <Text style={styles.heroAuthor}>
                Read real lifebooks — and book an expert when you need guidance.
              </Text>
              <View style={styles.heroTapHint}>
                <Text style={styles.heroTapHintText}>Explore stories →</Text>
              </View>
            </View>
          </Pressable>
        )}

        {/* QUICK ACTIONS */}
        <View style={styles.quickRow}>
          {quickActions.map((action, i) => (
            <Reveal key={action.label} delay={80 + i * 60} style={{ flex: 1 }}>
              <Pressable
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.quickCard,
                  { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[styles.quickIcon, { backgroundColor: `${action.tint}18` }]}>
                  <Ionicons name={action.icon} size={20} color={action.tint} />
                </View>
                <Text style={[styles.quickLabel, { color: theme.text }]}>{action.label}</Text>
              </Pressable>
            </Reveal>
          ))}
        </View>

        {/* CONSULTATION — talk to an expert */}
        <Reveal delay={320}>
          <CoachSection onBook={() => setConsultOpen(true)} />
        </Reveal>

        {/* WHAT IS LIFEBOOKZ — definition + authors/readers panels */}
        <Reveal delay={380}>
          <WhatIsLifebookz />
        </Reveal>

        {/* HOW DOES LIFEBOOKZ WORK — the eight-step journey */}
        <Reveal delay={420}>
          <HowItWorks />
        </Reveal>

        {/* TRENDING RAIL */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Stories from real lives
          </Text>
          <Text
            style={[styles.sectionLink, { color: theme.primary }]}
            onPress={() => router.push("/(tabs)/stories")}
          >
            View all
          </Text>
        </View>

        {latest.isLoading ? (
          <StoryCardListSkeleton count={2} />
        ) : rail.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title="No stories yet"
            description="Check back soon — authors are writing."
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.md, paddingRight: Spacing.lg }}
          >
            {rail.map((story) => (
              <StoryRailCard key={story._id || story.id} story={story} />
            ))}
          </ScrollView>
        )}

        {/* THE REST, FULL CARDS */}
        {list.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Fresh from the community
              </Text>
            </View>
            <View style={{ gap: Spacing.lg }}>
              {list.map((story) => (
                <StoryCard key={story._id || story.id} story={story} />
              ))}
            </View>
          </>
        )}

        {/* TESTIMONIALS — community voices rail → full page */}
        <TestimonialsRail />

      </ScrollView>

      {/* Talk to an expert — bottom-sheet brief → results page */}
      <ConsultFormSheet visible={consultOpen} onClose={() => setConsultOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: Spacing.sm,
  },
  brandLogo: { width: 40, height: 40 },
  brandName: { fontSize: 20, fontWeight: "800", letterSpacing: 0.2 },
  brandTag: { fontSize: 12, marginTop: 1 },

  hero: {
    height: 300,
    borderRadius: Radius.xl,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  heroImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  heroOverlay: {
    paddingTop: 130,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  heroBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800", lineHeight: 30 },
  heroAuthor: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  heroTapHint: { marginTop: Spacing.xs },
  heroTapHintText: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "700" },

  quickRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  quickCard: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 12, fontWeight: "700" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 20, fontWeight: "800" },
  sectionLink: { fontSize: 14, fontWeight: "600" },
});
