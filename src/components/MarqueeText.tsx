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
/** 中日韓字元在窄字級下的平均字寬係數 */
const CJK_WIDTH_FACTOR = 1.14;

type Props = {
  text: string;
  style?: TextStyle;
  containerStyle?: ViewStyle;
};

function textStyleMetrics(style?: TextStyle) {
  const fontSize = typeof style?.fontSize === "number" ? style.fontSize : 12;
  const lineHeight = typeof style?.lineHeight === "number" ? style.lineHeight : Math.ceil(fontSize * 1.45);
  return { fontSize, lineHeight };
}

function estimateTextWidth(text: string, fontSize: number) {
  if (!text) return 0;
  return Math.ceil(text.length * fontSize * CJK_WIDTH_FACTOR);
}

export default function MarqueeText({ text, style, containerStyle }: Props) {
  const [viewportW, setViewportW] = useState(0);
  const translateX = useSharedValue(0);

  const { fontSize, lineHeight: styleLineHeight } = textStyleMetrics(style);
  const contentW = estimateTextWidth(text, fontSize);
  const trackW = contentW * 2 + MARQUEE_GAP;
  const clipHeight = styleLineHeight + (Platform.OS === "android" ? ANDROID_VIEWPORT_SLACK : 0);
  const shouldScroll = viewportW > 0 && contentW > viewportW;
  const textCommon = [style, styles.textBase] as TextStyle[];
  const segmentStyle = [textCommon, { width: contentW }] as TextStyle[];

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

  return (
    <View style={[styles.root, containerStyle]}>
      <View
        style={[styles.viewport, shouldScroll && styles.viewportScroll, { height: clipHeight }]}
        onLayout={onViewportLayout}
        collapsable={false}
      >
        {shouldScroll ? (
          <Animated.View style={[styles.track, { width: trackW }, animatedStyle]}>
            <Text style={segmentStyle} numberOfLines={1} ellipsizeMode="clip">
              {text}
            </Text>
            <View style={styles.gap} />
            <Text style={segmentStyle} numberOfLines={1} ellipsizeMode="clip">
              {text}
            </Text>
          </Animated.View>
        ) : (
          <Text style={[...textCommon, styles.staticText]} numberOfLines={1} ellipsizeMode="clip">
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
