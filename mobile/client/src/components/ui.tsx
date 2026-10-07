/**
 * Small, focused building blocks shared by every screen — the RN equivalents
 * of the web client's components/ui primitives.
 */
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle, TextStyle, ActivityIndicator, useColorScheme } from "react-native";
import { Image } from "expo-image";
import { useState } from "react";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { Radius, Spacing, useTheme, type Theme } from "../theme";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "md" | "lg";
  fullWidth?: boolean;
  style?: ViewStyle;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  size = "md",
  fullWidth = false,
  style,
  icon,
}: ButtonProps) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const blocked = disabled || loading;

  const bg =
    variant === "primary" ? theme.primary
    : variant === "danger" ? theme.danger
    : "transparent";
  const fg =
    variant === "primary" || variant === "danger"
      ? theme.primaryForeground
      : variant === "outline" ? theme.primary
      : theme.text;
  const borderColor = variant === "outline" ? theme.primary : "transparent";

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.button,
        size === "lg" && styles.buttonLg,
        fullWidth && { alignSelf: "stretch" },
        { backgroundColor: bg, borderColor, opacity: blocked ? 0.6 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={16} color={fg} />}
          <Text style={[styles.buttonLabel, { color: fg }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  helperText?: string;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words";
  keyboardType?: "default" | "email-address";
  icon?: keyof typeof Ionicons.glyphMap;
  rightAccessory?: React.ReactNode;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  helperText,
  multiline = false,
  autoCapitalize = "none",
  keyboardType = "default",
  icon,
  rightAccessory,
}: InputProps) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const [showPassword, setShowPassword] = useState(false);
  const hidden = secureTextEntry && !showPassword;

  return (
    <View style={styles.inputWrap}>
      {label && (
        <Text style={[styles.inputLabel, { color: theme.text }]}>{label}</Text>
      )}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: theme.surfaceMuted,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}
      >
        {icon && <Ionicons name={icon} size={16} color={theme.textMuted} />}
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          secureTextEntry={hidden}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          autoCorrect={!secureTextEntry}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
            <Ionicons
              name={showPassword ? "eye-off" : "eye"}
              size={16}
              color={theme.textMuted}
            />
          </Pressable>
        )}
        {rightAccessory}
      </View>
      {error ? (
        <Text style={[styles.inputHint, { color: theme.danger }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.inputHint, { color: theme.textMuted }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SelectField — select-style dropdown
// ---------------------------------------------------------------------------

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  error,
}: {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View>
      {label ? (
        <Text style={[styles.inputLabel, { color: theme.text }]}>{label}</Text>
      ) : null}
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={[
          styles.select,
          {
            backgroundColor: theme.surfaceMuted,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}
      >
        <Text
          style={{
            color: selected ? theme.text : theme.textMuted,
            fontSize: 15,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.textMuted}
        />
      </Pressable>
      {open && (
        <View
          style={[
            styles.selectOptions,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {options.map((option) => (
            <Pressable
              key={option.value || "__any__"}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={({ pressed }) => [
                styles.selectOption,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text
                style={{
                  color: value === option.value ? theme.primary : theme.text,
                  fontSize: 14,
                  fontWeight: value === option.value ? "700" : "400",
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {option.label}
              </Text>
              {value === option.value && (
                <Ionicons name="checkmark" size={16} color={theme.primary} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export function Avatar({
  uri,
  name,
  size = 40,
}: {
  uri?: string;
  name?: string;
  size?: number;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const [failed, setFailed] = useState(false);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
        contentFit="cover"
        recyclingKey={uri}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.primary,
        },
      ]}
    >
      <Text style={{ color: theme.primaryForeground, fontSize: size * 0.38, fontWeight: "700" }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

function initialsOf(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function LoadingScreen({ message = "Loading…" }: { message?: string }) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");

  return (
    <View style={[styles.center, styles.fill]}>
      <MotiView
        from={{ opacity: 0.4, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: "timing",
          duration: 700,
          loop: true,
          repeatReverse: true,
        }}
      >
        <Image
          source={require("../../assets/images/logo.png")}
          style={{ width: 44, height: 44 }}
          contentFit="contain"
        />
      </MotiView>
      <ActivityIndicator
        size="small"
        color={theme.primary}
        style={{ marginTop: Spacing.lg }}
      />
      {message ? (
        <Text style={[styles.stateTitle, { color: theme.textMuted, marginTop: Spacing.md }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Fade-and-rise entrance wrapper — the standard reveal for screen content.
 * `delay` staggers siblings so sections cascade in.
 */
export function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 420, delay }}
      style={style}
    >
      {children}
    </MotiView>
  );
}

export function EmptyState({
  icon = "book-outline",
  title,
  description,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  return (
    <View style={[styles.center, styles.statePad]}>
      <Ionicons name={icon} size={40} color={theme.textMuted} />
      <Text style={[styles.stateTitle, { color: theme.text, marginTop: Spacing.lg }]}>
        {title}
      </Text>
      {description ? (
        <Text style={[styles.stateBody, { color: theme.textMuted, marginTop: Spacing.sm, textAlign: "center" }]}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  return (
    <View style={[styles.center, styles.statePad]}>
      <Ionicons name="cloud-offline-outline" size={40} color={theme.danger} />
      <Text style={[styles.stateTitle, { color: theme.text, marginTop: Spacing.lg }]}>
        {title}
      </Text>
      {message ? (
        <Text style={[styles.stateBody, { color: theme.textMuted, marginTop: Spacing.sm, textAlign: "center" }]}>
          {message}
        </Text>
      ) : null}
      {onRetry && (
        <Button label="Try again" onPress={onRetry} style={{ marginTop: Spacing.xl }} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Badge / ScreenHeader
// ---------------------------------------------------------------------------

export function Badge({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "primary" | "danger" | "success";
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const color =
    tone === "primary" ? theme.primary
    : tone === "danger" ? theme.danger
    : tone === "success" ? theme.success
    : theme.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
      <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

/** Tappable back row with a chevron and label — for stack screens. */
export function BackBar({
  label = "Back",
  onPress,
}: {
  label?: string;
  onPress: () => void;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.backBar,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name="chevron-back" size={18} color={theme.primary} />
      <Text style={[styles.backBarLabel, { color: theme.primary }]}>{label}</Text>
    </Pressable>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  return (
    <View style={styles.headerRow}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={8} style={{ marginRight: Spacing.md }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[Type_h.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const Type_h: { title: TextStyle } = {
  title: { fontSize: 24, fontWeight: "800" },
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  buttonLg: { paddingVertical: Spacing.lg },
  buttonLabel: { fontSize: 15, fontWeight: "700" },

  inputWrap: { marginBottom: Spacing.lg },
  inputLabel: { fontSize: 14, fontWeight: "600", marginBottom: Spacing.sm },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 4 },
  inputHint: { fontSize: 12, marginTop: Spacing.xs },

  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },

  center: { alignItems: "center", justifyContent: "center" },
  fill: { flex: 1, padding: Spacing.xl },
  statePad: { padding: Spacing.xxl },
  stateTitle: { fontSize: 17, fontWeight: "700" },
  stateBody: { fontSize: 14, lineHeight: 20, maxWidth: 320 },

  badge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    alignSelf: "flex-start",
  },

  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  selectOptions: {
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  selectOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  headerSubtitle: { fontSize: 13, marginTop: 2 },

  backBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
    marginBottom: Spacing.sm,
  },
  backBarLabel: { fontSize: 14, fontWeight: "600" },
});
