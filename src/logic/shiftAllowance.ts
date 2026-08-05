import { addDays, formatYMD, parseYMD } from "@/src/logic/dates";
import { isRestDayShift } from "@/src/logic/differentialHours";
import { leaveCase, shiftTime, timeToMin } from "@/src/logic/shiftLogic";
import type { Overtime, ShiftItem } from "@/src/types";

const DAY = 1440;
const MID_WIN_START = 17 * 60; // 1020
const MID_WIN_END = DAY; // 1440
const MID_MIN_WORK = 240; // 嚴格 > 4h
const MID_END_MIN = 21 * 60; // 1260，結束須 > 21:00
const NIGHT_TODAY_END = 9 * 60; // 540，00:00～09:00
const NIGHT_TOMORROW_END = DAY + 9 * 60; // 1980，跨日翌日 00:00～09:00
const NIGHT_MIN_WORK = 240;

export type ShiftAllowanceInput = {
  startTime: string;
  endTime: string;
};

export type ShiftAllowanceLeave = {
  leaveStart?: string | null;
  leaveEnd?: string | null;
};

/** 當日加班／上課（與行事曆顯示邏輯一致） */
export type ShiftAllowanceOvertime = {
  earlyHours?: number;
  lateHours?: number;
  earlyClassHours?: number;
  lateClassHours?: number;
};

export type ShiftAllowanceShift = ShiftAllowanceInput &
  ShiftAllowanceLeave & {
    date: string;
    name: string;
    overtime?: ShiftAllowanceOvertime | null;
    handoverEnabled?: boolean;
  };

export type ShiftAllowanceFlags = {
  hasMiddleAllowance: boolean;
  hasNightAllowance: boolean;
};

export type AllowanceDetailRow = {
  date: string;
  midAmount: number;
  nightAmount: number;
};

export type PeriodAllowanceBreakdown = {
  rows: AllowanceDetailRow[];
  midCount: number;
  nightCount: number;
  midPay: number;
  nightPay: number;
  totalPay: number;
};

export type AllowanceRates = {
  midPerShift: number;
  nightPerShift: number;
};

type MinuteSegment = { start: number; end: number };

function timeCoord(timeStr: string, shiftStartMin: number): number {
  const min = timeToMin(timeStr);
  return min >= shiftStartMin ? min : min + 1440;
}

/** 上班起點座標；case 11 交接班提早若落在下一圈，改以班表上班為準 */
function workStartCoord(scEff: number, sc: number): number {
  if (scEff >= sc && scEff < DAY) return scEff;
  return sc;
}

/** 班次分鐘區間；end <= start 視為跨日，end += 1440 */
export function shiftMinuteRange(startTime: string, endTime: string): { start: number; end: number } {
  let start = timeToMin(startTime);
  let end = timeToMin(endTime);
  if (end <= start) end += DAY;
  return { start, end };
}

function intersectLen(segStart: number, segEnd: number, winStart: number, winEnd: number): number {
  const a = Math.max(segStart, winStart);
  const b = Math.min(segEnd, winEnd);
  return Math.max(0, b - a);
}

function todaySegment(start: number, end: number): MinuteSegment | null {
  if (start >= DAY) return null;
  return { start: Math.max(0, start), end: Math.min(end, DAY) };
}

function tomorrowSegment(start: number, end: number): MinuteSegment | null {
  if (end <= DAY) return null;
  return { start: Math.max(DAY, start), end };
}

type AbsoluteRange = { startMs: number; endMs: number };

function parseDateTimeMs(date: string, time: string): number {
  const d = parseYMD(date);
  const m = timeToMin(time);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d.getTime();
}

/**
 * 有效上下班 → 絕對時間。
 * 班表日 = 早上下班日：跨日班（如 23:00–08:00）為前一日傍晚開工、班表日清晨結束
 *（例：7/2 夜班 → 7/1 23:00～7/2 08:00）。
 */
function resolveWorkAbsoluteSpan(
  shiftDate: string,
  effectiveStart: string,
  effectiveEnd: string,
): AbsoluteRange {
  const startMin = timeToMin(effectiveStart);
  const endMin = timeToMin(effectiveEnd);
  if (endMin <= startMin) {
    const prev = formatYMD(addDays(parseYMD(shiftDate), -1));
    return {
      startMs: parseDateTimeMs(prev, effectiveStart),
      endMs: parseDateTimeMs(shiftDate, effectiveEnd),
    };
  }
  return {
    startMs: parseDateTimeMs(shiftDate, effectiveStart),
    endMs: parseDateTimeMs(shiftDate, effectiveEnd),
  };
}

function calendarYmdFromMs(ms: number): string {
  const d = new Date(ms);
  return formatYMD(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** 夜班津貼歸屬日：實際開始上班的日曆日（跨日夜班為前一日）。 */
function resolveNightAllowanceDate(
  shift: ShiftAllowanceShift,
  workRanges: AbsoluteRange[],
): string {
  if (workRanges.length > 0) {
    const startMs = Math.min(...workRanges.map((r) => r.startMs));
    return calendarYmdFromMs(startMs);
  }
  const effective = resolveEffectiveShiftTimes(
    shift,
    shift.overtime,
    shift.handoverEnabled,
    shift.leaveStart,
    shift.leaveEnd,
  );
  if (timeToMin(effective.endTime) <= timeToMin(effective.startTime)) {
    return prevDateStr(shift.date);
  }
  return shift.date;
}

/** 請假後實際上班區段 → 絕對時間（與 workSegmentsAfterLeave 座標一致） */
function workAbsoluteRangesAfterLeave(shift: ShiftAllowanceShift): AbsoluteRange[] {
  const segments = workSegmentsForAllowanceShift(shift);
  if (segments.length === 0) return [];

  const effective = resolveEffectiveShiftTimes(
    shift,
    shift.overtime,
    shift.handoverEnabled,
    shift.leaveStart,
    shift.leaveEnd,
  );
  const hasLeave = !!(shift.leaveStart && shift.leaveEnd);
  // 無請假：與 shiftMinuteRange 一致；有請假：與 workSegmentsAfterLeave 的 timeCoord 一致
  const anchorCoord = hasLeave
    ? timeCoord(shift.startTime, timeToMin(shift.startTime))
    : shiftMinuteRange(effective.startTime, effective.endTime).start;
  const spanStartMs = resolveWorkAbsoluteSpan(shift.date, effective.startTime, effective.endTime).startMs;

  return segments.map((seg) => ({
    startMs: spanStartMs + (seg.start - anchorCoord) * 60 * 1000,
    endMs: spanStartMs + (seg.end - anchorCoord) * 60 * 1000,
  }));
}

function qualifiesNightFromAbsoluteRanges(workRanges: AbsoluteRange[], shiftDate: string): boolean {
  const base = parseYMD(shiftDate);
  for (let delta = -1; delta <= 1; delta++) {
    const d = formatYMD(addDays(base, delta));
    if (nightMinutesOnAbsoluteCalendarDate(workRanges, d) >= NIGHT_MIN_WORK) return true;
  }
  return false;
}

function nightMinutesOnAbsoluteCalendarDate(ranges: AbsoluteRange[], targetDate: string): number {
  const dayStart = parseYMD(targetDate).getTime();
  const winStart = dayStart;
  const winEnd = dayStart + NIGHT_TODAY_END * 60 * 1000;
  let totalMs = 0;
  for (const r of ranges) {
    totalMs += Math.max(0, Math.min(r.endMs, winEnd) - Math.max(r.startMs, winStart));
  }
  return totalMs / (60 * 1000);
}

function midMinutesOnAbsoluteCalendarDate(ranges: AbsoluteRange[], targetDate: string): number {
  const dayStart = parseYMD(targetDate).getTime();
  const winStart = dayStart + MID_WIN_START * 60 * 1000;
  const winEnd = dayStart + DAY * 60 * 1000;
  let totalMs = 0;
  for (const r of ranges) {
    totalMs += Math.max(0, Math.min(r.endMs, winEnd) - Math.max(r.startMs, winStart));
  }
  return totalMs / (60 * 1000);
}

function qualifiesMidOnAbsoluteCalendarDate(ranges: AbsoluteRange[], targetDate: string): boolean {
  if (midMinutesOnAbsoluteCalendarDate(ranges, targetDate) <= MID_MIN_WORK) return false;
  const dayStart = parseYMD(targetDate).getTime();
  const winStart = dayStart + MID_WIN_START * 60 * 1000;
  const winEnd = dayStart + DAY * 60 * 1000;
  const endThreshold = dayStart + MID_END_MIN * 60 * 1000;
  let maxEndInWindow = dayStart;
  for (const r of ranges) {
    const a = Math.max(r.startMs, winStart);
    const b = Math.min(r.endMs, winEnd);
    if (b > a) maxEndInWindow = Math.max(maxEndInWindow, b);
  }
  return maxEndInWindow > endThreshold;
}

function qualifiesMidFromAbsoluteRanges(workRanges: AbsoluteRange[], shiftDate: string): boolean {
  const base = parseYMD(shiftDate);
  for (let delta = -1; delta <= 0; delta++) {
    const d = formatYMD(addDays(base, delta));
    if (qualifiesMidOnAbsoluteCalendarDate(workRanges, d)) return true;
  }
  return false;
}

/**
 * 中班津貼歸屬日曆日：班表日與前一日中，取 17:00–24:00 符合中班條件且工時最多者
 * （例：5/5 夜班提早加班、5/4 19:45 起 → 5/4 中班）
 */
function resolveMiddleAllowanceDate(shiftDate: string, workRanges: AbsoluteRange[]): string | null {
  let bestDate: string | null = null;
  let bestMins = 0;
  const base = parseYMD(shiftDate);
  for (let delta = -1; delta <= 0; delta++) {
    const d = formatYMD(addDays(base, delta));
    if (!qualifiesMidOnAbsoluteCalendarDate(workRanges, d)) continue;
    const mins = midMinutesOnAbsoluteCalendarDate(workRanges, d);
    if (mins > bestMins) {
      bestMins = mins;
      bestDate = d;
    }
  }
  return bestDate;
}

/**
 * 津貼判定用有效上下班時間：班表時間 ± 加班，延後／提早有加班時併入交接班 0.25h（與 CalendarGrid 一致）。
 */
export function resolveEffectiveShiftTimes(
  shift: ShiftAllowanceInput,
  ot?: ShiftAllowanceOvertime | null,
  handoverEnabled = false,
  leaveStart?: string | null,
  leaveEnd?: string | null,
): { startTime: string; endTime: string } {
  const ho = handoverEnabled ? 0.25 : 0;
  const earlyH = (ot?.earlyHours ?? 0) + (ot?.earlyClassHours ?? 0);
  const lateH = (ot?.lateHours ?? 0) + (ot?.lateClassHours ?? 0);
  let startTime = shift.startTime;
  let endTime = shift.endTime;
  if (earlyH > 0) startTime = shiftTime(shift.startTime, -(earlyH + ho));
  if (lateH > 0) endTime = shiftTime(shift.endTime, lateH + ho);

  if (handoverEnabled && ho > 0 && leaveStart && leaveEnd) {
    const lc = leaveCase(shift.startTime, shift.endTime, leaveStart, leaveEnd);
    // 該側已有加班／上課時，交接班已併入 earlyH/lateH，勿再加一次
    if (lc === 10 && lateH === 0) endTime = shiftTime(endTime, ho);
    else if (lc === 11 && earlyH === 0) startTime = shiftTime(startTime, -ho);
    else if (lc === 12 && lateH === 0) endTime = shiftTime(endTime, ho);
  }
  return { startTime, endTime };
}

export type DisplayShiftTimesOvertime = Pick<
  Overtime,
  | "earlyHours"
  | "lateHours"
  | "earlyClassHours"
  | "lateClassHours"
  | "holidayWorkStart"
  | "holidayWorkEnd"
  | "leaveStart"
  | "leaveEnd"
>;

/** 首頁／儀表板顯示用上下班時間（含加班、上課、交接班；休假日上班另計）。 */
export function getDisplayShiftTimes(
  shift: Pick<ShiftItem, "name" | "systemTag" | "startTime" | "endTime">,
  ot: DisplayShiftTimesOvertime | null | undefined,
  handoverEnabled: boolean,
): { startTime: string; endTime: string; changed: boolean } {
  const ho = handoverEnabled ? 0.25 : 0;

  if (isRestDayShift(shift) && ot?.holidayWorkStart && ot?.holidayWorkEnd) {
    return {
      startTime: shiftTime(ot.holidayWorkStart, -ho),
      endTime: shiftTime(ot.holidayWorkEnd, ho),
      changed: true,
    };
  }

  if (isRestDayShift(shift)) {
    return { startTime: shift.startTime, endTime: shift.endTime, changed: false };
  }

  const hasLeave = !!(ot?.leaveStart && ot?.leaveEnd);
  const otInput: ShiftAllowanceOvertime | null = ot
    ? {
        earlyHours: ot.earlyHours,
        lateHours: ot.lateHours,
        earlyClassHours: ot.earlyClassHours,
        lateClassHours: ot.lateClassHours,
      }
    : null;
  const earlyH = (ot?.earlyHours ?? 0) + (ot?.earlyClassHours ?? 0);
  const lateH = (ot?.lateHours ?? 0) + (ot?.lateClassHours ?? 0);

  let { startTime, endTime } = resolveEffectiveShiftTimes(
    shift,
    otInput,
    handoverEnabled,
    ot?.leaveStart,
    ot?.leaveEnd,
  );

  if (handoverEnabled && ho > 0 && earlyH === 0 && lateH === 0 && !hasLeave) {
    startTime = shiftTime(shift.startTime, -ho);
    endTime = shiftTime(shift.endTime, ho);
  }

  const changed = startTime !== shift.startTime || endTime !== shift.endTime;
  return { startTime, endTime, changed };
}

/** 首頁班次標題旁注記：因加班、上課或請假（含休假日上班）而調整顯示時間時回傳對應標籤。 */
export function getScheduleChangeLabels(
  shift: Pick<ShiftItem, "name" | "systemTag" | "startTime" | "endTime">,
  ot: DisplayShiftTimesOvertime | null | undefined,
  handoverEnabled: boolean,
): string {
  if (!ot || !getDisplayShiftTimes(shift, ot, handoverEnabled).changed) return "";

  const labels: string[] = [];

  if (isRestDayShift(shift)) {
    if (ot.holidayWorkStart && ot.holidayWorkEnd) labels.push("（加班）");
    return labels.join("");
  }

  if (ot.leaveStart && ot.leaveEnd) {
    labels.push("（請假）");
  }
  if ((ot.earlyHours ?? 0) > 0 || (ot.lateHours ?? 0) > 0) labels.push("（加班）");
  if ((ot.earlyClassHours ?? 0) > 0 || (ot.lateClassHours ?? 0) > 0) labels.push("（上課）");

  return labels.join("");
}

/**
 * 扣除請假後的實際上班區段。
 * 請假幾何以班表上下班為準；加班／交接班僅延伸有效上下班（請假後的上班結束可延後）。
 */
export function workSegmentsAfterLeave(
  scheduledStart: string,
  scheduledEnd: string,
  leaveStart?: string | null,
  leaveEnd?: string | null,
  effectiveStart?: string,
  effectiveEnd?: string,
): MinuteSegment[] {
  const workStartStr = effectiveStart ?? scheduledStart;
  const workEndStr = effectiveEnd ?? scheduledEnd;

  if (!leaveStart || !leaveEnd) {
    const r = shiftMinuteRange(workStartStr, workEndStr);
    return r.end > r.start ? [{ start: r.start, end: r.end }] : [];
  }

  const lc = leaveCase(scheduledStart, scheduledEnd, leaveStart, leaveEnd);
  if (lc === 9) return [];

  const ssm = timeToMin(scheduledStart);
  const sc = timeCoord(scheduledStart, ssm);
  const ecWork = timeCoord(workEndStr, ssm);
  const lsc = timeCoord(leaveStart, ssm);
  const lec = timeCoord(leaveEnd, ssm);
  const scEff = timeCoord(workStartStr, ssm);

  if (lc === 10) {
    return lec < ecWork ? [{ start: lec, end: ecWork }] : [];
  }
  if (lc === 11) {
    const start = workStartCoord(scEff, sc);
    return start < lsc ? [{ start, end: lsc }] : [];
  }

  const segs: MinuteSegment[] = [];
  const segStart = workStartCoord(scEff, sc);
  if (segStart < lsc) segs.push({ start: segStart, end: lsc });
  if (lec < ecWork) segs.push({ start: lec, end: ecWork });
  return segs;
}

function qualifiesMiddleInToday(today: MinuteSegment): boolean {
  const workStart = Math.max(today.start, MID_WIN_START);
  const workEnd = Math.min(today.end, MID_WIN_END);
  const duration = workEnd - workStart;
  if (duration <= MID_MIN_WORK) return false;
  return workEnd > MID_END_MIN;
}

function qualifiesNightInWindow(segStart: number, segEnd: number, winStart: number, winEnd: number): boolean {
  return intersectLen(segStart, segEnd, winStart, winEnd) >= NIGHT_MIN_WORK;
}

function qualifiesMiddleFromSegments(segments: MinuteSegment[]): boolean {
  for (const seg of segments) {
    const today = todaySegment(seg.start, seg.end);
    if (today && qualifiesMiddleInToday(today)) return true;
  }
  return false;
}

function qualifiesNightFromSegments(segments: MinuteSegment[]): boolean {
  for (const seg of segments) {
    const today = todaySegment(seg.start, seg.end);
    const tomorrow = tomorrowSegment(seg.start, seg.end);
    if (today && qualifiesNightInWindow(today.start, today.end, 0, NIGHT_TODAY_END)) return true;
    if (tomorrow && qualifiesNightInWindow(tomorrow.start, tomorrow.end, DAY, NIGHT_TOMORROW_END)) return true;
  }
  return false;
}

function applyCrossDayOverride(segments: MinuteSegment[], hasMiddle: boolean, hasNight: boolean): ShiftAllowanceFlags {
  if (!hasMiddle) return { hasMiddleAllowance: false, hasNightAllowance: hasNight };

  const crossesDay = segments.some((s) => s.end > DAY);
  if (!crossesDay) return { hasMiddleAllowance: true, hasNightAllowance: hasNight };

  let tomorrowNightWork = 0;
  for (const seg of segments) {
    const tom = tomorrowSegment(seg.start, seg.end);
    if (tom) tomorrowNightWork += intersectLen(tom.start, tom.end, DAY, NIGHT_TOMORROW_END);
  }

  if (tomorrowNightWork < NIGHT_MIN_WORK) {
    return { hasMiddleAllowance: false, hasNightAllowance: true };
  }
  return { hasMiddleAllowance: true, hasNightAllowance: hasNight };
}

/** 依實際上班區段判定津貼 */
export function evaluateAllowancesFromWorkSegments(segments: MinuteSegment[]): ShiftAllowanceFlags {
  if (segments.length === 0) {
    return { hasMiddleAllowance: false, hasNightAllowance: false };
  }
  const hasMiddle = qualifiesMiddleFromSegments(segments);
  const hasNight = qualifiesNightFromSegments(segments);
  return applyCrossDayOverride(segments, hasMiddle, hasNight);
}

/**
 * 依實際上下班時間判定單日中班／夜班津貼（與班次名稱、標籤無關）。
 */
export function evaluateShiftAllowances(startTime: string, endTime: string): ShiftAllowanceFlags {
  const { start, end } = shiftMinuteRange(startTime, endTime);
  return evaluateAllowancesFromWorkSegments([{ start, end }]);
}

function prevDateStr(date: string): string {
  return formatYMD(addDays(parseYMD(date), -1));
}

/**
 * 帶前一日班次上下文，避免相鄰班次重複計入夜班津貼。
 */
function workSegmentsForAllowanceShift(shift: ShiftAllowanceShift): MinuteSegment[] {
  const effective = resolveEffectiveShiftTimes(
    shift,
    shift.overtime,
    shift.handoverEnabled,
    shift.leaveStart,
    shift.leaveEnd,
  );
  return workSegmentsAfterLeave(
    shift.startTime,
    shift.endTime,
    shift.leaveStart,
    shift.leaveEnd,
    effective.startTime,
    effective.endTime,
  );
}

function shouldSuppressNightAsDuplicate(
  shift: ShiftAllowanceShift,
  workRanges: AbsoluteRange[],
  previousDayShift: ShiftAllowanceShift,
  prevWorkRanges: AbsoluteRange[],
): boolean {
  const prevSegments = workSegmentsForAllowanceShift(previousDayShift);
  const prevFlags = evaluateAllowancesFromWorkSegments(prevSegments);
  const prevHasNight =
    prevFlags.hasNightAllowance ||
    qualifiesNightFromAbsoluteRanges(prevWorkRanges, previousDayShift.date);
  if (!prevHasNight) return false;

  const curMorning = nightMinutesOnAbsoluteCalendarDate(workRanges, shift.date);
  return previousDayShift.date === shift.date && curMorning > 0;
}

function mergeDetailRow(
  rows: AllowanceDetailRow[],
  date: string,
  patch: Partial<Pick<AllowanceDetailRow, "midAmount" | "nightAmount">>,
) {
  const existing = rows.find((r) => r.date === date);
  if (existing) {
    existing.midAmount += patch.midAmount ?? 0;
    existing.nightAmount += patch.nightAmount ?? 0;
  } else {
    rows.push({
      date,
      midAmount: patch.midAmount ?? 0,
      nightAmount: patch.nightAmount ?? 0,
    });
  }
}

function buildAllowanceRowsForShift(
  shift: ShiftAllowanceShift,
  rates: AllowanceRates,
  previousDayShift?: ShiftAllowanceShift | null,
): AllowanceDetailRow[] {
  const segments = workSegmentsForAllowanceShift(shift);
  const workRanges = workAbsoluteRangesAfterLeave(shift);
  const flags = evaluateAllowancesFromWorkSegments(segments);
  const hasMid =
    flags.hasMiddleAllowance || qualifiesMidFromAbsoluteRanges(workRanges, shift.date);
  const hasNight =
    flags.hasNightAllowance || qualifiesNightFromAbsoluteRanges(workRanges, shift.date);

  const midDate = hasMid ? resolveMiddleAllowanceDate(shift.date, workRanges) : null;
  /** 夜班津貼歸屬開始上班日（例：7/2 夜班 23:00–08:00 → 津貼記在 7/1） */
  let nightDate = hasNight ? resolveNightAllowanceDate(shift, workRanges) : null;
  if (
    nightDate &&
    previousDayShift &&
    shouldSuppressNightAsDuplicate(
      shift,
      workRanges,
      previousDayShift,
      workAbsoluteRangesAfterLeave(previousDayShift),
    )
  ) {
    nightDate = null;
  }

  const out: AllowanceDetailRow[] = [];
  if (midDate) {
    mergeDetailRow(out, midDate, { midAmount: rates.midPerShift, nightAmount: 0 });
  }
  if (nightDate) {
    mergeDetailRow(out, nightDate, { midAmount: 0, nightAmount: rates.nightPerShift });
  }
  return out;
}

export function evaluateShiftAllowancesWithContext(
  shift: ShiftAllowanceShift,
  previousDayShift?: ShiftAllowanceShift | null,
): ShiftAllowanceFlags {
  const rows = buildAllowanceRowsForShift(shift, { midPerShift: 1, nightPerShift: 1 }, previousDayShift);
  return {
    hasMiddleAllowance: rows.some((r) => r.midAmount > 0),
    hasNightAllowance: rows.some((r) => r.nightAmount > 0),
  };
}

export function isAllowanceEligibleShift(name: string): boolean {
  return name !== "休假";
}

/** 同一日期只保留一筆班次，避免重排班表後重複計入津貼 */
export function dedupeShiftsByDate<T extends { date: string }>(shifts: T[]): T[] {
  const map = new Map<string, T>();
  for (const s of shifts) map.set(s.date, s);
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** 單日津貼金額（0 或單次津貼） */
export function allowanceAmountsForShift(
  shift: ShiftAllowanceShift,
  rates: AllowanceRates,
  previousDayShift?: ShiftAllowanceShift | null,
): { midAmount: number; nightAmount: number } {
  const rows = buildAllowanceRowsForShift(shift, rates, previousDayShift);
  return {
    midAmount: rows.reduce((s, r) => s + r.midAmount, 0),
    nightAmount: rows.reduce((s, r) => s + r.nightAmount, 0),
  };
}

/** 一期津貼明細與合計（夜班津貼歸屬實際開始上班日） */
export function buildPeriodAllowanceBreakdown(
  shifts: ShiftAllowanceShift[],
  rates: AllowanceRates,
): PeriodAllowanceBreakdown {
  const rows: AllowanceDetailRow[] = [];
  let midCount = 0;
  let nightCount = 0;
  let midPay = 0;
  let nightPay = 0;

  const deduped = dedupeShiftsByDate(shifts);
  for (let i = 0; i < deduped.length; i++) {
    const s = deduped[i];
    if (!isAllowanceEligibleShift(s.name)) continue;
    const prev =
      i > 0 && prevDateStr(s.date) === deduped[i - 1].date ? deduped[i - 1] : undefined;
    const shiftRows = buildAllowanceRowsForShift(s, rates, prev);
    for (const row of shiftRows) {
      if (row.midAmount <= 0 && row.nightAmount <= 0) continue;
      if (row.midAmount > 0) midCount += 1;
      if (row.nightAmount > 0) nightCount += 1;
      midPay += row.midAmount;
      nightPay += row.nightAmount;
      mergeDetailRow(rows, row.date, {
        midAmount: row.midAmount,
        nightAmount: row.nightAmount,
      });
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  return {
    rows,
    midCount,
    nightCount,
    midPay,
    nightPay,
    totalPay: midPay + nightPay,
  };
}

/** @deprecated 請改用 buildPeriodAllowanceBreakdown */
export function countPeriodAllowances(
  shifts: ShiftAllowanceShift[],
): { midCount: number; nightCount: number } {
  const { midCount, nightCount } = buildPeriodAllowanceBreakdown(shifts, {
    midPerShift: 1,
    nightPerShift: 1,
  });
  return { midCount, nightCount };
}
