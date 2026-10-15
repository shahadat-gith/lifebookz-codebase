import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, { TOKEN_KEY } from "../config/api";
import * as SecureStore from "expo-secure-store";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  role: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginUser: (email: string, password: string) => Promise<void>;
  registerUser: (data: { email: string; password: string; fullName: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      // No token means there is no session to restore — skip the request so a
      // signed-out launch never sends an unauthenticated call (and logs a 401).
      const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const res = await api.get("/users/me");
        setUser(res.data.data);
      } catch {
        // No valid session (expired/absent token) — clear stale token.
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
        setUser(null);
      }
      setIsLoading(false);
    };
    restore();
  }, []);

  const loginUser = useCallback(async (email: string, password: string) => {
    const res = await api.post("/users/login", { email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, res.data.data.token);
    setUser(res.data.data.user);
  }, []);

  const registerUser = useCallback(
    async (data: { email: string; password: string; fullName: string }) => {
      const res = await api.post("/users/register", data);
      await SecureStore.setItemAsync(TOKEN_KEY, res.data.data.token);
      setUser(res.data.data.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/users/logout");
    } catch {
      /* the session is being dropped either way */
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setUser(null);
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    const res = await api.patch("/users/me", updates);
    setUser(res.data.data);
  }, []);

  const value = useMemo(
    () => ({
      user,
      // The API sends the account role with every account payload; the
      // fallback keeps older sessions working.
      role: user?.role || (user ? "user" : null),
      isAuthenticated: !!user,
      isLoading,
      loginUser,
      registerUser,
      logout,
      updateUser,
    }),
    [user, isLoading, loginUser, registerUser, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
