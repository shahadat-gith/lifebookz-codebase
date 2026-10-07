import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

import { useAuth } from "../src/context/AuthContext";
import { useToast } from "../src/components/Toast";
import { Button, Input } from "../src/components/ui";
import { apiError } from "../src/utils/helpers";
import { Spacing, useTheme } from "../src/theme";
import { Image } from "expo-image";

const LOGO = require("../assets/images/logo.png");

export default function LoginScreen() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const { loginUser } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      await loginUser(email.trim(), password);
      toast.success("Welcome back!");
      router.back();
    } catch (err) {
      const { message, fields } = apiError(err, "Could not sign you in. Please try again.");
      setError(message);
      setFieldErrors(fields);
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
            <Image source={LOGO} style={{ width: 56, height: 56 }} contentFit="contain" />
            <Text style={[styles.title, { color: theme.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Sign in to continue reading and sharing stories.
            </Text>
          </View>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            icon="mail-outline"
            error={fieldErrors.email}
          />

          <View>
            <View style={styles.passwordRow}>
              <Text> </Text>
              <Pressable onPress={() => router.push("/forgot-password")} hitSlop={8}>
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: "600" }}>
                  Forgot password?
                </Text>
              </Pressable>
            </View>
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              icon="lock-closed-outline"
              error={fieldErrors.password}
            />
          </View>

          {error ? (
            <Text style={{ color: theme.danger, fontSize: 13, marginBottom: Spacing.lg }}>
              {error}
            </Text>
          ) : null}

          <Button
            label="Sign in"
            icon="log-in-outline"
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleSubmit}
          />

          <View style={styles.footer}>
            <Text style={{ color: theme.textMuted, fontSize: 14 }}>New to Lifebookz? </Text>
            <Pressable onPress={() => router.push("/register")}>
              <Text style={{ color: theme.primary, fontSize: 14, fontWeight: "700" }}>
                Create an account
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  back: { alignSelf: "flex-end", padding: Spacing.sm, marginTop: 0 },
  header: { alignItems: "center", marginVertical: Spacing.xl, gap: Spacing.sm },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 14, textAlign: "center" },
  passwordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
});
