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

import { useAuth } from "../src/context/AuthContext";
import { useToast } from "../src/components/Toast";
import { Button, Input } from "../src/components/ui";
import { apiError } from "../src/utils/helpers";
import { Spacing, useTheme } from "../src/theme";
import { Image } from "expo-image";

const LOGO = require("../assets/images/logo.png");

export default function RegisterScreen() {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");
  const router = useRouter();
  const { registerUser } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    setError("");
    setFieldErrors({});
    if (password.length < 8) {
      setFieldErrors({ password: "Password must be at least 8 characters." });
      return;
    }

    setLoading(true);
    try {
      // Name, email and password only — the profile photo is chosen from
      // the dashboard later.
      await registerUser({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });
      toast.success("Account created successfully!");
      router.back();
    } catch (err) {
      const { message, fields } = apiError(err, "Registration failed. Please try again.");
      const hasFields = Object.keys(fields).length > 0;
      setFieldErrors(fields);
      setError(hasFields ? "" : message);
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
            <Text style={[styles.title, { color: theme.text }]}>Create your account</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Join the community of readers and storytellers.
            </Text>
          </View>

          <Input
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            autoCapitalize="words"
            icon="person-outline"
            error={fieldErrors.fullName}
          />

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

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            secureTextEntry
            icon="lock-closed-outline"
            error={fieldErrors.password}
            helperText="Use at least 8 characters."
          />

          {error ? (
            <Text style={{ color: theme.danger, fontSize: 13, marginBottom: Spacing.lg }}>
              {error}
            </Text>
          ) : null}

          <Button
            label="Create account"
            icon="person-add-outline"
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleSubmit}
          />

          <View style={styles.footer}>
            <Text style={{ color: theme.textMuted, fontSize: 14 }}>
              Already have an account?{" "}
            </Text>
            <Pressable onPress={() => router.push("/login")}>
              <Text style={{ color: theme.primary, fontSize: 14, fontWeight: "700" }}>
                Sign in
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
  back: { alignSelf: "flex-end", padding: Spacing.sm },
  header: { alignItems: "center", marginVertical: Spacing.lg, gap: Spacing.sm },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 14, textAlign: "center" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
});
