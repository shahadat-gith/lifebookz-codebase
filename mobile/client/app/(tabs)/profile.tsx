import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/components/Toast";
import { ConsultFormSheet } from "../../src/components/ConsultFormSheet";
import { Avatar, Button, LoadingScreen } from "../../src/components/ui";
import { isVerifiedAuthor, mediaUrl } from "../../src/utils/stories";
import { Radius, Spacing, useTheme } from "../../src/theme";

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  route?: string;
  danger?: boolean;
};

export default function ProfileScreen() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
        <LoadingScreen message="Loading your profile…" />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.center, { flex: 1, backgroundColor: theme.background }]} edges={["top"]}>
        <Ionicons name="person-circle-outline" size={64} color={theme.textMuted} />
        <Text style={[styles.title, { color: theme.text, marginTop: Spacing.lg }]}>
          You&apos;re browsing as a guest
        </Text>
        <Text style={[styles.body, { color: theme.textMuted, textAlign: "center", marginTop: Spacing.sm }]}>
          Sign in to like and comment on stories, book experts, and see your sessions.
        </Text>
        <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xl }}>
          <Button label="Sign in" onPress={() => router.push("/login")} />
          <Button label="Create account" variant="outline" onPress={() => router.push("/register")} />
        </View>
      </SafeAreaView>
    );
  }

  const coverUrl = mediaUrl(user?.coverImage);

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: "Activity",
      rows: [
        { icon: "calendar-outline", label: "My bookings", sub: "Consultation sessions", route: "/bookings" },
        { icon: "book-outline", label: "Explore stories", sub: "The full lifebook feed", route: "/(tabs)/stories" },
      ],
    },
    {
      title: "Support",
      rows: [
        { icon: "chatbubbles-outline", label: "Find an expert", sub: "Book a one-to-one session", route: "__consult_sheet__" },
        { icon: "settings-outline", label: "Settings", sub: "Policies, cache, app info", route: "/settings" },
      ],
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* IDENTITY CARD — gradient cover, ringed avatar, stats strip */}
        <View
          style={[
            styles.identity,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.coverWrap}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={styles.coverBanner} contentFit="cover" transition={150} />
            ) : (
              <View style={[styles.coverBanner, { backgroundColor: theme.primary }]} />
            )}
            {/* Darken the bottom edge so the avatar ring always reads well. */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.6)"]}
              style={[styles.coverBanner, styles.coverOverlay]}
            />
          </View>
          <View style={styles.identityBody}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatarRing, { backgroundColor: theme.surface }]}>
                <Avatar uri={mediaUrl(user?.avatar)} name={user?.fullName} size={76} />
              </View>
              {isVerifiedAuthor(user || undefined) && (
                <View style={[styles.verifiedBadge, { backgroundColor: theme.surface }]}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.info} />
                </View>
              )}
            </View>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {user?.fullName || "Reader"}
            </Text>
            {user?.profession ? (
              <View style={[styles.professionChip, { backgroundColor: `${theme.primary}14` }]}>
                <Ionicons name="briefcase-outline" size={11} color={theme.primary} />
                <Text style={[styles.professionText, { color: theme.primary }]} numberOfLines={1}>
                  {user.profession}
                </Text>
              </View>
            ) : null}
            {user?.bio ? (
              <Text style={[styles.bio, { color: theme.textMuted }]} numberOfLines={3}>
                {user.bio}
              </Text>
            ) : null}
          </View>
        </View>

        {/* MENU SECTIONS */}
        {sections.map((section) => (
          <View key={section.title} style={{ marginBottom: Spacing.xl }}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{section.title}</Text>
            <View
              style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              {section.rows.map((row, i) => (
                <Pressable
                  key={row.label}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => {
                    if (row.route === "__consult_sheet__") setConsultOpen(true);
                    else if (row.route) router.push(row.route as never);
                  }}
                >
                  <View style={[styles.rowIcon, { backgroundColor: `${theme.primary}14` }]}>
                    <Ionicons name={row.icon} size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: theme.text }]}>{row.label}</Text>
                    {row.sub ? (
                      <Text style={[styles.rowSub, { color: theme.textMuted }]}>{row.sub}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <ConsultFormSheet visible={consultOpen} onClose={() => setConsultOpen(false)} />

        {/* SIGN OUT */}
        <Button
          label="Sign out"
          variant="danger"
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            try {
              await logout();
              toast.success("Signed out.");
            } catch {
              toast.error("Could not sign out. Please try again.");
            } finally {
              setSigningOut(false);
            }
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  center: { alignItems: "center", justifyContent: "center", padding: Spacing.xxl },
  title: { fontSize: 20, fontWeight: "800" },
  body: { fontSize: 14, lineHeight: 20, maxWidth: 300 },

  identity: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  coverWrap: { height: 170 },
  coverBanner: { width: "100%", height: "100%" },
  coverOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  identityBody: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  avatarWrap: { marginTop: -40 },
  avatarRing: {
    padding: 4,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderRadius: 11,
    padding: 1,
  },
  name: { fontSize: 20, fontWeight: "800", marginTop: Spacing.md },
  professionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    marginTop: Spacing.md,
  },
  professionText: { fontSize: 12, fontWeight: "700" },
  bio: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: Spacing.md },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  sectionCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowSub: { fontSize: 12, marginTop: 1 },
});
