import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Clock, FileText, Palmtree } from "lucide-react-native";
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
import { leaveCase, shiftTime } from "@/src/logic/shiftLogic";
import { colors, fontCalendarDateCondensed } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";
import type { Overtime, ShiftItem } from "@/src/types";

const DAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];
const LEAVE_COLOR = "#ec4899";
const HO = 0.25;
const SLOT_RADIUS = 12;
const SHIFT_HOLIDAY_BG = "#f1f5f9";
const EXT_SLOT_BG_OPACITY = 0.5;

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

/** 與 slotMid 正班大方塊相同的背景色 */
function shiftMiddleBackground(shift: ShiftItem): string {
  return isHolidayLike(shift) ? SHIFT_HOLIDAY_BG : shift.color;
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

/** 延伸區背景：正班色 + 50% 透明度（僅背景，不影響內文） */
function shiftExtensionBackground(shift: ShiftItem): string {
  return colorWithOpacity(shiftMiddleBackground(shift));
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
};

export default function CalendarGrid({
  onShiftClick,
  onOvertime,
  scheduleMode,
  selectedScheduleDate,
  onDateSelect,
  readOnly,
  typewriterDim,
}: CalendarGridProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
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

  return (
    <View>
      <View style={styles.monthRow}>
        <Text style={styles.monthTitle}>
          {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
        </Text>
        <Pressable onPress={() => setCurrentMonth(addMonths(currentMonth, -1))} style={styles.iconBtn}>
          <Text style={styles.chev}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setCurrentMonth(startOfMonth(new Date()))} style={styles.monthChip}>
          <Text style={styles.monthChipText}>本月</Text>
        </Pressable>
        <Pressable onPress={() => setCurrentMonth(addMonths(currentMonth, 1))} style={styles.iconBtn}>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </View>

      <View style={styles.dowRow}>
        {DAY_NAMES.map((name) => (
          <Text key={name} style={styles.dowCell}>
            {name}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
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

          const leaveStart = ot?.leaveStart ?? undefined;
          const leaveEnd = ot?.leaveEnd ?? undefined;
          const isLeave = !!(inCurrentMonth && isWork && ot && leaveStart && leaveEnd);
          const lCase =
            isLeave && shift ? leaveCase(shift.startTime, shift.endTime, leaveStart!, leaveEnd!) : 0;

          let earlyContent: React.ReactNode = null;
          let earlySlotBg: string | undefined;
          if (isLeave && shift && lCase !== 12 && lCase !== 9) {
            if (lCase === 10) {
              earlySlotBg = shiftExtensionBackground(shift);
              earlyContent = (
                <Text style={[styles.extTime, { color: LEAVE_COLOR }]} numberOfLines={1} ellipsizeMode="clip">
                  {leaveEnd}
                </Text>
              );
            }
          } else if (inCurrentMonth && isWork && ot) {
            const earlyHours = ot.earlyHours ?? 0;
            const earlyClass = ot.earlyClassHours ?? 0;
            if (earlyHours > 0) {
              earlySlotBg = shiftExtensionBackground(shift);
              earlyContent = (
                <View style={styles.extRow}>
                  <Clock size={9} color="#ea580c" />
                  <Text style={[styles.extTime, { color: "#c2410c" }]} numberOfLines={1} ellipsizeMode="clip">
                    {shiftTime(shift!.startTime, -(earlyHours + ho))}
                  </Text>
                </View>
              );
            } else if (earlyClass > 0) {
              earlySlotBg = shiftExtensionBackground(shift);
              earlyContent = (
                <View style={styles.extRow}>
                  <FileText size={9} color="#2563eb" />
                  <Text style={[styles.extTime, { color: "#1d4ed8" }]} numberOfLines={1} ellipsizeMode="clip">
                    {shiftTime(shift!.startTime, -(earlyClass + ho))}
                  </Text>
                </View>
              );
            }
          }

          let lateContent: React.ReactNode = null;
          let lateSlotBg: string | undefined;
          if (isLeave && shift && lCase !== 12 && lCase !== 9) {
            if (lCase === 11) {
              lateSlotBg = shiftExtensionBackground(shift);
              lateContent = (
                <Text style={[styles.extTime, { color: LEAVE_COLOR }]} numberOfLines={1} ellipsizeMode="clip">
                  {leaveStart}
                </Text>
              );
            }
          } else if (inCurrentMonth && isWork && ot) {
            const lateHours = ot.lateHours ?? 0;
            const lateClass = ot.lateClassHours ?? 0;
            if (lateHours > 0) {
              lateSlotBg = shiftExtensionBackground(shift);
              lateContent = (
                <View style={styles.extRow}>
                  <Clock size={9} color="#d97706" />
                  <Text style={[styles.extTime, { color: "#b45309" }]} numberOfLines={1} ellipsizeMode="clip">
                    {shiftTime(shift!.endTime, lateHours + ho)}
                  </Text>
                </View>
              );
            } else if (lateClass > 0) {
              lateSlotBg = shiftExtensionBackground(shift);
              lateContent = (
                <View style={styles.extRow}>
                  <FileText size={9} color="#4f46e5" />
                  <Text style={[styles.extTime, { color: "#4338ca" }]} numberOfLines={1} ellipsizeMode="clip">
                    {shiftTime(shift!.endTime, lateClass + ho)}
                  </Text>
                </View>
              );
            }
          }

          const showLeaveGhost = !!(isLeave && shift && lCase !== 9);
          const hasEarlyExt = !!earlySlotBg;
          const hasLateExt = !!lateSlotBg;
          const shiftCorners = blockCorners(!hasEarlyExt, !hasLateExt);

          let cellBorder: object = styles.cellBorderDefault;
          if (isSelectedScheduleDate) cellBorder = styles.cellSelectedSchedule;
          else if (isToday) cellBorder = styles.cellToday;

          const bgOut = !inCurrentMonth ? styles.cellOutside : styles.cellInside;
          const holidayChip = getHolidayCalendarChip(dateStr);

          return (
            <Pressable
              key={dateStr}
              onPress={handleCellClick}
              disabled={!interactive}
              style={({ pressed }) => [
                styles.cell,
                bgOut,
                cellBorder,
                dimTypewriter && styles.cellDimTw,
                interactive && pressed && styles.cellPressed,
              ]}
            >
              {/* 頂部日期區：與班次內容完全隔離 */}
              <View style={styles.cellHeader}>
                <View style={styles.dateHead}>
                  <Text
                    style={[
                      styles.dateNum,
                      isToday && styles.dateToday,
                      !inCurrentMonth && styles.dateMuted,
                    ]}
                    numberOfLines={1}
                  >
                    {day.getDate()}
                  </Text>
                  {holidayChip ? (
                    <Text
                      style={[styles.holidayName, { color: holidayChip.color }]}
                      numberOfLines={1}
                      ellipsizeMode="clip"
                    >
                      {holidayChip.label}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* 班次內容區：1 : 2 : 1 垂直比例 */}
              <View style={styles.shiftBody}>
                {showLeaveGhost ? (
                  <View style={styles.leaveGhost} pointerEvents="none">
                    <Palmtree size={11} color={LEAVE_COLOR} />
                  </View>
                ) : null}

                <View style={styles.slotEarly}>
                  {earlySlotBg ? (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: earlySlotBg },
                        blockCorners(true, false),
                      ]}
                      pointerEvents="none"
                    />
                  ) : null}
                  <View style={styles.extInner}>{earlyContent}</View>
                </View>

                <View style={styles.slotMid}>
                  {shift && lCase === 9 ? (
                    <View
                      style={[styles.shiftBadge, shiftCorners, { backgroundColor: LEAVE_COLOR }]}
                    >
                      <Text style={styles.shiftText} numberOfLines={1} ellipsizeMode="clip">
                        請假
                      </Text>
                    </View>
                  ) : shift ? (
                    <View
                      style={[
                        styles.shiftBadge,
                        shiftCorners,
                        isHolidayLike(shift) ? styles.shiftHoliday : { backgroundColor: shift.color },
                      ]}
                    >
                      <Text
                        style={isHolidayLike(shift) ? styles.shiftTextHoliday : styles.shiftTextWork}
                        numberOfLines={1}
                        ellipsizeMode="clip"
                      >
                        {shift.name}
                      </Text>
                    </View>
                  ) : inCurrentMonth && (isShiftMode || isScheduleMode) ? (
                    <View style={styles.plusPlaceholder} />
                  ) : null}
                </View>

                <View style={styles.slotLate}>
                  {lateSlotBg ? (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: lateSlotBg },
                        blockCorners(false, true),
                      ]}
                      pointerEvents="none"
                    />
                  ) : null}
                  <View style={styles.extInner}>{lateContent}</View>
                </View>
              </View>
            </Pressable>
            );
          })}
          </View>
        ))}
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
  monthTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.text },
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
  dowRow: { flexDirection: "row", marginBottom: 4 },
  dowCell: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: colors.teal,
    opacity: 0.75,
    paddingVertical: 4,
  },
  grid: {},
  weekRow: { flexDirection: "row" },
  cell: {
    flex: 1,
    minHeight: 102,
    flexDirection: "column",
    overflow: "hidden",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  cellBorderDefault: {},
  cellOutside: { backgroundColor: "#f8fafc" },
  cellInside: { backgroundColor: colors.card },
  cellPressed: { opacity: 0.92 },
  cellDimTw: { opacity: 0.52 },
  cellToday: {
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  cellSelectedSchedule: {
    borderWidth: 2,
    borderColor: colors.teal,
  },
  cellHeader: {
    flexShrink: 0,
    paddingTop: 2,
    paddingBottom: 2,
    minHeight: 18,
    overflow: "hidden",
  },
  dateHead: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "nowrap",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },
  dateNum: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    ...(fontCalendarDateCondensed ? { fontFamily: fontCalendarDateCondensed } : {}),
  },
  dateToday: { color: "#ef4444" },
  dateMuted: { color: "#94a3b8", opacity: 0.7 },
  holidayName: {
    fontSize: 9,
    fontWeight: "700",
    marginLeft: 0.5,
    flexShrink: 0,
    includeFontPadding: false,
  },
  shiftBody: {
    flex: 1,
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
    position: "relative",
  },
  leaveGhost: {
    position: "absolute",
    right: 2,
    bottom: 1,
    zIndex: 2,
  },
  slotEarly: {
    flex: 0.33,
    minHeight: 0,
    alignSelf: "center",
    width: "90%",
    overflow: "hidden",
  },
  slotMid: {
    flex: 0.25,
    minHeight: 0,
    zIndex: 10, // 👈 2. 加這行！確保出界的背景蓋在最上層，不會被加班框擋住
    justifyContent: "center",
    alignItems: "stretch",
    alignSelf: "center",
    width: "90%",
  },
  slotLate: {
    flex: 0.33,
    minHeight: 0,
    alignSelf: "center",
    width: "90%",
    overflow: "hidden",
  },
  extInner: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 0,
  },
  extRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    maxWidth: "100%",
    overflow: "hidden",
  },
  extTime: {
    fontSize: 6.6,
    lineHeight: 7,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "center",
  },
  shiftBadge: {
    position: "absolute", // 👈 3. 大絕招：絕對定位！不被父框框限制
    top: -6.5,             // 👈 4. 往上突破 12 像素 (覺得不夠長可以改 -15)
    bottom: -6.5,          // 👈 5. 往下突破 12 像素 (覺得不夠長可以改 -15)
    left: 0,
    right: 0,
    borderRadius: 12,     // 👈 6. 直接在這裡給它漂亮的膠囊圓角！
    alignItems: "center",
    justifyContent: "center",
    // overflow: "hidden", // 🚫 這裡如果有這行，也請刪除
  },
  shiftHoliday: {
    backgroundColor: SHIFT_HOLIDAY_BG,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftText: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" },
  /** 正班（有色底）：黑字、略小 */
  shiftTextWork: { color: colors.muted, fontSize: 9, fontWeight: "500", textAlign: "center" },
  shiftTextHoliday: { color: colors.muted, fontSize: 9, fontWeight: "500", textAlign: "center" },
  plusPlaceholder: { flex: 1, width: "100%", minHeight: 8 },
});
