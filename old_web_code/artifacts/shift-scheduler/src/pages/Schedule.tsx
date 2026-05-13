import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { X, Repeat, CalendarCheck } from "lucide-react";
import OvertimeDialog from "@/components/OvertimeDialog";
import MonthView, { type ShiftItem } from "@/components/MonthView";
import ShiftSchedulingPanel from "@/components/ShiftSchedulingPanel";
import { type Overtime } from "@/hooks/useOvertime";
import { type ShiftTemplate } from "@/hooks/useShiftTemplates";
import { useShiftPanel } from "@/App";
import { useListShifts, useCreateShift, getListShiftsQueryKey, getGetWeeklyShiftsQueryKey, getGetShiftSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

async function rawBulkCreate(shifts: {
  date: string;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  notes?: string;
}[]): Promise<{ created: number }> {
  const res = await fetch(`${BASE()}/api/shifts/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "raw", shifts }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "建立失敗");
  }
  return res.json();
}

const HOLIDAY_NAME = "休假";
const HOLIDAY_COLOR = "#94a3b8";

export default function Schedule() {
  const queryClient = useQueryClient();
  const { shiftPanelOpen, closeShiftPanel } = useShiftPanel();
  const createShift = useCreateShift();
  const { data: allShifts } = useListShifts();

  // Overtime mode state
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [overtimeDate, setOvertimeDate] = useState("");
  const [overtimeExisting, setOvertimeExisting] = useState<Overtime | undefined>(undefined);
  const [overtimeShift, setOvertimeShift] = useState<ShiftItem | undefined>(undefined);

  // Schedule (typewriter) mode state
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // Cycle mode state
  const [cycleMode, setCycleMode] = useState(false);
  const [cycleStart, setCycleStart] = useState<string | null>(null);
  const [cycleEnd, setCycleEnd] = useState<string | null>(null);
  const [cycleConfirmOpen, setCycleConfirmOpen] = useState(false);
  const [cycleFillDays, setCycleFillDays] = useState(30);
  const [cycleGenerating, setCycleGenerating] = useState(false);
  const [cycleResult, setCycleResult] = useState<{ created: number } | null>(null);

  // Reset schedule mode when panel closes
  useEffect(() => {
    if (!shiftPanelOpen) {
      setSelectedScheduleDate(null);
      setCycleMode(false);
      setCycleStart(null);
      setCycleEnd(null);
      setCycleConfirmOpen(false);
      setCycleResult(null);
    }
  }, [shiftPanelOpen]);

  // Reset cycle state when toggling out of cycle mode
  const handleCycleModeToggle = () => {
    if (cycleMode) {
      setCycleMode(false);
      setCycleStart(null);
      setCycleEnd(null);
      setCycleConfirmOpen(false);
      setCycleResult(null);
    } else {
      setCycleMode(true);
      setSelectedScheduleDate(null);
      setCycleStart(null);
      setCycleEnd(null);
    }
  };

  const invalidateShifts = () => {
    queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetWeeklyShiftsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetShiftSummaryQueryKey() });
  };

  // Handle calendar date click
  const handleDateSelect = (dateStr: string) => {
    if (cycleMode) {
      if (!cycleStart) {
        setCycleStart(dateStr);
        setCycleEnd(null);
      } else if (!cycleEnd) {
        if (dateStr === cycleStart) {
          setCycleStart(null);
        } else {
          setCycleEnd(dateStr);
        }
      } else {
        setCycleStart(dateStr);
        setCycleEnd(null);
      }
    } else {
      setSelectedScheduleDate(dateStr);
    }
  };

  // Handle overtime mode (normal calendar)
  const handleOvertime = (date: string, existing?: Overtime, shift?: ShiftItem) => {
    setOvertimeDate(date);
    setOvertimeExisting(existing);
    setOvertimeShift(shift);
    setOvertimeOpen(true);
  };

  // Typewriter: apply template and advance date
  const handleTemplateSelect = async (template: ShiftTemplate) => {
    if (!selectedScheduleDate) return;
    setApplying(true);
    try {
      await createShift.mutateAsync({
        data: {
          date: selectedScheduleDate,
          name: template.name,
          color: template.color,
          startTime: template.startTime,
          endTime: template.endTime,
        },
      });
      invalidateShifts();
      const next = addDays(new Date(selectedScheduleDate), 1);
      setSelectedScheduleDate(format(next, "yyyy-MM-dd"));
    } finally {
      setApplying(false);
    }
  };

  // Typewriter: apply holiday and advance date
  const handleHolidaySelect = async () => {
    if (!selectedScheduleDate) return;
    setApplying(true);
    try {
      await createShift.mutateAsync({
        data: {
          date: selectedScheduleDate,
          name: HOLIDAY_NAME,
          color: HOLIDAY_COLOR,
          startTime: "00:00",
          endTime: "00:00",
        },
      });
      invalidateShifts();
      const next = addDays(new Date(selectedScheduleDate), 1);
      setSelectedScheduleDate(format(next, "yyyy-MM-dd"));
    } finally {
      setApplying(false);
    }
  };

  // Open cycle confirm dialog
  const handleCycleGenerate = () => {
    if (!cycleStart || !cycleEnd) return;
    setCycleFillDays(30);
    setCycleResult(null);
    setCycleConfirmOpen(true);
  };

  // Execute cycle generation
  const handleCycleSubmit = async () => {
    if (!cycleStart || !cycleEnd || !allShifts) return;
    const lo = cycleStart <= cycleEnd ? cycleStart : cycleEnd;
    const hi = cycleStart <= cycleEnd ? cycleEnd : cycleStart;

    // Build pattern from existing shifts in range
    type PatternEntry = { name: string; color: string; startTime: string; endTime: string } | null;
    const pattern: PatternEntry[] = [];
    const start = new Date(lo);
    const end = new Date(hi);
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const dateStr = format(d, "yyyy-MM-dd");
      const shift = allShifts.find((s) => s.date === dateStr);
      if (shift) {
        pattern.push({ name: shift.name, color: shift.color, startTime: shift.startTime, endTime: shift.endTime });
      } else {
        pattern.push(null);
      }
    }

    if (pattern.length === 0) return;

    const fillShifts: { date: string; name: string; color: string; startTime: string; endTime: string }[] = [];
    const fillStart = addDays(end, 1);

    for (let i = 0; i < cycleFillDays; i++) {
      const entry = pattern[i % pattern.length];
      if (entry) {
        const dateStr = format(addDays(fillStart, i), "yyyy-MM-dd");
        fillShifts.push({ date: dateStr, ...entry });
      }
    }

    setCycleGenerating(true);
    try {
      const result = await rawBulkCreate(fillShifts);
      invalidateShifts();
      setCycleResult(result);
      setCycleConfirmOpen(false);
      setCycleMode(false);
      setCycleStart(null);
      setCycleEnd(null);
    } catch (err) {
      // error silently — user can retry
    } finally {
      setCycleGenerating(false);
    }
  };

  return (
    <div className="px-1 py-6 w-full">
      <MonthView
        onOvertime={shiftPanelOpen ? undefined : handleOvertime}
        scheduleMode={shiftPanelOpen && !cycleMode}
        selectedScheduleDate={selectedScheduleDate}
        onDateSelect={shiftPanelOpen ? handleDateSelect : undefined}
        cycleMode={shiftPanelOpen && cycleMode}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
      />

      {/* Cycle result toast */}
      <AnimatePresence>
        {cycleResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-card border border-card-border rounded-2xl shadow-xl"
          >
            <CalendarCheck className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-foreground">
              週期排班完成！已新增 <span className="text-primary font-semibold">{cycleResult.created}</span> 個班次
            </span>
            <button onClick={() => setCycleResult(null)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overtime dialog (normal mode) */}
      <OvertimeDialog
        open={overtimeOpen}
        onOpenChange={setOvertimeOpen}
        date={overtimeDate}
        existing={overtimeExisting}
        shift={overtimeShift}
      />

      {/* Shift scheduling panel (bottom sheet) */}
      <ShiftSchedulingPanel
        open={shiftPanelOpen}
        onClose={closeShiftPanel}
        selectedDate={selectedScheduleDate}
        onTemplateSelect={handleTemplateSelect}
        onHolidaySelect={handleHolidaySelect}
        cycleMode={cycleMode}
        onCycleModeToggle={handleCycleModeToggle}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        onCycleGenerate={handleCycleGenerate}
        applying={applying}
      />

      {/* Cycle confirm dialog */}
      <AnimatePresence>
        {cycleConfirmOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setCycleConfirmOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-card rounded-2xl border border-card-border shadow-xl w-full max-w-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-green-500" />
                  生成週期班表
                </h2>
                <button
                  onClick={() => setCycleConfirmOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-5">
                以 <span className="font-semibold text-foreground">
                  {cycleStart && cycleEnd
                    ? `${cycleStart <= cycleEnd ? cycleStart : cycleEnd} → ${cycleStart <= cycleEnd ? cycleEnd : cycleStart}`
                    : ""}
                </span> 的班次為基準週期，循環填滿後續天數。
              </p>

              <div className="mb-5">
                <label className="text-sm font-medium text-foreground block mb-2">
                  要循環填滿未來幾天？
                  <span className="text-muted-foreground font-normal ml-1">（最多 365 天）</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={cycleFillDays}
                  onChange={(e) => setCycleFillDays(Math.min(365, Math.max(1, Number(e.target.value))))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <button
                onClick={handleCycleSubmit}
                disabled={cycleGenerating}
                className="w-full py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Repeat className="w-4 h-4" />
                {cycleGenerating ? "生成中..." : `生成 ${cycleFillDays} 天週期班表`}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
