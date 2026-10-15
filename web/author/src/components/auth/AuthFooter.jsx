import { Link } from "react-router-dom";

/**
 * The line under an auth form that sends the visitor to the other screen.
 * `to` may be an internal path or an absolute URL (e.g. the app's
 * sign-up page).
 */
export default function AuthFooter({ prompt, linkLabel = "Sign in", to = "/login" }) {
  return (
    <div className="mt-6 border-t border-border/40 pt-6 text-center">
      <p className="text-sm text-muted-foreground">
        {prompt}{" "}
        {/^https?:\/\//.test(to) ? (
          <a
            href={to}
            className="font-semibold text-primary transition-colors hover:underline"
          >
            {linkLabel}
          </a>
        ) : (
          <Link
            to={to}
            className="font-semibold text-primary transition-colors hover:underline"
          >
            {linkLabel}
          </Link>
        )}
      </p>
    </div>
  );
}
