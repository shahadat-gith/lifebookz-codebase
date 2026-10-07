/** The LifeBookz wordmark, shared branding with every other portal. */
export default function Logo({ compact = false }) {
  if (compact) {
    return (
      <img
        src="/logo.png"
        alt="LifeBookz"
        className="h-8 w-auto"
        draggable="false"
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <img src="/logo.png" alt="LifeBookz" className="h-8 w-auto" draggable="false" />
      <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
        Life<span className="text-accent">Bookz</span>
      </span>
    </div>
  );
}
