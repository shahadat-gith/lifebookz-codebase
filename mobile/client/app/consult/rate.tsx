/**
 * Rate a completed session — the mobile-native replacement for the
 * session portal's web rating page. The session room deep-links back here
 * when the meeting ends (lifebookz://consult/rate?consultationId=…), and
 * My Bookings links COMPLETED sessions to this screen.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

import { BackBar, Button, ErrorState, LoadingScreen, Avatar } from "../../src/components/ui";
import { useToast } from "../../src/components/Toast";
import * as consultApi from "../../src/api/consultation";
import { apiErrorMessage } from "../../src/utils/helpers";
import { mediaUrl } from "../../src/utils/stories";
import { Radius, Spacing, useTheme } from "../../src/theme";
import type { Consultation } from "../../src/types";

export default function ConsultRateScreen() {
  const { consultationId } = useLocalSearchParams<{ consultationId?: string }>();
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const toast = useToast();

  const [score, setScore] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const consultation = useQuery({
    queryKey: ["consultations", "detail", consultationId],
    enabled: !!consultationId,
    queryFn: async () => {
      const res = await consultApi.getConsultation(consultationId as string);
      return res as Consultation;
    },
    // Every page load re-authorizes server-side; a completed-but-unrated
    // session keeps this refetch harmless, and the rating submit relies on
    // the record we already have.
  });

  const expertName = consultation.data?.expert?.fullName || "your expert";
  const alreadyRated = !!consultation.data?.rating?.score;

  const submit = async () => {
    if (!score || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await consultApi.rate(consultationId as string, score, review.trim());
      setDone(true);
      toast.success("Thanks for your rating!");
      router.replace("/bookings");
    } catch (err) {
      const msg = apiErrorMessage(err, "Your rating couldn't be saved. Please try again.");
      if (/already rated/i.test(msg)) {
        setDone(true);
        toast.success("You've already rated this session.");
        router.replace("/bookings");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top", "bottom"]}>
      <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
        <BackBar onPress={() => router.back()} />
      </View>

      {consultation.isLoading ? (
        <LoadingScreen message="Loading your session…" />
      ) : consultation.isError ? (
        <ErrorState
          title="Session not found"
          message="We couldn't load this session. It may have ended."
          onRetry={() => consultation.refetch()}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.center}>
            <Avatar
              uri={
                consultation.data?.expert?.avatar
                  ? mediaUrl(consultation.data.expert.avatar)
                  : undefined
              }
              name={expertName}
              size={72}
            />
            <Text style={[styles.title, { color: theme.text }]}>
              How was your session?
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Rate your meeting with{" "}
              <Text style={{ color: theme.text, fontWeight: "700" }}>{expertName}</Text>{" "}
              — your feedback shapes their rating and helps others choose well.
            </Text>

            {alreadyRated || done ? (
              <>
                <View style={[styles.doneBadge, { backgroundColor: `${theme.success}1a` }]}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                  <Text style={[styles.doneText, { color: theme.success }]}>
                    {alreadyRated ? "You've already rated this session" : "Rating saved — thank you!"}
                  </Text>
                </View>
                <Button
                  label="Back to My bookings"
                  onPress={() => router.replace("/bookings")}
                  style={{ marginTop: Spacing.xl, alignSelf: "stretch" }}
                />
              </>
            ) : (
              <>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setScore(n)} hitSlop={6}>
                      <Ionicons
                        name={n <= score ? "star" : "star-outline"}
                        size={40}
                        color={n <= score ? theme.accent : theme.textMuted}
                      />
                    </Pressable>
                  ))}
                </View>

                <TextInput
                  style={[
                    styles.reviewInput,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                  value={review}
                  onChangeText={setReview}
                  placeholder="Share a few words about the session (optional)"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  maxLength={2000}
                  textAlignVertical="top"
                />

                {error ? (
                  <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
                ) : null}

                <Button
                  label={submitting ? "Saving…" : "Submit rating"}
                  onPress={submit}
                  disabled={!score || submitting}
                  loading={submitting}
                  style={{ marginTop: Spacing.lg, alignSelf: "stretch" }}
                />
              </>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  center: { alignItems: "center", paddingTop: Spacing.xl, gap: Spacing.sm },
  title: { fontSize: 24, fontWeight: "800", marginTop: Spacing.md, textAlign: "center" },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 320,
    marginBottom: Spacing.lg,
  },
  stars: { flexDirection: "row", gap: Spacing.sm, marginVertical: Spacing.md },
  reviewInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 96,
    fontSize: 14,
    marginTop: Spacing.md,
  },
  errorText: { fontSize: 13, textAlign: "center", marginTop: Spacing.md },
  doneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    marginTop: Spacing.lg,
  },
  doneText: { fontSize: 13, fontWeight: "700" },
});
