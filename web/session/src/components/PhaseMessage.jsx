import Logo from "./Logo";
import { Icon } from "./Icons";

/** Full-screen phase screen (loading / connecting / error states). */
export default function PhaseMessage({ icon, title, children, action }) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <header className="flex items-center justify-center border-b border-border/60 bg-card/60 px-4 py-3">
        <Logo />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-foreground">{title}</h1>
        <div className="mt-2 max-w-md text-sm text-muted-foreground">{children}</div>
        {action && (
          <a
            href={action.href}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            {action.icon}
            {action.label}
          </a>
        )}
      </main>
    </div>
  );
}

export { Icon };
