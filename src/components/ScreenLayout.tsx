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

/** 暫關橫幅廣告；改回 false 即可恢復 */
const ADS_TEMPORARILY_DISABLED = true;

export default function ScreenLayout({
  children,
  edges = ["top"],
  style,
  contentStyle,
  hideAd = false,
}: Props) {
  const showAd = !ADS_TEMPORARILY_DISABLED && !hideAd;

  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      {showAd ? <AdBannerSlot /> : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.greyBg },
  content: { flex: 1 },
});
