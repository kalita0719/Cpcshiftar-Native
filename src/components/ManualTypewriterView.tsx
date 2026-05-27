import CalendarGrid, { darkenColor } from "@/src/components/CalendarGrid";
import { colors } from "@/src/components/theme";
import { addDays, formatYMD } from "@/src/logic/dates";
import { useAppData } from "@/src/state/AppDataContext";
import type { ShiftTemplate } from "@/src/types";
import { effectiveTemplateTimes } from "@/src/types";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** 手動排班月曆最高佔螢幕比例（避免撐滿整段剩餘空間） */
const MANUAL_CAL_MAX_HEIGHT_RATIO = 0.5;

const KEYBOARD_BORDER_COLOR = "#3b82f6";
const KEYBOARD_BORDER_STROKE = 3;
const KEYBOARD_BORDER_RADIUS = 8;
const KEYBOARD_BORDER_TOP_INSET = 14;
const BREATH_MS = 1400;

const KEYS_PER_ROW = 4;

function chunkTemplates<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

type Props = {
  selectedYmd: string;
  onChangeSelectedYmd: (ymd: string) => void;
  onDone?: () => void;
  /** 內嵌於排班中心（無獨立外殼與「完成」列）。 */
  embedded?: boolean;
};

function BreathingBorder() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + pulse.value * 0.6,
    transform: [{ scale: 1 + pulse.value * 0.014 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + pulse.value * 0.28,
    transform: [{ scale: 1 + pulse.value * 0.028 }],
  }));

  return (
    <View style={styles.keyboardBorderLayer} pointerEvents="none">
      <Animated.View style={[styles.breathingGlow, glowStyle]} />
      <Animated.View style={[styles.breathingRing, ringStyle]} />
    </View>
  );
}

function KeyboardPanel({
  embedded,
  hint,
  children,
}: {
  embedded: boolean;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.keyboardWrap, embedded && styles.keyboardEmbedded]}>
      <View style={styles.keyboardHintWrap} pointerEvents="none">
        <Text style={styles.keyboardHint}>{hint}</Text>
      </View>
      <View style={styles.keyboard}>{children}</View>
      <BreathingBorder />
    </View>
  );
}

export default function ManualTypewriterView({
  selectedYmd,
  onChangeSelectedYmd,
  onDone,
  embedded = false,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const manualCalMaxHeight = Math.round(windowHeight * MANUAL_CAL_MAX_HEIGHT_RATIO);
  const { templates, upsertShiftForDate } = useAppData();

  const templateRows = useMemo(() => chunkTemplates(templates, KEYS_PER_ROW), [templates]);
  const [scheduleRipple, setScheduleRipple] = useState<{
    date: string;
    color: string;
    key: number;
  } | null>(null);

  const applyTemplate = useCallback(
    (t: ShiftTemplate) => {
      const appliedDate = selectedYmd;
      const { startTime, endTime } = effectiveTemplateTimes(t);
      upsertShiftForDate({
        date: appliedDate,
        name: t.name,
        color: t.color,
        startTime,
        endTime,
        systemTag: t.systemTag,
      });
      setScheduleRipple({ date: appliedDate, color: t.color, key: Date.now() });
      const next = formatYMD(addDays(new Date(selectedYmd + "T12:00:00"), 1));
      onChangeSelectedYmd(next);
    },
    [onChangeSelectedYmd, selectedYmd, upsertShiftForDate],
  );

  const keyboard = (
    <KeyboardPanel embedded={embedded} hint="點選日期後，點擊班次可連續排班">
      {templates.length === 0 ? (
        <Text style={styles.emptyHint}>請先至右上角班次設定新增班次</Text>
      ) : (
        templateRows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.keyboardRow}>
            {row.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => applyTemplate(t)}
                style={({ pressed }) => [
                  styles.key,
                  {
                    backgroundColor: t.color,
                    borderColor: t.systemTag === "休假" ? colors.border : t.color,
                  },
                  pressed && styles.keyPressed,
                ]}
              >
                <Text
                  style={[styles.keyText, { color: darkenColor(t.color) }]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {t.name || "未命名"}
                </Text>
              </Pressable>
            ))}
          </View>
        ))
      )}
    </KeyboardPanel>
  );

  if (embedded) {
    return (
      <View style={styles.embedRoot}>
        <View style={[styles.calWrapEmbedded, { maxHeight: manualCalMaxHeight }]}>
          <CalendarGrid
            scheduleMode
            compactSchedule
            compactScheduleFill
            selectedScheduleDate={selectedYmd}
            onDateSelect={onChangeSelectedYmd}
            scheduleRipple={scheduleRipple}
          />
        </View>
        {keyboard}
      </View>
    );
  }

  const body = (
    <>
      <View style={styles.calWrap}>
        <CalendarGrid
          scheduleMode
          compactSchedule
          selectedScheduleDate={selectedYmd}
          onDateSelect={onChangeSelectedYmd}
          scheduleRipple={scheduleRipple}
        />
      </View>
      {keyboard}
    </>
  );

  return (
    <View style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>🚀 快速編輯中</Text>
        {onDone ? (
          <Pressable onPress={onDone} style={styles.doneBtn}>
            <Text style={styles.doneText}>完成</Text>
          </Pressable>
        ) : null}
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  embedRoot: { flex: 1, minHeight: 0, justifyContent: "flex-start" },
  safe: { flex: 1, backgroundColor: "#e2e8f0" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  doneBtn: {
    backgroundColor: colors.teal,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
  },
  doneText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  calWrap: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 6,
    backgroundColor: "#cbd5e1",
  },
  calWrapEmbedded: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 0,
  },
  keyboardWrap: {
    position: "relative",
    borderRadius: KEYBOARD_BORDER_RADIUS,
    backgroundColor: colors.card,
    overflow: "visible",
  },
  keyboard: {
    paddingTop: 2,
    paddingBottom: 8,
    paddingHorizontal: 6,
    gap: 6,
    zIndex: 1,
  },
  keyboardHintWrap: {
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 2,
    paddingHorizontal: 10,
    backgroundColor: "transparent",
  },
  keyboardBorderLayer: {
    position: "absolute",
    top: KEYBOARD_BORDER_TOP_INSET,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  breathingGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: KEYBOARD_BORDER_RADIUS + 2,
    borderWidth: KEYBOARD_BORDER_STROKE + 2,
    borderColor: KEYBOARD_BORDER_COLOR,
    backgroundColor: "transparent",
  },
  breathingRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: KEYBOARD_BORDER_RADIUS,
    borderWidth: KEYBOARD_BORDER_STROKE,
    borderColor: KEYBOARD_BORDER_COLOR,
    backgroundColor: "transparent",
  },
  keyboardEmbedded: {
    flexShrink: 0,
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  keyboardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  key: {
    width: "23.5%",
    height: 40,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  keyPressed: { opacity: 0.88 },
  keyText: { fontSize: 13, fontWeight: "800", textAlign: "center" },
  keyboardHint: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
    alignSelf: "center",
    backgroundColor: colors.card,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: 12,
  },
});
