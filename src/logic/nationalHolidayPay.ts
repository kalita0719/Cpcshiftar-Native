import { isRestDayShift } from "@/src/logic/differentialHours";
import {
  getNationalHoliday,
  type HolidayLevelKey,
} from "@/src/logic/holidayConfig";
import { workSegmentsAfterLeave } from "@/src/logic/shiftAllowance";
import type { Overtime, ShiftItem } from "@/src/types";

export const NATIONAL_HOLIDAY_REST_HOURS = 8;
export const PREMIUM_AWARD_MAX_HOURS = 8;

export type NationalHolidayPayRowKind = "national" | "award";

export type NationalHolidayPayRow = {
  date: string;
  holidayName: string;
  level: HolidayLevelKey;
  kind: NationalHolidayPayRowKind;
  hours: number;
  pay: number;
  isRestDay: boolean;
};

export type NationalHolidayPaySummary = {
  rows: NationalHolidayPayRow[];
  totalHours: number;
  totalPay: number;
};

/** 上班日實際工時（班表扣除請假；不含交接班與額外加班）。 */
function workDayScheduledHours(shift: ShiftItem, ot?: Overtime | null): number {
  const segments = workSegmentsAfterLeave(
    shift.startTime,
    shift.endTime,
    ot?.leaveStart,
    ot?.leaveEnd,
    shift.startTime,
    shift.endTime,
  );
  const minutes = segments.reduce((s, seg) => s + Math.max(0, seg.end - seg.start), 0);
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * 國定假日加班費時數（STANDARD／PREMIUM 相同）：
 * 上班日＝實際上班；休假日＝固定 8 小時。
 */
export function nationalHolidayWorkHours(shift: ShiftItem, ot?: Overtime | null): number {
  if (isRestDayShift(shift)) return NATIONAL_HOLIDAY_REST_HOURS;
  return workDayScheduledHours(shift, ot);
}

/**
 * PREMIUM 獎工：計算方式同國定假日加班費之上班日規則，上限 8h；休假日不給。
 */
export function premiumAwardWorkHours(shift: ShiftItem, ot?: Overtime | null): number {
  if (isRestDayShift(shift)) return 0;
  const h = workDayScheduledHours(shift, ot);
  if (h <= 0) return 0;
  return Math.min(h, PREMIUM_AWARD_MAX_HOURS);
}

export function computeNationalHolidayPay(
  periodShifts: ShiftItem[],
  overtimeByDate: Map<string, Overtime>,
  hourlyRate: number,
): NationalHolidayPaySummary {
  const rows: NationalHolidayPayRow[] = [];

  for (const shift of periodShifts) {
    const holiday = getNationalHoliday(shift.date);
    if (!holiday) continue;

    const ot = overtimeByDate.get(shift.date);
    const isRestDay = isRestDayShift(shift);
    const nationalHours = nationalHolidayWorkHours(shift, ot);
    if (nationalHours > 0) {
      rows.push({
        date: shift.date,
        holidayName: holiday.name,
        level: holiday.level,
        kind: "national",
        hours: nationalHours,
        pay: hourlyRate * nationalHours,
        isRestDay,
      });
    }

    if (holiday.level === "PREMIUM") {
      const awardHours = premiumAwardWorkHours(shift, ot);
      if (awardHours > 0) {
        rows.push({
          date: shift.date,
          holidayName: holiday.name,
          level: holiday.level,
          kind: "award",
          hours: awardHours,
          pay: hourlyRate * awardHours,
          isRestDay: false,
        });
      }
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "national" ? -1 : 1));

  return {
    rows,
    totalHours: rows.reduce((s, r) => s + r.hours, 0),
    totalPay: rows.reduce((s, r) => s + r.pay, 0),
  };
}
