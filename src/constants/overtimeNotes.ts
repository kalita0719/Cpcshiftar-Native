/** 加班／請假備註字數上限 */
export const OVERTIME_NOTE_MAX_LENGTH = 30;

export function clampOvertimeNote(text: string): string {
  return text.slice(0, OVERTIME_NOTE_MAX_LENGTH);
}
