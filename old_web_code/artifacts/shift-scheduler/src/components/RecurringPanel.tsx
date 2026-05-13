import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Repeat, CalendarCheck, Plus, Minus, GripVertical } from "lucide-react";
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

const today = new Date().toISOString().slice(0, 10);

const minStartDate = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10);
})();

export default function RecurringPanel() {
  const { data: templates } = useShiftTemplates();
  const queryClient = useQueryClient();

  const [pattern, setPattern] = useState<(number | null)[]>(Array(8).fill(null));
  const [startDate, setStartDate] = useState(today);
  const [cycles, setCycles] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (templates && templates.length > 0) {
      setPattern(Array.from({ length: 8 }, (_, i) => templates[i % templates.length]?.id ?? null));
    }
  }, [templates]);

  const cycleModeEndDate = (() => {
    if (!startDate || pattern.length === 0) return "";
    const totalDays = cycles * pattern.length;
    const d = new Date(startDate);
    d.setDate(d.getDate() + totalDays - 1);
    return d.toISOString().slice(0, 10);
  })();

  const previewCount = (() => {
    if (!startDate) return 0;
    const nonHoliday = pattern.filter((p) => p !== null).length;
    return cycles * nonHoliday;
  })();

  const setCycleSlot = (idx: number, val: number | null) => {
    setPattern((prev) => prev.map((v, i) => (i === idx ? val : v)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !cycleModeEndDate) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await bulkCreate({
        mode: "cycle",
        pattern,
        startDate,
        endDate: cycleModeEndDate,
        notes: notes || undefined,
      });
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

  const reset = () => {
    setResult(null);
    setError("");
    setStartDate(today);
    setCycles(1);
    setNotes("");
  };

  if (result) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CalendarCheck className="w-8 h-8 text-primary" />
        </div>
        <p className="text-xl font-semibold text-foreground mb-1">排班完成！</p>
        <p className="text-muted-foreground text-sm">
          已成功新增 <span className="text-primary font-semibold">{result.created}</span> 個班次
        </p>
        <button
          onClick={reset}
          className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          再次排班
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <p className="text-sm text-muted-foreground">
        依自訂輪班週期批量建立班次，循環重複至週期數結束。
      </p>

      {/* Cycle pattern */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            週期設定
            <span className="text-muted-foreground font-normal ml-1">（{pattern.length} 天循環）</span>
          </label>
          <div className="flex gap-1">
            <button
              type="button" onClick={() => setPattern((p) => p.length > 2 ? p.slice(0, -1) : p)}
              disabled={pattern.length <= 2}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              type="button" onClick={() => setPattern((p) => p.length < 30 ? [...p, null] : p)}
              disabled={pattern.length >= 30}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">依序設定每天的班次，循環重複至週期數結束。</p>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {pattern.map((tplId, idx) => (
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
          ))}
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
            <span className="text-[10px] text-muted-foreground self-center ml-1">× {cycles}</span>
          </div>
        )}
      </div>

      {/* Start date + cycles count */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">開始日期</label>
          <input
            type="date" required value={startDate} min={minStartDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">
            循環週期數 <span className="text-muted-foreground font-normal">（最多50）</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCycles((c) => Math.max(1, c - 1))}
              disabled={cycles <= 1}
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-40"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number" min={1} max={50} value={cycles}
              onChange={(e) => setCycles(Math.min(50, Math.max(1, Number(e.target.value))))}
              className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setCycles((c) => Math.min(50, c + 1))}
              disabled={cycles >= 50}
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {cycleModeEndDate && (
            <p className="text-xs text-muted-foreground mt-1.5 text-center">
              至 {cycleModeEndDate}
            </p>
          )}
        </div>
      </div>

      {/* Notes */}
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
          {cycleModeEndDate && (
            <span className="text-muted-foreground ml-1">（{startDate} 至 {cycleModeEndDate}，共 {cycles} 週期）</span>
          )}
        </motion.div>
      )}

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <button
        type="submit"
        disabled={submitting || previewCount === 0}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
      >
        <Repeat className="w-4 h-4" />
        {submitting ? "建立中..." : `確認建立 ${previewCount > 0 ? `(${previewCount} 個班次)` : ""}`}
      </button>
    </form>
  );
}
