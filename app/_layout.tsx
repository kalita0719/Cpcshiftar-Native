import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AppDataProvider } from "@/src/state/AppDataContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void (async () => {
      await SystemUI.setBackgroundColorAsync("#000000");
      if (Platform.OS === "android") {
        try {
          NavigationBar.setStyle("dark");
        } catch {
          try {
            await NavigationBar.setBackgroundColorAsync("#000000");
            await NavigationBar.setButtonStyleAsync("light");
          } catch {
            /* non-Android or edge-to-edge limitations */
          }
        }
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <AppDataProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
          </Stack>
          {/* 隱藏頂部狀態列，實現全螢幕沉浸效果 */}
          <StatusBar hidden />
        </ThemeProvider>
      </AppDataProvider>
    </SafeAreaProvider>
  );
}
