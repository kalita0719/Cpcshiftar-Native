import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clampOvertimeNote } from "@/src/constants/overtimeNotes";
import { formatYMD } from "@/src/logic/dates";
import {
  mergePlannedDifferentialEntries,
  planDifferentialEntriesFromShifts,
  type PlannedDifferentialEntry,
} from "@/src/logic/differentialHours";
import { type GeneratedShiftRow } from "@/src/logic/shiftLogic";
import {
  applyTemplateAppearanceToShifts,
  applyTemplateTimesToShifts,
} from "@/src/logic/templateShiftSync";
import {
  applyPaletteToShifts,
  applyPaletteToTemplates,
  COLOR_PALETTE_VERSION,
  migrateShiftColor,
  SHIFT_SEED_COLOR,
} from "@/src/constants/shiftPresetColors";
import type {
  AppSettings,
  Overtime,
  RotationSlotCode,
  SavedCustomRotation,
  ShiftItem,
  ShiftTemplate,
  SystemShiftTag,
} from "@/src/types";

const STORAGE_KEY = "cpc_native_app_v1";

const defaultSettings = (): AppSettings => ({
  baseSalary: "40000",
  startDay: "8",
  handoverEnabled: true,
  differentialHoursEnabled: false,
  nationalHolidayOvertimeEnabled: false,
  disasterStopOvertimeEnabled: false,
  midAllowance: "200",
  nightAllowance: "450",
  nextShiftId: 1,
  nextTemplateId: 5,
  nextOvertimeId: 1,
  shiftColorPaletteVersion: COLOR_PALETTE_VERSION,
});

function seedTemplates(now: string): ShiftTemplate[] {
  return [
    {
      id: 1,
      name: "早班",
      color: SHIFT_SEED_COLOR.早班,
      startTime: "07:00",
      endTime: "15:00",
      notes: null,
      createdAt: now,
      systemTag: "早班",
      isFixed: true,
    },
    {
      id: 2,
      name: "中班",
      color: SHIFT_SEED_COLOR.中班,
      startTime: "15:00",
      endTime: "23:00",
      notes: null,
      createdAt: now,
      systemTag: "中班",
      isFixed: true,
    },
    {
      id: 3,
      name: "夜班",
      color: SHIFT_SEED_COLOR.夜班,
      startTime: "23:00",
      endTime: "07:00",
      notes: null,
      createdAt: now,
      systemTag: "夜班",
      isFixed: true,
    },
    {
      id: 4,
      name: "休假",
      color: SHIFT_SEED_COLOR.休假,
      startTime: null,
      endTime: null,
      notes: null,
      createdAt: now,
      systemTag: "休假",
      isFixed: true,
    },
  ];
}

function readSystemTag(o: Record<string, unknown>): SystemShiftTag | undefined {
  const st = o.systemTag;
  return st === "早班" || st === "中班" || st === "夜班" || st === "休假" ? st : undefined;
}

/** AsyncStorage rows saved before `isFixed` existed. */
function templatesStorageIsLegacy(rows: unknown[]): boolean {
  return rows.some((raw) => {
    if (!raw || typeof raw !== "object") return true;
    return !Object.prototype.hasOwnProperty.call(raw, "isFixed");
  });
}

function parseTemplateRowLoose(raw: unknown, now: string): ShiftTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "number" ? o.id : null;
  if (id == null) return null;
  const name = typeof o.name === "string" ? o.name : "";
  const color = typeof o.color === "string" ? o.color : "#64748b";
  const notes = o.notes === null || o.notes === undefined ? null : String(o.notes);
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : now;
  const startTime = typeof o.startTime === "string" ? o.startTime : "09:00";
  const endTime = typeof o.endTime === "string" ? o.endTime : "17:00";
  return { id, name, color, startTime, endTime, notes, createdAt, systemTag: undefined, isFixed: false };
}

function parseTemplateRowStrict(raw: unknown, now: string): ShiftTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "number" ? o.id : null;
  if (id == null) return null;
  const name = typeof o.name === "string" ? o.name : "";
  const color = typeof o.color === "string" ? o.color : "#64748b";
  const notes = o.notes === null || o.notes === undefined ? null : String(o.notes);
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : now;
  const isFixed = o.isFixed === true;
  const systemTag = readSystemTag(o);
  let startTime: string | null =
    typeof o.startTime === "string" ? o.startTime : o.startTime === null ? null : null;
  let endTime: string | null = typeof o.endTime === "string" ? o.endTime : o.endTime === null ? null : null;
  if (systemTag === "休假") {
    startTime = null;
    endTime = null;
  } else {
    if (startTime === null) startTime = "09:00";
    if (endTime === null) endTime = "17:00";
  }
  return { id, name, color, startTime, endTime, notes, createdAt, systemTag, isFixed };
}

function mergeLegacyCoreTemplates(parsed: ShiftTemplate[], now: string): ShiftTemplate[] {
  const seeds = seedTemplates(now);
  const byId = new Map<number, ShiftTemplate>();
  for (const t of parsed) byId.set(t.id, t);
  for (const seed of seeds) {
    const cur = byId.get(seed.id);
    if (!cur) {
      byId.set(seed.id, seed);
      continue;
    }
    const isLeave = seed.systemTag === "休假";
    byId.set(seed.id, {
      ...cur,
      systemTag: seed.systemTag,
      isFixed: true,
      startTime: isLeave ? null : (cur.startTime ?? seed.startTime),
      endTime: isLeave ? null : (cur.endTime ?? seed.endTime),
    });
  }
  for (const t of parsed) {
    if (t.id >= 1 && t.id <= 4) continue;
    byId.set(t.id, {
      ...t,
      isFixed: false,
      systemTag: undefined,
      startTime: t.startTime ?? "09:00",
      endTime: t.endTime ?? "17:00",
    });
  }
  return Array.from(byId.values())
    .map(normalizeFixedSystemTemplateName)
    .sort((a, b) => a.id - b.id);
}

const LEGACY_FIXED_TEMPLATE_NAMES: Record<SystemShiftTag, string> = {
  早班: "預設早班",
  中班: "預設中班",
  夜班: "預設夜班",
  休假: "預設休假",
};

function normalizeFixedSystemTemplateName(t: ShiftTemplate): ShiftTemplate {
  if (!t.isFixed || !t.systemTag) return t;
  const legacyName = LEGACY_FIXED_TEMPLATE_NAMES[t.systemTag];
  if (legacyName && t.name === legacyName) {
    return { ...t, name: t.systemTag };
  }
  return t;
}

function normalizeModernTemplates(rows: ShiftTemplate[]): ShiftTemplate[] {
  return rows.map((t) => {
    if (!t.isFixed) {
      return {
        ...t,
        systemTag: undefined,
        startTime: t.startTime ?? "09:00",
        endTime: t.endTime ?? "17:00",
      };
    }
    if (t.systemTag === "休假") return normalizeFixedSystemTemplateName({ ...t, startTime: null, endTime: null });
    return normalizeFixedSystemTemplateName({ ...t, startTime: t.startTime ?? "09:00", endTime: t.endTime ?? "17:00" });
  });
}

function upgradePersistedTemplates(rows: unknown[], now: string): ShiftTemplate[] {
  if (!Array.isArray(rows) || rows.length === 0) return seedTemplates(now);
  const legacy = templatesStorageIsLegacy(rows);
  const parsed: ShiftTemplate[] = [];
  for (const raw of rows) {
    const t = legacy ? parseTemplateRowLoose(raw, now) : parseTemplateRowStrict(raw, now);
    if (t) parsed.push(t);
  }
  if (parsed.length === 0) return seedTemplates(now);
  const upgraded = legacy ? mergeLegacyCoreTemplates(parsed, now) : normalizeModernTemplates(parsed);
  return upgraded.map((t) => ({ ...t, color: migrateShiftColor(t.color) }));
}

function migratePersistedShifts(rows: ShiftItem[]): ShiftItem[] {
  return rows.map((s) => ({ ...s, color: migrateShiftColor(s.color) }));
}

function nextId<T extends { id: number }>(items: T[]): number {
  return items.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}

type PersistShape = {
  shifts: ShiftItem[];
  templates: ShiftTemplate[];
  overtime: Overtime[];
  settings: AppSettings;
  customRotation?: SavedCustomRotation | null;
  /** 快速排班時鎖定的差額工時；手動改班不重算。缺省時載入會自班表種子一次。 */
  plannedDifferentialEntries?: PlannedDifferentialEntry[];
};

type AppDataContextValue = Omit<PersistShape, "plannedDifferentialEntries" | "customRotation"> & {
  customRotation: SavedCustomRotation | null;
  plannedDifferentialEntries: PlannedDifferentialEntry[];
  ready: boolean;
  saveCustomRotation: (dna: RotationSlotCode[]) => void;
  upsertShiftForDate: (row: Omit<ShiftItem, "id" | "createdAt"> & { id?: number }) => void;
  bulkUpsertShifts: (rows: GeneratedShiftRow[]) => number;
  deleteShift: (id: number) => void;
  updateShift: (id: number, patch: Partial<ShiftItem>) => void;
  createTemplate: (data: Omit<ShiftTemplate, "id" | "createdAt">) => void;
  updateTemplate: (id: number, patch: Partial<ShiftTemplate>) => void;
  deleteTemplate: (id: number) => void;
  upsertOvertime: (data: {
    date: string;
    earlyHours: number;
    lateHours: number;
    earlyClassHours: number;
    lateClassHours: number;
    leaveStart?: string | null;
    leaveEnd?: string | null;
    holidayWorkStart?: string | null;
    holidayWorkEnd?: string | null;
    disasterStop?: boolean;
    notes?: string;
  }) => void;
  deleteOvertimeByDate: (date: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  getShiftsInRange: (from: string, to: string) => ShiftItem[];
  getWeeklyShifts: (weekStartYmd: string) => ShiftItem[];
};

function parsePlannedDifferentialEntries(raw: unknown): PlannedDifferentialEntry[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  const out: PlannedDifferentialEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.date !== "string") continue;
    const rest =
      typeof o.restDaysInWeek === "number" && Number.isFinite(o.restDaysInWeek)
        ? Math.max(0, Math.floor(o.restDaysInWeek))
        : 0;
    out.push({ date: o.date, restDaysInWeek: rest });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function seedPlannedDifferentialFromShifts(shifts: ShiftItem[]): PlannedDifferentialEntry[] {
  if (shifts.length === 0) return [];
  const dates = shifts.map((s) => s.date).sort();
  return planDifferentialEntriesFromShifts(shifts, dates[0]!, dates[dates.length - 1]!);
}

function applyBulkShiftRows(prev: ShiftItem[], rows: GeneratedShiftRow[]): ShiftItem[] {
  const map = new Map(prev.map((s) => [s.date, s]));
  let nid = nextId(prev);
  for (const r of rows) {
    const existing = map.get(r.date);
    const id = existing?.id ?? nid;
    if (!existing) nid += 1;
    map.set(r.date, {
      id,
      name: r.name,
      color: r.color,
      startTime: r.startTime,
      endTime: r.endTime,
      date: r.date,
      notes: r.notes ?? null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      systemTag: r.systemTag,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function parseSavedCustomRotation(raw: unknown): SavedCustomRotation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.dna)) return null;
  const dna = o.dna.filter((x): x is RotationSlotCode => {
    if (x === "M" || x === "A" || x === "N" || x === "O") return true;
    return typeof x === "string" && /^@\d+$/.test(x) && Number(x.slice(1)) > 0;
  });
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString();
  return { dna, updatedAt };
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [overtime, setOvertime] = useState<Overtime[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [customRotation, setCustomRotation] = useState<SavedCustomRotation | null>(null);
  const [plannedDifferentialEntries, setPlannedDifferentialEntries] = useState<
    PlannedDifferentialEntry[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const p = JSON.parse(raw) as PersistShape;
          if (!cancelled) {
            const loadedShifts = Array.isArray(p.shifts) ? p.shifts : [];
            let loadedTemplates =
              Array.isArray(p.templates) && p.templates.length
                ? upgradePersistedTemplates(p.templates, new Date().toISOString())
                : seedTemplates(new Date().toISOString());
            let migratedShifts = migratePersistedShifts(loadedShifts);
            const mergedSettings = { ...defaultSettings(), ...p.settings };
            const paletteV = mergedSettings.shiftColorPaletteVersion ?? 0;
            if (paletteV < COLOR_PALETTE_VERSION) {
              loadedTemplates = applyPaletteToTemplates(loadedTemplates);
              migratedShifts = applyPaletteToShifts(migratedShifts, loadedTemplates);
              mergedSettings.shiftColorPaletteVersion = COLOR_PALETTE_VERSION;
            }
            setShifts(migratedShifts);
            setTemplates(loadedTemplates);
            setOvertime(Array.isArray(p.overtime) ? p.overtime : []);
            setSettings(mergedSettings);
            setCustomRotation(parseSavedCustomRotation(p.customRotation));
            const parsedPlanned = parsePlannedDifferentialEntries(p.plannedDifferentialEntries);
            setPlannedDifferentialEntries(
              parsedPlanned === undefined
                ? seedPlannedDifferentialFromShifts(migratedShifts)
                : parsedPlanned,
            );
          }
        } else if (!cancelled) {
          setTemplates(seedTemplates(new Date().toISOString()));
          setSettings(defaultSettings());
          setCustomRotation(null);
          setPlannedDifferentialEntries([]);
        }
      } catch {
        if (!cancelled) {
          setTemplates(seedTemplates(new Date().toISOString()));
          setSettings(defaultSettings());
          setCustomRotation(null);
          setPlannedDifferentialEntries([]);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const payload: PersistShape = {
      shifts,
      templates,
      overtime,
      settings,
      customRotation,
      plannedDifferentialEntries,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
  }, [shifts, templates, overtime, settings, customRotation, plannedDifferentialEntries, ready]);

  const upsertShiftForDate = useCallback((row: Omit<ShiftItem, "id" | "createdAt"> & { id?: number }) => {
    const createdAt = new Date().toISOString();
    setShifts((prev) => {
      const rest = prev.filter((s) => s.date !== row.date);
      const existing = prev.find((s) => s.date === row.date);
      const id = row.id ?? existing?.id ?? nextId(prev);
      const item: ShiftItem = {
        id,
        name: row.name,
        color: row.color,
        startTime: row.startTime,
        endTime: row.endTime,
        date: row.date,
        notes: row.notes ?? null,
        createdAt: existing?.createdAt ?? createdAt,
        systemTag: row.systemTag,
      };
      return [...rest, item].sort((a, b) => a.date.localeCompare(b.date));
    });
  }, []);

  const bulkUpsertShifts = useCallback((rows: GeneratedShiftRow[]) => {
    if (rows.length === 0) return 0;
    const coveredFrom = rows.reduce((m, r) => (r.date < m ? r.date : m), rows[0]!.date);
    const coveredTo = rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0]!.date);
    setShifts((prev) => {
      const next = applyBulkShiftRows(prev, rows);
      setPlannedDifferentialEntries((planned) =>
        mergePlannedDifferentialEntries(planned, next, coveredFrom, coveredTo),
      );
      return next;
    });
    return rows.length;
  }, []);

  const deleteShift = useCallback((id: number) => {
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateShift = useCallback((id: number, patch: Partial<ShiftItem>) => {
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const createTemplate = useCallback((data: Omit<ShiftTemplate, "id" | "createdAt">) => {
    setTemplates((prev) => [
      ...prev,
      { ...data, id: nextId(prev), createdAt: new Date().toISOString() },
    ]);
  }, []);

  const updateTemplate = useCallback((id: number, patch: Partial<ShiftTemplate>) => {
    setTemplates((prev) => {
      const before = prev.find((t) => t.id === id);
      const next = prev.map((t) => {
        if (t.id !== id) return t;
        const { systemTag: _st, isFixed: _fx, ...safe } = patch;
        return { ...t, ...safe };
      });
      const after = next.find((t) => t.id === id);
      if (before && after) {
        const nameChanged = patch.name !== undefined && patch.name !== before.name;
        const colorChanged = patch.color !== undefined && patch.color !== before.color;
        const timesChanged =
          (patch.startTime !== undefined && patch.startTime !== before.startTime) ||
          (patch.endTime !== undefined && patch.endTime !== before.endTime);
        if (nameChanged || colorChanged || timesChanged) {
          setShifts((shifts) => {
            let updated = shifts;
            if (nameChanged || colorChanged) {
              updated = applyTemplateAppearanceToShifts(updated, after, before);
            }
            if (timesChanged) {
              updated = applyTemplateTimesToShifts(updated, after, before);
            }
            return updated;
          });
        }
      }
      return next;
    });
  }, []);

  const deleteTemplate = useCallback((id: number) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id || t.isFixed));
  }, []);

  const upsertOvertime = useCallback(
    (data: {
      date: string;
      earlyHours: number;
      lateHours: number;
      earlyClassHours: number;
      lateClassHours: number;
      leaveStart?: string | null;
      leaveEnd?: string | null;
      holidayWorkStart?: string | null;
      holidayWorkEnd?: string | null;
      disasterStop?: boolean;
      notes?: string;
    }) => {
      setOvertime((prev) => {
        const rest = prev.filter((o) => o.date !== data.date);
        const existing = prev.find((o) => o.date === data.date);
        const row: Overtime = {
          id: existing?.id ?? nextId(prev),
          date: data.date,
          hours: data.earlyHours + data.lateHours + data.earlyClassHours + data.lateClassHours,
          earlyHours: data.earlyHours,
          lateHours: data.lateHours,
          earlyClassHours: data.earlyClassHours,
          lateClassHours: data.lateClassHours,
          // 加班／上課儲存未帶請假欄位時，不得覆寫既有 leave（否則結算交接班永遠當成無請假）
          leaveStart: "leaveStart" in data ? (data.leaveStart ?? null) : (existing?.leaveStart ?? null),
          leaveEnd: "leaveEnd" in data ? (data.leaveEnd ?? null) : (existing?.leaveEnd ?? null),
          holidayWorkStart:
            "holidayWorkStart" in data ? (data.holidayWorkStart ?? null) : (existing?.holidayWorkStart ?? null),
          holidayWorkEnd:
            "holidayWorkEnd" in data ? (data.holidayWorkEnd ?? null) : (existing?.holidayWorkEnd ?? null),
          disasterStop:
            "disasterStop" in data ? !!data.disasterStop : !!existing?.disasterStop,
          // 加班／請假儲存未帶備註時，不得覆寫既有 notes
          notes:
            "notes" in data
              ? clampOvertimeNote(data.notes ?? "") || null
              : (existing?.notes ?? null),
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        return [...rest, row].sort((a, b) => a.date.localeCompare(b.date));
      });
    },
    [],
  );

  const deleteOvertimeByDate = useCallback((date: string) => {
    setOvertime((prev) => prev.filter((o) => o.date !== date));
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const saveCustomRotation = useCallback((dna: RotationSlotCode[]) => {
    setCustomRotation({ dna: [...dna], updatedAt: new Date().toISOString() });
  }, []);

  const getShiftsInRange = useCallback(
    (from: string, to: string) => shifts.filter((s) => s.date >= from && s.date <= to),
    [shifts],
  );

  const getWeeklyShifts = useCallback(
    (weekStartYmd: string) => {
      const start = new Date(weekStartYmd + "T12:00:00");
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const to = formatYMD(end);
      return shifts.filter((s) => s.date >= weekStartYmd && s.date <= to);
    },
    [shifts],
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      shifts,
      templates,
      overtime,
      settings,
      customRotation,
      plannedDifferentialEntries,
      ready,
      saveCustomRotation,
      upsertShiftForDate,
      bulkUpsertShifts,
      deleteShift,
      updateShift,
      createTemplate,
      updateTemplate,
      deleteTemplate,
      upsertOvertime,
      deleteOvertimeByDate,
      updateSettings,
      getShiftsInRange,
      getWeeklyShifts,
    }),
    [
      shifts,
      templates,
      overtime,
      settings,
      customRotation,
      plannedDifferentialEntries,
      ready,
      saveCustomRotation,
      upsertShiftForDate,
      bulkUpsertShifts,
      deleteShift,
      updateShift,
      createTemplate,
      updateTemplate,
      deleteTemplate,
      upsertOvertime,
      deleteOvertimeByDate,
      updateSettings,
      getShiftsInRange,
      getWeeklyShifts,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be inside AppDataProvider");
  return ctx;
}
