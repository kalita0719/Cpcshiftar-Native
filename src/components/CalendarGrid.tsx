import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import { leaveCase, shiftTime } from "@/src/logic/shiftLogic";
import { colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";
import type { Overtime, ShiftItem } from "@/src/types";

const DAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];
const LEAVE_COLOR = "#ec4899";
const HO = 0.25;

function isHolidayLike(shift: ShiftItem) {
  return shift.systemTag === "休假" || shift.name === "休假";
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
          if (isLeave && shift && lCase !== 12) {
            if (lCase === 9) {
              earlyContent = (
                <View style={[styles.subBadge, { backgroundColor: "#fce7f3" }]}>
                  <Palmtree size={11} color={LEAVE_COLOR} />
                  <Text style={[styles.subTime, { color: LEAVE_COLOR }]}>{leaveStart}</Text>
                </View>
              );
            } else if (lCase === 10) {
              earlyContent = (
                <View style={[styles.subBadge, { backgroundColor: "#fce7f3" }]}>
                  <Palmtree size={11} color={LEAVE_COLOR} />
                  <Text style={[styles.subTime, { color: LEAVE_COLOR }]}>{leaveEnd}</Text>
                </View>
              );
            }
          } else if (inCurrentMonth && isWork && ot) {
            const earlyHours = ot.earlyHours ?? 0;
            const earlyClass = ot.earlyClassHours ?? 0;
            if (earlyHours > 0) {
              earlyContent = (
                <View style={[styles.subBadge, { backgroundColor: "#ffedd5" }]}>
                  <Clock size={11} color="#ea580c" />
                  <Text style={[styles.subTime, { color: "#c2410c" }]}>
                    {shiftTime(shift!.startTime, -(earlyHours + ho))}
                  </Text>
                </View>
              );
            } else if (earlyClass > 0) {
              earlyContent = (
                <View style={[styles.subBadge, { backgroundColor: "#dbeafe" }]}>
                  <FileText size={11} color="#2563eb" />
                  <Text style={[styles.subTime, { color: "#1d4ed8" }]}>
                    {shiftTime(shift!.startTime, -(earlyClass + ho))}
                  </Text>
                </View>
              );
            }
          }

          let lateContent: React.ReactNode = null;
          if (isLeave && shift && lCase !== 12) {
            if (lCase === 9) {
              lateContent = (
                <View style={[styles.subBadge, { backgroundColor: "#fce7f3" }]}>
                  <Palmtree size={11} color={LEAVE_COLOR} />
                  <Text style={[styles.subTime, { color: LEAVE_COLOR }]}>{leaveEnd}</Text>
                </View>
              );
            } else if (lCase === 11) {
              lateContent = (
                <View style={[styles.subBadge, { backgroundColor: "#fce7f3" }]}>
                  <Palmtree size={11} color={LEAVE_COLOR} />
                  <Text style={[styles.subTime, { color: LEAVE_COLOR }]}>{leaveStart}</Text>
                </View>
              );
            }
          } else if (inCurrentMonth && isWork && ot) {
            const lateHours = ot.lateHours ?? 0;
            const lateClass = ot.lateClassHours ?? 0;
            if (lateHours > 0) {
              lateContent = (
                <View style={[styles.subBadge, { backgroundColor: "#fef3c7" }]}>
                  <Clock size={11} color="#d97706" />
                  <Text style={[styles.subTime, { color: "#b45309" }]}>
                    {shiftTime(shift!.endTime, lateHours + ho)}
                  </Text>
                </View>
              );
            } else if (lateClass > 0) {
              lateContent = (
                <View style={[styles.subBadge, { backgroundColor: "#e0e7ff" }]}>
                  <FileText size={11} color="#4f46e5" />
                  <Text style={[styles.subTime, { color: "#4338ca" }]}>
                    {shiftTime(shift!.endTime, lateClass + ho)}
                  </Text>
                </View>
              );
            }
          }

          let cellBorder: object = styles.cellBorderDefault;
          if (isSelectedScheduleDate) cellBorder = styles.cellSelectedSchedule;
          else if (isToday) cellBorder = styles.cellToday;

          const bgOut = !inCurrentMonth ? styles.cellOutside : styles.cellInside;

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
              <View style={styles.dateRow}>
                <Text
                  style={[
                    styles.dateNum,
                    isToday && styles.dateToday,
                    !inCurrentMonth && styles.dateMuted,
                  ]}
                >
                  {day.getDate()}
                </Text>
                {inCurrentMonth && !ot && isOvertimeMode && (
                  <View style={styles.otHint}>
                    <Clock size={10} color={colors.muted} />
                    <Text style={styles.otHintText}>加班</Text>
                  </View>
                )}
              </View>

              <View style={styles.stack}>
                <View style={styles.slot}>{earlyContent}</View>

                {shift && lCase === 9 ? (
                  <View style={[styles.shiftBadge, { backgroundColor: LEAVE_COLOR }]}>
                    <Text style={styles.shiftText}>請假</Text>
                  </View>
                ) : shift ? (
                  <View
                    style={[
                      styles.shiftBadge,
                      isHolidayLike(shift) ? styles.shiftHoliday : { backgroundColor: shift.color },
                    ]}
                  >
                    <Text
                      style={[styles.shiftText, isHolidayLike(shift) && { color: colors.muted }]}
                    >
                      {shift.name}
                    </Text>
                  </View>
                ) : inCurrentMonth && (isShiftMode || isScheduleMode) ? (
                  <View style={styles.plusPlaceholder} />
                ) : null}

                <View style={styles.slot}>{lateContent}</View>
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
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 2,
    paddingBottom: 4,
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
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 2,
  },
  dateNum: { fontSize: 18, fontWeight: "700", color: colors.text },
  dateToday: { color: "#ef4444" },
  dateMuted: { color: "#94a3b8", opacity: 0.7 },
  otHint: { flexDirection: "row", alignItems: "center", gap: 2, opacity: 0.45 },
  otHintText: { fontSize: 9, color: colors.muted },
  stack: { flex: 1, gap: 3, marginTop: 2 },
  slot: { minHeight: 20, justifyContent: "center" },
  subBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  subTime: { fontSize: 11, fontWeight: "600" },
  shiftBadge: {
    borderRadius: 6,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  shiftHoliday: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  plusPlaceholder: { flex: 1, minHeight: 24 },
});
