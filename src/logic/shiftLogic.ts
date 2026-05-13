/**
 * 四班三輪 / 週期排班核心：與 old_web_code `artifacts/api-server/src/routes/shifts.ts`
 * 中 `mode: "cycle"` 分支一致——對於從 start 到 end（含）的每一天 i，
 * `pattern[i % pattern.length]` 決定當日模板；`null` 表示休假列（固定色與 00:00–00:00）。
 */
import { addDays, formatYMD, parseYMD, pad2 } from "@/src/logic/dates";

export type CyclePatternEntry = number | null;

export type ShiftTemplateLike = {
  id: number;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
};

export type GeneratedShiftRow = {
  date: string;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
};

const HOLIDAY_NAME = "休假";
const HOLIDAY_COLOR = "#94a3b8";

export function buildCycleShiftRows(
  pattern: CyclePatternEntry[],
  startDate: string,
  endDate: string,
  templateById: Map<number, ShiftTemplateLike>,
  notes?: string | null,
): GeneratedShiftRow[] {
  if (pattern.length < 2) return [];
  const start = parseYMD(startDate);
  const end = parseYMD(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays < 0) return [];

  const rows: GeneratedShiftRow[] = [];
  for (let i = 0; i <= diffDays; i++) {
    const templateId = pattern[i % pattern.length];
    const d = addDays(start, i);
    const dateStr = formatYMD(d);
    if (templateId === null) {
      rows.push({
        date: dateStr,
        name: HOLIDAY_NAME,
        color: HOLIDAY_COLOR,
        startTime: "00:00",
        endTime: "00:00",
        notes: notes ?? null,
      });
    } else {
      const t = templateById.get(templateId);
      if (!t) continue;
      rows.push({
        date: dateStr,
        name: t.name,
        color: t.color,
        startTime: t.startTime,
        endTime: t.endTime,
        notes: notes ?? null,
      });
    }
  }
  return rows;
}

/** Schedule 頁「以圈選區間既有班次為 pattern」循環填滿後續天數（對應 Schedule.tsx handleCycleSubmit）。 */
export function buildRawFillFromExistingPattern(
  loDate: string,
  hiDate: string,
  existingByDate: Map<string, { name: string; color: string; startTime: string; endTime: string }>,
  fillDays: number,
): GeneratedShiftRow[] {
  const lo = loDate <= hiDate ? loDate : hiDate;
  const hi = loDate <= hiDate ? hiDate : loDate;
  const pattern: (GeneratedShiftRow | null)[] = [];
  for (let d = parseYMD(lo); formatYMD(d) <= hi; d = addDays(d, 1)) {
    const ds = formatYMD(d);
    const shift = existingByDate.get(ds);
    if (shift) {
      pattern.push({ date: ds, ...shift, notes: null });
    } else {
      pattern.push(null);
    }
  }
  if (pattern.length === 0) return [];
  const fillShifts: GeneratedShiftRow[] = [];
  const fillStart = addDays(parseYMD(hi), 1);
  for (let i = 0; i < fillDays; i++) {
    const entry = pattern[i % pattern.length];
    if (entry) {
      const dateStr = formatYMD(addDays(fillStart, i));
      fillShifts.push({
        date: dateStr,
        name: entry.name,
        color: entry.color,
        startTime: entry.startTime,
        endTime: entry.endTime,
        notes: entry.notes,
      });
    }
  }
  return fillShifts;
}

/* ── MonthView 時間／請假區段邏輯（原 MonthView.tsx）────────────────── */

export function shiftTime(timeStr: string, deltaHours: number): string {
  if (!timeStr || !timeStr.includes(":")) return timeStr;
  const [h, m] = timeStr.split(":").map(Number);
  const total = ((h * 60 + m + Math.round(deltaHours * 60)) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function timeToMin(t: string): number {
  if (!t || !t.includes(":")) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function timeCoord(timeStr: string, shiftStartMin: number): number {
  const min = timeToMin(timeStr);
  return min >= shiftStartMin ? min : min + 1440;
}

/** 請假區段與班次的幾何關係（原 leaveCase）。 */
export function leaveCase(
  shiftStartTime: string,
  shiftEndTime: string,
  leaveStart: string,
  leaveEnd: string,
): 9 | 10 | 11 | 12 {
  const ssm = timeToMin(shiftStartTime);
  const sc = timeCoord(shiftStartTime, ssm);
  const ec = timeCoord(shiftEndTime, ssm);
  const lsc = timeCoord(leaveStart, ssm);
  const lec = timeCoord(leaveEnd, ssm);
  const startCovered = sc >= lsc && sc <= lec;
  const endCovered = ec >= lsc && ec <= lec;
  if (startCovered && endCovered) return 9;
  if (startCovered) return 10;
  if (endCovered) return 11;
  return 12;
}

/* ── OvertimePay 加班費累進拆段（原 OvertimePay.tsx brackets）──────── */

export function brackets(h: number) {
  return {
    b133: Math.min(h, 2),
    b166: Math.max(Math.min(h, 4) - 2, 0),
    b200: Math.max(h - 4, 0),
  };
}

/* ── 薪資期間（原 Dashboard / OvertimePay getPeriod）──────────────── */

export function getPeriod(startDay: number, offset = 0, ref = new Date()): { from: string; to: string; label: string } {
  const year = ref.getFullYear();
  const month = ref.getMonth();

  if (startDay <= 1) {
    const base = new Date(year, month + offset, 1);
    const y = base.getFullYear();
    const m = base.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    const from = `${y}-${pad2(m + 1)}-01`;
    const to = `${y}-${pad2(m + 1)}-${pad2(dim)}`;
    return { from, to, label: `${y}年${m + 1}月` };
  }

  const day = ref.getDate();
  const periodStart =
    day >= startDay ? new Date(year, month + offset, startDay) : new Date(year, month - 1 + offset, startDay);
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, startDay - 1);

  const from = formatYMD(periodStart);
  const to = formatYMD(periodEnd);
  const label = `${periodStart.getMonth() + 1}/${periodStart.getDate()} ～ ${periodEnd.getMonth() + 1}/${periodEnd.getDate()}`;
  return { from, to, label };
}

export const DAY_WEEK_ZH = ["日", "一", "二", "三", "四", "五", "六"];

export function shortDate(d: string): string {
  const dt = parseYMD(d);
  return `${d.slice(5).replace("-", "/")}(${DAY_WEEK_ZH[dt.getDay()]})`;
}
