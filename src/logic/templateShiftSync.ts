import type { ShiftItem, ShiftTemplate } from "@/src/types";
import { effectiveTemplateTimes } from "@/src/types";

/** 判斷日曆上的班次是否由該模板產生（或對應同一系統班別）。 */
export function shiftMatchesTemplate(
  shift: ShiftItem,
  template: ShiftTemplate,
  previousColor?: string,
): boolean {
  if (template.systemTag) return shift.systemTag === template.systemTag;
  if (shift.systemTag) return false;
  if (shift.name !== template.name) return false;
  if (previousColor !== undefined && shift.color === previousColor) return true;
  const { startTime, endTime } = effectiveTemplateTimes(template);
  return shift.startTime === startTime && shift.endTime === endTime;
}

/** 模板顏色／名稱變更時，同步已寫入日曆的班次列。 */
export function applyTemplateAppearanceToShifts(
  shifts: ShiftItem[],
  template: ShiftTemplate,
  previousColor: string,
): ShiftItem[] {
  return shifts.map((s) =>
    shiftMatchesTemplate(s, template, previousColor)
      ? { ...s, color: template.color, name: template.name }
      : s,
  );
}
