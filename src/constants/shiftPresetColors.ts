import type { ShiftItem, ShiftTemplate, SystemShiftTag } from "@/src/types";

/**
 * 班表 8 色色票（編輯模板／單日班表時的色點）。
 * 修改後請「完全重載 JS」（Expo: `npx expo start -c` 或關 App 重開）。
 * 並遞增 COLOR_PALETTE_VERSION，讓已儲存資料同步到新色盤。
 */
export const COLOR_PALETTE_VERSION = 3;

export const SHIFT_PRESET_COLORS = [
  "#CFE8E6",
  "#F4D8A8",
  "#D9CEF0",
  "#ECEFF1",
  "#D4AFCD",
  "#CAD5CA",
  "#E5CDC8",
  "#E0AFA0",
] as const;

export const SHIFT_SEED_COLOR: Record<SystemShiftTag, string> = {
  早班: SHIFT_PRESET_COLORS[0],
  中班: SHIFT_PRESET_COLORS[1],
  夜班: SHIFT_PRESET_COLORS[2],
  休假: SHIFT_PRESET_COLORS[6],
};

const COLOR_HISTORY_BY_SLOT: readonly string[][] = [
  ["#f59e0b", "#f29d11", "#c4ad8a", "#cfe8e6", "#a9b7aa"],
  ["#11928f", "#8eaaa3", "#fd48a8"],
  ["#6b66e8", "#9a95b0", "#d9cef0"],
  ["#10b981", "#94a895", "#eceff1"],
  ["#ef4444", "#c49a94"],
  ["#3b82f6", "#8fa4b0", "#e4b69e"],
  ["#ec4899", "#e85299", "#b8a0ad", "#bfd1c4"],
  ["#8b5cf6", "#a89cb5"],
];

const MIGRATED_COLOR_LOOKUP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  COLOR_HISTORY_BY_SLOT.forEach((history, slot) => {
    const target = SHIFT_PRESET_COLORS[slot];
    if (!target) return;
    for (const hex of history) {
      map[hex.toLowerCase()] = target;
    }
    map[target.toLowerCase()] = target;
  });
  return map;
})();

export function migrateShiftColor(color: string): string {
  return MIGRATED_COLOR_LOOKUP[color.trim().toLowerCase()] ?? color;
}

export function applyPaletteToTemplates(templates: ShiftTemplate[]): ShiftTemplate[] {
  return templates.map((t) => {
    if (t.systemTag && SHIFT_SEED_COLOR[t.systemTag]) {
      return { ...t, color: SHIFT_SEED_COLOR[t.systemTag] };
    }
    return { ...t, color: migrateShiftColor(t.color) };
  });
}

export function applyPaletteToShifts(shifts: ShiftItem[], templates: ShiftTemplate[]): ShiftItem[] {
  const byTag = new Map<SystemShiftTag, ShiftTemplate>();
  for (const t of templates) {
    if (t.systemTag) byTag.set(t.systemTag, t);
  }
  return shifts.map((s) => {
    if (s.systemTag) {
      const tpl = byTag.get(s.systemTag);
      if (tpl) return { ...s, color: tpl.color, name: tpl.name };
    }
    return { ...s, color: migrateShiftColor(s.color) };
  });
}
