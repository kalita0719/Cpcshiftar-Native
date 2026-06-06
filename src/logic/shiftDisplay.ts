/** 行事曆方塊／班次選擇鈕：≤2 字全顯；>2 字取第 1、第 3 字。 */
export function shiftTwoCharLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  if (trimmed.length <= 2) return trimmed;
  return trimmed[0] + (trimmed[2] ?? "");
}
