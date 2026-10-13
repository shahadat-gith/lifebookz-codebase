/**
 * Waiting for expert confirmation — shown right after a booking request is
 * sent (same flow as the web client's waiting page). Live updates arrive
 * over the AWS API Gateway WebSocket (consultation.confirmed/.cancelled);
 * a lightweight polling fallback covers WS outage.
 *
 * The wait is bounded, exactly like the web client:
 *   • 2 min  — a dismissible "Getting late?" modal offers to book a
 *              different expert instead.
 *   • 5 min  — the request is cancelled automatically ("Expert did not
 *              confirm") and the user is pointed to book a new expert.
 * "Book a new expert" always cancels the pending request first — nothing
 * is left dangling.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import * as SecureStore from "expo-secure-store";

import api from "../../src/config/api";
import { Radius, Spacing, useTheme } from "../../src/theme";
import { BackBar, Avatar, Button } from "../../src/components/ui";
import { useToast } from "../../src/components/Toast";
import { useConsultationEvents } from "../../src/api/realtime";
import { openPayment } from "../../src/utils/handoff";
import { apiErrorMessage } from "../../src/utils/helpers";
import { cancel } from "../../src/api/consultation";
import type { Consultation } from "../../src/types";

const POLL_INTERVAL_MS = 20_000; // WS-fallback net: checks status every 20s
const NUDGE_MS = 2 * 60_000; // "Getting late?" modal after this
const MAX_WAIT_MS = 5 * 60_000; // server auto-cancels here; mirror it
const FALLBACK_DEADLINE_MS = MAX_WAIT_MS;

/**
 * "Getting late?" — after two minutes without a confirmation, a
 * dismissible modal offers to book a different expert. The ✕ and the
 * backdrop both keep waiting; only the 5-minute expiry forces the exit.
 */
function GettingLateModal({
  expertName,
  onDismiss,
  onBookOther,
}: {
  expertName: string;
  onDismiss: () => void;
  onBookOther: () => void;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        style={[styles.modalBackdrop]}
        onPress={onDismiss}
        accessibilityRole="button"
      >
        <Pressable
          style={[
            styles.modalSheet,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={() => {}}
        >
          <Pressable
            onPress={onDismiss}
            hitSlop={10}
            style={styles.modalClose}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>

          <View style={styles.modalIconWrap}>
            <Ionicons name="time-outline" size={26} color={theme.accent} />
          </View>

          <Text style={[styles.modalTitle, { color: theme.text }]}>
            Getting late?
          </Text>
          <Text style={[styles.modalBody, { color: theme.textMuted }]}>
            {expertName} hasn&apos;t responded yet. You can keep waiting —
            we&apos;ll notify you the moment there&apos;s an update — or book a
            different expert right away.
          </Text>

          <Button
            label="Book a new expert"
            variant="outline"
            icon="search"
            onPress={onBookOther}
            style={styles.modalButton}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * The 5-minute expiry screen: the request was cancelled automatically and
 * the user is asked to book a different expert. "Book a new expert" cancels
 * the pending request first, then opens the expert search.
 */
function ExpiredScreen({
  expertName,
  onBookOther,
  onBookings,
  cancelling,
}: {
  expertName: string;
  onBookOther: () => void;
  onBookings: () => void;
  cancelling: boolean;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");

  return (
    <View style={styles.center}>
      <Ionicons name="time-outline" size={44} color={theme.danger} />
      <Text style={[styles.stateTitle, { color: theme.text }]}>
        Request not confirmed
      </Text>
      <Text
        style={[
          styles.stateBody,
          { color: theme.textMuted, textAlign: "center" },
        ]}
      >
        {expertName} didn&apos;t confirm your session within 5 minutes, so the
        request has been cancelled. You won&apos;t be charged. Please book a new
        expert — someone else may be available right away.
      </Text>

      <Button
        label={cancelling ? "Cancelling…" : "Book a new expert"}
        icon="search"
        onPress={onBookOther}
        loading={cancelling}
        disabled={cancelling}
        style={{ marginTop: Spacing.xl, alignSelf: "stretch" }}
      />
      <Button
        label="View my bookings"
        variant="ghost"
        onPress={onBookings}
        style={{ marginTop: Spacing.md, alignSelf: "stretch" }}
      />
    </View>
  );
}

export default function ConsultWaitingScreen() {
  const { consultationId, expertName, expertAvatar } = useLocalSearchParams<{
    consultationId?: string;
    expertName?: string;
    expertAvatar?: string;
  }>();
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [expiredByTimer, setExpiredByTimer] = useState(false);
  const expiredRef = useRef(false);

  // Source of truth: the consultation record. The WS event invalidates it.
  const consultation = useQuery({
    queryKey: ["consultations", "detail", consultationId],
    enabled: !!consultationId,
    queryFn: async () => {
      const res = await api.get(`/consultations/${consultationId}`);
      return res.data.data as Consultation;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling once resolved either way.
      if (status && status !== "PENDING") return false;
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });

  const { lastEvent } = useConsultationEvents(consultationId);

  const status = consultation.data?.status || "PENDING";
  const confirmed = status === "CONFIRMED";
  // Expiry screen shows for the 5-minute timer OR a remote cancel/expiry
  // that arrived via WS/poll while we were waiting.
  const expired =
    expiredByTimer || status === "CANCELLED" || status === "EXPIRED";

  // WS event → invalidate the record → react-query refetches → status flips.
  // The socket is the signal, the API is the truth.
  useEffect(() => {
    if (!lastEvent) return;
    queryClient.invalidateQueries({
      queryKey: ["consultations", "detail", consultationId],
    });
  }, [lastEvent, queryClient, consultationId]);

  /**
   * Server-clock-driven timers, same as the web client. The backend issues
   * `confirmDeadline` on every consultation payload and auto-cancels at
   * that moment in its own sweep — closing the app, navigating away, or a
   * dropped socket never moves the deadline. This screen mirrors it for
   * presentation; the local cancel at expiry is a best-effort catch-up.
   *
   * AsyncStorage keeps the deadline so re-entering the waiting screen
   * (waiting → bookings → waiting) resumes the same countdown.
   */
  const [deadline, setDeadline] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const persisted = `lbz_confirm_deadline_${consultationId}`;
    (async () => {
      let next: number | null = null;
      const fromPayload = consultation.data?.confirmDeadline
        ? new Date(consultation.data.confirmDeadline).getTime()
        : null;
      if (fromPayload) {
        next = fromPayload;
      } else {
        try {
          const stored = await SecureStore.getItemAsync(persisted);
          if (stored) next = Number(stored);
        } catch {
          /* storage unavailable */
        }
        if (!next && active) {
          next = Date.now() + MAX_WAIT_MS;
        }
      }
      if (next && active) {
        setDeadline(next);
        try {
          await SecureStore.setItemAsync(persisted, String(next));
        } catch {
          /* storage unavailable — timers just restart on remount */
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [consultation.data?.confirmDeadline, consultationId]);

  // 2-minute-mark nudge.
  useEffect(() => {
    if (!deadline || status !== "PENDING") return undefined;
    const nudgeAt = deadline - (MAX_WAIT_MS - NUDGE_MS);
    const timer = setTimeout(
      () => setNudgeOpen(true),
      Math.max(0, nudgeAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [deadline, status]);

  // 5-minute expiry: best-effort local cancel; the backend sweep is the
  // authority and both paths show the same expiry screen.
  useEffect(() => {
    if (!deadline || status !== "PENDING") return undefined;
    const timer = setTimeout(
      async () => {
        if (expiredRef.current) return;
        expiredRef.current = true;
        setExpiredByTimer(true);
        setNudgeOpen(false);
        try {
          await cancel(
            consultationId as string,
            "Expert did not confirm the session",
          );
        } catch {
          /* already cancelled or expired server-side */
        }
      },
      Math.max(0, deadline - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [deadline, status, consultationId]);

  /**
   * "Book a new expert" — always cancel the pending request first so
   * nothing is left dangling, then open the expert search (the consult
   * form lives at the app's entry point; results reuse the last brief).
   * Cancelling an already cancelled/expired request is a no-op
   * server-side; errors don't block the navigation.
   */
  const handleCancelAndBookNew = useCallback(async () => {
    setCancelling(true);
    try {
      if (!expiredRef.current) {
        expiredRef.current = true;
        setExpiredByTimer(true);
        await cancel(
          consultationId as string,
          "User booked a different expert",
        );
      }
    } catch {
      /* nothing left to cancel — continue to search either way */
    } finally {
      setCancelling(false);
      // Web opens /consult/book; on mobile the matching brief lives on the
      // home tab, and the results page restores the last description.
      router.replace("/consult/results");
    }
  }, [consultationId, router]);

  // Expert dashboard may confirm while we are here — keep My Bookings warm.
  useEffect(() => {
    if (confirmed) {
      queryClient.invalidateQueries({ queryKey: ["consultations", "mine"] });
    }
  }, [confirmed, queryClient]);

  async function handlePay() {
    if (!consultationId) return;
    setPaying(true);
    try {
      await openPayment("consultation", consultationId);
      // After payment the flow continues on the payment portal; when the
      // user returns, Bookings shows the session with its join control.
      await queryClient.invalidateQueries({ queryKey: ["consultations"] });
      router.replace("/bookings");
    } catch (err) {
      toast.error(
        apiErrorMessage(err, "Could not open payment. Please try again."),
      );
    } finally {
      setPaying(false);
    }
  }

  if (expired) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.background }}
        edges={["top", "bottom"]}
      >
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
          <BackBar onPress={() => router.replace("/bookings")} />
        </View>
        <ExpiredScreen
          expertName={
            expertName || consultation.data?.expert?.fullName || "your expert"
          }
          onBookOther={handleCancelAndBookNew}
          onBookings={() => router.replace("/bookings")}
          cancelling={cancelling}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={["top", "bottom"]}
    >
      <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
        <BackBar onPress={() => router.back()} />
      </View>

      <View style={styles.container}>
        {/* Waiting animation — pulsing rings around the expert avatar */}
        <View style={styles.ringWrap}>
          {[0, 1].map((i) => (
            <MotiView
              key={i}
              from={{ opacity: 0.5, scale: 1 }}
              animate={{ opacity: 0, scale: 1.9 }}
              transition={{
                type: "timing",
                duration: 2200,
                delay: i * 900,
                loop: confirmed ? false : true,
                repeatReverse: false,
              }}
              style={[styles.ring, { borderColor: theme.primary }]}
            />
          ))}
          <Avatar
            uri={
              expertAvatar ||
              (typeof consultation.data?.expert?.avatar === "string"
                ? consultation.data?.expert?.avatar
                : consultation.data?.expert?.avatar?.url) ||
              undefined
            }
            name={expertName || consultation.data?.expert?.fullName || "Expert"}
            size={84}
          />
        </View>

        {confirmed ? (
          <>
            <View
              style={[
                styles.confirmedBadge,
                { backgroundColor: `${theme.success}1a` },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={theme.success}
              />
              <Text style={[styles.confirmedText, { color: theme.success }]}>
                Session confirmed
              </Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              You&apos;re almost there
            </Text>
            <Text style={[styles.body, { color: theme.textMuted }]}>
              {expertName || "Your expert"} has confirmed your session. Complete
              the payment to secure your slot — your session room opens as soon
              as the payment goes through.
            </Text>

            <Pressable
              onPress={handlePay}
              disabled={paying}
              style={({ pressed }) => [
                styles.payButton,
                {
                  backgroundColor: theme.primary,
                  opacity: paying ? 0.7 : pressed ? 0.92 : 1,
                },
              ]}
            >
              {paying ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <>
                  <Ionicons
                    name="card"
                    size={17}
                    color={theme.primaryForeground}
                  />
                  <Text
                    style={[styles.payText, { color: theme.primaryForeground }]}
                  >
                    Pay now
                  </Text>
                </>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: theme.text }]}>
              Confirming your session
            </Text>

            <Text style={[styles.body, { color: theme.textMuted }]}>
              Your request has been sent to{" "}
              <Text style={{ color: theme.text, fontWeight: "700" }}>
                {expertName || "your expert"}
              </Text>
              . We&apos;ll confirm the moment the expert responds — you can keep
              this screen open, or check back anytime under My Bookings.
            </Text>

            <View style={styles.liveRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.liveText, { color: theme.textMuted }]}>
                Awaiting confirmation…
              </Text>
            </View>
          </>
        )}
      </View>

      {nudgeOpen && !confirmed && (
        <GettingLateModal
          expertName={
            expertName || consultation.data?.expert?.fullName || "your expert"
          }
          onDismiss={() => setNudgeOpen(false)}
          onBookOther={handleCancelAndBookNew}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  stateTitle: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  stateBody: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 340,
  },
  ringWrap: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  ring: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
  },
  confirmedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  confirmedText: { fontSize: 12, fontWeight: "800" },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 14, lineHeight: 22, textAlign: "center", maxWidth: 320 },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  liveText: { fontSize: 12, fontWeight: "600" },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.pill,
    alignSelf: "stretch",
    marginTop: Spacing.lg,
  },
  payText: { fontSize: 15, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    marginTop: "auto",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: "center",
  },
  modalClose: { position: "absolute", top: Spacing.md, right: Spacing.md },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  modalBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 320,
  },
  modalButton: { alignSelf: "stretch", marginTop: Spacing.md },
});
