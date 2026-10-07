import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "../src/context/AuthContext";
import { useToast } from "../src/components/Toast";
import { useQueryClient } from "@tanstack/react-query";
import { BackBar, Button, ScreenHeader } from "../src/components/ui";
import { Radius, Spacing, useTheme } from "../src/theme";

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackBar onPress={() => router.back()} />
        <ScreenHeader title="Settings" subtitle="Preferences and app information." />

        {/* APPEARANCE */}
        <SettingsSection title="Appearance">
          <SettingsRow
            icon="contrast-outline"
            label="Theme"
            value={scheme === "dark" ? "Dark" : "Light"}
            muted
          />
        </SettingsSection>

        {/* LEGAL & POLICIES */}
        <SettingsSection title="Legal & policies">
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Privacy policy"
            chevron
            onPress={() => router.push("/policies/privacy")}
          />
          <SettingsRow
            icon="document-text-outline"
            label="Terms of service"
            chevron
            onPress={() => router.push("/policies/terms")}
          />
          <SettingsRow
            icon="albums-outline"
            label="Content guidelines"
            chevron
            onPress={() => router.push("/policies/guidelines")}
          />
          <SettingsRow
            icon="information-circle-outline"
            label="About Lifebookz"
            chevron
            onPress={() => router.push("/policies/about")}
          />
        </SettingsSection>

        {/* APP */}
        <SettingsSection title="App">
          <SettingsRow
            icon="refresh-outline"
            label="Clear cached content"
            chevron
            onPress={async () => {
              await queryClient.invalidateQueries();
              toast.success("Cache cleared — content will reload fresh.");
            }}
          />
          <SettingsRow icon="server" label="Version" value="1.0.0" muted />
        </SettingsSection>

        {/* ACCOUNT */}
        {isAuthenticated && (
          <SettingsSection title="Account">
            <View style={{ padding: Spacing.lg }}>
              <Button
                label="Sign out"
                variant="danger"
                loading={signingOut}
                onPress={async () => {
                  setSigningOut(true);
                  try {
                    await logout();
                    toast.success("Signed out.");
                    router.back();
                  } catch {
                    toast.error("Could not sign out. Please try again.");
                  } finally {
                    setSigningOut(false);
                  }
                }}
              />
            </View>
          </SettingsSection>
        )}

        <Text style={[styles.footer, { color: theme.textMuted }]}>
          Lifebookz · Real stories. Real guidance.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  return (
    <View style={{ marginBottom: Spacing.xl }}>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{title}</Text>
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  chevron = false,
  muted = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  muted?: boolean;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");

  const content = (
    <>
      <Ionicons name={icon} size={18} color={theme.primary} />
      <Text style={[styles.rowLabel, { color: theme.text, flex: 1 }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text
          style={[styles.rowValue, { color: muted ? theme.textMuted : theme.text }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
      {chevron && <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
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
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  rowValue: { fontSize: 13, flexShrink: 1, textAlign: "right" },
  footer: { textAlign: "center", fontSize: 12, marginTop: Spacing.sm },
});
