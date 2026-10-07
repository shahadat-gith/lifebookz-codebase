/** Consult categories shared by the matching and booking flows. */
export const COACH_CATEGORIES = [
  { id: "education", label: "Education" },
  { id: "relationship", label: "Relationship" },
  { id: "career", label: "Career & Job" },
  { id: "business", label: "Business" },
  { id: "growth", label: "Personal Growth" },
  { id: "health", label: "Health & Wellness" },
] as const;

export function getCategoryLabel(categoryId?: string) {
  return COACH_CATEGORIES.find((c) => c.id === categoryId)?.label || categoryId || "";
}

/** How much of a description the matcher needs to work with. */
export const MIN_PROBLEM_LENGTH = 10;

/** The problem text sent to the matcher, with optional notes folded in. */
export function buildProblem(problem: string, details?: string) {
  const clean = problem.trim();
  const extra = (details || "").trim();
  return extra ? `${clean}\n\nAdditional context: ${extra}` : clean;
}

/** What is wrong with the form, or "" when it is ready to submit. */
export function validateConsult({ problem, category }: { problem: string; category?: string }) {
  if (problem.trim().length < MIN_PROBLEM_LENGTH) {
    return `Please describe your problem in at least ${MIN_PROBLEM_LENGTH} characters.`;
  }
  if (!category) {
    return "Please pick a category so we can match you accurately.";
  }
  return "";
}
