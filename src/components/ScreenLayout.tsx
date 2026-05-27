import AdBannerSlot from "@/src/components/AdBannerSlot";
import { colors } from "@/src/components/theme";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

type Props = {
  children: React.ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** 全螢幕子畫面（如手動編輯）可關閉頂部廣告佔位 */
  hideAd?: boolean;
};

export default function ScreenLayout({
  children,
  edges = ["top"],
  style,
  contentStyle,
  hideAd = false,
}: Props) {
  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      {!hideAd && <AdBannerSlot />}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.greyBg },
  content: { flex: 1 },
});
