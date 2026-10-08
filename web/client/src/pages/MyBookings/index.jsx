import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { Icons } from "../../icons";
import LoadingScreen from "../../components/common/LoadingScreen";
import SignInPrompt from "../../components/common/SignInPrompt";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";

import * as consultApi from "../../api/consultation";
import { openPayment, openConsultation } from "../../utils/handoff";

import BookingCard from "./components/BookingCard";
import RatingDialog from "./components/RatingDialog";

/**
 * The reader's consultations — one card per session with the action that
 * matches its state: join the room (payment happens at its door), rate when
 * completed, cancel while still open.
 */
const PAGE_SIZE = 10; // shown per "Show more" click, mirroring the expert dashboard

export default function MyBookings() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [checkingId, setCheckingId] = useState(null);
  const [ratingTarget, setRatingTarget] = useState(null);

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
   * Join a session — the full journey runs through the dedicated portals.
   *
   * The card list can't know the real paid state (a verified Razorpay
   * payment lives in the Payment collection, not on this row), so the
   * backend is asked first: unpaid → checkout on payment.lifebookz.com,
   * paid / free → straight into the room on session.lifebookz.com. The
   * backend re-authorizes everything at the far end — nothing here is
   * trusted.
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

  const handleRate = async (consultation, score, review) => {
    const id = consultation._id || consultation.id;
    await consultApi.rate(id, score, review);
    await loadConsultations();
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

  // Upcoming (actionable) vs history (finished) — never mixed in one list.
  const upcoming = consultations.filter((c) =>
    ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(c.status),
  );
  const history = consultations.filter((c) =>
    ["COMPLETED", "CANCELLED", "EXPIRED"].includes(c.status),
  );

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
        onJoin={() => handleJoin(consultation)}
        onRate={() => setRatingTarget(consultation)}
      />
    );
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

  return (
    <div className="min-h-screen bg-background px-4 py-10 font-sans text-foreground selection:bg-accent/20 md:py-16">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground sm:text-sm">
            Your Sessions
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            My Bookings
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
            Track your consultation requests — once the expert confirms,
            complete the payment, join the session, and rate it afterwards.
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
            icon={Icons.book}
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
              <section className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Upcoming sessions
                  </h2>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                    {upcoming.length}
                  </span>
                </div>
                {upcoming.map(renderCard)}
              </section>
            )}

            {history.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    History
                  </h2>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                    {history.length}
                  </span>
                </div>
                {history.map(renderCard)}
              </section>
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

      {ratingTarget && (
        <RatingDialog
          consultation={ratingTarget}
          onClose={() => setRatingTarget(null)}
          onSubmit={handleRate}
        />
      )}
    </div>
  );
}
