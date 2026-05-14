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
  notes?: string | null;
  createdAt: string;
};

export type AppSettings = {
  baseSalary: string;
  startDay: string;
  handoverEnabled: boolean;
  midAllowance: string;
  nightAllowance: string;
  nextShiftId: number;
  nextTemplateId: number;
  nextOvertimeId: number;
};
