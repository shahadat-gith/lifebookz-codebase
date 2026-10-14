import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Icons from "../../../icons";

const STEPS = [
  {
    title: "Create your Lifebook",
    description: "Set up your personal lifebook — a home for your memories, page by page.",
    icon: Icons.book,
  },
  {
    title: "Preserve your experiences",
    description: "Capture the moments, struggles and achievements as they happened.",
    icon: Icons.shieldCheck,
  },
  {
    title: "Organize your stories and memories",
    description: "Sort everything into chapters so your story reads the way you lived it.",
    icon: Icons.edit,
  },
  {
    title: "Choose what you want to share",
    description: "Public, or just you — you decide who sees what, chapter by chapter.",
    icon: Icons.shieldCheck,
  },
  {
    title: "Discover stories from other people",
    description: "Read real lifebooks from every walk of life — the ordinary and the extraordinary.",
    icon: Icons.book,
  },
  {
    title: "Search by topic, experience, profession, place, or life challenge",
    description: "Find exactly the stories that matter to you, however you look for them.",
    icon: Icons.search,
  },
  {
    title: "Learn from real human experiences",
    description: "Find comfort and guidance in how others faced their hardest days.",
    icon: Icons.sparkles,
  },
  {
    title: "Seek guidance from life coaches and experts when needed",
    description: "Book a verified coach or expert for the moments you want a hand through.",
    icon: Icons.academic,
  },
];

function StepCard({ step, index, isInView }) {
  const Icon = step.icon;

  return (
    <motion.li
      initial={{ opacity: 0, y: 18 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
        delay: 0.05 + index * 0.06,
      }}
      className="group relative flex overflow-hidden rounded-[var(--radius-2xl)] border border-border/70 bg-card/70 shadow-xs transition-colors duration-200 hover:bg-accent/[0.03]"
    >
      {/* Number rail */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-start gap-1.5 border-r border-border/60 bg-gradient-to-b from-accent/[0.06] to-transparent py-5 sm:w-16">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/25 bg-accent/[0.06] font-display text-sm font-extrabold text-accent transition-colors duration-200 group-hover:bg-accent group-hover:text-white">
          {index + 1}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 gap-4 px-5 py-5 sm:px-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/[0.06] text-primary ring-1 ring-inset ring-primary/10">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-bold leading-snug tracking-tight text-foreground sm:text-base">
            {step.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {step.description}
          </p>
        </div>
      </div>
    </motion.li>
  );
}

/**
 * "How does Lifebookz work?" — the eight-step journey, numbered 1–8,
 * following the same visual pattern as the rest of the home page.
 */
export function HowItWorks() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden border-t border-border/60 bg-background py-14 select-none sm:py-24"
    >
      {/* Soft wash behind the whole section */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-primary/[0.04] via-primary/[0.01] to-transparent"
      />

      {/* Floating glow orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-1/3 h-72 w-72 rounded-full bg-accent/[0.06] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-1/4 h-80 w-80 rounded-full bg-blue-500/[0.05] blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <h2 className="font-display text-[30px] font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            How does{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Lifebookz
            </span>{" "}
            work?
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            From writing your first memory to getting the right guidance — this
            is your journey in eight steps.
          </p>
        </motion.div>

        {/* The eight steps */}
        <ol className="mt-10 grid gap-3 sm:mt-12 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <StepCard
              key={step.title}
              step={step}
              index={index}
              isInView={isInView}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}

export default HowItWorks;
