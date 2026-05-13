import { Tabs } from "expo-router";
import React from "react";
import { Platform, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banknote, Calendar, Clock, LayoutGrid } from "lucide-react-native";
import { colors } from "@/src/components/theme";

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
      return <Calendar size={size} color={stroke} />;
    case "overtime":
      return <Banknote size={size} color={stroke} />;
    case "shifts":
      return <Clock size={size} color={stroke} />;
    default:
      return null;
  }
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // 底部 padding = 系統導覽列高度 + 固定間距
  const tabPaddingBottom = Math.max(insets.bottom, 8) + 2;
  const tabHeight = 52 + tabPaddingBottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: tabHeight,
          paddingBottom: tabPaddingBottom,
          paddingTop: 8,
          elevation: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabel: ({ focused, color, children }) => (
          <Text style={{ fontSize: 10, fontWeight: "600", color: focused ? "#fff" : color, marginBottom: 2 }}>
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
          title: "加班費",
          tabBarIcon: ({ color, focused }) => <TabIcon name="overtime" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="shifts"
        options={{
          title: "班次",
          tabBarIcon: ({ color, focused }) => <TabIcon name="shifts" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
