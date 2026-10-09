/**
 * Rate a completed session — the web client's in-app rating page, mirroring
 * the mobile app's /consult/rate screen. My Bookings lands here the moment
 * the WebSocket announces `consultation.completed` (and the Rate session
 * button on COMPLETED cards links here too), replacing the old inline modal.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { Icons } from "../../icons";
import { getConsultation, rate } from "../../api/consultation";
import { initials } from "../MyBookings/utils";

const RATING_PROMPTS = {
  1: "Not helpful",
  2: "Below expectations",
  3: "Okay",
  4: "Helpful",
  5: "Excellent session",
};

/** One interactive star of the rating row. */
function Star({ value, active, onPick, onHover, onLeave }) {
  return (
    <button
      type="button"
      aria-checked={value === active}
      aria-label={`${value} star${value > 1 ? "s" : ""}`}
      role="radio"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onPick}
      className="rounded-full p-1 transition-transform hover:scale-110"
    >
      <Icons.starSolid
        className={`h-9 w-9 transition-colors ${
          value <= active ? "text-amber-500" : "text-border"
        }`}
      />
    </button>
  );
}

export default function ConsultRate() {
  const { consultationId } = useParams();
  const navigate = useNavigate();

  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [score, setScore] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const data = await getConsultation(consultationId);
        if (!active) return;
        setConsultation(data);
        // A session that was rated on another device shows its saved state.
        if (data?.rating?.score) setDone(true);
      } catch {
        if (active) {
          setLoadError(
            "We couldn't load this session. It may have ended or been removed.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [consultationId]);

  const expert = consultation?.expert;
  const expertName = expert?.fullName || "your expert";
  const alreadyRated = !!consultation?.rating?.score;
  const active = hovered || score;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!score || submitting) return;

    setSubmitting(true);
    try {
      await rate(consultationId, score, review.trim());
      setDone(true);
      toast.success("Thanks for your rating!");
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        "Your rating couldn't be saved. Please try again.";
      if (/already rated/i.test(message)) {
        setDone(true);
        toast.success("You've already rated this session.");
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 font-sans text-foreground selection:bg-accent/20 md:py-16">
      <div className="mx-auto max-w-xl">
        <Link
          to="/bookings"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-accent"
        >
          <Icons.arrowLeft className="h-4 w-4" />
          My Bookings
        </Link>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
            Loading your session…
          </div>
        ) : loadError || !consultation ? (
          <div className="mt-10 rounded-2xl border border-border/70 bg-card p-8 text-center">
            <h1 className="font-display text-xl font-bold text-foreground">
              Session not found
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-border/70 bg-card p-6 shadow-xs sm:p-8">
            <div className="flex flex-col items-center gap-2 text-center">
              {expert?.avatar?.url ? (
                <img
                  src={expert.avatar.url}
                  alt={expertName}
                  className="h-[72px] w-[72px] rounded-full object-cover ring-4 ring-primary/15"
                />
              ) : (
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary font-display text-base font-extrabold text-primary-foreground ring-4 ring-primary/15">
                  {initials(expertName)}
                </div>
              )}

              <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-foreground">
                How was your session?
              </h1>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Rate your meeting with{" "}
                <span className="font-bold text-foreground">{expertName}</span>{" "}
                — your feedback shapes their rating and helps others choose
                well.
              </p>
            </div>

            {alreadyRated || done ? (
              <div className="mt-8 flex flex-col items-center gap-5">
                <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-xs font-extrabold text-success">
                  <Icons.checkCircle className="h-4 w-4" />
                  {alreadyRated
                    ? "You've already rated this session"
                    : "Rating saved — thank you!"}
                </span>
                <button
                  type="button"
                  onClick={() => navigate("/bookings", { replace: true })}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md transition-opacity hover:bg-primary/90"
                >
                  <Icons.book className="h-4 w-4" />
                  Back to My bookings
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="flex gap-1.5"
                    role="radiogroup"
                    aria-label="Star rating"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        value={value}
                        active={active}
                        onPick={() => setScore(value)}
                        onHover={() => setHovered(value)}
                        onLeave={() => setHovered(0)}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {RATING_PROMPTS[active] || "How was your session?"}
                  </p>
                </div>

                <textarea
                  rows={3}
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Share a few words about the session (optional)"
                  className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={!score || submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? (
                    <Icons.spinner className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icons.checkCircle className="h-4 w-4" />
                  )}
                  Submit rating
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
