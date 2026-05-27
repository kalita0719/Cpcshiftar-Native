import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import { StatusBar, setStatusBarStyle, setStatusBarTranslucent } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AppDataProvider } from "@/src/state/AppDataContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

/** edge-to-edge 下手勢列區域需自行鋪黑底，系統按鈕才會顯示為白色 */
function GestureBarBackdrop() {
  const insets = useSafeAreaInsets();
  if (insets.bottom <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: insets.bottom,
        backgroundColor: "#000000",
        zIndex: 1,
      }}
    />
  );
}

function RootShell() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync("#ffffff");
    // 淺色 App 背景：狀態列用深色圖示，避免與 NavigationBar.setStyle 衝突成白底白字
    setStatusBarStyle("dark");
    if (Platform.OS === "android") {
      setStatusBarTranslucent(true);
      NavigationBar.setStyle("dark");
    }
  }, []);

  return (
    <AppDataProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
        </Stack>
        <GestureBarBackdrop />
        <StatusBar style="dark" translucent backgroundColor="transparent" />
      </ThemeProvider>
    </AppDataProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RootShell />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
