import { Link } from "react-router-dom";
import { Icons } from "../../../icons";
import { getCategoryLabel } from "../../../data/experts";
import { CANCELLABLE, initials, formatDate, formatDuration } from "../utils";

/**
 * One consultation — the same card the mobile app renders: status badge and
 * booked date on top, expert name and category, a snippet of the problem,
 * then the actions that match the state (join the room — payment happens at
 * its door — rate, or cancel). Responsive: stacks vertically on small
 * screens, keeps the action row on one line from sm up.
 */

/** How each status is labelled and coloured — same tones as mobile's badge. */
const STATUS_STYLES = {
  PENDING: "bg-primary/10 text-primary border-primary/20",
  CONFIRMED: "bg-primary/10 text-primary border-primary/20",
  IN_PROGRESS: "bg-primary/10 text-primary border-primary/20",
  COMPLETED: "bg-success/10 text-success border-success/20",
  CANCELLED: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  EXPIRED: "bg-muted text-muted-foreground border-border",
};

function statusLabel(status) {
  return (status || "PENDING").replace("_", " ");
}

export default function BookingCard({
  consultation,
  confirming,
  cancelling,
  joining,
  onConfirm,
  onDismissConfirm,
  onCancel,
  onWait,
  onPay,
  onJoin,
  onRate,
}) {
  const expert = consultation.expert;
  const id = consultation._id || consultation.id;
  const status = consultation.status || "PENDING";
  const canWait = status === "PENDING"; // expert hasn't confirmed yet
  // CONFIRMED + unpaid → pay; CONFIRMED + paid (or amount 0) → the room
  // is open. The backend computes `paid` from the Payment collection on
  // every list/detail response, so a completed checkout flips the card on
  // the next fetch (and instantly via the WS payment push).
  const canPay =
    status === "CONFIRMED" && consultation.paid === false;
  const canJoin =
    status === "IN_PROGRESS" ||
    (status === "CONFIRMED" && consultation.paid !== false);
  const canRate = status === "COMPLETED" && !consultation.rating?.score;
  const canCancel = CANCELLABLE.includes(status);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-xs sm:p-6">
      {/* Top row: status badge + booked date */}
      <div className="flex items-center justify-between gap-3">
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${STATUS_STYLES[status] || STATUS_STYLES.EXPIRED}`}
        >
          {statusLabel(status)}
        </span>
        {consultation.createdAt && (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatDate(consultation.createdAt)}
          </span>
        )}
      </div>

      {/* Expert + category */}
      <div className="mt-4 flex min-w-0 items-center gap-3">
        {expert?.avatar?.url ? (
          <img
            src={expert.avatar.url}
            alt={expert.fullName}
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-border/70"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-extrabold text-primary-foreground ring-4 ring-primary/10">
            {initials(expert?.fullName || "Expert")}
          </div>
        )}

        <div className="min-w-0">
          <Link
            to={expert ? `/consult/book/${expert._id || expert.id}` : "/consult"}
            className="block truncate font-display text-base font-bold text-foreground hover:text-accent"
          >
            {expert?.fullName || "Expert"}
          </Link>
          {consultation.category && (
            <p className="truncate text-xs text-muted-foreground">
              {getCategoryLabel(consultation.category)}
            </p>
          )}
        </div>
      </div>

      {/* The problem, two lines like the mobile card */}
      {consultation.problem && (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {consultation.problem}
        </p>
      )}

      {/* Metadata strip */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        {typeof consultation.amount === "number" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1">
            <Icons.money className="h-3 w-3" />
            ₹{(consultation.amount / 100).toFixed(0)}
          </span>
        )}
        {consultation.session?.durationSeconds > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1">
            <Icons.videoCamera className="h-3 w-3" />
            {formatDuration(consultation.session.durationSeconds)}
          </span>
        )}
      </div>

      {/* The rating the user left */}
      {consultation.rating?.score && (
        <div className="mt-3 flex items-center gap-2">
          <span className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Icons.starSolid
                key={n}
                className={`h-3.5 w-3.5 ${n <= consultation.rating.score ? "text-amber-500" : "text-border"}`}
              />
            ))}
          </span>
          {consultation.rating.review && (
            <span className="truncate text-xs text-muted-foreground">
              &ldquo;{consultation.rating.review}&rdquo;
            </span>
          )}
        </div>
      )}

      {/* Actions — the ones that match the state: PENDING → waiting page,
          CONFIRMED → pay, IN_PROGRESS → join the room. */}
      {(canWait || canPay || canJoin || canRate || canCancel) && (
        <div className="mt-4 space-y-2.5 border-t border-border/60 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {canWait && !confirming && (
              <button
                type="button"
                onClick={onWait}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/5 px-5 py-2.5 text-xs font-bold text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-400 sm:flex-none"
              >
                <Icons.clock className="h-3.5 w-3.5" />
                Check status
              </button>
            )}

            {canPay && !confirming && (
              <button
                type="button"
                onClick={onPay}
                disabled={joining}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:flex-none"
              >
                {joining ? (
                  <Icons.spinner className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icons.money className="h-3.5 w-3.5" />
                )}
                {joining ? "Opening payment…" : "Pay now"}
              </button>
            )}

            {canJoin && !confirming && (
              <button
                type="button"
                onClick={onJoin}
                disabled={joining}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:flex-none"
              >
                {joining ? (
                  <Icons.spinner className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icons.videoCamera className="h-3.5 w-3.5" />
                )}
                {joining ? "Checking…" : "Rejoin session"}
              </button>
            )}

            {canRate && (
              <button
                type="button"
                onClick={onRate}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-amber-500/40 px-5 py-2.5 text-xs font-bold text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-400 sm:flex-none"
              >
                <Icons.starSolid className="h-3.5 w-3.5" />
                Rate session
              </button>
            )}
          </div>

          {canCancel && (
            <div>
              {confirming ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto text-xs font-medium text-muted-foreground">
                    Cancel this session?
                  </span>
                  <button
                    type="button"
                    onClick={onDismissConfirm}
                    disabled={cancelling}
                    className="rounded-full border border-border px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    Keep session
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancel(id)}
                    disabled={cancelling}
                    className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    <Icons.close className="h-3.5 w-3.5" />
                    {cancelling ? "Cancelling…" : "Yes, cancel"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onConfirm}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Icons.close className="h-3.5 w-3.5" />
                  Cancel session
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
