import type { ShiftItem, ShiftTemplate } from "@/src/types";
import { effectiveTemplateTimes } from "@/src/types";

/** 判斷日曆班次是否仍使用模板變更前的外觀（名稱／顏色同步用）。 */
export function shiftMatchesTemplateAppearance(
  shift: ShiftItem,
  beforeTemplate: ShiftTemplate,
): boolean {
  if (beforeTemplate.systemTag) return shift.systemTag === beforeTemplate.systemTag;
  if (shift.systemTag) return false;
  if (shift.name !== beforeTemplate.name) return false;
  if (shift.color === beforeTemplate.color) return true;
  const { startTime, endTime } = effectiveTemplateTimes(beforeTemplate);
  return shift.startTime === startTime && shift.endTime === endTime;
}

/** 判斷日曆班次是否仍使用模板變更前的時間（用於時間同步）。 */
export function shiftMatchesTemplateTimes(shift: ShiftItem, beforeTemplate: ShiftTemplate): boolean {
  if (beforeTemplate.systemTag) return shift.systemTag === beforeTemplate.systemTag;
  if (shift.systemTag) return false;
  if (shift.name !== beforeTemplate.name) return false;
  const { startTime, endTime } = effectiveTemplateTimes(beforeTemplate);
  return shift.startTime === startTime && shift.endTime === endTime;
}

/** 模板顏色／名稱變更時，同步已寫入日曆的班次列。 */
export function applyTemplateAppearanceToShifts(
  shifts: ShiftItem[],
  template: ShiftTemplate,
  beforeTemplate: ShiftTemplate,
): ShiftItem[] {
  return shifts.map((s) =>
    shiftMatchesTemplateAppearance(s, beforeTemplate)
      ? { ...s, color: template.color, name: template.name }
      : s,
  );
}

/** 模板上下班時間變更時，同步已寫入日曆的班次列。 */
export function applyTemplateTimesToShifts(
  shifts: ShiftItem[],
  template: ShiftTemplate,
  beforeTemplate: ShiftTemplate,
): ShiftItem[] {
  const { startTime, endTime } = effectiveTemplateTimes(template);
  return shifts.map((s) =>
    shiftMatchesTemplateTimes(s, beforeTemplate) ? { ...s, startTime, endTime } : s,
  );
}
