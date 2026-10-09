import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import api from "../../config/api";
import { apiErrorMessage } from "../../utils/helpers";
import { useAuth } from "../../context/AuthContext";
import SignInPrompt from "../../components/common/SignInPrompt";
import * as consultApi from "../../api/consultation";
import ConsultHeader from "./components/ConsultHeader";
import ConsultForm from "./components/ConsultForm";
import MatchResults from "./components/MatchResults";
import {
  buildProblem,
  validateConsult,
} from "./utils";

/**
 * Expert matching: describe a problem, pick a category, and see the experts
 * who fit — best first.
 *
 * The page owns the brief and the matches; the form and the results are
 * layout only.
 */
export default function ConsultSearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resultsRef = useRef(null);
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [problem, setProblem] = useState("");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [details, setDetails] = useState("");

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [experts, setExperts] = useState([]);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState(null);

  /* ---------- Clear the error as soon as the form is touched ---------- */
  function change(setter) {
    return (value) => {
      if (error) setError("");
      setter(value);
    };
  }

  /* ---------- Ask the matcher for experts ---------- */
  async function handleSubmit(event) {
    event.preventDefault();

    const invalid = validateConsult({ problem, category });
    if (invalid) {
      setError(invalid);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await api.post("/consultations/match", {
        problem: buildProblem(problem, details),
        category,
        limit: 5,
      });

      const found = res.data?.data?.experts || [];
      setExperts(found);
      setSearched(true);

      if (found.length === 0) {
        toast.error(
          "No available expert found in this category right now — please try again a bit later.",
        );
      }

      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (err) {
      toast.error(
        apiErrorMessage(
          err,
          "We couldn't reach our experts right now. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Book one of the matches straight from the brief ---------- */
  async function handleBook(expert) {
    const expertId = expert.id || expert._id;
    if (bookingId) return; // one booking at a time

    setBookingId(expertId);

    try {
      const consultation = await consultApi.createRequest({
        expertId,
        problem: buildProblem(problem, details),
        category,
        notes: details.trim(),
      });

      const consultationId = consultation._id || consultation.id;
      toast.success(
        "Request sent — we'll tell you the moment it's confirmed.",
      );
      // Same journey as the mobile app: straight to the live waiting page,
      // which flips to a Pay step when the expert confirms over the socket.
      navigate(`/consult/waiting/${consultationId}`, {
        replace: true,
        state: {
          expertName: expert.fullName || "Your expert",
          expertAvatar: expert.avatar?.url,
        },
      });
    } catch (err) {
      toast.error(
        apiErrorMessage(err, "Could not send your request. Please try again."),
      );
    } finally {
      setBookingId(null);
    }
  }

  /* ---------- Matching needs an account ---------- */
  if (!authLoading && !isAuthenticated) {
    return (
      <SignInPrompt
        title="Sign in to find your expert"
        description="We match you with experts using your consult form and keep your bookings in one place, so an account is needed. Log in and we'll take it from there."
        showRegister
      />
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 font-sans text-foreground selection:bg-accent/20 md:py-16">
      <div className="mx-auto max-w-5xl space-y-10">
        <ConsultHeader />

        <ConsultForm
          problem={problem}
          onProblemChange={change(setProblem)}
          category={category}
          onCategoryChange={change(setCategory)}
          details={details}
          onDetailsChange={change(setDetails)}
          error={error}
          loading={loading}
          onSubmit={handleSubmit}
        />

        {searched && (
          <div ref={resultsRef}>
            <MatchResults
              experts={experts}
              bookingId={bookingId}
              onBook={handleBook}
            />
          </div>
        )}
      </div>
    </div>
  );
}
