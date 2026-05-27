import { colors } from "@/src/components/theme";
import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

/** 預留給未來橫幅廣告的固定高度（px） */
export const AD_BANNER_HEIGHT = 70;

type Props = {
  style?: ViewStyle;
};

/** 頂部廣告欄位佔位；之後可替換為實際 AdMob / 聯播元件 */
export default function AdBannerSlot({ style }: Props) {
  return <View style={[styles.slot, style]} pointerEvents="none" accessibilityElementsHidden />;
}

const styles = StyleSheet.create({
  slot: {
    height: AD_BANNER_HEIGHT,
    backgroundColor: "#E8F4FC",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
