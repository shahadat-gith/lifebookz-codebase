import { useEffect, useRef, useState } from "react";

import { useAuth } from "../context/AuthContext";
import AccessDenied from "./AccessDenied";
import Verifying from "./Verifying";

/**
 * Auth gate for the checkout pages.
 *
 * The client portal opens this portal with a one-time ticket in the URL
 * hash (`…#tk=…`). The gate exchanges the ticket for a regular JWT, strips
 * the code from the URL, and renders the checkout. Without a ticket (or
 * when the exchange fails) it shows a plain access-denied screen.
 *
 * The URL alone never grants access — the backend authorizes every payment
 * call.
 */
export default function HandoffGate({ children }) {
  const { completeHandoff, isAuthenticated, isLoading } = useAuth();
  const [denied, setDenied] = useState(false);
  // The ticket exchange is a network round-trip — until it resolves (or the
  // visitor has no ticket at all), the page must NOT show access denied.
  const [exchanging, setExchanging] = useState(false);
  // StrictMode guard: the one-time ticket must only ever be exchanged once.
  const exchangeStarted = useRef(false);

  useEffect(() => {
    if (isLoading || exchangeStarted.current) return;
    exchangeStarted.current = true;

    const match = (window.location.hash || "").match(/tk=([a-f0-9]+)/i);
    const code = match?.[1];

    if (!code) {
      if (!localStorage.getItem("token")) setDenied(true);
      return;
    }

    // Strip the ticket from the URL first, then exchange in the background.
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );

    setExchanging(true);
    completeHandoff(code)
      .catch(() => setDenied(true))
      .finally(() => setExchanging(false));
  }, [isLoading, completeHandoff]);

  // Auth restoring, or a handoff ticket mid-exchange: the visitor hasn't
  // been judged yet — show a neutral verifying screen, never access denied.
  if (isLoading || exchanging) return <Verifying />;
  if (denied || !isAuthenticated) return <AccessDenied />;

  return children;
}
