/**
 * "Share your experience" — one testimonial per person, editable until
 * deleted (mirrors the web client). Sign-in prompt when unauthenticated.
 */
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import api from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast";
import { Radius, Spacing, useTheme } from "../../theme";

function StarPicker({
  rating,
  onSelect,
  size = 22,
}: {
  rating: number;
  onSelect: (n: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onSelect(n)} hitSlop={6}>
          <Ionicons
            name="star"
            size={size}
            color={n <= rating ? "#fbbf24" : "rgba(148,163,184,0.4)"}
          />
        </Pressable>
      ))}
    </View>
  );
}

export function ShareTestimonial() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Refetch the community grid after any change to the user's testimonial.
  const refreshList = () =>
    queryClient.invalidateQueries({ queryKey: ["testimonials"] });

  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [mine, setMine] = useState<{ _id?: string; id?: string } | null>(null);

  async function handleSubmit() {
    if (!message.trim()) {
      toast.error("Please write a short testimonial before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/testimonials", { message: message.trim(), rating });
      toast.success("Thank you! Your testimonial is now live.");
      refreshList();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || "Failed to submit your testimonial.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!mine) return;
    try {
      await api.delete(`/testimonials/${mine._id || mine.id}`);
      setMine(null);
      setMessage("");
      setRating(5);
      toast.success("Your testimonial has been removed.");
      refreshList();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || "Failed to remove your testimonial.";
      toast.error(msg);
    }
  }

  return (
    <View style={{ gap: Spacing.lg }}>
      {/* Header */}
      <View style={{ alignItems: "center", gap: Spacing.sm }}>
        <Ionicons name="star" size={26} color="#fbbf24" />
        <Text style={[styles.title, { color: theme.text }]}>
          Share Your Experience
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {isAuthenticated
            ? "Tell us what Lifebookz means to you — your words help others discover real stories."
            : "Join our community and share how Lifebookz has touched your life."}
        </Text>
      </View>

      {isAuthenticated ? (
        <View
          style={[
            styles.form,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {mine && (
            <Text
              style={[
                styles.mineNote,
                { color: theme.success, backgroundColor: `${theme.success}1a` },
              ]}
            >
              You already shared a testimonial — editing it will update your
              existing entry.
            </Text>
          )}

          {/* Star rating picker */}
          <View style={styles.ratingRow}>
            <Text style={[styles.ratingLabel, { color: theme.textMuted }]}>
              Your rating:
            </Text>
            <StarPicker rating={rating} onSelect={setRating} />
          </View>

          <TextInput
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
            placeholder="Share how Lifebookz has helped you"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
            ]}
          />

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.signedIn, { color: theme.textMuted }]}>
                Signed in as{" "}
                <Text style={{ color: theme.text, fontWeight: "700" }}>
                  {user?.fullName || "you"}
                </Text>
              </Text>
              {mine && (
                <Pressable onPress={handleDelete} hitSlop={6}>
                  <Text style={[styles.deleteLink, { color: theme.danger }]}>
                    Delete my testimonial
                  </Text>
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting || !message.trim()}
              style={({ pressed }) => [
                styles.submit,
                {
                  backgroundColor: theme.primary,
                  opacity: submitting || !message.trim() ? 0.5 : pressed ? 0.9 : 1,
                },
              ]}
            >
              <Ionicons name="star" size={13} color={theme.primaryForeground} />
              <Text style={[styles.submitText, { color: theme.primaryForeground }]}>
                {submitting ? "Sharing..." : mine ? "Update" : "Share"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.signinCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.signinText, { color: theme.textMuted }]}>
            Sign in to share your experience with our community.
          </Text>
          <Pressable
            onPress={() => router.push("/login")}
            style={[styles.signinButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="log-in-outline" size={14} color={theme.primaryForeground} />
            <Text style={[styles.signinButtonText, { color: theme.primaryForeground }]}>
              Sign in to share
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  form: {
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.lg,
  },
  mineNote: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  ratingLabel: { fontSize: 12, fontWeight: "600" },
  input: {
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  signedIn: { fontSize: 11, lineHeight: 16 },
  deleteLink: { fontSize: 11, fontWeight: "700", marginTop: Spacing.xs },
  submit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  submitText: { fontSize: 13, fontWeight: "700" },
  signinCard: {
    alignItems: "center",
    gap: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  signinText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  signinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  signinButtonText: { fontSize: 13, fontWeight: "700" },
});
