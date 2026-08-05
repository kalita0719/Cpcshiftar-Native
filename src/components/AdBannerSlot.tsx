import { colors } from "@/src/components/theme";
import Constants, { ExecutionEnvironment } from "expo-constants";
import React from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";

/** 頂部廣告欄位預設高度（載入前／失敗時） */
export const AD_BANNER_HEIGHT = 70;

const canShowNativeAds =
  Platform.OS !== "web" &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

type Props = {
  style?: ViewStyle;
};

/** 頂部錨定自動調整橫幅；Expo Go 僅顯示佔位 */
export default function AdBannerSlot({ style }: Props) {
  if (!canShowNativeAds) {
    return (
      <View
        style={[styles.slot, { height: AD_BANNER_HEIGHT }, style]}
        pointerEvents="none"
        accessibilityElementsHidden
      />
    );
  }

  // 延遲載入，避免 Expo Go 因缺少原生模組而崩潰
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const NativeAdBanner = require("./AdBannerNative").default as React.ComponentType<Props>;
  return <NativeAdBanner style={style} />;
}

const styles = StyleSheet.create({
  slot: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
