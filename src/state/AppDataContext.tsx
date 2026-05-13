import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { formatYMD } from "@/src/logic/dates";
import { buildCycleShiftRows, type GeneratedShiftRow } from "@/src/logic/shiftLogic";
import type { AppSettings, Overtime, ShiftItem, ShiftTemplate } from "@/src/types";

const STORAGE_KEY = "cpc_native_app_v1";

const defaultSettings = (): AppSettings => ({
  baseSalary: "40000",
  startDay: "8",
  handoverEnabled: true,
  midAllowance: "200",
  nightAllowance: "450",
  nextShiftId: 1,
  nextTemplateId: 5,
  nextOvertimeId: 1,
});

function seedTemplates(now: string): ShiftTemplate[] {
  return [
    {
      id: 1,
      name: "早班",
      color: "#F29D11",
      startTime: "07:00",
      endTime: "15:00",
      notes: null,
      createdAt: now,
    },
    {
      id: 2,
      name: "午班",
      color: "#11928F",
      startTime: "15:00",
      endTime: "23:00",
      notes: null,
      createdAt: now,
    },
    {
      id: 3,
      name: "夜班",
      color: "#6B66E8",
      startTime: "23:00",
      endTime: "07:00",
      notes: null,
      createdAt: now,
    },
    {
      id: 4,
      name: "放假",
      color: "#E85299",
      startTime: "00:00",
      endTime: "00:00",
      notes: null,
      createdAt: now,
    },
  ];
}

function nextId<T extends { id: number }>(items: T[]): number {
  return items.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}

type PersistShape = {
  shifts: ShiftItem[];
  templates: ShiftTemplate[];
  overtime: Overtime[];
  settings: AppSettings;
};

type AppDataContextValue = PersistShape & {
  ready: boolean;
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
    leaveStart?: string;
    leaveEnd?: string;
    notes?: string;
  }) => void;
  deleteOvertimeByDate: (date: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  getShiftsInRange: (from: string, to: string) => ShiftItem[];
  getWeeklyShifts: (weekStartYmd: string) => ShiftItem[];
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [overtime, setOvertime] = useState<Overtime[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const p = JSON.parse(raw) as PersistShape;
          if (!cancelled) {
            setShifts(Array.isArray(p.shifts) ? p.shifts : []);
            setTemplates(
              Array.isArray(p.templates) && p.templates.length ? p.templates : seedTemplates(new Date().toISOString()),
            );
            setOvertime(Array.isArray(p.overtime) ? p.overtime : []);
            setSettings({ ...defaultSettings(), ...p.settings });
          }
        } else if (!cancelled) {
          setTemplates(seedTemplates(new Date().toISOString()));
          setSettings(defaultSettings());
        }
      } catch {
        if (!cancelled) {
          setTemplates(seedTemplates(new Date().toISOString()));
          setSettings(defaultSettings());
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
    const payload: PersistShape = { shifts, templates, overtime, settings };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
  }, [shifts, templates, overtime, settings, ready]);

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
      };
      return [...rest, item].sort((a, b) => a.date.localeCompare(b.date));
    });
  }, []);

  const bulkUpsertShifts = useCallback((rows: GeneratedShiftRow[]) => {
    setShifts((prev) => {
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
        });
      }
      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
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
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const deleteTemplate = useCallback((id: number) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const upsertOvertime = useCallback(
    (data: {
      date: string;
      earlyHours: number;
      lateHours: number;
      earlyClassHours: number;
      lateClassHours: number;
      leaveStart?: string;
      leaveEnd?: string;
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
          leaveStart: data.leaveStart ?? null,
          leaveEnd: data.leaveEnd ?? null,
          notes: data.notes ?? null,
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
      ready,
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
      ready,
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

export function useApplyCyclePattern() {
  const { templates, bulkUpsertShifts } = useAppData();
  return useCallback(
    (pattern: (number | null)[], startDate: string, endDate: string, notes?: string | null): number => {
      const map = new Map(templates.map((t) => [t.id, t]));
      const rows = buildCycleShiftRows(pattern, startDate, endDate, map, notes);
      return bulkUpsertShifts(rows);
    },
    [bulkUpsertShifts, templates],
  );
}
