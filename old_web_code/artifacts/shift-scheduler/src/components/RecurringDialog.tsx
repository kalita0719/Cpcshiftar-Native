import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Repeat, CalendarCheck, Plus, Minus, GripVertical } from "lucide-react";
import { useShiftTemplates } from "@/hooks/useShiftTemplates";
import { useQueryClient } from "@tanstack/react-query";
import { getListShiftsQueryKey, getGetWeeklyShiftsQueryKey, getGetShiftSummaryQueryKey } from "@workspace/api-client-react";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

async function bulkCreate(data: object): Promise<{ created: number }> {
  const res = await fetch(`${BASE()}/api/shifts/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "建立失敗");
  }
  return res.json();
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultStartDate?: string;
}

export default function RecurringDialog({ open, onOpenChange, defaultStartDate }: Props) {
  const { data: templates } = useShiftTemplates();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [pattern, setPattern] = useState<(number | null)[]>([null, null, null]);
  const [startDate, setStartDate] = useState(defaultStartDate ?? today);
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setResult(null);
      setError("");
      setStartDate(defaultStartDate ?? today);
      setEndDate("");
      setNotes("");
    }
  }, [open]);

  useEffect(() => {
    if (templates && templates.length > 0) {
      setPattern(templates.map((t) => t.id).slice(0, 3));
    }
  }, [templates]);

  const previewCount = (() => {
    if (!startDate || !endDate || pattern.length === 0) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    if (diff < 0) return 0;
    return diff + 1;
  })();

  const setCycleSlot = (idx: number, val: number | null) => {
    setPattern((prev) => prev.map((v, i) => (i === idx ? val : v)));
  };

  const addCycleDay = () => {
    if (pattern.length >= 30) return;
    setPattern((prev) => [...prev, null]);
  };

  const removeCycleDay = () => {
    if (pattern.length <= 2) return;
    setPattern((prev) => prev.slice(0, -1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    setSubmitting(true);
    setError("");
    try {
      const r = await bulkCreate({ mode: "cycle", pattern, startDate, endDate, notes: notes || undefined });
      setResult(r);
      queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetWeeklyShiftsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetShiftSummaryQueryKey() });
    } catch (err: any) {
      setError(err.message ?? "建立失敗，請重試");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => onOpenChange(false)}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-card rounded-2xl border border-card-border shadow-xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Repeat className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">週期排班</h2>
              </div>
              <button onClick={() => onOpenChange(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {result ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarCheck className="w-8 h-8 text-primary" />
                </div>
                <p className="text-xl font-semibold text-foreground mb-1">排班完成！</p>
                <p className="text-muted-foreground text-sm">已成功新增 <span className="text-primary font-semibold">{result.created}</span> 個班次</p>
                <button onClick={() => onOpenChange(false)} className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                  完成
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Cycle pattern */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      週期設定
                      <span className="text-muted-foreground font-normal ml-1">（{pattern.length} 天循環）</span>
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button" onClick={removeCycleDay} disabled={pattern.length <= 2}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        type="button" onClick={addCycleDay} disabled={pattern.length >= 30}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">依序設定每天的班次，循環重複至結束日期。</p>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {pattern.map((tplId, idx) => {
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 w-16 flex-shrink-0">
                            <GripVertical className="w-3 h-3 text-muted-foreground/40" />
                            <span className="text-xs text-muted-foreground font-medium">第{idx + 1}天</span>
                          </div>
                          <div className="flex-1 flex gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setCycleSlot(idx, null)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                tplId === null
                                  ? "bg-muted/80 text-foreground ring-1 ring-border"
                                  : "bg-muted text-muted-foreground hover:bg-muted/70"
                              }`}
                            >
                              休假
                            </button>
                            {(templates ?? []).map((t) => (
                              <button
                                key={t.id} type="button"
                                onClick={() => setCycleSlot(idx, t.id)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                  tplId === t.id
                                    ? "text-white ring-1 ring-offset-1"
                                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                                }`}
                                style={tplId === t.id ? { backgroundColor: t.color } : {}}
                              >
                                {tplId === t.id && <div className="w-1.5 h-1.5 rounded-full bg-white/80" />}
                                {t.name || <span className="italic">未命名</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {pattern.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {pattern.map((tplId, idx) => {
                        const tpl = templates?.find((t) => t.id === tplId);
                        return (
                          <div
                            key={idx}
                            className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ backgroundColor: tpl ? tpl.color : "#e5e7eb" }}
                            title={tpl ? (tpl.name || "未命名") : "休假"}
                          >
                            {tpl ? (tpl.name[0] ?? "▪") : "休"}
                          </div>
                        );
                      })}
                      <span className="text-[10px] text-muted-foreground self-center ml-1">× ∞</span>
                    </div>
                  )}
                </div>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">開始日期</label>
                    <input
                      type="date" required value={startDate} min={today}
                      onChange={(e) => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(""); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">結束日期</label>
                    <input
                      type="date" required value={endDate} min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">備註（選填）</label>
                  <input
                    value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="套用到所有班次的備註..."
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {previewCount > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-center"
                  >
                    將新增 <span className="font-bold text-primary">{previewCount}</span> 個班次
                    {startDate && endDate && (
                      <span className="text-muted-foreground ml-1">（{startDate} 至 {endDate}）</span>
                    )}
                  </motion.div>
                )}

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting || !startDate || !endDate || previewCount === 0}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Repeat className="w-4 h-4" />
                  {submitting ? "建立中..." : `確認建立 ${previewCount > 0 ? `(${previewCount} 個班次)` : ""}`}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
