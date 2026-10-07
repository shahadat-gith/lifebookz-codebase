import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

import * as paymentApi from "../api/payment";

/**
 * Payment-portal auth — identical mechanism to the consultations portal:
 * same storage key, same Bearer headers, same `/users/me` resolution, plus
 * `completeHandoff` for the one-time ticket the portals relay here. No
 * second login form, no second credential system.
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

      const role = localStorage.getItem(ROLE_KEY) || "user";

      try {
        const me = await paymentApi.fetchAccount(role);
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

  /** Exchanges the one-time handoff ticket for this portal's own JWT. */
  const completeHandoff = useCallback(async (code) => {
    const { token, role } = await paymentApi.exchangeHandoffTicket(code);
    setStoredToken(token);
    try {
      localStorage.setItem(ROLE_KEY, role);
    } catch {
      /* storage unavailable — the session still works */
    }

    const me = await paymentApi.fetchAccount(role);
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
