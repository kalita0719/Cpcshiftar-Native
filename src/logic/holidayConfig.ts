export const HOLIDAY_LEVELS = {
  STANDARD: { rate: 2.0, label: "國定假日", color: "#EF4444" },
  PREMIUM: { rate: 2.0, label: "特級加碼", color: "#F59E0B", hasBonus: true },
};

export const HOLIDAY_MAP_2026 = {
  // --- Level 2: Premium (特級加碼) ---
  "2026-01-01": { name: "元旦", level: "PREMIUM" },
  "2026-02-16": { name: "除夕", level: "PREMIUM" },
  "2026-02-17": { name: "初一", level: "PREMIUM" },
  "2026-02-18": { name: "初二", level: "PREMIUM" },
  "2026-09-25": { name: "中秋", level: "PREMIUM" },

  // --- Level 1: Standard (標準假日) ---
  "2026-02-28": { name: "和平", level: "STANDARD" },
  "2026-04-04": { name: "兒童", level: "STANDARD" },
  "2026-04-05": { name: "清明", level: "STANDARD" },
  "2026-05-01": { name: "勞動", level: "STANDARD" }, 
  "2026-06-19": { name: "端午", level: "STANDARD" },
  "2026-10-10": { name: "國慶日", level: "STANDARD" },
  "2026-02-15": { name: "小年夜", level: "STANDARD" },
  "2026-02-19": { name: "初三", level: "STANDARD" },// 💡 已統整至此
};

export type HolidayLevelKey = keyof typeof HOLIDAY_LEVELS;

const HOLIDAY_MAP = HOLIDAY_MAP_2026 as Record<
  string,
  { name: string; level: HolidayLevelKey } | undefined
>;

function holidayEntry(ymd: string) {
  return HOLIDAY_MAP[ymd] ?? null;
}

/** STANDARD 或 PREMIUM 國定假日（皆可能有國定假日加班費；PREMIUM 另含獎工）。 */
export function getNationalHoliday(ymd: string): { name: string; level: HolidayLevelKey } | null {
  const entry = holidayEntry(ymd);
  if (!entry || (entry.level !== "STANDARD" && entry.level !== "PREMIUM")) return null;
  return { name: entry.name, level: entry.level };
}

/** @deprecated 請改用 getNationalHoliday */
export function getStandardNationalHoliday(ymd: string): { name: string } | null {
  const h = getNationalHoliday(ymd);
  if (!h || h.level !== "STANDARD") return null;
  return { name: h.name };
}

/** 行事曆用：依 YYYY-MM-DD 查節日；目前僅 `HOLIDAY_MAP_2026` 有資料，其餘日期回傳 null。 */
export function getHolidayCalendarChip(ymd: string): { label: string; color: string } | null {
  const entry = holidayEntry(ymd);
  if (!entry) return null;
  const spec = HOLIDAY_LEVELS[entry.level];
  if (!spec) return null;
  return {
    label: [...entry.name].slice(0, 2).join(""),
    color: spec.color,
  };
}
