/**
 * Shown while a handoff ticket is being exchanged or auth is restoring.
 * Access denied must never flash during this window — the visitor hasn't
 * been judged yet.
 */
export default function Verifying({ label = "Verifying your access…" }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
