/** The LifeBookz wordmark, shared branding with every other portal. */
export default function Logo({ compact = false }) {
  if (compact) {
    return (
      <img src="/logo.png" alt="LifeBookz" className="h-8 w-auto" draggable="false" />
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

/** Page chrome shared by all three payment screens. */
export function CheckoutShell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <header className="flex items-center justify-center border-b border-border/60 bg-card/60 px-4 py-3">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        {children}
      </main>
    </div>
  );
}
