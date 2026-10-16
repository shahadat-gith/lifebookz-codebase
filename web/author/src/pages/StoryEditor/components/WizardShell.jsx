import { motion } from "framer-motion";
import { Icons } from "../../../icons";

/**
 * Wizard chrome, reduced to the step number: a back chevron, "Step X of N",
 * and the animated progress bar. The steps speak for themselves — no titles.
 */
export function WizardShell({
  step,
  totalSteps,
  onBack,
  children,
  maxWidth = "max-w-xl",
}) {
  const pct = Math.round((step / totalSteps) * 100);

  return (
    <div className="min-h-[calc(100vh-4rem)] py-6 sm:py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`mx-auto w-full ${maxWidth}`}
      >
        {/* ── Header row: back · step number · spacer ── */}
        <div className="mb-5 flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-foreground shadow-xs transition-colors hover:bg-muted"
            >
              <Icons.chevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="h-10 w-10 flex-shrink-0" />
          )}

          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-accent">
              Step {step} / {totalSteps}
            </p>
          </div>

          <span className="h-10 w-10 flex-shrink-0" />
        </div>

        {/* ── Progress bar ── */}
        <div className="mb-6">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-accent"
            />
          </div>
        </div>

        {/* ── Card body ── */}
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-md sm:p-8">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export default WizardShell;

/** Primary navy pill button used across the wizard steps. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  type = "button",
  className = "",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3.5 font-display text-sm font-semibold shadow-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}
