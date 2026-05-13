import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Palmtree } from "lucide-react";
import { useCreateShift, useUpdateShift, getListShiftsQueryKey, getGetWeeklyShiftsQueryKey, getGetShiftSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useShiftTemplates } from "@/hooks/useShiftTemplates";

const HOLIDAY_NAME = "休假";
const HOLIDAY_COLOR = "#94a3b8";

const PRESET_COLORS = [
  "#0d9488", "#f59e0b", "#6366f1", "#10b981",
  "#ef4444", "#3b82f6", "#ec4899", "#8b5cf6",
];

type ShiftFormData = {
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  date: string;
  notes: string;
};

type Shift = {
  id: number;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  date: string;
  notes?: string | null;
  createdAt: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate?: string;
  editShift?: Shift;
  onSuccess?: () => void;
}

export default function ShiftDialog({ open, onOpenChange, defaultDate, editShift, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const { data: templates } = useShiftTemplates();

  const today = new Date().toISOString().slice(0, 10);
  const [submitError, setSubmitError] = useState("");

  const [form, setForm] = useState<ShiftFormData>({
    name: "",
    color: PRESET_COLORS[0],
    startTime: "09:00",
    endTime: "17:00",
    date: defaultDate ?? today,
    notes: "",
  });

  useEffect(() => {
    setSubmitError("");
    if (editShift) {
      setForm({
        name: editShift.name,
        color: editShift.color,
        startTime: editShift.startTime,
        endTime: editShift.endTime,
        date: editShift.date,
        notes: editShift.notes ?? "",
      });
    } else {
      setForm({
        name: "",
        color: PRESET_COLORS[0],
        startTime: "09:00",
        endTime: "17:00",
        date: defaultDate ?? today,
        notes: "",
      });
    }
  }, [editShift, defaultDate, open]);

  const applyTemplate = (t: { name: string; color: string; startTime: string; endTime: string }) => {
    setForm((prev) => ({ ...prev, name: t.name, color: t.color, startTime: t.startTime, endTime: t.endTime }));
  };

  const applyHoliday = () => {
    setForm((prev) => ({ ...prev, name: HOLIDAY_NAME, color: HOLIDAY_COLOR, startTime: "00:00", endTime: "00:00" }));
  };

  const isCurrentlyHoliday = form.name === HOLIDAY_NAME;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    const data = { ...form, notes: form.notes || undefined };

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetWeeklyShiftsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetShiftSummaryQueryKey() });
      onSuccess?.();
      onOpenChange(false);
    };

    const onError = (err: Error) => {
      setSubmitError(err.message || "儲存失敗，請重試");
    };

    if (editShift) {
      updateShift.mutate({ id: editShift.id, data }, { onSuccess: invalidate, onError });
    } else {
      createShift.mutate({ data }, { onSuccess: invalidate, onError });
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => onOpenChange(false)}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-card rounded-2xl border border-card-border shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">
                {editShift ? "編輯班次" : "新增班次"}
              </h2>
              <button onClick={() => onOpenChange(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground">快速套用</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* 休假 quick button */}
                <button
                  type="button"
                  onClick={applyHoliday}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    isCurrentlyHoliday
                      ? "border-slate-300 bg-slate-100 text-slate-700 ring-1 ring-slate-300"
                      : "border-border bg-muted/40 hover:bg-slate-50 hover:border-slate-300 text-muted-foreground hover:text-slate-600"
                  }`}
                >
                  <Palmtree className="w-3 h-3" />
                  <span>休假</span>
                </button>
                {(templates ?? []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted transition-colors text-xs font-medium"
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    <span>{t.name || <span className="italic text-muted-foreground">未命名</span>}</span>
                    <span className="text-muted-foreground">{t.startTime}–{t.endTime}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">班次名稱</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例：早班、晚班"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">顏色</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm({ ...form, color })}
                      className={`w-8 h-8 rounded-full transition-all ${form.color === color ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">日期</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {isCurrentlyHoliday ? (
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500">
                  <Palmtree className="w-4 h-4 flex-shrink-0" />
                  <span>全天休假，不需要設定上班時間</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">開始時間</label>
                    <input
                      type="time"
                      lang="zh-TW"
                      required
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">結束時間</label>
                    <input
                      type="time"
                      lang="zh-TW"
                      required
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">備註（選填）</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="備註事項..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {submitError && (
                <p className="text-sm text-destructive text-center">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={createShift.isPending || updateShift.isPending}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {editShift ? "儲存變更" : "新增班次"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
