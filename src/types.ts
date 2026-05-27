/** Immutable core identity for built-in templates (第二標籤 / system tag). */
export type SystemShiftTag = "早班" | "中班" | "夜班" | "休假";

export type ShiftItem = {
  id: number;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  date: string;
  notes?: string | null;
  createdAt: string;
  /** When set (e.g. from a 休假 template), time fields are hidden in the shift editor. */
  systemTag?: SystemShiftTag;
};

export type ShiftTemplate = {
  id: number;
  name: string;
  color: string;
  /** Null when `systemTag === "休假"` — no meaningful time range. */
  startTime: string | null;
  endTime: string | null;
  notes?: string | null;
  createdAt: string;
  /** Present on built-in rows; omitted for user-created templates. */
  systemTag?: SystemShiftTag;
  isFixed: boolean;
};

/** Calendar / cycle code paths still use concrete HH:mm strings. */
export function effectiveTemplateTimes(t: Pick<ShiftTemplate, "startTime" | "endTime" | "systemTag">): {
  startTime: string;
  endTime: string;
} {
  if (t.systemTag === "休假") return { startTime: "00:00", endTime: "00:00" };
  const s = t.startTime ?? "00:00";
  const e = t.endTime ?? "00:00";
  return { startTime: s, endTime: e };
}

export type Overtime = {
  id: number;
  date: string;
  hours: number;
  earlyHours: number;
  lateHours: number;
  earlyClassHours: number;
  lateClassHours: number;
  leaveStart?: string | null;
  leaveEnd?: string | null;
  /** 休假日上班時段（僅班別為休假時使用） */
  holidayWorkStart?: string | null;
  holidayWorkEnd?: string | null;
  notes?: string | null;
  createdAt: string;
};

/** 快速排班自訂輪班 DNA（M/A/N/O）。 */
export type RotationSlotCode = "M" | "A" | "N" | "O";

export type SavedCustomRotation = {
  dna: RotationSlotCode[];
  updatedAt: string;
};

export type AppSettings = {
  baseSalary: string;
  startDay: string;
  handoverEnabled: boolean;
  /** 週休少於 2 日時，於該週週六給予 8h 差額工時（依一般加班費計算）。 */
  differentialHoursEnabled: boolean;
  /** 啟用國定假日額外加班費（2×／獎工）計算。 */
  nationalHolidayOvertimeEnabled: boolean;
  midAllowance: string;
  nightAllowance: string;
  nextShiftId: number;
  nextTemplateId: number;
  nextOvertimeId: number;
  /** 已套用的班表色盤版本；低於 constants 內 COLOR_PALETTE_VERSION 時會重同步顏色。 */
  shiftColorPaletteVersion?: number;
};
