import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { CONSULT_CATEGORIES } from "../../config";
import { Icons } from "../../icons";
import Button from "../../components/ui/Button";
import TestimonialForm from "./components/TestimonialForm";
import TestimonialsSection from "./components/TestimonialsSection";

/**
 * Home — the expert portal's landing page, protected like the author's:
 * guests are sent to the login page, while signed-in accounts get a warm
 * greeting, how-it-works guidance and testimonials. No marketing hero.
 */
export default function Home() {
  const navigate = useNavigate();
  const { expert, isLoading: authLoading } = useAuth();
  const [testimonialKey, setTestimonialKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !expert) {
      navigate("/login", { replace: true });
    }
  }, [expert, authLoading, navigate]);

  if (authLoading || !expert) return null;

  // Roles-aware: upgraded accounts carry "expert" inside `roles` even when
  // their primary `role` points elsewhere.
  const isExpert =
    expert.role === "expert" ||
    (Array.isArray(expert.roles) && expert.roles.includes("expert"));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 md:py-8 pb-28 md:pb-12">
      {/* ═══════════ Greeting ═══════════ */}
      <section className="rounded-3xl border border-border/60 bg-card p-8 sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          <Icons.sparkles className="h-3.5 w-3.5" />
          LifeBookz Experts
        </span>

        <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          Hello, {expert.fullName?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          {isExpert
            ? "Your consultations, availability and bookings all live in your dashboard."
            : "Complete your expert profile to start taking one-on-one consultations in education, relationships, career, business, personal growth and wellness."}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {isExpert ? (
            <Button onClick={() => navigate("/dashboard")} size="lg">
              <Icons.calendar className="h-4 w-4" />
              Go to Dashboard
            </Button>
          ) : (
            <Button onClick={() => navigate("/profile/edit")} size="lg">
              <Icons.userAdd className="h-4 w-4" />
              Complete your application
            </Button>
          )}
        </div>
      </section>

      {/* ═══════════ How it works ═══════════ */}
      <section className="mt-10 rounded-3xl border border-border/60 bg-card p-8 sm:p-10">
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "Apply",
              desc: "Complete your expert profile — expertise, qualification and the categories you want to consult in.",
            },
            {
              step: "2",
              title: "Get verified",
              desc: "Our team reviews your application. Once approved, your profile becomes searchable.",
            },
            {
              step: "3",
              title: "Consult",
              desc: "People are matched to you automatically. Review requests and manage them from your dashboard.",
            },
          ].map((item) => (
            <li key={item.step} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                {item.step}
              </span>
              <div>
                <p className="font-display text-base font-bold">
                  {item.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {item.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ═══════════ Consultancy areas ═══════════ */}
      <section className="mt-10 rounded-3xl border border-border/60 bg-card p-8 sm:p-10">
        <h2 className="font-display text-lg font-bold">Consultancy areas</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {CONSULT_CATEGORIES.map((cat) => (
            <span
              key={cat.id}
              className="rounded-full border border-border/70 bg-background px-4 py-2 text-xs font-semibold text-muted-foreground"
            >
              {cat.label}
            </span>
          ))}
        </div>
      </section>

      {/* ═══════════ Share your experience ═══════════ */}
      <div className="mt-10 mb-10">
        <TestimonialForm onSubmitted={() => setTestimonialKey((k) => k + 1)} />
      </div>

      {/* ═══════════ Community testimonials ═══════════ */}
      <TestimonialsSection refreshKey={testimonialKey} />
    </div>
  );
}
