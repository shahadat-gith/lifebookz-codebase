import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { Icons } from "../../icons";
import { getCategoryLabel } from "../../data/experts";
import SignInPrompt from "../../components/common/SignInPrompt";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import LoadingScreen from "../../components/common/LoadingScreen";

import * as consultApi from "../../api/consultation";
import { eventConsultationId, getSharedSocket } from "../../api/realtime";
import { openPayment, openConsultation } from "../../utils/handoff";

import BookingCard from "./components/BookingCard";

/**
 * The reader's consultations — same structure as the mobile app's bookings
 * screen: an "Upcoming sessions (n)" and a "History (n)" section, one card
 * per session with the action that matches its state (join, rate, cancel),
 * live WebSocket updates, and a "Show more" pager.
 */
const PAGE_SIZE = 10; // shown per "Show more" click, mirroring the expert dashboard

/** Statuses that still benefit from live WebSocket updates. */
const UPCOMING = ["PENDING", "CONFIRMED", "IN_PROGRESS"];
const HISTORY = ["COMPLETED", "CANCELLED", "EXPIRED"];

/** Section title + count badge, exactly as the mobile app renders it. */
function Section({ title, count, muted, children }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <h2
          className={`text-[15px] font-extrabold uppercase tracking-[0.03em] ${
            muted ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {title}
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
            muted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
          }`}
        >
          {count}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function MyBookings() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [checkingId, setCheckingId] = useState(null);

  // --- Limited fetching: 10 now, "Show more" appends the next 10 ----------
  const [page, setPage] = useState(1);
  const [lastPageCount, setLastPageCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allFetched, setAllFetched] = useState(false);

  const loadConsultations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await consultApi.listMine({ limit: PAGE_SIZE, page: 1 });
      setConsultations(data || []);
      setLastPageCount((data || []).length);
      setPage(1);
      setAllFetched(false);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "We couldn't load your sessions. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    loadConsultations();
  }, [authLoading, isAuthenticated, loadConsultations]);

  /**
   * "Show more" — deduped append of the next page. A page-param-less
   * backend can return overlapping pages; dedupe by id guards against
   * duplicate cards. A short page (less than PAGE_SIZE) means we're done.
   */
  const loadMore = useCallback(async () => {
    if (allFetched || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await consultApi.listMine({ limit: PAGE_SIZE, page: page + 1 });
      const known = new Set(consultations.map((c) => c._id || c.id));
      const fresh = (next || []).filter((c) => !known.has(c._id || c.id));
      setLastPageCount((next || []).length);
      setPage((p) => p + 1);
      if (fresh.length > 0) {
        setConsultations((prev) => [...prev, ...fresh]);
      }
      if ((next || []).length < PAGE_SIZE || fresh.length === 0) {
        setAllFetched(true);
      }
    } catch {
      toast.error("Could not load more sessions.");
    } finally {
      setLoadingMore(false);
    }
  }, [allFetched, loadingMore, page, consultations]);

  /**
   * Live session updates — the same WebSocket the waiting screen uses.
   * The socket is a signal, the API is the truth: frames update the cards
   * in place, and `consultation.completed` (session ended) lands the user
   * straight on the rating page, mirroring the mobile app's bookings
   * listener. Falls back gracefully when VITE_WS_URL isn't set.
   */
  const refreshSilently = useCallback(async () => {
    try {
      const next = await consultApi.listMine({ limit: PAGE_SIZE, page: 1 });
      setConsultations((prev) => {
        const byId = new Map(prev.map((c) => [c._id || c.id, c]));
        (next || []).forEach((c) =>
          byId.set(c._id || c.id, { ...byId.get(c._id || c.id), ...c }),
        );
        return Array.from(byId.values());
      });
    } catch {
      /* the next poll or manual refresh will catch up */
    }
  }, []);

  const upcoming = useMemo(
    () => consultations.filter((c) => UPCOMING.includes(c.status)),
    [consultations],
  );
  const history = useMemo(
    () => consultations.filter((c) => HISTORY.includes(c.status)),
    [consultations],
  );

  const consultationKey = useMemo(
    () => upcoming.map((c) => c._id || c.id).join(","),
    [upcoming],
  );

  useEffect(() => {
    if (!isAuthenticated || !consultationKey) return undefined;
    const socket = getSharedSocket();
    if (!socket) return undefined;
    socket.connect();

    const ids = consultationKey.split(",").filter(Boolean);
    ids.forEach((id) => socket.subscribe(id));

    const off = socket.on((event) => {
      const cid = eventConsultationId(event);
      if (!cid || !ids.includes(cid)) return;

      const status = event.consultation?.status;
      const paid = event.consultation?.paid;
      if (status || paid !== undefined) {
        setConsultations((prev) =>
          prev.map((c) =>
            (c._id || c.id) === cid
              ? {
                  ...c,
                  ...(status ? { status } : {}),
                  ...(paid !== undefined ? { paid } : {}),
                }
              : c,
          ),
        );
      } else {
        refreshSilently();
      }

      if (status === "COMPLETED" || event.event === "consultation.completed") {
        toast.success("Session ended — rate your expert!");
        navigate(`/consult/rate/${cid}`);
      }
    });

    return () => {
      ids.forEach((id) => socket.unsubscribe(id));
      off();
    };
    // consultationKey keeps this from re-running on every render — it only
    // changes when the actual set of upcoming consultations changes.
  }, [isAuthenticated, consultationKey, refreshSilently, navigate]);

  /**
   * Join a session — the full journey runs through the dedicated portals.
   *
   * The card list can't know the real paid state (a verified Razorpay
   * payment lives in the Payment collection, not on this row), so the
   * backend is asked first: unpaid → checkout on payment.lifebookz.com,
   * paid / free → straight into the room on session.lifebookz.com. The
   * backend re-authorizes everything at the far end — nothing here is
   * trusted.
   *
   * Same fallback as the mobile app: after the room tab opens, re-check the
   * record — if the meeting ended while it was open, go straight to rating.
   */
  const handleJoin = async (consultation) => {
    const id = consultation._id || consultation.id;
    setCheckingId(id);

    try {
      const session = await consultApi.getSession(id);

      if (session.paymentRequired) {
        await openPayment("consultation", id);
      } else {
        await openConsultation(id);
        try {
          const fresh = await consultApi.getConsultation(id);
          if ((fresh?.status || "") === "COMPLETED") {
            await refreshSilently();
            if (!fresh.rating?.score) {
              navigate(`/consult/rate/${id}`);
            }
          }
        } catch {
          /* the list already refetched — nothing more to do */
        }
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error?.message ||
          err.message ||
          "Could not open this session. Please try again.",
      );
    } finally {
      setCheckingId(null);
    }
  };

  /**
   * PENDING card → back to the live waiting screen. There the 2-min
   * nudge / 5-min auto-cancel flow keeps running as if the user never
   * left; the WS event flips it to Pay when the expert confirms.
   */
  const handleWait = (consultation) => {
    const id = consultation._id || consultation.id;
    navigate(`/consult/waiting/${id}`, {
      state: {
        expertName: consultation.expert?.fullName || "your expert",
        expertAvatar: consultation.expert?.avatar?.url,
      },
    });
  };

  /**
   * CONFIRMED card → straight to checkout. The backend re-checks payment
   * state at the payment portal, so no pre-flight getSession round-trip is
   * needed here — a stale CONFIRMED row can only mean "unpaid".
   */
  const handlePay = async (consultation) => {
    const id = consultation._id || consultation.id;
    setCheckingId(id);
    try {
      await openPayment("consultation", id);
      await refreshSilently();
    } catch (err) {
      toast.error(
        err.response?.data?.error?.message ||
          err.message ||
          "Could not open payment. Please try again.",
      );
    } finally {
      setCheckingId(null);
    }
  };

  const handleCancel = async (consultationId) => {
    setCancellingId(consultationId);

    try {
      await consultApi.cancel(consultationId);
      setConsultations((prev) =>
        prev.map((c) =>
          (c._id || c.id) === consultationId ? { ...c, status: "CANCELLED" } : c,
        ),
      );
      toast.success("Session cancelled.");
    } catch (err) {
      toast.error(
        err.response?.data?.error?.message ||
          "We couldn't cancel this session. Please try again.",
      );
    } finally {
      setCancellingId(null);
      setConfirmingId(null);
    }
  };

  if (authLoading || (isAuthenticated && loading)) {
    return <LoadingScreen message="Loading your sessions…" />;
  }

  if (!isAuthenticated) {
    return (
      <SignInPrompt
        title="Sign in to see your sessions"
        description="Your consultation sessions are tied to your account. Log in to view and manage them."
      />
    );
  }

  const renderCard = (consultation) => {
    const id = consultation._id || consultation.id;

    return (
      <BookingCard
        key={id}
        consultation={consultation}
        confirming={confirmingId === id}
        cancelling={cancellingId === id}
        joining={checkingId === id}
        onConfirm={() => setConfirmingId(id)}
        onDismissConfirm={() => setConfirmingId(null)}
        onCancel={() => handleCancel(id)}
        onWait={() => handleWait(consultation)}
        onPay={() => handlePay(consultation)}
        onJoin={() => handleJoin(consultation)}
        onRate={() => navigate(`/consult/rate/${id}`)}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 font-sans text-foreground selection:bg-accent/20 md:py-16">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            My bookings
          </h1>
          <p className="text-sm text-muted-foreground">
            Your all bookings appear here.
          </p>
        </header>

        {error ? (
          <ErrorState
            title="Sessions didn't load"
            message={error}
            onRetry={loadConsultations}
          />
        ) : consultations.length === 0 ? (
          <EmptyState
            variant="panel"
            icon={Icons.calendar}
            title="No sessions yet"
            description="Find an expert who understands your situation and request your first session."
            action={{
              label: "Find an Expert",
              to: "/consult/book",
              icon: <Icons.search className="h-4 w-4" />,
            }}
          />
        ) : (
          <div className="space-y-10">
            {upcoming.length > 0 && (
              <Section title="Upcoming sessions" count={upcoming.length}>
                {upcoming.map(renderCard)}
              </Section>
            )}

            {history.length > 0 && (
              <Section title="History" count={history.length} muted>
                {history.map(renderCard)}
              </Section>
            )}
          </div>
        )}

        {consultations.length > 0 && !allFetched && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold text-foreground shadow-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Show more"}
            </button>
          </div>
        )}

        {consultations.length > 0 && (
          <div className="pt-2 text-center">
            <Link
              to="/consult/book"
              className="inline-flex items-center gap-2 text-sm font-bold text-accent hover:underline"
            >
              <Icons.plus className="h-4 w-4" />
              Request another session
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
