import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "../src/context/AuthContext";
import { ConsultFormSheet } from "../src/components/ConsultFormSheet";
import { BookingListSkeleton } from "../src/components/Skeleton";
import { useToast } from "../src/components/Toast";
import * as consultApi from "../src/api/consultation";
import { openPayment, openConsultation } from "../src/utils/handoff";
import { apiErrorMessage, formatDate } from "../src/utils/helpers";
import { getCategoryLabel } from "../src/utils/consult";
import { BackBar, Badge, Button, EmptyState, ErrorState, LoadingScreen, ScreenHeader } from "../src/components/ui";
import { Radius, Spacing, useTheme } from "../src/theme";
import type { Consultation } from "../src/types";

const UPCOMING: string[] = ["PENDING", "CONFIRMED", "IN_PROGRESS"];
const HISTORY: string[] = ["COMPLETED", "CANCELLED", "EXPIRED"];

export default function BookingsScreen() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const toast = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [ratingTarget, setRatingTarget] = useState<Consultation | null>(null);
  const [consultOpen, setConsultOpen] = useState(false);

  const bookings = useQuery({
    queryKey: ["consultations", "mine"],
    enabled: isAuthenticated,
    queryFn: () => consultApi.listMine(),
  });

  const consultations = bookings.data || [];
  const upcoming = consultations.filter((c) => UPCOMING.includes(c.status || ""));
  const history = consultations.filter((c) => HISTORY.includes(c.status || ""));

  async function handleJoin(consultation: Consultation) {
    const id = (consultation._id || consultation.id) as string;
    setCheckingId(id);
    try {
      const session = await consultApi.getSession(id);
      if (session.paymentRequired) {
        await openPayment("consultation", id);
      } else {
        await openConsultation(id);
      }
    } catch (err) {
      toast.error(
        apiErrorMessage(err, "Could not open this session. Please try again."),
      );
    } finally {
      setCheckingId(null);
    }
  }

  async function handleCancel(consultationId: string) {
    setCancellingId(consultationId);
    try {
      await consultApi.cancel(consultationId);
      await bookings.refetch();
      toast.success("Session cancelled.");
    } catch (err) {
      toast.error(
        apiErrorMessage(err, "We couldn't cancel this session. Please try again."),
      );
    } finally {
      setCancellingId(null);
    }
  }

  async function handleRate(score: number, review: string) {
    if (!ratingTarget) return;
    const id = (ratingTarget._id || ratingTarget.id) as string;
    try {
      await consultApi.rate(id, score, review);
      toast.success("Thanks for your rating!");
      setRatingTarget(null);
      await bookings.refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not submit your rating."));
    }
  }

  if (!authLoading && !isAuthenticated) {
    return (
      <SafeAreaView style={[styles.center, { flex: 1, backgroundColor: theme.background }]} edges={["top"]}>
        <Ionicons name="lock-closed-outline" size={40} color={theme.textMuted} />
        <Text style={[styles.stateTitle, { color: theme.text, marginTop: Spacing.lg }]}>
          Sign in to see your sessions
        </Text>
        <Text style={[styles.stateBody, { color: theme.textMuted, textAlign: "center", marginTop: Spacing.sm }]}>
          Your consultation sessions are tied to your account.
        </Text>
        <Button label="Sign in" onPress={() => router.push("/login")} style={{ marginTop: Spacing.xl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <View style={styles.header}>
        <BackBar onPress={() => router.back()} />
        <ScreenHeader
          title="My bookings"
          subtitle="Track your consultation requests — pay at the room door, then join."
        />
      </View>

      {bookings.isLoading || authLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <BookingListSkeleton count={3} />
        </ScrollView>
      ) : bookings.isError ? (
        <ErrorState
          title="Sessions didn't load"
          message="We couldn't load your sessions. Please try again."
          onRetry={() => bookings.refetch()}
        />
      ) : consultations.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No sessions yet"
          description="Find an expert who understands your situation and request your first session."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {upcoming.length > 0 && (
            <Section title={`Upcoming sessions (${upcoming.length})`}>
              {upcoming.map((c) => (
                <BookingCard
                  key={c._id || c.id}
                  consultation={c}
                  theme={theme}
                  cancelling={cancellingId === (c._id || c.id)}
                  joining={checkingId === (c._id || c.id)}
                  onJoin={() => handleJoin(c)}
                  onCancel={() => handleCancel((c._id || c.id) as string)}
                  onRate={() => setRatingTarget(c)}
                />
              ))}
            </Section>
          )}

          {history.length > 0 && (
            <Section title={`History (${history.length})`}>
              {history.map((c) => (
                <BookingCard
                  key={c._id || c.id}
                  consultation={c}
                  theme={theme}
                  cancelling={cancellingId === (c._id || c.id)}
                  joining={checkingId === (c._id || c.id)}
                  onJoin={() => handleJoin(c)}
                  onCancel={() => handleCancel((c._id || c.id) as string)}
                  onRate={() => setRatingTarget(c)}
                />
              ))}
            </Section>
          )}

          <Button
            label="Request another session"
            variant="outline"
            icon="add"
            onPress={() => setConsultOpen(true)}
            style={{ marginTop: Spacing.xl }}
          />
        </ScrollView>
      )}

      <ConsultFormSheet visible={consultOpen} onClose={() => setConsultOpen(false)} />

      <RatingModal
        visible={!!ratingTarget}
        expertName={ratingTarget?.expert?.fullName || "your expert"}
        onClose={() => setRatingTarget(null)}
        onSubmit={handleRate}
      />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  return (
    <View style={{ marginBottom: Spacing.xl }}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <View style={{ gap: Spacing.md, marginTop: Spacing.md }}>{children}</View>
    </View>
  );
}

const STATUS_TONE: Record<string, "primary" | "success" | "danger" | "muted"> = {
  PENDING: "primary",
  CONFIRMED: "primary",
  IN_PROGRESS: "primary",
  COMPLETED: "success",
  CANCELLED: "danger",
  EXPIRED: "muted",
};

function BookingCard({
  consultation,
  theme,
  cancelling,
  joining,
  onJoin,
  onCancel,
  onRate,
}: {
  consultation: Consultation;
  theme: ReturnType<typeof useTheme>;
  cancelling: boolean;
  joining: boolean;
  onJoin: () => void;
  onCancel: () => void;
  onRate: () => void;
}) {
  const status = consultation.status || "PENDING";
  const canJoin = UPCOMING.includes(status);
  const canCancel = ["PENDING", "CONFIRMED"].includes(status);
  const canRate = status === "COMPLETED";

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cardTop}>
        <Badge label={status.replace("_", " ")} tone={STATUS_TONE[status] || "muted"} />
        <Text style={[styles.date, { color: theme.textMuted }]}>
          {consultation.createdAt ? formatDate(consultation.createdAt) : ""}
        </Text>
      </View>

      <Text style={[styles.expert, { color: theme.text }]} numberOfLines={1}>
        {consultation.expert?.fullName || "Expert"}
      </Text>
      {consultation.category ? (
        <Text style={[styles.meta, { color: theme.textMuted }]}>
          {getCategoryLabel(consultation.category)}
        </Text>
      ) : null}
      {consultation.problem ? (
        <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={2}>
          {consultation.problem}
        </Text>
      ) : null}

      <View style={styles.cardActions}>
        {canJoin && (
          <Button
            label={joining ? "Checking…" : "Join session"}
            icon="videocam"
            onPress={onJoin}
            loading={joining}
          />
        )}
        {canRate && !consultation.rating && (
          <Button label="Rate session" variant="outline" icon="star" onPress={onRate} />
        )}
        {canCancel && (
          <View style={{ marginTop: Spacing.md }}>
            <Button
              label={cancelling ? "Cancelling…" : "Cancel session"}
              variant="ghost"
              icon="close"
              onPress={onCancel}
              loading={cancelling}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function RatingModal({
  visible,
  expertName,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  expertName: string;
  onClose: () => void;
  onSubmit: (score: number, review: string) => void;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const [score, setScore] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            Rate your session with {expertName}
          </Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setScore(n)} hitSlop={4}>
                <Ionicons
                  name={n <= score ? "star" : "star-outline"}
                  size={32}
                  color={n <= score ? theme.accent : theme.textMuted}
                />
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[styles.reviewInput, { color: theme.text, borderColor: theme.border }]}
            value={review}
            onChangeText={setReview}
            placeholder="What went well? (optional)"
            placeholderTextColor={theme.textMuted}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.modalActions}>
            <Button label="Cancel" variant="ghost" onPress={onClose} />
            <Button
              label="Submit"
              onPress={async () => {
                if (score === 0) return;
                setSubmitting(true);
                await onSubmit(score, review.trim());
                setSubmitting(false);
              }}
              disabled={score === 0 || submitting}
              loading={submitting}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  sectionTitle: { fontSize: 15, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },

  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  date: { fontSize: 12 },
  expert: { fontSize: 16, fontWeight: "700", marginTop: Spacing.md },
  meta: { fontSize: 13, marginTop: 2 },

  cardActions: { marginTop: Spacing.lg },

  center: { alignItems: "center", justifyContent: "center", padding: Spacing.xxl },
  stateTitle: { fontSize: 18, fontWeight: "700" },
  stateBody: { fontSize: 14, lineHeight: 20, maxWidth: 300 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  modalCard: {
    width: "100%",
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.xl,
  },
  modalTitle: { fontSize: 17, fontWeight: "800" },
  stars: { flexDirection: "row", gap: Spacing.sm, marginVertical: Spacing.lg },
  reviewInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 80,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
});
