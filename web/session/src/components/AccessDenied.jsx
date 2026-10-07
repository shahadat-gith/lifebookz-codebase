/**
 * The plain refusal screen — shown when someone reaches this portal without
 * a session. Deliberately bare: no portal tour, no guidance paragraphs.
 * Every join is re-authorized server-side; this screen is just the wall.
 */
export default function AccessDenied() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center font-sans text-foreground">
      <h1 className="font-display text-3xl font-bold text-foreground">
        Access denied
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You don't have permission to view this page.
      </p>
    </div>
  );
}
