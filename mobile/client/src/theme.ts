/** Shared design tokens — a mobile translation of the web client's palette. */

export const Colors = {
  light: {
    background: "#fafaf9",
    surface: "#ffffff",
    surfaceMuted: "#f5f5f4",
    text: "#1c1917",
    textMuted: "#78716c",
    border: "#e7e5e4",
    primary: "#0f766e", // teal-700
    primaryForeground: "#ffffff",
    accent: "#f59e0b", // amber-500
    danger: "#dc2626",
    success: "#16a34a",
    info: "#0284c7",
  },
  dark: {
    background: "#0c0a09",
    surface: "#1c1917",
    surfaceMuted: "#292524",
    text: "#fafaf9",
    textMuted: "#a8a29e",
    border: "#44403c",
    primary: "#2dd4bf", // teal-400
    primaryForeground: "#042f2e",
    accent: "#fbbf24",
    danger: "#f87171",
    success: "#4ade80",
    info: "#38bdf8",
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const Type = {
  title: { fontSize: 24, fontWeight: "800" as const },
  heading: { fontSize: 18, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
  caption: { fontSize: 11, fontWeight: "500" as const },
};

export function useTheme(isDark: boolean) {
  return isDark ? Colors.dark : Colors.light;
}

export type Theme = ReturnType<typeof useTheme>;
