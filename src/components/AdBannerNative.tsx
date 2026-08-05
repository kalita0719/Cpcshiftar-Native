import { colors } from "@/src/components/theme";
import React, { useRef, useState } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
  useForeground,
} from "react-native-google-mobile-ads";

const FALLBACK_HEIGHT = 70;

/** AdMob 錨定橫幅廣告單元 ID（正式） */
const PRODUCTION_BANNER_UNIT_ID = "ca-app-pub-8170419690835413/2079080995";

const adUnitId =
  __DEV__ || !PRODUCTION_BANNER_UNIT_ID
    ? TestIds.ADAPTIVE_BANNER
    : PRODUCTION_BANNER_UNIT_ID;

type Props = {
  style?: ViewStyle;
};

/** 僅在有原生 AdMob 模組的 build 使用（非 Expo Go） */
export default function AdBannerNative({ style }: Props) {
  const bannerRef = useRef<BannerAd>(null);
  const [height, setHeight] = useState(FALLBACK_HEIGHT);

  useForeground(() => {
    if (Platform.OS === "ios") {
      bannerRef.current?.load();
    }
  });

  return (
    <View style={[styles.slot, { height }, style]}>
      <BannerAd
        ref={bannerRef}
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={(dimensions) => {
          if (dimensions.height > 0) setHeight(dimensions.height);
        }}
        onAdFailedToLoad={() => {
          setHeight(0);
        }}
      />
    </View>
  );
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
