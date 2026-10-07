import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { Colors } from "../../src/theme";
import { triggerHomeReload } from "../../src/utils/homeReload";

export default function TabLayout() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const tint = dark ? Colors.dark.primary : Colors.light.primary;
  const inactive = dark ? Colors.dark.textMuted : Colors.light.textMuted;

  return (
    <Tabs
      // Double-tap Home while already on it → reload the feed.
      screenListeners={({ navigation }: { navigation: any }) => ({
        tabPress: (e: { target?: string }) => {
          const state = navigation.getState();
          const pressed = state.routes.find((r: { key: string }) => r.key === e.target);
          const focused = state.routes[state.index];
          if (pressed?.name === "index" && focused?.name === "index") {
            triggerHomeReload();
          }
        },
      })}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: {
          backgroundColor: dark ? Colors.dark.surface : Colors.light.surface,
          borderTopColor: dark ? Colors.dark.border : Colors.light.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),

        }}
      />
      <Tabs.Screen
        name="stories"
        options={{
          title: "Stories",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trending"
        options={{
          title: "Trending",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
