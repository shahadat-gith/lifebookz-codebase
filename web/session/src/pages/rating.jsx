import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import Logo from "../components/Logo";
import RatingStars from "../components/RatingStars";
import { Icon, Paths } from "../components/Icons";
import * as consultationsApi from "../api/consultations";
import { useAuth } from "../context/AuthContext";

/**
 * Post-meeting rating — the client's stop after the room closes.
 *
 * Rates the meeting (1–5 stars, optional review) through the same backend
 * endpoint the client portal used. The expert's aggregate rating is
 * recalculated server-side from these records.
 */
export default function RatingPage() {
  const { consultationId } = useParams();
  const { user } = useAuth();

  const [consultation, setConsultation] = useState(null);
  const [score, setScore] = useState(0);
  const [review, setReview] = useState("");
  const [phase, setPhase] = useState("loading"); // loading | ready | submitting | done | already | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await consultationsApi.getConsultation(consultationId);
        if (cancelled) return;
        setConsultation(data);

        if (data.rating?.score) {
          setPhase("already");
          setScore(data.rating.score);
        } else if (data.status !== "COMPLETED") {
          setPhase("error");
          setMessage("This session hasn't been completed yet, so it can't be rated.");
        } else {
          setPhase("ready");
        }
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setMessage(
          err.response?.data?.error?.message ||
            "We couldn't load this session. Please try again.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consultationId]);

  const submit = useCallback(async () => {
    if (!score) return;
    setPhase("submitting");
    try {
      await consultationsApi.rateConsultation(consultationId, score, review);
      setPhase("done");
    } catch (err) {
      const msg =
        err.response?.data?.error?.message || "Your rating couldn't be saved.";
      if (/already rated/i.test(msg)) {
        setPhase("already");
      } else {
        setPhase("ready");
        setMessage(msg);
      }
    }
  }, [consultationId, score, review]);

  const clientBase = (import.meta.env.VITE_CLIENT_URL || "").replace(/\/$/, "");
  const expertName = consultation?.expert?.fullName || "your expert";

  // ?platform=mobile (persisted by the meeting page) — the user came from
  // the LifeBookz app, so all exits lead back INTO the app, never to the
  // web client portal.
  let platform = "";
  try {
    platform =
      (new URLSearchParams(window.location.search).get("platform") || "").toLowerCase() ||
      sessionStorage.getItem("lbz_platform") ||
      "";
  } catch {
    /* storage unavailable */
  }
  const isMobileApp = platform === "mobile";

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <header className="flex items-center justify-center border-b border-border/60 bg-card/60 px-4 py-3">
        <Logo />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          {phase === "loading" && (
            <>
              <Icon path={Paths.infoCircle} className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">Loading your session…</p>
            </>
          )}

          {phase === "error" && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <Icon path={Paths.infoCircle} className="h-7 w-7" />
              </div>
              <h1 className="mt-4 font-display text-xl font-bold text-foreground">
                Something went wrong
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{message}</p>
              {(isMobileApp ? true : !!clientBase) && (
                <a
                  href={isMobileApp ? "lifebookz://bookings" : `${clientBase}/bookings`}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                >
                  Back to My Bookings
                </a>
              )}
            </>
          )}

          {phase === "ready" && (
            <>
              <h1 className="font-display text-2xl font-bold text-foreground">
                How was your session?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Rate your meeting with <strong className="text-foreground">{expertName}</strong>{" "}
                — your feedback shapes their rating and helps others choose well.
              </p>

              <div className="mt-6">
                <RatingStars value={score} onChange={setScore} />
              </div>

              <textarea
                value={review}
                onChange={(event) => setReview(event.target.value)}
                placeholder="Share a few words about the session (optional)"
                rows={3}
                maxLength={2000}
                className="mt-5 w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
              />

              {message && (
                <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {message}
                </p>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={!score || phase === "submitting"}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
              >
                {phase === "submitting" ? (
                  <Icon path={Paths.infoCircle} className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon path={Paths.star} className="h-4 w-4" />
                )}
                {phase === "submitting" ? "Saving…" : "Submit rating"}
              </button>
            </>
          )}

          {(phase === "done" || phase === "already") && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
                <Icon path={Paths.checkCircle} className="h-7 w-7" />
              </div>
              <h1 className="mt-4 font-display text-xl font-bold text-foreground">
                {phase === "done" ? "Thanks for your feedback!" : "You've already rated this session"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {phase === "done" && "Your rating helps other people find great experts."}
                {phase === "already" && "Your feedback was already recorded — thank you!"}
              </p>
              <div className="mt-2 flex justify-center gap-0.5 text-amber-400">
                {[1, 2, 3, 4, 5].map((step) => (
                  <Icon
                    key={step}
                    path={Paths.star}
                    className={`h-5 w-5 ${step <= score ? "fill-amber-400" : "fill-transparent text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              {(isMobileApp ? true : !!clientBase) && (
                <a
                  href={isMobileApp ? "lifebookz://bookings" : `${clientBase}/bookings`}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                >
                  Back to My Bookings
                </a>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="pb-6 text-center text-xs text-muted-foreground">
        Signed in as {user?.fullName || "a LifeBookz client"}
      </footer>
    </div>
  );
}
