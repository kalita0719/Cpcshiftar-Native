import { addDays, formatYMD, parseYMD } from "@/src/logic/dates";
import { bracketOvertimePay } from "@/src/logic/overtimePay";
import { brackets } from "@/src/logic/shiftLogic";
import type { ShiftItem } from "@/src/types";

export const DIFFERENTIAL_HOURS_PER_WEEK = 8;

export function isRestDayShift(shift: Pick<ShiftItem, "name" | "systemTag">): boolean {
  return shift.systemTag === "休假" || shift.name === "休假";
}

/** 週日為一週起點（本地日曆日）。 */
export function startOfWeekSunday(d: Date): Date {
  const day = d.getDay();
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -day);
}

/** 快速排班時寫入的差額工時規劃（週六日期 + 當下休假天數）。 */
export type PlannedDifferentialEntry = {
  date: string;
  restDaysInWeek: number;
};

export type DifferentialOtRow = {
  date: string;
  hours: number;
  restDaysInWeek: number;
  b133: number;
  b166: number;
  b266: number;
};

export type DifferentialOtSummary = {
  rows: DifferentialOtRow[];
  totalHours: number;
  totalPay: number;
  b133: number;
  b166: number;
  b266: number;
};

function emptySummary(): DifferentialOtSummary {
  return {
    rows: [],
    totalHours: 0,
    totalPay: 0,
    b133: 0,
    b166: 0,
    b266: 0,
  };
}

function rowFromRestDays(date: string, restDaysInWeek: number): DifferentialOtRow {
  const { b133, b166, b266 } = brackets(DIFFERENTIAL_HOURS_PER_WEEK);
  return {
    date,
    hours: DIFFERENTIAL_HOURS_PER_WEEK,
    restDaysInWeek,
    b133,
    b166,
    b266,
  };
}

function summarizeRows(rows: DifferentialOtRow[], hourlyRate: number): DifferentialOtSummary {
  const b133 = rows.reduce((s, r) => s + r.b133, 0);
  const b166 = rows.reduce((s, r) => s + r.b166, 0);
  const b266 = rows.reduce((s, r) => s + r.b266, 0);
  return {
    rows,
    totalHours: rows.reduce((s, r) => s + r.hours, 0),
    totalPay: bracketOvertimePay(hourlyRate, { b133, b166, b266 }),
    b133,
    b166,
    b266,
  };
}

/**
 * 依班表規劃差額工時：週日～週六休假日少於 2 天時，該週週六給予 8 小時。
 * 僅在快速排班寫入／覆蓋時呼叫；手動改班不應重算。
 */
export function planDifferentialEntriesFromShifts(
  shifts: ShiftItem[],
  rangeFrom: string,
  rangeTo: string,
): PlannedDifferentialEntry[] {
  if (rangeFrom > rangeTo) return [];

  const shiftByDate = new Map<string, ShiftItem>();
  for (const s of shifts) shiftByDate.set(s.date, s);

  const from = parseYMD(rangeFrom);
  const to = parseYMD(rangeTo);
  const entries: PlannedDifferentialEntry[] = [];

  for (let weekStart = startOfWeekSunday(from); weekStart <= to; weekStart = addDays(weekStart, 7)) {
    const saturday = addDays(weekStart, 6);
    const saturdayYmd = formatYMD(saturday);
    if (saturdayYmd < rangeFrom || saturdayYmd > rangeTo) continue;

    let restDaysInWeek = 0;
    for (let i = 0; i < 7; i++) {
      const shift = shiftByDate.get(formatYMD(addDays(weekStart, i)));
      if (shift && isRestDayShift(shift)) restDaysInWeek++;
    }

    if (restDaysInWeek >= 2) continue;
    entries.push({ date: saturdayYmd, restDaysInWeek });
  }

  return entries;
}

/**
 * 快速排班覆蓋 [coveredFrom, coveredTo] 後，重算與該區間相交的週，並合併進既有規劃。
 * 未相交的週保留原規劃（不受手動改班影響）。
 */
export function mergePlannedDifferentialEntries(
  previous: PlannedDifferentialEntry[],
  shiftsAfterBulk: ShiftItem[],
  coveredFrom: string,
  coveredTo: string,
): PlannedDifferentialEntry[] {
  if (coveredFrom > coveredTo) return previous;

  const coveredFromD = parseYMD(coveredFrom);
  const coveredToD = parseYMD(coveredTo);
  const touchWeekStarts = new Set<string>();

  for (let weekStart = startOfWeekSunday(coveredFromD); ; weekStart = addDays(weekStart, 7)) {
    const saturday = addDays(weekStart, 6);
    if (weekStart > coveredToD) break;
    if (saturday < coveredFromD) continue;
    touchWeekStarts.add(formatYMD(weekStart));
  }

  const kept = previous.filter((e) => {
    const sat = parseYMD(e.date);
    const weekStart = startOfWeekSunday(sat);
    return !touchWeekStarts.has(formatYMD(weekStart));
  });

  const touchFrom = formatYMD(startOfWeekSunday(coveredFromD));
  const touchTo = formatYMD(addDays(startOfWeekSunday(coveredToD), 6));
  const recomputed = planDifferentialEntriesFromShifts(shiftsAfterBulk, touchFrom, touchTo);

  return [...kept, ...recomputed].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 依已規劃的差額工時（非即時班表）彙總薪資期間內金額。
 */
export function summarizePlannedDifferential(
  planned: PlannedDifferentialEntry[],
  periodFrom: string,
  periodTo: string,
  enabled: boolean,
  hourlyRate: number,
): DifferentialOtSummary {
  if (!enabled) return emptySummary();

  const rows = planned
    .filter((e) => e.date >= periodFrom && e.date <= periodTo)
    .map((e) => rowFromRestDays(e.date, e.restDaysInWeek))
    .sort((a, b) => a.date.localeCompare(b.date));

  return summarizeRows(rows, hourlyRate);
}
