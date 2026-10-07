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
import * as ImagePicker from "expo-image-picker";

import { useAuth } from "../src/context/AuthContext";
import { useToast } from "../src/components/Toast";
import { Avatar, Button, Input } from "../src/components/ui";
import { apiError } from "../src/utils/helpers";
import { Radius, Spacing, useTheme } from "../src/theme";
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
  // RN's FormData accepts { uri, name, type } objects as file fields.
  const [avatar, setAvatar] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAvatar({
        uri: asset.uri,
        name: asset.fileName || "avatar.jpg",
        type: asset.mimeType || "image/jpeg",
      });
    }
  }

  async function handleSubmit() {
    setError("");
    setFieldErrors({});
    if (password.length < 8) {
      setFieldErrors({ password: "Password must be at least 8 characters." });
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("fullName", fullName.trim());
      fd.append("email", email.trim());
      fd.append("password", password);
      if (avatar) {
        // Cast: RN's FormData extension isn't in the DOM FormData types.
        fd.append("avatar", avatar as unknown as Blob);
      }
      await registerUser(fd);
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

          {/* Avatar picker */}
          <View style={[styles.avatarCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable onPress={pickAvatar}>
              <Avatar uri={avatar?.uri} name={fullName || "User"} size={64} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: Spacing.lg }}>
              <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}>
                Profile picture
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                Optional — or use your initials.
              </Text>
              <Pressable onPress={pickAvatar} hitSlop={4}>
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: "600", marginTop: Spacing.sm }}>
                  {avatar ? "Change photo" : "Upload photo"}
                </Text>
              </Pressable>
            </View>
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

  avatarCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.lg,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
});
