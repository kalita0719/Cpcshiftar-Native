import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { colors } from "@/src/components/theme";

const ITEM_H = 36;
const VISIBLE = 3;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
const MINUTE_STEP = 15;
/** 重複區段數（奇數，滾動錨點在中間段） */
const LOOP_COUNT = 5;

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTE_LABELS = ["00", "15", "30", "45"];

export function snapTimeToQuarter(timeStr: string): string {
  if (!timeStr || !timeStr.includes(":")) return "09:00";
  const [h, m] = timeStr.split(":").map(Number);
  const total = ((Math.round((h * 60 + m) / MINUTE_STEP) * MINUTE_STEP) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function parseTime(timeStr: string): { hour: number; minuteIdx: number } {
  const snapped = snapTimeToQuarter(timeStr);
  const [h, m] = snapped.split(":").map(Number);
  const minuteIdx = MINUTE_LABELS.indexOf(String(m).padStart(2, "0"));
  return { hour: h, minuteIdx: minuteIdx >= 0 ? minuteIdx : 0 };
}

function formatTime(hour: number, minuteIdx: number): string {
  return `${String(hour).padStart(2, "0")}:${MINUTE_LABELS[minuteIdx] ?? "00"}`;
}

function releaseScrollLock(lockRef: React.MutableRefObject<boolean>) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      lockRef.current = false;
    });
  });
}

type WheelColumnProps = {
  items: readonly string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width?: number;
};

function WheelColumn({ items, selectedIndex, onSelect, width = 52 }: WheelColumnProps) {
  const len = items.length;
  const centerBlock = Math.floor(LOOP_COUNT / 2);
  const loopedItems = useMemo(
    () => Array.from({ length: len * LOOP_COUNT }, (_, i) => items[i % len]),
    [items, len],
  );

  const snapOffsets = useMemo(
    () => Array.from({ length: loopedItems.length }, (_, i) => i * ITEM_H),
    [loopedItems.length],
  );

  const absForLogical = useCallback((logical: number) => centerBlock * len + logical, [centerBlock, len]);

  const snapOffsetY = useCallback((logical: number) => absForLogical(logical) * ITEM_H, [absForLogical]);

  const scrollRef = useRef<ScrollView>(null);
  const scrollLockRef = useRef(false);
  const lastLogicalRef = useRef<number | null>(null);
  const lastSnappedYRef = useRef<number | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [highlightAbsIdx, setHighlightAbsIdx] = useState(() => absForLogical(selectedIndex));

  const scrollToLogical = useCallback(
    (logical: number) => {
      const abs = absForLogical(logical);
      const y = snapOffsetY(logical);
      lastSnappedYRef.current = y;
      scrollLockRef.current = true;
      setHighlightAbsIdx(abs);
      scrollRef.current?.scrollTo({ y, animated: false });
      releaseScrollLock(scrollLockRef);
    },
    [absForLogical, snapOffsetY],
  );

  // 僅在外部改值時同步滾動，避免 onSelect → 父層更新 → 再次 scrollTo 與手勢衝突
  useEffect(() => {
    if (selectedIndex === lastLogicalRef.current) return;
    lastLogicalRef.current = selectedIndex;
    scrollToLogical(selectedIndex);
  }, [selectedIndex, scrollToLogical]);

  const applySettle = useCallback(
    (y: number) => {
      if (scrollLockRef.current) return;

      const rawAbs = Math.round(y / ITEM_H);
      const clamped = Math.max(0, Math.min(loopedItems.length - 1, rawAbs));
      const logical = ((clamped % len) + len) % len;
      const targetAbs = absForLogical(logical);
      const snappedY = snapOffsetY(logical);

      // 已在目標位置：不再 scrollTo，避免手指放開後二次捲動
      if (
        lastSnappedYRef.current !== null &&
        Math.abs(y - snappedY) <= 1 &&
        Math.abs(lastSnappedYRef.current - snappedY) <= 1 &&
        logical === lastLogicalRef.current
      ) {
        setHighlightAbsIdx(targetAbs);
        return;
      }

      lastSnappedYRef.current = snappedY;
      setHighlightAbsIdx(targetAbs);

      if (logical !== lastLogicalRef.current) {
        lastLogicalRef.current = logical;
        onSelect(logical);
      }

      if (Math.abs(y - snappedY) > 1) {
        scrollLockRef.current = true;
        scrollRef.current?.scrollTo({ y: snappedY, animated: false });
        releaseScrollLock(scrollLockRef);
      }
    },
    [absForLogical, len, loopedItems.length, onSelect, snapOffsetY],
  );

  const queueSettle = useCallback(
    (y: number) => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        applySettle(y);
      }, 32);
    },
    [applySettle],
  );

  useEffect(
    () => () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    },
    [],
  );

  const onScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      queueSettle(e.nativeEvent.contentOffset.y);
    },
    [queueSettle],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      queueSettle(e.nativeEvent.contentOffset.y);
    },
    [queueSettle],
  );

  return (
    <View style={[styles.col, { width }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        nestedScrollEnabled
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={{ paddingVertical: PAD }}
      >
        {loopedItems.map((label, i) => (
          <View key={`${label}-${i}`} style={styles.item}>
            <Text style={[styles.itemText, i === highlightAbsIdx && styles.itemTextActive]}>{label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  style?: ViewStyle;
};

export default function WheelTimePicker({ value, onChange, style }: Props) {
  const { hour, minuteIdx } = parseTime(value);

  const setHour = useCallback(
    (idx: number) => onChange(formatTime(idx, minuteIdx)),
    [minuteIdx, onChange],
  );

  const setMinute = useCallback(
    (idx: number) => onChange(formatTime(hour, idx)),
    [hour, onChange],
  );

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.highlight} pointerEvents="none" />
      <WheelColumn items={HOUR_LABELS} selectedIndex={hour} onSelect={setHour} />
      <Text style={styles.sep}>:</Text>
      <WheelColumn items={MINUTE_LABELS} selectedIndex={minuteIdx} onSelect={setMinute} width={56} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: ITEM_H * VISIBLE,
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: colors.border,
  },
  highlight: {
    position: "absolute",
    left: 8,
    right: 8,
    top: PAD,
    height: ITEM_H,
    borderRadius: 8,
    backgroundColor: "rgba(17, 146, 143, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(17, 146, 143, 0.25)",
  },
  col: { height: ITEM_H * VISIBLE },
  item: { height: ITEM_H, justifyContent: "center", alignItems: "center" },
  itemText: { fontSize: 18, color: colors.muted, fontVariant: ["tabular-nums"] },
  itemTextActive: { fontSize: 20, fontWeight: "700", color: colors.teal },
  sep: { fontSize: 20, fontWeight: "700", color: colors.text, marginHorizontal: 2 },
});
