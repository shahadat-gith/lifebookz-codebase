/**
 * Waiting for expert confirmation — shown right after a booking request is
 * sent. Live update arrives over the AWS API Gateway WebSocket
 * (consultation.confirmed); a lightweight polling fallback covers WS outage.
 * On confirm → Pay button → payment portal (same handoff as the web client).
 */
import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";

import api from "../../src/config/api";
import { Radius, Spacing, useTheme } from "../../src/theme";
import { BackBar, Avatar } from "../../src/components/ui";
import { useToast } from "../../src/components/Toast";
import { useConsultationEvents } from "../../src/api/realtime";
import { openPayment } from "../../src/utils/handoff";
import { apiErrorMessage } from "../../src/utils/helpers";
import type { Consultation } from "../../src/types";

const POLL_INTERVAL_MS = 30_000; // WS-fallback net: checks status every 30s
const MAX_WAIT_MS = 15 * 60_000; // expert requests auto-expire upstream

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

  const { status: socketStatus, lastEvent } = useConsultationEvents(consultationId);

  const status = consultation.data?.status || "PENDING";
  const confirmed = status === "CONFIRMED";
  const cancelled = ["CANCELLED", "EXPIRED"].includes(status);

  // WS event → invalidate the record → react-query refetches → status flips.
  // This is the industry-standard pattern: socket as signal, API as truth.
  useEffect(() => {
    if (!lastEvent) return;
    queryClient.invalidateQueries({
      queryKey: ["consultations", "detail", consultationId],
    });
  }, [lastEvent, queryClient, consultationId]);

  // Expert dashboard may confirm while we are here — keep My Bookings warm.
  useEffect(() => {
    if (confirmed) {
      queryClient.invalidateQueries({ queryKey: ["consultations", "mine"] });
    }
  }, [confirmed, queryClient]);

  useEffect(() => {
    if (!cancelled) return;
    toast.error("This request was cancelled or expired.");
    router.replace("/bookings");
  }, [cancelled, router, toast]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (!confirmed) router.replace("/bookings");
    }, MAX_WAIT_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [confirmed, router]);

  const minutesLeft = useRef(MAX_WAIT_MS);
  useEffect(() => {
    minutesLeft.current = MAX_WAIT_MS;
  }, [consultationId]);

  async function handlePay() {
    if (!consultationId) return;
    setPaying(true);
    try {
      await openPayment("consultation", consultationId);
      // After payment the flow continues on the payment portal; when the user
      // returns, Bookings shows the session with its join control.
      await queryClient.invalidateQueries({ queryKey: ["consultations"] });
      router.replace("/bookings");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not open payment. Please try again."));
    } finally {
      setPaying(false);
    }
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
          <Avatar uri={expertAvatar || undefined} name={expertName || "Expert"} size={84} />
        </View>

        {confirmed ? (
          <>
            <View style={[styles.confirmedBadge, { backgroundColor: `${theme.success}1a` }]}>
              <Ionicons name="checkmark-circle" size={16} color={theme.success} />
              <Text style={[styles.confirmedText, { color: theme.success }]}>
                Expert confirmed your session
              </Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              You&apos;re almost there
            </Text>
            <Text style={[styles.body, { color: theme.textMuted }]}>
              Complete the payment to lock in your session with{" "}
              <Text style={{ color: theme.text, fontWeight: "700" }}>
                {expertName || "your expert"}
              </Text>
              . The room link unlocks right after.
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
                  <Ionicons name="card" size={17} color={theme.primaryForeground} />
                  <Text style={[styles.payText, { color: theme.primaryForeground }]}>
                    Pay now
                  </Text>
                </>
              )}
            </Pressable>
          </>
        ) : cancelled ? null : (
          <>
            <Text style={[styles.title, { color: theme.text }]}>
              Waiting for expert response
            </Text>
           

            <View style={styles.liveRow}>
              
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          </>
        )}
      </View>
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
  liveDot: { width: 8, height: 8, borderRadius: 4 },
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
});
