import { useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

import api from "../src/config/api";
import { useToast } from "../src/components/Toast";
import { Button, Input } from "../src/components/ui";
import { apiError, apiErrorMessage } from "../src/utils/helpers";
import { Spacing, useTheme } from "../src/theme";

/**
 * Two-step reset, mirroring the web client:
 *   1. request an OTP by email
 *   2. verify OTP + set the new password
 */
export default function ForgotPasswordScreen() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function requestOtp() {
    setError("");
    setLoading(true);
    try {
      await api.post("/users/forgot-password", { email: email.trim() });
      setStep(2);
      toast.success("If that email exists, a reset code is on its way.");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not send the reset email. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndReset() {
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/users/verify-reset-otp", {
        email: email.trim(),
        otp: otp.trim(),
      });
      await api.post("/users/reset-password", {
        resetToken: otp.trim(),
        password,
      });
      toast.success("Password updated — sign in with your new password.");
      router.back();
    } catch (err) {
      setError(apiError(err, "Could not reset your password.").message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>

          <View style={styles.header}>
            <Ionicons name="key-outline" size={36} color={theme.primary} />
            <Text style={[styles.title, { color: theme.text }]}>
              {step === 1 ? "Forgot password" : "Check your email"}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {step === 1
                ? "Enter your email and we'll send you a reset code."
                : `Enter the code sent to ${email.trim()} and choose a new password.`}
            </Text>
          </View>

          {step === 1 ? (
            <>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                icon="mail-outline"
              />
              <Button
                label="Send reset code"
                size="lg"
                fullWidth
                loading={loading}
                onPress={requestOtp}
              />
            </>
          ) : (
            <>
              <Input
                label="Reset code"
                value={otp}
                onChangeText={setOtp}
                placeholder="6-digit code"
                autoCapitalize="none"
                icon="keypad-outline"
              />
              <Input
                label="New password"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                secureTextEntry
                icon="lock-closed-outline"
              />
              <Button
                label="Update password"
                size="lg"
                fullWidth
                loading={loading}
                onPress={verifyAndReset}
              />
              <Pressable
                onPress={() => setStep(1)}
                style={{ alignSelf: "center", marginTop: Spacing.lg }}
              >
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: "600" }}>
                  Use a different email
                </Text>
              </Pressable>
            </>
          )}

          {error ? (
            <Text style={{ color: theme.danger, fontSize: 13, marginTop: Spacing.lg }}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  back: { alignSelf: "flex-end", padding: Spacing.sm },
  header: { alignItems: "center", marginVertical: Spacing.xl, gap: Spacing.sm },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 14, textAlign: "center" },
});
