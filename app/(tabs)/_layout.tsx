import { colors } from "@/src/components/theme";
import { Tabs } from "expo-router";
import { LayoutGrid } from "lucide-react-native";

const TAB_CALENDAR_EMOJI = "\u{1F5D3}\u{FE0F}";
const TAB_OVERTIME_EMOJI = "\u{1F4CA}";
const TAB_SHIFTS_EMOJI = "\u{2699}\u{FE0F}";
import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function TabIcon({
  name,
  color,
  focused,
}: {
  name: "home" | "calendar" | "overtime" | "shifts";
  color: string;
  focused: boolean;
}) {
  const stroke = focused ? "#fff" : color;
  const size = 22;
  switch (name) {
    case "home":
      return <LayoutGrid size={size} color={stroke} />;
    case "calendar":
      return (
        <Text style={{ fontSize: size, lineHeight: size + 2, textAlign: "center" }} allowFontScaling={false}>
          {TAB_CALENDAR_EMOJI}
        </Text>
      );
    case "overtime":
      return (
        <Text style={{ fontSize: size, lineHeight: size + 2, textAlign: "center" }} allowFontScaling={false}>
          {TAB_OVERTIME_EMOJI}
        </Text>
      );
    case "shifts":
      return (
        <Text style={{ fontSize: size, lineHeight: size + 2, textAlign: "center" }} allowFontScaling={false}>
          {TAB_SHIFTS_EMOJI}
        </Text>
      );
    default:
      return null;
  }
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabPaddingBottom = Math.max(insets.bottom, 8) + 2;
  const tabHeight = 52 + tabPaddingBottom;

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { flex: 1, backgroundColor: colors.greyBg },
        tabBarBackground: () => (
          <View style={{ flex: 1 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            />
            <View style={{ height: tabPaddingBottom, backgroundColor: "#000000" }} />
          </View>
        ),
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,
          height: tabHeight,
          paddingBottom: tabPaddingBottom,
          paddingTop: 0,
          elevation: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabel: ({ focused, color, children }) => (
          <Text style={{ fontSize: 10, fontWeight: "600", color: focused ? "#fff" : color,transform: [{ translateY: -5 }] }}>
            {children}
          </Text>
        ),
        tabBarItemStyle: {
          borderRadius: 14,
          marginHorizontal: 4,
        },
        tabBarActiveBackgroundColor: colors.teal,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "首頁",
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "行事曆",
          tabBarIcon: ({ color, focused }) => <TabIcon name="calendar" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="overtime"
        options={{
          title: "加班統計",
          tabBarIcon: ({ color, focused }) => <TabIcon name="overtime" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="shifts"
        options={{
          title: "排班中心",
          tabBarIcon: ({ color, focused }) => <TabIcon name="shifts" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
