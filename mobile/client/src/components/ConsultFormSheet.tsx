import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";

import { Input, Button, SelectField } from "./ui";
import { useAuth } from "../context/AuthContext";
import {
  COACH_CATEGORIES,
  MIN_PROBLEM_LENGTH,
  buildProblem,
  validateConsult,
} from "../utils/consult";
import { Radius, Spacing, useTheme } from "../theme";

/**
 * Bottom-sheet consult brief. Rises from the bottom taking only the space
 * its content needs — no dim layer — tapping above the sheet dismisses it.
 * On submit the user is taken to the dedicated results page.
 */
export function ConsultFormSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [problem, setProblem] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    const invalid = validateConsult({ problem, category });
    if (invalid) {
      setError(invalid);
      return;
    }

    setError("");
    onClose();
    router.push({
      pathname: "/consult/results",
      params: {
        problem: buildProblem(problem),
        category,
      },
    });
  }

  function requireAuthThenClose() {
    onClose();
    router.push("/login");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Anchored to the bottom; the area above stays clear (tap to close). */}
      <View style={styles.root}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <SafeAreaView edges={["bottom"]} style={styles.sheetWrap}>
            <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {/* Grab handle + header */}
              <View style={[styles.handle, { backgroundColor: theme.border }]} />
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: theme.text }]}>Talk to an expert</Text>
                  <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                    Tell us what&apos;s going on — we&apos;ll match you with the right experts.
                  </Text>
                </View>
                <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={theme.text} />
                </Pressable>
              </View>

              {!isAuthenticated ? (
                <View style={{ gap: Spacing.lg, paddingBottom: Spacing.lg }}>
                  <Text style={[styles.authNotice, { color: theme.textMuted }]}>
                    Sign in to request a session — your bookings are kept with your account.
                  </Text>
                  <Button label="Sign in" fullWidth size="lg" onPress={requireAuthThenClose} />
                </View>
              ) : (
                <>
                  <Input
                    label={`What's going on? (${MIN_PROBLEM_LENGTH}+ characters)`}
                    value={problem}
                    onChangeText={(v) => {
                      setError("");
                      setProblem(v);
                    }}
                    placeholder="Describe your problem or situation…"
                    multiline
                    autoCapitalize="sentences"
                  />

                  <SelectField
                    label="Category"
                    value={category}
                    onChange={(v) => {
                      setError("");
                      setCategory(v);
                    }}
                    options={COACH_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
                    placeholder="Select a category…"
                    error={!!error && !category}
                  />

                  {error ? (
                    <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
                  ) : null}

                  <Button
                    label="Find experts"
                    icon="search"
                    size="lg"
                    fullWidth
                    onPress={handleSubmit}
                    style={{ marginTop: Spacing.sm, marginBottom: Spacing.lg }}
                  />
                </>
              )}
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // No dark layer — the sheet simply anchors to the bottom edge.
  root: { flex: 1, justifyContent: "flex-end" },
  dismissArea: { flex: 1 },
  sheetWrap: { backgroundColor: "transparent" },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  closeBtn: { padding: Spacing.xs },
  authNotice: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  error: { fontSize: 13, marginBottom: Spacing.md },
});
