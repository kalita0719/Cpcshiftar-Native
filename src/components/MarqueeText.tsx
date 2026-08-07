import React, { useEffect, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const MARQUEE_GAP = 24;
const PX_PER_SEC = 14;
const MIN_SCROLL_MS = 5000;
const SCROLL_PAUSE_MS = 1400;
const ANDROID_VIEWPORT_SLACK = 4;

type Props = {
  text: string;
  style?: TextStyle;
  containerStyle?: ViewStyle;
};

function textStyleMetrics(style?: TextStyle) {
  const fontSize = typeof style?.fontSize === "number" ? style.fontSize : 12;
  const lineHeight =
    typeof style?.lineHeight === "number" ? style.lineHeight : Math.ceil(fontSize * 1.45);
  return { fontSize, lineHeight };
}

export default function MarqueeText({ text, style, containerStyle }: Props) {
  const [viewportW, setViewportW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const translateX = useSharedValue(0);

  const { fontSize, lineHeight: styleLineHeight } = textStyleMetrics(style);
  const trackW = contentW * 2 + MARQUEE_GAP;
  const clipHeight = styleLineHeight + (Platform.OS === "android" ? ANDROID_VIEWPORT_SLACK : 0);
  const measured = contentW > 0 && viewportW > 0;
  const shouldScroll = measured && contentW > viewportW;
  const textCommon = [style, styles.textBase] as TextStyle[];
  const segmentStyle = [textCommon, { width: contentW }] as TextStyle[];

  // 文字或字級變更時重測，避免沿用舊寬度
  useEffect(() => {
    setContentW(0);
  }, [text, fontSize]);

  useEffect(() => {
    cancelAnimation(translateX);
    translateX.value = 0;
    if (!shouldScroll || contentW <= 0) return;

    const travel = contentW + MARQUEE_GAP;
    const scrollMs = Math.max(MIN_SCROLL_MS, (travel / PX_PER_SEC) * 1000);

    translateX.value = withDelay(
      SCROLL_PAUSE_MS,
      withRepeat(
        withTiming(-travel, { duration: scrollMs, easing: Easing.linear }),
        -1,
        false,
      ),
    );

    return () => {
      cancelAnimation(translateX);
    };
  }, [shouldScroll, contentW, viewportW, text, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const onViewportLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setViewportW(w);
  };

  const onMeasureLayout = (e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    if (w > 0) setContentW(w);
  };

  return (
    <View style={[styles.root, containerStyle]}>
      {/* 不受視口寬度限制，量出文字真實寬度 */}
      <View style={styles.measureHost} pointerEvents="none" collapsable={false}>
        <Text style={textCommon} onLayout={onMeasureLayout} numberOfLines={1}>
          {text}
        </Text>
      </View>

      <View
        style={[styles.viewport, shouldScroll && styles.viewportScroll, { height: clipHeight }]}
        onLayout={onViewportLayout}
        collapsable={false}
      >
        {shouldScroll ? (
          <Animated.View style={[styles.track, { width: trackW }, animatedStyle]}>
            <Text style={segmentStyle} numberOfLines={1}>
              {text}
            </Text>
            <View style={styles.gap} />
            <Text style={segmentStyle} numberOfLines={1}>
              {text}
            </Text>
          </Animated.View>
        ) : (
          <Text style={[...textCommon, styles.staticText]} numberOfLines={1}>
            {text}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    alignSelf: "stretch",
    overflow: "visible",
  },
  measureHost: {
    position: "absolute",
    opacity: 0,
    left: 0,
    top: 0,
    zIndex: -1,
    // 勿被日曆格子寬度卡住，否則 onLayout 量到的是裁切後寬度
    width: 4096,
    alignItems: "flex-start",
  },
  textBase: {
    includeFontPadding: false,
    textAlignVertical: "center",
    flexShrink: 0,
  },
  viewport: {
    width: "100%",
    overflow: "hidden",
    justifyContent: "center",
  },
  viewportScroll: {
    alignItems: "flex-start",
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  gap: {
    width: MARQUEE_GAP,
    flexShrink: 0,
  },
  staticText: {
    textAlign: "center",
    width: "100%",
  },
});
