import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../src/context/AuthContext";
import { ConsultFormSheet } from "../src/components/ConsultFormSheet";
import { BookingListSkeleton } from "../src/components/Skeleton";
import { useToast } from "../src/components/Toast";
import * as consultApi from "../src/api/consultation";
import { getSharedSocket } from "../src/api/realtime";
import { openPayment, openConsultation } from "../src/utils/handoff";
import { apiErrorMessage, formatDate } from "../src/utils/helpers";
import { getCategoryLabel } from "../src/utils/consult";
import { BackBar, Badge, Button, EmptyState, ErrorState, ScreenHeader } from "../src/components/ui";
import { Radius, Spacing, useTheme } from "../src/theme";
import type { Consultation } from "../src/types";

const UPCOMING: string[] = ["PENDING", "CONFIRMED", "IN_PROGRESS"];
const HISTORY: string[] = ["COMPLETED", "CANCELLED", "EXPIRED"];

/** Stable empty list so derived arrays keep their identity between renders. */
const EMPTY_ITEMS: Consultation[] = [];

export default function BookingsScreen() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const toast = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [consultOpen, setConsultOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // --- Limited fetching: 10 now, "Show more" appends the next 10 ----------
  const PAGE_SIZE = 10;
  const bookings = useQuery({
    queryKey: ["consultations", "mine"],
    enabled: isAuthenticated,
    queryFn: () => consultApi.listMine({ limit: PAGE_SIZE, page: 1 }),
  });

  // Appended pages live alongside a snapshot id of the base fetch
  // (dataUpdatedAt). When the base list refetches, the snapshot no longer
  // matches and the derived value resets — no setState-in-effect needed.
  const [more, setMore] = useState<{
    baseUpdatedAt: number;
    items: Consultation[];
    page: number;
    allFetched: boolean;
  } | null>(null);
  const base = useMemo(() => bookings.data || [], [bookings.data]);
  const extrasActive = !!more && more.baseUpdatedAt === (bookings.dataUpdatedAt || 0);
  const moreItems = extrasActive ? (more as { items: Consultation[] }).items : EMPTY_ITEMS;
  const extras = extrasActive ? (more as NonNullable<typeof more>) : {
    baseUpdatedAt: bookings.dataUpdatedAt || 0,
    items: EMPTY_ITEMS,
    page: 1,
    allFetched: base.length < PAGE_SIZE,
  };

  const loadMore = async () => {
    if (extras.allFetched || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await consultApi.listMine({ limit: PAGE_SIZE, page: extras.page + 1 });
      const known = new Set([...base, ...moreItems].map((c) => c._id || c.id));
      const fresh = next.filter((c) => !known.has(c._id || c.id));
      setMore({
        baseUpdatedAt: bookings.dataUpdatedAt || 0,
        items: [...moreItems, ...fresh],
        page: extras.page + 1,
        allFetched: next.length < PAGE_SIZE || fresh.length === 0,
      });
    } catch {
      toast.error("Could not load more sessions.");
    } finally {
      setLoadingMore(false);
    }
  };

  const consultations = useMemo(() => [...base, ...moreItems], [base, moreItems]);
  const consultationKey = useMemo(
    () => consultations.map((c) => c._id || c.id).join(","),
    [consultations],
  );

  const queryClient = useQueryClient();

  // Live session-end events: the backend pushes consultation.completed over
  // the WebSocket when the meeting closes (docs/realtime-websocket-
  // backend.md §4). The app flips to the in-app rating page the moment it
  // lands — no refresh, and the web rating page is never seen. The socket
  // is a signal, the API is the truth: each event just invalidates queries.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const socket = getSharedSocket();
    if (!socket) return undefined;
    socket.connect();

    const upcomingIds = consultations
      .filter((c) => UPCOMING.includes(c.status || ""))
      .map((c) => (c._id || c.id) as string)
      .filter(Boolean);
    upcomingIds.forEach((id) => socket.subscribe(id));

    const off = socket.on((event) => {
      const cid = (event.consultationId ||
        event.consultation?._id ||
        event.consultation?.id) as string | undefined;
      if (!cid) return;
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      const status = event.consultation?.status as string | undefined;
      if (status === "COMPLETED" || event.event === "consultation.completed") {
        toast.success("Session ended — rate your expert!");
        router.push({ pathname: "/consult/rate", params: { consultationId: cid } });
      }
    });
    return () => {
      upcomingIds.forEach((id) => socket.unsubscribe(id));
      off();
    };
    // consultationKey keeps the effect from re-running on every render —
    // it only changes when the actual set of consultations changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, consultationKey, queryClient, router]);
  const upcoming = consultations.filter((c) => UPCOMING.includes(c.status || ""));
  const history = consultations.filter((c) => HISTORY.includes(c.status || ""));

  /**
   * CONFIRMED card → straight to checkout (same shortcut as the web
   * client). The backend re-checks payment state at the payment portal,
   * so a stale CONFIRMED row can only mean "unpaid".
   */
  async function handlePay(consultation: Consultation) {
    const id = (consultation._id || consultation.id) as string;
    setCheckingId(id);
    try {
      await openPayment("consultation", id);
      await bookings.refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not open payment. Please try again."));
    } finally {
      setCheckingId(null);
    }
  }

  async function handleJoin(consultation: Consultation) {
    const id = (consultation._id || consultation.id) as string;
    setCheckingId(id);
    try {
      const session = await consultApi.getSession(id);
      if (session.paymentRequired) {
        await openPayment("consultation", id);
      } else {
        await openConsultation(id);
        // The in-app browser was dismissed — if the meeting ended while it
        // was open, take the user straight to the in-app rating page.
        try {
          const fresh = await consultApi.getConsultation(id);
          await bookings.refetch();
          if ((fresh.status || "") === "COMPLETED" && !fresh.rating) {
            router.push({ pathname: "/consult/rate", params: { consultationId: id } });
          }
        } catch {
          /* the list already refetched — nothing more to do */
        }
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

  // Rating moved to its own screen (/consult/rate) — the same page the
  // session room deep-links back into when a meeting ends in the app.

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
          subtitle="Your all bookings appear here."
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
                  onWait={() =>
                    router.push({
                      pathname: "/consult/waiting",
                      params: {
                        consultationId: (c._id || c.id) as string,
                        expertName: c.expert?.fullName || "Your expert",
                      },
                    })
                  }
                  onPay={() => handlePay(c)}
                  onJoin={() => handleJoin(c)}
                  onCancel={() => handleCancel((c._id || c.id) as string)}
                  onRate={() => router.push({ pathname: "/consult/rate", params: { consultationId: (c._id || c.id) as string } })}
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
                  onWait={() =>
                    router.push({
                      pathname: "/consult/waiting",
                      params: {
                        consultationId: (c._id || c.id) as string,
                        expertName: c.expert?.fullName || "Your expert",
                      },
                    })
                  }
                  onPay={() => handlePay(c)}
                  onJoin={() => handleJoin(c)}
                  onCancel={() => handleCancel((c._id || c.id) as string)}
                  onRate={() => router.push({ pathname: "/consult/rate", params: { consultationId: (c._id || c.id) as string } })}
                />
              ))}
            </Section>
          )}

          {!extras.allFetched && consultations.length > 0 && (
            <Button
              label={loadingMore ? "Loading…" : "Show more"}
              variant="outline"
              onPress={loadMore}
              loading={loadingMore}
              disabled={loadingMore}
              fullWidth
            />
          )}
        </ScrollView>
      )}

      <ConsultFormSheet visible={consultOpen} onClose={() => setConsultOpen(false)} />
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
  onWait,
  onPay,
  onJoin,
  onCancel,
  onRate,
}: {
  consultation: Consultation;
  theme: ReturnType<typeof useTheme>;
  cancelling: boolean;
  joining: boolean;
  onWait: () => void;
  onPay: () => void;
  onJoin: () => void;
  onCancel: () => void;
  onRate: () => void;
}) {
  const status = consultation.status || "PENDING";
  // Status-based primary action, same as the web client:
  // PENDING → waiting screen, CONFIRMED → pay, IN_PROGRESS → join the room.
  const canWait = status === "PENDING";
  // CONFIRMED + unpaid → pay; CONFIRMED + paid (or amount 0) → room open.
  // `paid` comes from the backend (Payment collection) on every fetch and
  // via the WS payment push, so a completed checkout flips instantly.
  const canPay = status === "CONFIRMED" && consultation.paid === false;
  const canJoin =
    status === "IN_PROGRESS" ||
    (status === "CONFIRMED" && consultation.paid !== false);
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
        {canWait && (
          <Button
            label="Check status"
            icon="time"
            variant="outline"
            onPress={onWait}
          />
        )}
        {canPay && (
          <Button
            label={joining ? "Opening payment…" : "Pay now"}
            icon="card"
            onPress={onPay}
            loading={joining}
          />
        )}
        {canJoin && (
          <Button
            label={joining ? "Checking…" : "Rejoin session"}
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
});
