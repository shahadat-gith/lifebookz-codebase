import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
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

  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [filter, setFilter] = useState("all");

  const loadConsultations = useCallback(async () => {
    try {
      const data = await consultApi.listMine();
      setConsultations(data || []);
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
    if (!expert) return;
    loadConsultations();
  }, [expert, loadConsultations]);

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
    return active?.statuses
      ? consultations.filter((c) => active.statuses.includes(c.status))
      : consultations;
  }, [consultations, filter]);

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

  if (authLoading || loading) {
    return <LoadingScreen message="Loading your expert workspace..." />;
  }

  if (!expert) return null;

  const stat = [
    { label: "Total requests", value: stats.total },
    { label: "Awaiting your reply", value: stats.pending, highlight: stats.pending > 0 },
    { label: "Live or upcoming", value: stats.upcoming },
    { label: "Completed", value: stats.completed },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:py-10">
      {/* Profile header */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {expert.avatar?.url ? (
              <img
                src={expert.avatar.url}
                alt={expert.fullName}
                className="size-16 shrink-0 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground">
                {initials(expert.fullName)}
              </div>
            )}

            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {expert.fullName}
              </h1>
              {expert.expertise && (
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {expert.expertise}
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <Badge
                  variant={isApproved ? "success" : isRejected ? "danger" : "warning"}
                >
                  {isApproved
                    ? "Verified expert"
                    : isRejected
                      ? "Application rejected"
                      : "Pending approval"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {expert.ratingCount
                    ? `${expert.rating.toFixed(1)} ★ from ${expert.ratingCount} rating${expert.ratingCount === 1 ? "" : "s"}`
                    : "No ratings yet"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Availability switch */}
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/50 px-3 py-1.5 sm:justify-start">
              <div className="leading-tight">
                <p className="text-[13px] font-medium text-foreground">
                  {isAvailable ? "Accepting requests" : "Not accepting requests"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isAvailable ? "Visible in search" : "Hidden from search"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isAvailable}
                aria-label="Toggle availability"
                disabled={togglingAvailability}
                onClick={toggleAvailability}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 ${
                  isAvailable ? "bg-success" : "bg-input"
                }`}
              >
                <span
                  className={`inline-block size-4 rounded-full bg-white shadow-xs transition-transform duration-150 ${
                    isAvailable ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            <Link to="/profile/edit" className="sm:shrink-0">
              <Button
                variant="outline"
                icon={<Icons.edit />}
                fullWidth
                className="sm:w-auto"
              >
                Edit profile
              </Button>
            </Link>
          </div>
        </div>

        {/* Verification notice, attached to the header */}
        {!isApproved && (
          <div
            className={`flex items-start gap-3 border-t px-5 py-3 text-sm sm:px-6 ${
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
      </Card>

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
                          {typeof consultation.amount === "number" && (
                            <span className="inline-flex items-center gap-1.5">
                              <Icons.money className="size-3.5" />
                              ₹{(consultation.amount / 100).toFixed(0)}, paid when the client joins
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
                            onClick={run(id, () => consultApi.accept(id))}
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
      </Card>
    </div>
  );
}