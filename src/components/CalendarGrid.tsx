import MarqueeText from "@/src/components/MarqueeText";
import { cardShadow, colors } from "@/src/components/theme";
import { snapTimeToQuarter } from "@/src/components/WheelTimePicker";
import { clampOvertimeNote } from "@/src/constants/overtimeNotes";
import {
  addDays,
  addMonths,
  eachDayInclusive,
  endOfMonth,
  formatYMD,
  isSameMonth,
  startOfMonth,
  startOfWeekMonday,
} from "@/src/logic/dates";
import { getHolidayCalendarChip } from "@/src/logic/holidayConfig";
import { hasHolidayWork } from "@/src/logic/holidayOvertime";
import { shiftTwoCharLabel } from "@/src/logic/shiftDisplay";
import { leaveCase, shiftTime } from "@/src/logic/shiftLogic";
import { useAppData } from "@/src/state/AppDataContext";
import type { Overtime, ShiftItem } from "@/src/types";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const DAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];
const TODAY_BORDER_BLUE = "#60a5fa";
const TODAY_BREATH_MS = 1900;
const WEEKEND_BG = "#fffcfc";
const WEEKEND_BG_OUT = "#fefafa";
const DOW_ROW_BG = "#f1f5f9";
const DOW_WEEKEND_BG = "#fff3f3";
const CALENDAR_SHELL_RADIUS = 16;
const CALENDAR_SHELL_RADIUS_COMPACT = 12;

function isWeekendDay(day: Date) {
  const dow = day.getDay();
  return dow === 0 || dow === 6;
}
const HO = 0.25;
const SLOT_RADIUS = 12;
const EXT_SLOT_BG_OPACITY = 0.5;
/** shiftBody 三 slot flex 比 0.33 / 0.25 / 0.33 */
const NOTE_MID_TOP = `${((0.33 + 0.25) / 0.91) * 100}%`;
const EARLY_SLOT_FRAC = 0.33 / 0.91;
/** 上方備註：仅占提早 slot 上半，避開正班方塊向上延伸 (shiftBadge top: -6.5) */
const NOTE_ABOVE_HEIGHT = `${EARLY_SLOT_FRAC * 0.5 * 100}%`;
const NOTE_TEXT_ROW_MIN_H = Platform.OS === "android" ? 16 : 12;

/** 依區塊在堆疊中的位置決定圓角（僅外緣圓角，銜接處維持直角） */
function blockCorners(top: boolean, bottom: boolean, radius = SLOT_RADIUS): ViewStyle {
  return {
    borderTopLeftRadius: top ? radius : 0,
    borderTopRightRadius: top ? radius : 0,
    borderBottomLeftRadius: bottom ? radius : 0,
    borderBottomRightRadius: bottom ? radius : 0,
  };
}

function isHolidayLike(shift: ShiftItem) {
  return shift.systemTag === "休假" || shift.name === "休假";
}

function leaveTimeRow(time: string, slot: "early" | "late") {
  return (
    <View style={styles.extRow}>
      <View
        style={[
          styles.extEmojiWrap,
          slot === "early" ? styles.leaveEmojiEarly : styles.leaveEmojiLate,
        ]}
      >
        <Text style={styles.extEmoji}>🏖️</Text>
      </View>
      <Text style={[styles.extTime, { color: colors.leave }]} numberOfLines={1} ellipsizeMode="clip">
        {time}
      </Text>
    </View>
  );
}

function overtimeTimeRow(time: string, toneColor: string, slot: "early" | "late") {
  return (
    <View style={styles.extRow}>
      <View
        style={[
          styles.extEmojiWrap,
          slot === "early" ? styles.overtimeEmojiEarly : styles.overtimeEmojiLate,
        ]}
      >
        <Text style={styles.extEmoji}>🕒</Text>
      </View>
      <Text style={[styles.extTime, styles.overtimeTimeText, { color: toneColor }]} numberOfLines={1} ellipsizeMode="clip">
        {time}
      </Text>
    </View>
  );
}

function classTimeRow(time: string, toneColor: string, slot: "early" | "late") {
  return (
    <View style={styles.extRow}>
      <View
        style={[
          styles.extEmojiWrap,
          slot === "early" ? styles.overtimeEmojiEarly : styles.overtimeEmojiLate,
        ]}
      >
        <Text style={styles.extEmoji}>📝</Text>
      </View>
      <Text style={[styles.extTime, styles.overtimeTimeText, { color: toneColor }]} numberOfLines={1} ellipsizeMode="clip">
        {time}
      </Text>
    </View>
  );
}

/** 與 slotMid 正班大方塊相同的背景色 */
function shiftMiddleBackground(shift: ShiftItem): string {
  return shift.color;
}

function holidayShiftBadgeStyle(shift: ShiftItem): ViewStyle {
  return {
    backgroundColor: shift.color,
    borderWidth: 1,
    borderColor: colors.border,
  };
}

function colorWithOpacity(color: string, opacity = EXT_SLOT_BG_OPACITY): string {
  const trimmed = color.trim();
  if (trimmed.startsWith("rgba(")) return trimmed;
  if (trimmed.startsWith("rgb(")) {
    const inner = trimmed.slice(4, -1);
    return `rgba(${inner}, ${opacity})`;
  }
  let hex = trimmed.replace(/^#/, "");
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  if (hex.length === 8) hex = hex.slice(0, 6);
  if (hex.length !== 6) return color;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return color;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function parseRgbComponents(color: string): { r: number; g: number; b: number } | null {
  const trimmed = color.trim();
  if (trimmed.startsWith("rgba(") || trimmed.startsWith("rgb(")) {
    const match = trimmed.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (!match) return null;
    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  let hex = trimmed.replace(/^#/, "");
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  if (hex.length === 8) hex = hex.slice(0, 6);
  if (hex.length !== 6) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

/** 將色票亮度調暗約 47.5%（Tone-on-Tone 深色系文字／圖示用） */
export function darkenColor(color: string, factor = 0.525): string {
  const rgb = parseRgbComponents(color);
  if (!rgb) return color;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${toHex(rgb.r * factor)}${toHex(rgb.g * factor)}${toHex(rgb.b * factor)}`;
}

/** 延伸區背景：正班色 + 50% 透明度（僅背景，不影響內文） */
function shiftExtensionBackground(shift: ShiftItem): string {
  return colorWithOpacity(shiftMiddleBackground(shift));
}

/** 班表／加班方塊浮起陰影（stacked：正班＋加班視為一整塊，加大陰影範圍） */
function scheduleBlockFloat(tintColor?: string, stacked = false): ViewStyle {
  if (Platform.OS === "android") {
    return { elevation: stacked ? 8 : tintColor ? 4 : 3 };
  }
  if (stacked) {
    return {
      shadowColor: darkenColor(tintColor ?? "#0f172a", 0.35),
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
    };
  }
  if (tintColor) {
    return {
      shadowColor: darkenColor(tintColor, 0.35),
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.22,
      shadowRadius: 4,
    };
  }
  return cardShadow(3);
}

/** 加班延伸區：僅半透明淡化，陰影由正班方塊統一投射 */
function OvertimeExtensionBlock({ fadeBg, corners }: { fadeBg: string; corners: ViewStyle }) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.scheduleBlockSurface,
        corners,
        { backgroundColor: fadeBg },
      ]}
      pointerEvents="none"
    />
  );
}

export type ScheduleRipplePulse = {
  date: string;
  color: string;
  key: number;
};

/** 今日整格：單層藍色圓角呼吸外框（僅一般月曆） */
function TodayCellBreathingBorder() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: TODAY_BREATH_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const breathStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + pulse.value * 0.68,
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.todayCellBreathFrame,
        styles.todayCellBreathInset,
        styles.todayCellBreathBorder,
        breathStyle,
      ]}
    />
  );
}

function ScheduleCellRipple({ color, triggerKey }: { color: string; triggerKey: number }) {
  const scale = useSharedValue(0.25);
  const opacity = useSharedValue(0.85);

  useEffect(() => {
    scale.value = 0.5;
    opacity.value = 1;
    scale.value = withTiming(1.4, { duration: 1500, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(0, { duration: 1500, easing: Easing.out(Easing.cubic) });
  }, [triggerKey, scale, opacity]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.scheduleRipple,
        { backgroundColor: colorWithOpacity(color, 1) },
        rippleStyle,
      ]}
    />
  );
}

export type CalendarGridProps = {
  onShiftClick?: (date: Date, existing?: ShiftItem) => void;
  onOvertime?: (date: string, existing?: Overtime, shift?: ShiftItem) => void;
  scheduleMode?: boolean;
  selectedScheduleDate?: string | null;
  onDateSelect?: (dateStr: string) => void;
  /** 僅顯示班表，不處理任何日期點擊（行事曆分頁用）。 */
  readOnly?: boolean;
  /** 非選中日期格略為壓暗（打字機手動編輯用）。 */
  typewriterDim?: boolean;
  /** 左右滑動切換月份（預設開啟） */
  enableMonthSwipe?: boolean;
  /** 手動排班精簡月曆：不顯示加班區、縮短日期格以完整呈現整月 */
  compactSchedule?: boolean;
  /** 精簡月曆填滿可用高度（手動排班內嵌用） */
  compactScheduleFill?: boolean;
  /** 手動排班套用班次時，在該日期格播放 Ripple */
  scheduleRipple?: ScheduleRipplePulse | null;
};

export default function CalendarGrid({
  onShiftClick,
  onOvertime,
  scheduleMode,
  selectedScheduleDate,
  onDateSelect,
  readOnly,
  typewriterDim,
  enableMonthSwipe = true,
  compactSchedule = false,
  compactScheduleFill = false,
  scheduleRipple = null,
}: CalendarGridProps) {
  const compactFill = compactSchedule && compactScheduleFill;
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  /** 手動排班：選中日期跨月時，月曆自動切換到該月 */
  useEffect(() => {
    if (!scheduleMode || !selectedScheduleDate) return;
    const picked = new Date(`${selectedScheduleDate}T12:00:00`);
    if (Number.isNaN(picked.getTime())) return;
    const targetMonth = startOfMonth(picked);
    setCurrentMonth((prev) => (isSameMonth(prev, targetMonth) ? prev : targetMonth));
  }, [scheduleMode, selectedScheduleDate]);

  const goPrevMonth = useCallback(() => {
    setCurrentMonth((m) => addMonths(m, -1));
  }, []);

  const goNextMonth = useCallback(() => {
    setCurrentMonth((m) => addMonths(m, 1));
  }, []);

  const monthSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-28, 28])
        .failOffsetY([-18, 18])
        .onEnd((e) => {
          if (e.translationX <= -50 || e.velocityX <= -450) {
            runOnJS(goNextMonth)();
          } else if (e.translationX >= 50 || e.velocityX >= 450) {
            runOnJS(goPrevMonth)();
          }
        }),
    [goNextMonth, goPrevMonth],
  );
  const { shifts, overtime, settings } = useAppData();
  const handoverEnabled = settings.handoverEnabled;
  const ho = handoverEnabled ? HO : 0;
  const today = formatYMD(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeekMonday(monthStart);
  const gridEnd = addDays(startOfWeekMonday(monthEnd), 6);
  const calendarDays = useMemo(() => eachDayInclusive(gridStart, gridEnd), [gridStart, gridEnd]);
  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) rows.push(calendarDays.slice(i, i + 7));
    return rows;
  }, [calendarDays]);

  const rangeFrom = formatYMD(gridStart);
  const rangeTo = formatYMD(gridEnd);
  const overtimeMap = useMemo(() => {
    const m = new Map<string, Overtime>();
    for (const o of overtime) {
      if (o.date >= rangeFrom && o.date <= rangeTo) m.set(o.date, o);
    }
    return m;
  }, [overtime, rangeFrom, rangeTo]);

  const shiftByDate = useMemo(() => {
    const m = new Map<string, ShiftItem>();
    for (const s of shifts) m.set(s.date, s);
    return m;
  }, [shifts]);

  const displayYear = currentMonth.getFullYear();
  const yearPrefix = String(displayYear).slice(0, -1);

  const calendarBody = (
    <>
      <View style={[styles.monthRow, compactSchedule && styles.monthRowCompact]}>
        <View style={[styles.monthTitleWrap, compactSchedule && styles.monthTitleWrapCompact]}>
          <Text
            style={[styles.monthYear, compactSchedule && styles.monthYearCompact]}
            numberOfLines={1}
          >
            {displayYear}
          </Text>
          <View style={styles.monthLabelRow}>
            <Text
              style={[
                styles.monthYear,
                styles.monthYearSpacer,
                compactSchedule && styles.monthYearCompact,
              ]}
              numberOfLines={1}
            >
              {yearPrefix || "\u2007"}
            </Text>
            <Text
              style={[styles.monthLabel, compactSchedule && styles.monthLabelCompact]}
              numberOfLines={1}
            >
              {currentMonth.getMonth() + 1}月
            </Text>
          </View>
        </View>
        <Pressable onPress={goPrevMonth} style={styles.iconBtn}>
          <Text style={styles.chev}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setCurrentMonth(startOfMonth(new Date()))} style={styles.monthChip}>
          <Text style={styles.monthChipText}>本月</Text>
        </Pressable>
        <Pressable onPress={goNextMonth} style={styles.iconBtn}>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </View>

      <View style={[styles.calendarTable, compactFill && styles.calendarTableFill]}>
        <View style={[styles.dowRow, compactSchedule && styles.dowRowCompact]}>
          {DAY_NAMES.map((name, dowIndex) => (
            <View
              key={name}
              style={[
                styles.dowCellWrap,
                compactSchedule && styles.dowCellWrapCompact,
                dowIndex >= 5 && styles.dowCellWrapWeekend,
              ]}
            >
              <Text
                style={[
                  styles.dowCell,
                  dowIndex >= 5 && styles.dowCellWeekend,
                  compactSchedule && styles.dowCellCompact,
                ]}
              >
                {name}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.calendarShell,
            compactSchedule && styles.calendarShellCompact,
            compactFill && styles.calendarShellFill,
          ]}
        >
          <View
            style={[
              styles.grid,
              compactSchedule && !compactFill && styles.gridCompact,
              compactFill && styles.gridCompactFill,
            ]}
          >
        {weeks.map((week, wi) => (
          <View
            key={wi}
            style={[
              styles.weekRow,
              compactSchedule && !compactFill && styles.weekRowCompact,
              compactFill && styles.weekRowCompactFill,
            ]}
          >
            {week.map((day) => {
              const dateStr = formatYMD(day);
          const isToday = dateStr === today;
          const inCurrentMonth = isSameMonth(day, currentMonth);
          const shift = shiftByDate.get(dateStr);
          const ot = overtimeMap.get(dateStr);

          const isOvertimeMode = !readOnly && !!onOvertime && !onShiftClick && !scheduleMode;
          const isShiftMode = !readOnly && !!onShiftClick && !scheduleMode;
          const isScheduleMode = !readOnly && !!scheduleMode;
          const isWork = !!shift && !isHolidayLike(shift);
          const shiftToneColor = isWork && shift ? darkenColor(shift.color) : undefined;

          const isSelectedScheduleDate = isScheduleMode && selectedScheduleDate === dateStr;
          const dimTypewriter =
            !!typewriterDim && isScheduleMode && !!selectedScheduleDate && inCurrentMonth && dateStr !== selectedScheduleDate;

          const handleCellClick = () => {
            if (!inCurrentMonth) return;
            if (isScheduleMode) onDateSelect?.(dateStr);
            else if (isShiftMode) onShiftClick?.(day, shift);
            else if (isOvertimeMode) onOvertime?.(dateStr, ot, shift);
          };

          const interactive = !readOnly && inCurrentMonth && (isShiftMode || isOvertimeMode || isScheduleMode);

          const leaveStart = compactSchedule ? undefined : ot?.leaveStart ?? undefined;
          const leaveEnd = compactSchedule ? undefined : ot?.leaveEnd ?? undefined;
          const isLeave =
            !compactSchedule && !!(inCurrentMonth && isWork && ot && leaveStart && leaveEnd);
          const lCase =
            isLeave && shift ? leaveCase(shift.startTime, shift.endTime, leaveStart!, leaveEnd!) : 0;
          const showHolidayOtLabel = !!(
            inCurrentMonth &&
            shift &&
            isHolidayLike(shift) &&
            hasHolidayWork(ot)
          );
          const isHolidayWork = !compactSchedule && showHolidayOtLabel;

          let earlyContent: React.ReactNode = null;
          let earlySlotBg: string | undefined;
          if (isHolidayWork && ot) {
            earlyContent = (
              <Text style={styles.holidayOtTime} numberOfLines={1} ellipsizeMode="clip">
                {snapTimeToQuarter(shiftTime(ot.holidayWorkStart!, -ho))}
              </Text>
            );
          } else if (!compactSchedule && isLeave && shift) {
            if (lCase === 12) {
              earlyContent = leaveTimeRow(leaveStart!, "early");
            } else if (lCase === 10) {
              earlyContent = leaveTimeRow(leaveEnd!, "early");
            }
          } else if (!compactSchedule && inCurrentMonth && isWork && ot) {
            const earlyHours = ot.earlyHours ?? 0;
            const earlyClass = ot.earlyClassHours ?? 0;
            if (earlyHours > 0) {
              earlySlotBg = shiftExtensionBackground(shift);
              earlyContent = overtimeTimeRow(shiftTime(shift!.startTime, -(earlyHours + ho)), shiftToneColor!, "early");
            } else if (earlyClass > 0) {
              earlySlotBg = shiftExtensionBackground(shift);
              earlyContent = classTimeRow(shiftTime(shift!.startTime, -(earlyClass + ho)), shiftToneColor!, "early");
            }
          }

          let lateContent: React.ReactNode = null;
          let lateSlotBg: string | undefined;
          if (isHolidayWork && ot) {
            lateContent = (
              <Text style={styles.holidayOtTime} numberOfLines={1} ellipsizeMode="clip">
                {snapTimeToQuarter(shiftTime(ot.holidayWorkEnd!, ho))}
              </Text>
            );
          } else if (!compactSchedule && isLeave && shift) {
            if (lCase === 12) {
              lateContent = leaveTimeRow(leaveEnd!, "late");
            } else if (lCase === 11) {
              lateContent = leaveTimeRow(leaveStart!, "late");
            }
          } else if (!compactSchedule && inCurrentMonth && isWork && ot) {
            const lateHours = ot.lateHours ?? 0;
            const lateClass = ot.lateClassHours ?? 0;
            if (lateHours > 0) {
              lateSlotBg = shiftExtensionBackground(shift);
              lateContent = overtimeTimeRow(shiftTime(shift!.endTime, lateHours + ho), shiftToneColor!, "late");
            } else if (lateClass > 0) {
              lateSlotBg = shiftExtensionBackground(shift);
              lateContent = classTimeRow(shiftTime(shift!.endTime, lateClass + ho), shiftToneColor!, "late");
            }
          }

          const hasEarlyExt = !!earlySlotBg;
          const hasLateExt = !!lateSlotBg;
          const noteText = clampOvertimeNote(ot?.notes?.trim() ?? "");
          const showOvertimeNote =
            isOvertimeMode && !compactSchedule && inCurrentMonth && !!noteText;
          /** 有提早方塊 → 正班下；僅延後方塊 → 正班上；皆無 → 預設正班下 */
          const noteBelowMid = showOvertimeNote && (hasEarlyExt || !hasLateExt);
          const noteAboveMid = showOvertimeNote && hasLateExt && !hasEarlyExt;
          const shiftCorners = blockCorners(!hasEarlyExt, !hasLateExt);
          const hasUnifiedScheduleStack = !!(shift && (hasEarlyExt || hasLateExt));

          let cellBorder: object = styles.cellBorderDefault;
          if (isSelectedScheduleDate) cellBorder = styles.cellSelectedSchedule;

          const weekend = isWeekendDay(day);
          const bgOut = !inCurrentMonth
            ? weekend
              ? styles.cellOutsideWeekend
              : styles.cellOutside
            : weekend
              ? styles.cellInsideWeekend
              : styles.cellInside;
          const holidayChip = getHolidayCalendarChip(dateStr);

          return (
            <Pressable
              key={dateStr}
              onPress={handleCellClick}
              disabled={!interactive}
              style={({ pressed }) => [
                styles.cell,
                compactSchedule && !compactFill && styles.cellCompact,
                compactFill && styles.cellCompactFill,
                bgOut,
                cellBorder,
                dimTypewriter && styles.cellDimTw,
                interactive && pressed && styles.cellPressed,
                compactSchedule && styles.cellCompactClip,
                isToday && !compactSchedule && styles.cellToday,
              ]}
            >
              {isToday && !compactSchedule ? <TodayCellBreathingBorder /> : null}
              {compactSchedule &&
              scheduleRipple?.date === dateStr &&
              inCurrentMonth ? (
                <ScheduleCellRipple color={scheduleRipple.color} triggerKey={scheduleRipple.key} />
              ) : null}
              {compactSchedule ? (
                <View style={styles.cellCompactStack}>
                  <View style={[styles.dateNumWrap, styles.dateNumWrapCompact]}>
                    <Text
                      style={[
                        styles.dateNum,
                        styles.dateNumCompact,
                        !inCurrentMonth && styles.dateMuted,
                        weekend && inCurrentMonth && styles.dateNumWeekend,
                      ]}
                      numberOfLines={1}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                  {shift ? (
                    <View
                      style={[
                        styles.compactShiftBadge,
                        isHolidayLike(shift) ? holidayShiftBadgeStyle(shift) : { backgroundColor: shift.color },
                        scheduleBlockFloat(shift.color),
                      ]}
                    >
                      <Text
                        style={
                          [styles.shiftTextWorkCompact, { color: darkenColor(shift.color) }]
                        }
                        numberOfLines={1}
                        ellipsizeMode="clip"
                      >
                        {showHolidayOtLabel ? "加班" : shiftTwoCharLabel(shift.name)}
                      </Text>
                    </View>
                  ) : inCurrentMonth && isScheduleMode ? (
                    <View style={styles.compactEmptySlot} />
                  ) : null}
                </View>
              ) : (
                <>
              {/* 頂部日期區：與班次內容完全隔離 */}
              <View style={styles.cellHeader}>
                <View style={styles.dateHead}>
                  <View style={styles.dateNumWrap}>
                    <Text
                      style={[
                        styles.dateNum,
                        !inCurrentMonth && styles.dateMuted,
                        weekend && inCurrentMonth && styles.dateNumWeekend,
                      ]}
                      numberOfLines={1}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                  {holidayChip ? (
                    <Text style={[styles.holidayName, { color: holidayChip.color }]}>
                      {holidayChip.label.split("").join("\n")}
                    </Text>
                  ) : null}
                </View>
              </View>

                <View style={styles.shiftBody}>
                  <View style={[styles.slotEarly, earlyContent ? styles.slotEmojiLayer : null]}>
                    {earlySlotBg ? (
                      <OvertimeExtensionBlock
                        fadeBg={earlySlotBg}
                        corners={blockCorners(true, false)}
                      />
                    ) : null}
                    <View style={styles.extInner}>{earlyContent}</View>
                  </View>

                  <View style={styles.slotMid}>
                    {shift && lCase === 9 ? (
                      <View
                        style={[
                          styles.shiftBadge,
                          shiftCorners,
                          { backgroundColor: colors.leaveSoft },
                          scheduleBlockFloat(colors.leaveSoft, hasUnifiedScheduleStack),
                        ]}
                      >
                        <Text
                          style={[styles.shiftTextWork, { color: colors.leaveText, fontWeight: "700" }]}
                          numberOfLines={1}
                          ellipsizeMode="clip"
                        >
                          請假
                        </Text>
                      </View>
                    ) : shift ? (
                      <View
                        style={[
                          styles.shiftBadge,
                          shiftCorners,
                          isHolidayLike(shift) ? holidayShiftBadgeStyle(shift) : { backgroundColor: shift.color },
                          scheduleBlockFloat(
                            isHolidayLike(shift) ? undefined : shift.color,
                            hasUnifiedScheduleStack,
                          ),
                        ]}
                      >
                        <Text
                          style={
                            [styles.shiftTextWork, { color: darkenColor(shift.color) }]
                          }
                          numberOfLines={1}
                          ellipsizeMode="clip"
                        >
                          {showHolidayOtLabel ? "加班" : shiftTwoCharLabel(shift.name)}
                        </Text>
                      </View>
                    ) : inCurrentMonth && (isShiftMode || isScheduleMode) ? (
                      <View style={styles.plusPlaceholder} />
                    ) : null}
                  </View>

                  <View style={[styles.slotLate, lateContent ? styles.slotEmojiLayer : null]}>
                    {lateSlotBg ? (
                      <OvertimeExtensionBlock
                        fadeBg={lateSlotBg}
                        corners={blockCorners(false, true)}
                      />
                    ) : null}
                    <View style={styles.extInner}>{lateContent}</View>
                  </View>

                  {noteAboveMid ? (
                    <View style={[styles.noteShiftOverlay, styles.noteShiftOverlayAbove]} pointerEvents="none">
                      <View style={styles.noteOverlayBgFill} />
                      <View style={[styles.noteTextRow, styles.noteTextRowAbove]}>
                        <MarqueeText key={noteText} text={noteText!} style={styles.noteOverlayText} />
                      </View>
                    </View>
                  ) : null}
                  {noteBelowMid ? (
                    <View style={[styles.noteShiftOverlay, styles.noteShiftOverlayBelow]} pointerEvents="none">
                      <View style={styles.noteOverlayBgFill} />
                      <View style={[styles.noteTextRow, styles.noteTextRowBelow]}>
                        <MarqueeText key={noteText} text={noteText!} style={styles.noteOverlayText} />
                      </View>
                    </View>
                  ) : null}
                </View>
              </>
              )}
            </Pressable>
            );
          })}
          </View>
        ))}
          </View>
        </View>
      </View>
    </>
  );

  const wrapStyle = compactFill ? styles.compactFillWrap : undefined;

  return (
    <View style={compactFill ? styles.compactFillRoot : undefined}>
      <View style={wrapStyle}>
        {enableMonthSwipe ? (
          <GestureDetector gesture={monthSwipeGesture}>
            <View style={compactFill ? styles.compactFillInner : undefined}>{calendarBody}</View>
          </GestureDetector>
        ) : (
          calendarBody
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 6,
  },
  monthTitleWrap: {
    flex: 1,
    justifyContent: "center",
    minHeight: 36,
  },
  monthYear: {
    fontSize: 7.5,
    fontWeight: "500",
    color: colors.muted,
    opacity: 0.65,
    lineHeight: 13,
  },
  monthLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 1,
  },
  monthYearSpacer: {
    opacity: 0,
  },
  monthLabel: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 22,
    marginLeft: -23,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  chev: { fontSize: 18, color: colors.text, marginTop: -2 },
  monthChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.greyBg,
  },
  monthChipText: { fontSize: 12, fontWeight: "600", color: colors.text },
  calendarTable: {
    marginTop: -8,
  },
  calendarTableFill: {
    flex: 1,
    minHeight: 0,
  },
  calendarShell: {
    borderBottomLeftRadius: CALENDAR_SHELL_RADIUS,
    borderBottomRightRadius: CALENDAR_SHELL_RADIUS,
    overflow: "hidden",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  calendarShellCompact: {
    borderBottomLeftRadius: CALENDAR_SHELL_RADIUS_COMPACT,
    borderBottomRightRadius: CALENDAR_SHELL_RADIUS_COMPACT,
  },
  calendarShellFill: {
    flex: 1,
    minHeight: 0,
  },
  dowRow: {
    flexDirection: "row",
    backgroundColor: DOW_ROW_BG,
    borderTopLeftRadius: CALENDAR_SHELL_RADIUS,
    borderTopRightRadius: CALENDAR_SHELL_RADIUS,
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dowRowCompact: {
    borderTopLeftRadius: CALENDAR_SHELL_RADIUS_COMPACT,
    borderTopRightRadius: CALENDAR_SHELL_RADIUS_COMPACT,
  },
  dowCellWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2.5,
  },
  dowCellWrapWeekend: {
    backgroundColor: DOW_WEEKEND_BG,
  },
  dowCell: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  dowCellWeekend: {
    color: "#e11d48",
    opacity: 0.9,
  },
  grid: {},
  weekRow: { flexDirection: "row" },
  cell: {
    flex: 1,
    minHeight: 90,
    flexDirection: "column",
    overflow: "visible",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 2,
    paddingBottom: 2,
    position: "relative",
  },
  cellBorderDefault: {},
  cellOutside: { backgroundColor: "#f8fafc" },
  cellOutsideWeekend: { backgroundColor: WEEKEND_BG_OUT },
  cellInside: { backgroundColor: colors.card },
  cellInsideWeekend: { backgroundColor: WEEKEND_BG },
  dateNumWeekend: { color: "#be123c" },
  cellPressed: { opacity: 0.92 },
  cellDimTw: { opacity: 0.52 },
  cellSelectedSchedule: {
    borderWidth: 2,
    borderColor: colors.teal,
  },
  cellToday: {
    zIndex: 2,
  },
  todayCellBreathFrame: {
    position: "absolute",
    zIndex: 30,
  },
  todayCellBreathInset: {
    top: 2,
    left: 1,
    right: 1,
    bottom: 2,
  },
  todayCellBreathBorder: {
    borderRadius: 11,
    borderWidth: 2,
    borderColor: TODAY_BORDER_BLUE,
    backgroundColor: "transparent",
  },
  cellHeader: {
    flexShrink: 0,
    paddingTop: 0,
    paddingBottom: 0,
    minHeight: 18,
   //overflow: "hidden",//
  },
  dateHead: {
    flexDirection: "row",
    justifyContent: "center", // 🌟 讓裡面的日期數字完美置中
    alignItems: "flex-start",
    width: "100%",            // 🌟 確保箱子撐滿整個格子的寬度
    position: "relative",     // 🌟 這是給等一下的絕對定位當作「座標基準點」
    flexWrap: "nowrap",
    minWidth: 0,
    maxWidth: "100%",
   // overflow: "hidden",//
  },
  dateNumWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 22,
    minHeight: 22,
  },
  dateNum: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    fontFamily: "system-ui",
  },
  dateMuted: { color: "#94a3b8", opacity: 0.7 },
  holidayName: {
    fontSize: 7,
    fontWeight: "400",
    position: "absolute",     // 🌟 魔法咒語：絕對定位！它現在不會擠壓到日期了
    right: -1,                 // 🌟 魔法咒語：死死貼齊格子的最右側 (留 2px 呼吸空間)
    top: -1,                  // (維持您剛才設定好的高度)
    lineHeight: 8,
    flexShrink: 0,
    includeFontPadding: false,
  },
  shiftBody: {
    flex: 1,
    flexDirection: "column",
    minHeight: 0,
    alignSelf: "stretch",
    overflow: "visible",
    position: "relative",
    marginTop: -4,
  },
  slotEarly: {
    flex: 0.33,
    minHeight: 0,
    alignSelf: "center",
    width: "90%",
    overflow: "visible",
    zIndex: 1,
    position: "relative",
  },
  slotEmojiLayer: {
    zIndex: 20,
    elevation: 20,
  },
  slotMid: {
    flex: 0.25,
    minHeight: 0,
    zIndex: 2,
    justifyContent: "center",
    alignItems: "stretch",
    alignSelf: "center",
    width: "90%",
    overflow: "visible",
  },
  slotLate: {
    flex: 0.33,
    minHeight: 0,
    alignSelf: "center",
    width: "90%",
    overflow: "visible",
    zIndex: 1,
    position: "relative",
  },
  scheduleBlockSurface: {
    zIndex: 0,
  },
  extInner: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 0,
    overflow: "visible",
    position: "relative",
    zIndex: 2,
  },
  extRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    maxWidth: "100%",
    overflow: "visible",
  },
  extEmojiWrap: {
    zIndex: 30,
    elevation: 30,
    position: "relative",
    overflow: "visible",
  },
  extEmoji: {
    fontSize: 7,
    lineHeight: 7,
    includeFontPadding: false,
  },
  leaveEmojiEarly: {
    marginTop: -2,
  },
  leaveEmojiLate: {
    marginTop: 2,
  },
  overtimeEmojiEarly: {
    marginTop: -3,
  },
  overtimeEmojiLate: {
    marginTop: 3,
  },
  overtimeTimeText: {
    marginLeft: -3,
  },
  extTime: {
    fontSize: 6.6,
    lineHeight: 7,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "center",
  },
  holidayOtTime: {
    fontSize: 6.6,
    lineHeight: 7,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
  },
  /** 加班請假備註：父層填滿正班上下至格子底／頂 */
  noteShiftOverlay: {
    position: "absolute",
    left: "5%",
    width: "90%",
    zIndex: 10,
    overflow: "visible",
  },
  noteShiftOverlayBelow: {
    top: NOTE_MID_TOP,
    bottom: 0,
  },
  noteShiftOverlayAbove: {
    top: 5,
    height: NOTE_ABOVE_HEIGHT,
  },
  noteOverlayBgFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    borderRadius: 3,
  },
  noteTextRow: {
    position: "absolute",
    left: 0,
    right: 0,
    minHeight: NOTE_TEXT_ROW_MIN_H,
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: Platform.OS === "android" ? 2 : 1,
    zIndex: 1,
    overflow: "visible",
  },
  noteTextRowBelow: {
    top: 0,
  },
  noteTextRowAbove: {
    bottom: 0,
  },
  noteOverlayText: {
    fontSize: Platform.OS === "android" ? 7 : 6.5,
    lineHeight: Platform.OS === "android" ? 12 : 10,
    fontWeight: "500",
    color: colors.muted,
    includeFontPadding: false,
  },
  shiftBadge: {
    position: "absolute",
    top: -6.5,
    bottom: -6.5,
    left: 0,
    right: 0,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  shiftText: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" },
  /** 正班／休假（有色底）：黑字、略小 */
  shiftTextWork: { color: colors.muted, fontSize: 9, fontWeight: "500", textAlign: "center" },
  plusPlaceholder: { flex: 1, width: "100%", minHeight: 8 },
  monthRowCompact: { marginBottom: 4, gap: 4 },
  monthTitleWrapCompact: { minHeight: 32 },
  monthYearCompact: { fontSize: 10, lineHeight: 12 },
  monthLabelCompact: { fontSize: 16, lineHeight: 18, marginLeft: -6 },
  dowCellWrapCompact: { paddingVertical: 2.5 },
  dowCellCompact: { fontSize: 10 },
  compactFillRoot: { flex: 1, minHeight: 0 },
  compactFillWrap: { flex: 1, minHeight: 0, flexDirection: "column" },
  compactFillInner: { flex: 1, minHeight: 0 },
  gridCompact: { flexGrow: 0 },
  gridCompactFill: { flex: 1, minHeight: 0 },
  weekRowCompact: { flexGrow: 0 },
  weekRowCompactFill: { flex: 1, minHeight: 44 },
  cellCompact: {
    height: 46,
    minHeight: 46,
    paddingBottom: 1,
  },
  cellCompactFill: {
    flex: 1,
    minHeight: 44,
  },
  cellCompactClip: { overflow: "hidden" },
  cellCompactStack: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: 0,
    paddingVertical: 2,
    minHeight: 0,
    zIndex: 1,
  },
  scheduleRipple: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    borderRadius: 12,
    overflow: "hidden",
  },
  dateNumWrapCompact: { minWidth: 20, minHeight: 18 },
  dateNumCompact: { fontSize: 14, lineHeight: 16 },
  compactShiftBadge: {
    width: "92%",
    borderRadius: 5,
    paddingVertical: 1,
    paddingHorizontal: 2,
    minHeight: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  compactEmptySlot: {
    width: "92%",
    minHeight: 16,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  shiftTextWorkCompact: { fontSize: 8, fontWeight: "600", textAlign: "center" },
});
