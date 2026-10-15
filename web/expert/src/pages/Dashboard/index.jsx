import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import useRealtimeConsultations from "../../hooks/useRealtimeConsultations";
import { CONSULT_CATEGORIES } from "../../config";
import * as consultApi from "../../api/consultation";
import { formatDate } from "../../utils/helpers";
import { openConsultation } from "../../utils/handoff";

import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/common/EmptyState";
import LoadingScreen from "../../components/common/LoadingScreen";

import { Icons } from "../../icons";

const STATUS_BADGE = {
  PENDING: { variant: "warning", label: "New request" },
  CONFIRMED: { variant: "info", label: "Confirmed — waiting for client" },
  IN_PROGRESS: { variant: "success", label: "In session" },
  COMPLETED: { variant: "default", label: "Completed" },
  CANCELLED: { variant: "danger", label: "Cancelled" },
  EXPIRED: { variant: "danger", label: "Expired" },
};

const FILTERS = [
  { id: "all", label: "All", statuses: null },
  { id: "new", label: "New", statuses: ["PENDING"] },
  { id: "upcoming", label: "Upcoming", statuses: ["CONFIRMED", "IN_PROGRESS"] },
  { id: "completed", label: "Completed", statuses: ["COMPLETED"] },
  { id: "closed", label: "Closed", statuses: ["CANCELLED", "EXPIRED"] },
];

const POLL_INTERVAL_MS = 30_000; // visible-tab fallback when the socket misses a frame

function categoryLabel(id) {
  if (!id) return "—";
  return CONSULT_CATEGORIES.find((c) => c.id === id)?.label || id;
}

function initials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { expert, isLoading: authLoading, setAvailability: persistAvailability } = useAuth();

  /**
   * Whether the signed-in account actually IS an expert. Accounts logged in
   * to apply (role user/author) must not hit the expert-only endpoints —
   * consultations list, realtime socket, availability — until they upgrade.
   * Upgraded multi-role accounts carry "expert" inside `roles`.
   */
  const isExpert = Boolean(
    expert &&
      (expert.role === "expert" ||
        (Array.isArray(expert.roles) && expert.roles.includes("expert"))),
  );

  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [filter, setFilter] = useState("all");
  const [newRequestPulse, setNewRequestPulse] = useState(false);
  // Shown once when an account from another portal (role user/author) opens
  // the expert workspace — invite them to apply, dismissible.
  const [upgradeModalDismissed, setUpgradeModalDismissed] = useState(false);

  // --- Limited fetching: latest PAGE_SIZE records, "Show more" appends 10
  const PAGE_SIZE = 10;
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [lastPageCount, setLastPageCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allFetched, setAllFetched] = useState(false);

  const loadConsultations = useCallback(async () => {
    try {
      const data = await consultApi.listMine({ limit: PAGE_SIZE, page: 1 });
      setConsultations(data || []);
      setLastPageCount((data || []).length);
      setShownCount(PAGE_SIZE);
      setPage(1);
      setAllFetched(false);
    } catch {
      toast.error("Could not load your consultations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !expert) navigate("/login", { replace: true });
  }, [expert, authLoading, navigate]);

  useEffect(() => {
    // Expert-only data — an applicant's dashboard shows nothing to load.
    if (!expert || !isExpert) {
      setLoading(false);
      return;
    }
    loadConsultations();
  }, [expert, isExpert, loadConsultations]);

  // --- Realtime (AWS API Gateway WebSocket) -------------------------------
  // One shared socket per dashboard session. Any consultation event for this
  // expert refetches the list in place — no refresh needed.
  const expertId = expert?._id || expert?.id;
  const loadingRef = useRef(false);

  const refreshFromEvent = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      await loadConsultations();
    } finally {
      loadingRef.current = false;
    }
  }, [loadConsultations]);

  const { status: wsStatus, subscribe } = useRealtimeConsultations((event) => {
    // Tolerant matching: whatever frame shape the backend pushes, treat any
    // non-ping message as "something changed" and refetch.
    if (!event || event.event === "ping" || event.payload?.event === "ping") return;
    if (
      event.event === "consultation.new" ||
      event.type === "consultation.new"
    ) {
      toast.success("New session request received");
      setNewRequestPulse(true);
      setTimeout(() => setNewRequestPulse(false), 6000);
    }
    refreshFromEvent();
  }, isExpert ? expertId : null);

  // After every successful list load, make sure the socket is subscribed to
  // each visible consultation id — the same routing path the client's
  // waiting screen uses (which demonstrably works), covering status-change
  // frames even if the backend's expertId routing isn't wired up yet.
  const lastSubscribedRef = useRef("");
  useEffect(() => {
    if (loading || !isExpert) return;
    const signature = consultations.map((c) => c._id || c.id).join(",");
    if (signature === lastSubscribedRef.current) return;
    lastSubscribedRef.current = signature;
    consultations.forEach((c) => subscribe(c._id || c.id));
  }, [consultations, loading, isExpert, subscribe]);

  // Safety net: refetch every 30s while the tab is visible, so the list
  // stays correct even if the socket drops or the backend skips a frame.
  useEffect(() => {
    if (!expertId || !isExpert) return undefined;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refreshFromEvent();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [expertId, isExpert, refreshFromEvent]);

  /**
   * "Show more" — reveal 10 more of what we already fetched; when that runs
   * out and the last page came back full, fetch the next page and append.
   * Deduped by id, so a page-param-less backend can't create duplicates.
   */
  const loadMore = useCallback(async () => {
    if (shownCount < consultations.length) {
      setShownCount((n) => n + PAGE_SIZE);
      return;
    }
    if (allFetched || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await consultApi.listMine({
        limit: PAGE_SIZE,
        page: page + 1,
      });
      const known = new Set(consultations.map((c) => c._id || c.id));
      const fresh = (next || []).filter((c) => !known.has(c._id || c.id));
      setLastPageCount((next || []).length);
      setPage((p) => p + 1);
      if (fresh.length > 0) {
        setConsultations((prev) => [...prev, ...fresh]);
        setShownCount((n) => n + fresh.length);
      } else {
        setAllFetched(true);
      }
      if ((next || []).length < PAGE_SIZE) setAllFetched(true);
    } catch {
      toast.error("Could not load more sessions.");
    } finally {
      setLoadingMore(false);
    }
  }, [consultations, shownCount, allFetched, loadingMore, page]);

  const stats = useMemo(() => {
    const count = (...statuses) =>
      consultations.filter((c) => statuses.includes(c.status)).length;
    return {
      total: consultations.length,
      pending: count("PENDING"),
      upcoming: count("CONFIRMED", "IN_PROGRESS"),
      completed: count("COMPLETED"),
    };
  }, [consultations]);

  const filterCounts = useMemo(() => {
    const counts = {};
    FILTERS.forEach((f) => {
      counts[f.id] = f.statuses
        ? consultations.filter((c) => f.statuses.includes(c.status)).length
        : consultations.length;
    });
    return counts;
  }, [consultations]);

  const visible = useMemo(() => {
    const active = FILTERS.find((f) => f.id === filter);
    const filtered = active?.statuses
      ? consultations.filter((c) => active.statuses.includes(c.status))
      : consultations;
    return filtered.slice(0, shownCount);
  }, [consultations, filter, shownCount]);

  const hasMore =
    shownCount < consultations.length ||
    (!allFetched && lastPageCount >= PAGE_SIZE);

  const isApproved = expert?.verification?.status === "approved";
  const isRejected = expert?.verification?.status === "rejected";
  const isAvailable = expert?.isAvailable !== false;

  /** Master switch: appear in search results / take new requests or not. */
  const toggleAvailability = async () => {
    if (togglingAvailability) return;
    setTogglingAvailability(true);
    try {
      await persistAvailability(!isAvailable);
      toast.success(
        isAvailable
          ? "You are now unavailable — new requests won't reach you."
          : "You are available again — clients can find you.",
      );
    } catch (err) {
      toast.error(
        err.response?.data?.error?.message || "Could not update availability.",
      );
    } finally {
      setTogglingAvailability(false);
    }
  };

  /**
   * Join the live session room. The room lives on session.lifebookz.com;
   * this mints a one-time handoff ticket and opens it there. Any failure
   * (portal not configured, expired session) surfaces as a toast instead
   * of a dead button.
   */
  const handleJoin = async (id) => {
    try {
      await openConsultation(id);
    } catch (err) {
      toast.error(
        err.response?.data?.error?.message ||
          err.message ||
          "Could not open the session room. Please try again.",
      );
    }
  };

  const run = (id, fn) => async () => {
    setBusyId(id);
    try {
      await fn();
      await loadConsultations();
    } catch (err) {
      toast.error(
        err.response?.data?.error?.message || "That didn't work. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Confirming a request hands the expert straight to the live waiting
   * room, which walks them through "client is paying → client joined —
   * join now" instead of dropping them back on the list.
   */
  const handleAccept = (id) =>
    run(id, async () => {
      await consultApi.accept(id);
      navigate(`/session-wait/${id}`);
    });

  if (authLoading || loading) {
    return <LoadingScreen message="Loading your expert workspace..." />;
  }

  if (!expert) return null;

  const isApplyingExpert = !isExpert;

  const stat = [
    { label: "Total requests", value: stats.total },
    { label: "Awaiting your reply", value: stats.pending, highlight: stats.pending > 0 },
    { label: "Live or upcoming", value: stats.upcoming },
    { label: "Completed", value: stats.completed },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:py-10">
      {/* Invite to become an expert — any account can open this portal */}
      {isApplyingExpert && !upgradeModalDismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icons.category className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-foreground">
              Do you want to take consultancy sessions?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your signed-in account isn't an expert yet. Complete your expert
              profile to start appearing in client searches and receive live
              session requests.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => setUpgradeModalDismissed(true)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Not now
              </button>
              <Button onClick={() => navigate("/profile/edit")}>
                Complete my expert profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header: title + single Availability control */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Session requests
          </h1>
         
        </div>

        {/* Availability — the one master control for new requests */}
        {!isApplyingExpert && (
        <button
          type="button"
          aria-pressed={isAvailable}
          aria-label="Toggle availability"
          disabled={togglingAvailability}
          onClick={toggleAvailability}
          className={`inline-flex shrink-0 items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-semibold shadow-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 ${
            isAvailable
              ? "border-success/30 bg-success/10 text-success hover:bg-success/15"
              : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          <span
            className={`size-2 rounded-full ${
              isAvailable ? "bg-success" : "bg-zinc-400"
            }`}
            aria-hidden="true"
          />
          {togglingAvailability
            ? "Updating…"
            : isAvailable
              ? "Available — accepting new sessions"
              : "Unavailable — tap to accept sessions"}
        </button>
        )}
      </div>

      {/* Verification notice — shown until approved; applicants get a CTA */}
      {isApplyingExpert ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Icons.infoCircle className="mt-0.5 size-4 shrink-0" />
            <div className="text-[13px] leading-relaxed">
              <span className="font-semibold">You're browsing as a “Expert” account.</span> Build your
              expert profile to unlock session requests.
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate("/profile/edit")}>
            Complete expert profile
          </Button>
        </div>
      ) : !isApproved && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            isRejected
              ? "border-destructive/20 bg-destructive/5 text-destructive"
              : "border-warning/20 bg-warning/5 text-warning"
          }`}
        >
          <Icons.infoCircle className="mt-0.5 size-4 shrink-0" />
          <div className="text-[13px] leading-relaxed">
            {isRejected ? (
              <>
                <span className="font-semibold">Your application was rejected.</span>
                {expert.verification?.rejectionReason && (
                  <span> Reason: {expert.verification.rejectionReason}</span>
                )}
              </>
            ) : (
              <>
                <span className="font-semibold">Your application is under review.</span>{" "}
                Once approved, your profile is matched with people who need your
                expertise and requests will appear here.
              </>
            )}
          </div>
        </div>
      )}

      {/* Stats strip: one panel, four cells */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border shadow-xs lg:grid-cols-4">
        {stat.map((item) => (
          <div key={item.label} className="bg-card px-5 py-4">
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              {item.highlight && (
                <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
              )}
              {item.label}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Realtime connection state — the socket feeds this page its updates */}
      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <span
          className={`size-1.5 rounded-full ${
            wsStatus === "open"
              ? "bg-emerald-500"
              : wsStatus === "connecting" || wsStatus === "idle"
                ? "bg-amber-400 animate-pulse"
                : "bg-zinc-400"
          }`}
          aria-hidden="true"
        />
        {wsStatus === "open"
          ? "Live — Accepting requests"
          : wsStatus === "connecting" || wsStatus === "idle"
            ? "Connecting for live updates…"
            : "Live updates reconnecting — list may lag a moment"}
        {newRequestPulse && (
          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            new request just came in
          </span>
        )}
      </p>

      {/* Consultations */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-5 pt-4 sm:px-6">
          <div className="flex items-center gap-1 overflow-x-auto" role="tablist">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.id)}
                  className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-3 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                  <span
                    className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {filterCounts[f.id]}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={loadConsultations}
            className="mb-3 inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Icons.refresh className="size-3.5" /> Refresh
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState
              icon={<Icons.videoCamera className="h-10 w-10 text-muted-foreground" />}
              title={filter === "all" ? "No requests yet" : "Nothing here"}
              description={
                filter !== "all"
                  ? "No consultations match this filter."
                  : isApproved
                    ? "When someone requests a session with you, it will show up here."
                    : "Requests will appear here once your account is approved."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((consultation) => {
              const id = consultation._id || consultation.id;
              const badge = STATUS_BADGE[consultation.status] || {
                variant: "default",
                label: consultation.status,
              };
              const clientName = consultation.user?.fullName || "Client";
              const busy = busyId === id;
              const isNew = consultation.status === "PENDING";

              return (
                <li
                  key={id}
                  className={`relative px-5 py-4 transition-colors hover:bg-muted/40 sm:px-6 ${
                    isNew ? "bg-accent/[0.03]" : ""
                  }`}
                >
                  {isNew && (
                    <span
                      className="absolute inset-y-0 left-0 w-0.5 bg-accent"
                      aria-hidden="true"
                    />
                  )}

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-1 gap-3.5">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-display text-[13px] font-semibold text-secondary">
                        {initials(clientName)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <h3 className="font-display text-[15px] font-semibold text-foreground">
                            {clientName}
                          </h3>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          {consultation.category && (
                            <Badge variant="default">
                              {categoryLabel(consultation.category)}
                            </Badge>
                          )}
                        </div>

                        <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                          {consultation.problem}
                        </p>

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {consultation.userEmail && (
                            <span className="inline-flex items-center gap-1.5">
                              <Icons.mail className="size-3.5" />
                              {consultation.userEmail}
                            </span>
                          )}
                          {typeof consultation.amount === "number" &&
                            consultation.amount > 0 && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                                <Icons.money className="size-3.5" />
                                ₹{(consultation.amount / 100).toFixed(0)} session fee
                              </span>
                            )}
                          {consultation.status === "CONFIRMED" && (
                            <span className="inline-flex items-center gap-1.5">
                              <Icons.clock className="size-3.5" />
                              Client pays before joining
                            </span>
                          )}
                          {consultation.createdAt && (
                            <span>Requested {formatDate(consultation.createdAt)}</span>
                          )}
                        </div>

                        {consultation.notes && (
                          <p className="mt-2.5 max-w-2xl rounded-md border border-border bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                            {consultation.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pl-[50px] lg:shrink-0 lg:justify-end lg:pl-0">
                      {consultation.status === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            loading={busy}
                            onClick={handleAccept(id)}
                            icon={<Icons.check />}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={run(id, () => consultApi.decline(id))}
                          >
                            Decline
                          </Button>
                        </>
                      )}

                      {["CONFIRMED", "IN_PROGRESS"].includes(consultation.status) && (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleJoin(id)}
                            icon={<Icons.videoCamera />}
                          >
                            {consultation.status === "IN_PROGRESS"
                              ? "Rejoin session"
                              : "Join session"}
                          </Button>
                          {consultation.status === "IN_PROGRESS" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={run(id, () => consultApi.endSession(id))}
                            >
                              Close meeting
                            </Button>
                          )}
                        </>
                      )}

                      {["PENDING", "CONFIRMED"].includes(consultation.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={run(id, () => consultApi.cancel(id))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && visible.length > 0 && (
          <div className="flex justify-center border-t border-border px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold text-foreground shadow-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Show more"}
              {!loadingMore && <Icons.chevronDown className="size-4" />}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}