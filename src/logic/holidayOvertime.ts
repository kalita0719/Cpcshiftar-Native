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
const DAY_MS = 1440 * MS_MIN;
const MIN_DURATION_MS = 15 * MS_MIN;

export type OccupiedRange = { startMs: number; endMs: number };

function parseAbs(date: string, time: string): number {
  const d = parseYMD(date);
  const m = timeToMin(snapTimeToQuarter(time));
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d.getTime();
}

/** 單段上下班 → 絕對時間（跨日 end < start 時 end 推到隔日） */
export function spanFromTimes(date: string, startTime: string, endTime: string): OccupiedRange {
  let startMs = parseAbs(date, startTime);
  let endMs = parseAbs(date, endTime);
  if (endMs <= startMs) endMs += DAY_MS;
  return { startMs, endMs };
}

export function rangesOverlap(a: OccupiedRange, b: OccupiedRange): boolean {
  return Math.max(a.startMs, b.startMs) < Math.min(a.endMs, b.endMs);
}

/** 班表結束時間在隔日清晨（如 23:00–07:00） */
function shiftEndsAfterMidnight(shift: Pick<ShiftItem, "startTime" | "endTime">): boolean {
  return timeToMin(shift.endTime) <= timeToMin(shift.startTime);
}

function dayStartMs(ymd: string): number {
  return parseAbs(ymd, "00:00");
}

/** 與 [intervalStart, intervalEnd) 交集；無交集回傳 null */
function clipRangeToInterval(
  r: OccupiedRange,
  intervalStart: number,
  intervalEnd: number,
): OccupiedRange | null {
  const startMs = Math.max(r.startMs, intervalStart);
  const endMs = Math.min(r.endMs, intervalEnd);
  if (startMs >= endMs) return null;
  return { startMs, endMs };
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
 * 休假日重疊檢查用佔用區間。
 * - 休假日當日跨日班：含隔日清晨（5/20 22:45 與 5/21 清晨段）
 * - 前一日跨日班：不含休假日清晨尾段（5/22 夜班不擋 5/23 休假日）
 */
function occupiedRangesForOverlapCheck(
  shift: ShiftItem,
  ot: Overtime | undefined,
  holidayDate: string,
  handoverEnabled: boolean,
): OccupiedRange[] {
  if (isRestDayShift(shift)) return [];

  const raw = getOccupiedRangesForDate(
    shift.date,
    shift,
    ot,
    handoverEnabled,
    false,
    false,
  );
  const holidayStart = dayStartMs(holidayDate);
  const prevD = formatYMD(addDays(parseYMD(holidayDate), -1));

  const out: OccupiedRange[] = [];
  for (const r of raw) {
    if (shift.date === prevD && shiftEndsAfterMidnight(shift)) {
      const eveningOnly = clipRangeToInterval(r, Number.NEGATIVE_INFINITY, holidayStart);
      if (eveningOnly) out.push(eveningOnly);
      continue;
    }
    out.push(r);
  }
  return out;
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
  const { startMs, endMs } = spanFromTimes(date, st, et);
  if (endMs - startMs < MIN_DURATION_MS) return "上班時段至少 15 分鐘";

  const proposed = spanFromTimes(date, st, et);
  const otByDate = new Map(overtime.map((o) => [o.date, o]));

  for (const shift of shifts) {
    const ranges = occupiedRangesForOverlapCheck(
      shift,
      otByDate.get(shift.date),
      date,
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
