import { snapTimeToQuarter } from "@/src/components/WheelTimePicker";
import { addDays, formatYMD, parseYMD } from "@/src/logic/dates";
import { isRestDayShift } from "@/src/logic/differentialHours";
import {
    resolveEffectiveShiftTimes,
    shiftMinuteRange,
    workSegmentsAfterLeave,
    type ShiftAllowanceOvertime,
    type ShiftAllowanceShift,
} from "@/src/logic/shiftAllowance";
import { shiftTime, timeToMin } from "@/src/logic/shiftLogic";
import type { Overtime, ShiftItem } from "@/src/types";

const MS_MIN = 60 * 1000;
const MIN_DURATION_MS = 15 * MS_MIN;

export type OccupiedRange = { startMs: number; endMs: number };

function parseAbs(date: string, time: string): number {
  const d = parseYMD(date);
  const m = timeToMin(snapTimeToQuarter(time));
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d.getTime();
}

/** 單段上下班 → 絕對時間。
 * 班表日 = 早上下班日：若結束時刻 ≤ 開始時刻（跨日），開始落在前一日、結束在班表日
 *（例：7/2 的 23:00–08:00 → 7/1 23:00～7/2 08:00）。
 */
export function spanFromTimes(date: string, startTime: string, endTime: string): OccupiedRange {
  const startMin = timeToMin(snapTimeToQuarter(startTime));
  const endMin = timeToMin(snapTimeToQuarter(endTime));
  if (endMin <= startMin) {
    const prev = formatYMD(addDays(parseYMD(date), -1));
    return { startMs: parseAbs(prev, startTime), endMs: parseAbs(date, endTime) };
  }
  return { startMs: parseAbs(date, startTime), endMs: parseAbs(date, endTime) };
}

export function rangesOverlap(a: OccupiedRange, b: OccupiedRange): boolean {
  return Math.max(a.startMs, b.startMs) < Math.min(a.endMs, b.endMs);
}

export function hasHolidayWork(ot?: Overtime | null): boolean {
  return !!(ot?.holidayWorkStart && ot?.holidayWorkEnd);
}

/** 休假日上班時數（15 分鐘刻度） */
export function holidayWorkHours(ot: Pick<Overtime, "holidayWorkStart" | "holidayWorkEnd">): number {
  if (!ot.holidayWorkStart || !ot.holidayWorkEnd) return 0;
  const { startMs, endMs } = spanFromTimes("2000-01-01", ot.holidayWorkStart, ot.holidayWorkEnd);
  return Math.round((endMs - startMs) / MS_MIN) / 60;
}

/** 上班日有請假紀錄。 */
export function hasWorkdayLeave(ot?: Pick<Overtime, "leaveStart" | "leaveEnd"> | null): boolean {
  return !!(ot?.leaveStart && ot?.leaveEnd);
}

/** 列入加班統計／加班費的時數 */
export function recordedOvertimeHours(ot: Overtime, shift?: ShiftItem | null): number {
  if (shift && isRestDayShift(shift) && hasHolidayWork(ot)) {
    return holidayWorkHours(ot);
  }
  return (ot.earlyHours ?? 0) + (ot.lateHours ?? 0);
}

function otAllowanceInput(ot?: Overtime | null): ShiftAllowanceOvertime | null {
  if (!ot) return null;
  return {
    earlyHours: ot.earlyHours,
    lateHours: ot.lateHours,
    earlyClassHours: ot.earlyClassHours,
    lateClassHours: ot.lateClassHours,
  };
}

function segmentsToAbsoluteRanges(
  shiftDate: string,
  scheduledStart: string,
  scheduledEnd: string,
  segments: { start: number; end: number }[],
  effectiveStart: string,
  effectiveEnd: string,
  hasLeave: boolean,
): OccupiedRange[] {
  if (segments.length === 0) return [];
  const ssm = timeToMin(scheduledStart);
  const anchorCoord = hasLeave
    ? timeCoord(scheduledStart, ssm)
    : shiftMinuteRange(effectiveStart, effectiveEnd).start;
  const spanStartMs = spanFromTimes(shiftDate, effectiveStart, effectiveEnd).startMs;
  return segments
    .filter((seg) => seg.end > seg.start)
    .map((seg) => ({
      startMs: spanStartMs + (seg.start - anchorCoord) * MS_MIN,
      endMs: spanStartMs + (seg.end - anchorCoord) * MS_MIN,
    }));
}

function timeCoord(timeStr: string, shiftStartMin: number): number {
  const min = timeToMin(timeStr);
  return min >= shiftStartMin ? min : min + 1440;
}

/**
 * 某日實際佔用時間（班表＋加班＋交接班，或休假日上班時段）。
 * excludeHolidayWork：編輯當日休假日上班時略過舊區段。
 * includeHandover：併入交接班；重疊檢查應為 false。
 */
export function getOccupiedRangesForDate(
  date: string,
  shift: ShiftItem | undefined,
  ot: Overtime | undefined,
  handoverEnabled: boolean,
  excludeHolidayWork = false,
  includeHandover = true,
): OccupiedRange[] {
  if (!shift) return [];
  const applyHandover = includeHandover && handoverEnabled;

  if (isRestDayShift(shift)) {
    if (excludeHolidayWork || !hasHolidayWork(ot)) return [];
    const ho = applyHandover ? 0.25 : 0;
    const st = shiftTime(ot!.holidayWorkStart!, -ho);
    const et = shiftTime(ot!.holidayWorkEnd!, ho);
    return [spanFromTimes(date, st, et)];
  }

  const otInput = otAllowanceInput(ot);
  const effective = resolveEffectiveShiftTimes(
    shift,
    otInput,
    applyHandover,
    ot?.leaveStart,
    ot?.leaveEnd,
  );

  if (ot?.leaveStart && ot?.leaveEnd) {
    const segs = workSegmentsAfterLeave(
      shift.startTime,
      shift.endTime,
      ot.leaveStart,
      ot.leaveEnd,
      effective.startTime,
      effective.endTime,
    );
    return segmentsToAbsoluteRanges(
      shift.date,
      shift.startTime,
      shift.endTime,
      segs,
      effective.startTime,
      effective.endTime,
      true,
    );
  }

  return [spanFromTimes(date, effective.startTime, effective.endTime)];
}

/**
 * 休假日重疊檢查用佔用區間（一般班次；跨日已依「班表日＝早上下班日」展開）。
 */
function occupiedRangesForOverlapCheck(
  shift: ShiftItem,
  ot: Overtime | undefined,
  handoverEnabled: boolean,
): OccupiedRange[] {
  if (isRestDayShift(shift)) return [];
  return getOccupiedRangesForDate(shift.date, shift, ot, handoverEnabled, false, false);
}

/** 休假日上班是否與前後日佔用時段重疊 */
export function validateHolidayWorkOverlap(
  date: string,
  startTime: string,
  endTime: string,
  shifts: ShiftItem[],
  overtime: Overtime[],
  handoverEnabled: boolean,
): string | null {
  const st = snapTimeToQuarter(startTime);
  const et = snapTimeToQuarter(endTime);
  const proposed = spanFromTimes(date, st, et);
  if (proposed.endMs - proposed.startMs < MIN_DURATION_MS) return "上班時段至少 15 分鐘";

  const otByDate = new Map(overtime.map((o) => [o.date, o]));

  for (const shift of shifts) {
    const ranges = occupiedRangesForOverlapCheck(
      shift,
      otByDate.get(shift.date),
      handoverEnabled,
    );
    for (const r of ranges) {
      if (rangesOverlap(proposed, r)) {
        const overlapMs = Math.max(r.startMs, proposed.startMs);
        const d = new Date(overlapMs);
        const overlapOn = formatYMD(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
        return `與 ${overlapOn} 的上班／加班時段重疊，請調整時間`;
      }
    }
  }
  return null;
}

/** 津貼／交接班判定用：休假日上班視為一般班次時段 */
export function buildHolidayAllowanceShift(
  shift: ShiftItem,
  ot: Overtime,
  handoverEnabled: boolean,
): ShiftAllowanceShift {
  const ho = handoverEnabled ? 0.25 : 0;
  const start = ot.holidayWorkStart!;
  const end = ot.holidayWorkEnd!;
  return {
    date: shift.date,
    name: "休假日上班",
    startTime: shiftTime(start, -ho),
    endTime: shiftTime(end, ho),
    leaveStart: null,
    leaveEnd: null,
    overtime: null,
    handoverEnabled,
  };
}

export function isAllowanceEligibleWithHoliday(
  shift: Pick<ShiftItem, "name" | "systemTag">,
  ot?: Overtime | null,
): boolean {
  if (hasHolidayWork(ot)) return true;
  return !isRestDayShift(shift);
}

/** 休假日上班且啟用交接班 → 0.5h（與全日班無請假相同） */
export function holidayHandoverHours(
  shift: ShiftItem | undefined,
  ot: Overtime | undefined,
  handoverEnabled: boolean,
): number {
  if (!handoverEnabled || !shift || !isRestDayShift(shift) || !hasHolidayWork(ot)) return 0;
  return 0.5;
}
