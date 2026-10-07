import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatePresence, MotiView } from "moti";
import { Radius, Spacing, useTheme, type Theme } from "../theme";

type ToastKind = "success" | "error" | "info";

interface ToastState {
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const COLORS: Record<ToastKind, keyof Theme> = {
  success: "success",
  error: "danger",
  info: "primary",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, kind: ToastKind = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, kind });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const value = useMemo(
    () => ({
      showToast,
      success: (m: string) => showToast(m, "success"),
      error: (m: string) => showToast(m, "error"),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <SafeAreaView pointerEvents="none" style={styles.wrap}>
          <AnimatePresence>
            <MotiView
              key={`${toast.message}-${toast.kind}`}
              from={{ opacity: 0, translateY: -16, scale: 0.96 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              exit={{ opacity: 0, translateY: -12, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              style={[
                styles.toast,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: theme[COLORS[toast.kind]] as string },
                ]}
              />
              <Text style={[styles.text, { color: theme.text }]} numberOfLines={3}>
                {toast.message}
              </Text>
            </MotiView>
          </AnimatePresence>
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
    // Small elevation keeps the toast legible over any screen.
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1, fontSize: 14, fontWeight: "500" },
});
