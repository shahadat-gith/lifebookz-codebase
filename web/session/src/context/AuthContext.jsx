import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

import * as consultationsApi from "../api/consultations";

/**
 * Session-portal auth — a thin mirror of the portals' AuthContext.
 *
 * Same storage key ("token"), same Bearer-header mechanism, same backend
 * resolution endpoints (`/users/me`, `/experts/me`). The only addition is
 * `completeHandoff`, which swaps the one-time ticket relayed from the
 * client/expert portal for this portal's own JWT. No second login form, no
 * second credential system.
 *
 * The role comes from the backend account payload; the meeting page
 * re-authorizes server-side at `/consultations/:id/join` regardless.
 * Nothing here trusts the URL.
 */
const AuthContext = createContext(undefined);

const TOKEN_KEY = "token";
const ROLE_KEY = "role";

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* storage unavailable */
  }
}

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const token = getStoredToken();
      if (!token) {
        setAccount(null);
        setIsLoading(false);
        return;
      }

      // Role was stored at handoff time; fall back to "user" — the meeting
      // page's `/join` call re-authorizes server-side either way.
      const role = localStorage.getItem(ROLE_KEY) || "user";

      try {
        const me = await consultationsApi.fetchAccount(role);
        setAccount({ ...me, role: me.role || role });
      } catch {
        setStoredToken(null);
        setAccount(null);
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []);

  /**
   * Called by the handoff gate with the one-time code relayed through the
   * URL hash. Exchanges it for a JWT, stores it, and resolves the account.
   */
  const completeHandoff = useCallback(async (code) => {
    const { token, role } = await consultationsApi.exchangeHandoffTicket(code);
    setStoredToken(token);
    try {
      localStorage.setItem(ROLE_KEY, role);
    } catch {
      /* storage unavailable — the session still works */
    }

    const me = await consultationsApi.fetchAccount(role);
    setAccount({ ...me, role: me.role || role });
    return me;
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setAccount(null);
  }, []);

  const value = useMemo(
    () => ({
      user: account,
      role: account?.role || null,
      isAuthenticated: !!account,
      isLoading,
      completeHandoff,
      logout,
    }),
    [account, isLoading, completeHandoff, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}

export default AuthProvider;
