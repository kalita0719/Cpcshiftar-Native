import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Receipt, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { format, getDaysInMonth } from "date-fns";
import { useOvertimeRange } from "@/hooks/useOvertime";
import { useListShifts } from "@workspace/api-client-react";

// ─── localStorage helpers ────────────────────────────────────────────────────
function ls(key: string, fallback = "") {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

const K = {
  salary:          "ot_base_salary",
  startDay:        "ot_start_day",
  handoverEnabled: "ot_handover_enabled",
  midAllowance:    "ot_mid_allowance",
  nightAllowance:  "ot_night_allowance",
};

// ─── Period calculation ───────────────────────────────────────────────────────
function getPeriod(startDay: number, offset = 0): { from: string; to: string; label: string } {
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth();

  if (startDay <= 1) {
    const base = new Date(year, month + offset, 1);
    const y = base.getFullYear(), m = base.getMonth();
    const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const to   = `${y}-${String(m + 1).padStart(2, "0")}-${String(getDaysInMonth(base)).padStart(2, "0")}`;
    return { from, to, label: `${y}年${m + 1}月` };
  }

  const day = today.getDate();
  const periodStart = day >= startDay
    ? new Date(year, month + offset, startDay)
    : new Date(year, month - 1 + offset, startDay);
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, startDay - 1);

  return {
    from:  format(periodStart, "yyyy-MM-dd"),
    to:    format(periodEnd,   "yyyy-MM-dd"),
    label: `${format(periodStart, "M/d")} ～ ${format(periodEnd, "M/d")}`,
  };
}

// ─── Overtime bracket split ───────────────────────────────────────────────────
function brackets(h: number) {
  return {
    b133: Math.min(h, 2),
    b166: Math.max(Math.min(h, 4) - 2, 0),
    b200: Math.max(h - 4, 0),
  };
}

// ─── Formatting ───────────────────────────────────────────────────────────────
const DAY = ["日","一","二","三","四","五","六"];
function shortDate(d: string) {
  const dt = new Date(d);
  return `${d.slice(5).replace("-", "/")}(${DAY[dt.getDay()]})`;
}
function fh(n: number) { return n > 0 ? `${n}h` : "-"; }
function fm(n: number) { return n > 0 ? `$${Math.round(n).toLocaleString()}` : "-"; }

// ─── Main component ───────────────────────────────────────────────────────────
export default function OvertimePay() {
  const [salary]   = useState(() => ls(K.salary));
  const [startDay] = useState(() => parseInt(ls(K.startDay, "1")));
  const [handover] = useState(() => ls(K.handoverEnabled, "false") === "true");
  const [midAmt]   = useState(() => ls(K.midAllowance));
  const [nightAmt] = useState(() => ls(K.nightAllowance));
  const [offset, setOffset] = useState(0);
  const [showHandoverDetail, setShowHandoverDetail] = useState(false);

  const period = useMemo(() => getPeriod(startDay, offset), [startDay, offset]);

  const { data: overtimeData, isLoading: otLoading } = useOvertimeRange(period.from, period.to);
  const { data: allShifts,    isLoading: shLoading } = useListShifts();

  const baseSalary   = parseFloat(salary)  || 0;
  const hourlyRate   = baseSalary / 240;
  const midPerShift  = parseFloat(midAmt)  || 0;
  const nitePerShift = parseFloat(nightAmt) || 0;

  // ── Shifts in this period ──────────────────────────────────────────────────
  const periodShifts = useMemo(() => {
    if (!allShifts) return [];
    return (allShifts as { date: string; name: string; color: string; startTime: string; endTime: string }[])
      .filter((s) => s.date >= period.from && s.date <= period.to);
  }, [allShifts, period]);

  const workShiftDates = useMemo(
    () => new Set(periodShifts.filter((s) => s.name !== "休假").map((s) => s.date)),
    [periodShifts],
  );
  const midCount   = periodShifts.filter((s) => s.name === "中班").length;
  const nightCount = periodShifts.filter((s) => s.name === "晚班").length;

  // ── Overtime rows（交接班獨立計算，不合併進累進）────────────────────────────
  const rows = useMemo(() => {
    if (!overtimeData) return [];

    return overtimeData
      .map((ot) => {
        const earlyHours = ot.earlyHours  ?? 0;
        const lateHours  = ot.lateHours   ?? 0;
        const total      = earlyHours + lateHours;
        const { b133, b166, b200 } = brackets(total);
        const pay        = hourlyRate * (b133 * 1.33 + b166 * 1.66 + b200 * 2.0);
        return { date: ot.date, earlyHours, lateHours, total, b133, b166, b200, pay };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [overtimeData, hourlyRate]);

  // ── Handover (separate) ────────────────────────────────────────────────────
  const handoverDates = useMemo(
    () => handover ? Array.from(workShiftDates).sort() : [],
    [handover, workShiftDates],
  );
  const handoverTotalH = handoverDates.length * 0.5;
  const handoverPay   = handoverTotalH * hourlyRate * 1.33;

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    total: rows.reduce((s, r) => s + r.total, 0),
    b133:  rows.reduce((s, r) => s + r.b133,  0),
    b166:  rows.reduce((s, r) => s + r.b166,  0),
    b200:  rows.reduce((s, r) => s + r.b200,  0),
    pay:   rows.reduce((s, r) => s + r.pay,   0),
  }), [rows]);

  const midPay     = midCount   * midPerShift;
  const nightPay   = nightCount * nitePerShift;
  const grandTotal = totals.pay + (handover ? handoverPay : 0) + midPay + nightPay;

  const isLoading = otLoading || shLoading;
  const hasData   = rows.length > 0 || (handover && handoverDates.length > 0) || midPay > 0 || nightPay > 0;

  return (
    <div className="p-4 max-w-3xl mx-auto pb-8">

      {/* ── Header ── */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">加班費計算</h1>
      </div>

      {/* ── Period navigator ── */}
      <div className="flex items-center justify-between mb-3 bg-card border border-card-border rounded-2xl px-4 py-2.5">
        <button onClick={() => setOffset((o) => o - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{period.label}</p>
          <p className="text-xs text-muted-foreground">{period.from} ～ {period.to}</p>
        </div>
        <button
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset >= 0}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Overtime table ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">本期無加班記錄</p>
          <p className="text-sm mt-1">至行事曆頁面記錄加班時數</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden mb-4">
          {/* Header */}
          <div className="grid grid-cols-[1.2fr_0.7fr_0.8fr_0.8fr_0.8fr] bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground">
            <div className="px-3 py-2.5">日期</div>
            <div className="px-2 py-2.5 text-right">總時數</div>
            <div className="px-2 py-2.5 text-right"><span className="text-orange-500">1.33</span>加班</div>
            <div className="px-2 py-2.5 text-right"><span className="text-amber-500">1.66</span>加班</div>
            <div className="px-2 py-2.5 text-right"><span className="text-red-500">2.0</span>加班</div>
          </div>

          {/* Rows */}
          {rows.map((row, i) => (
            <motion.div
              key={row.date}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="grid grid-cols-[1.2fr_0.7fr_0.8fr_0.8fr_0.8fr] border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <div className="px-3 py-2.5 text-sm font-medium text-foreground">
                {shortDate(row.date)}
              </div>
              <div className="px-2 py-2.5 text-sm text-right font-semibold">{fh(row.total)}</div>
              <div className="px-2 py-2.5 text-sm text-right text-orange-600">{fh(row.b133)}</div>
              <div className="px-2 py-2.5 text-sm text-right text-amber-600">{fh(row.b166)}</div>
              <div className="px-2 py-2.5 text-sm text-right text-red-600">{fh(row.b200)}</div>
            </motion.div>
          ))}

          {/* Totals */}
          <div className="grid grid-cols-[1.2fr_0.7fr_0.8fr_0.8fr_0.8fr] bg-muted/60 border-t-2 border-border text-xs font-bold">
            <div className="px-3 py-2.5 text-foreground">合計</div>
            <div className="px-2 py-2.5 text-right">{totals.total}h</div>
            <div className="px-2 py-2.5 text-right text-orange-600">{totals.b133 > 0 ? `${totals.b133}h` : "-"}</div>
            <div className="px-2 py-2.5 text-right text-amber-600">{totals.b166 > 0 ? `${totals.b166}h` : "-"}</div>
            <div className="px-2 py-2.5 text-right text-red-600">{totals.b200 > 0 ? `${totals.b200}h` : "-"}</div>
          </div>
        </div>
      )}

      {/* ── Pay summary ── */}
      {hasData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-card-border rounded-2xl p-4 space-y-2"
        >
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">費用明細</span>
          </div>

          {/* OT pay lines */}
          {totals.b133 > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">1.33× 加班 {totals.b133}h</span>
              <span className="font-medium text-orange-600">
                {baseSalary > 0 ? fm(hourlyRate * totals.b133 * 1.33) : "請設定底薪"}
              </span>
            </div>
          )}
          {totals.b166 > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">1.66× 加班 {totals.b166}h</span>
              <span className="font-medium text-amber-600">
                {baseSalary > 0 ? fm(hourlyRate * totals.b166 * 1.66) : "—"}
              </span>
            </div>
          )}
          {totals.b200 > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">2.0× 加班 {totals.b200}h</span>
              <span className="font-medium text-red-600">
                {baseSalary > 0 ? fm(hourlyRate * totals.b200 * 2.0) : "—"}
              </span>
            </div>
          )}

          {/* Handover — separate line with detail toggle */}
          {handover && handoverDates.length > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>交接班 {handoverDates.length} 日 × 0.5h × 1.33</span>
                  <button
                    type="button"
                    onClick={() => setShowHandoverDetail((v) => !v)}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors border border-teal-200"
                  >
                    明細
                    {showHandoverDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
                <span className="font-medium text-teal-600">
                  {baseSalary > 0 ? fm(handoverPay) : "請設定底薪"}
                </span>
              </div>

              {/* Handover detail list */}
              <AnimatePresence>
                {showHandoverDetail && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 ml-2 border-l-2 border-teal-200 pl-3 space-y-1 py-1">
                      {handoverDates.map((date) => (
                        <div key={date} className="flex justify-between text-xs text-muted-foreground">
                          <span>{shortDate(date)}</span>
                          <span className="text-teal-600">0.5h</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Mid-shift allowance */}
          {midCount > 0 && midPerShift > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">中班津貼 {midCount} 次 × ${midPerShift.toLocaleString()}</span>
              <span className="font-medium text-violet-600">{fm(midPay)}</span>
            </div>
          )}
          {midCount > 0 && midPerShift === 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">中班 {midCount} 次（未設定津貼金額）</span>
              <span className="text-muted-foreground">—</span>
            </div>
          )}

          {/* Night-shift allowance */}
          {nightCount > 0 && nitePerShift > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">晚班津貼 {nightCount} 次 × ${nitePerShift.toLocaleString()}</span>
              <span className="font-medium text-indigo-600">{fm(nightPay)}</span>
            </div>
          )}
          {nightCount > 0 && nitePerShift === 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">晚班 {nightCount} 次（未設定津貼金額）</span>
              <span className="text-muted-foreground">—</span>
            </div>
          )}

          {/* Grand total */}
          <div className="pt-3 mt-1 border-t border-border flex justify-between items-center">
            <span className="text-sm font-semibold text-foreground">本期合計</span>
            <span className={`text-xl font-bold ${baseSalary > 0 ? "text-primary" : "text-muted-foreground"}`}>
              {baseSalary > 0 ? fm(grandTotal) : "請設定底薪"}
            </span>
          </div>

          {baseSalary > 0 && (
            <p className="text-[11px] text-muted-foreground">
              加班費計算：底薪 {baseSalary.toLocaleString()} ÷ 240 × 時數 × 加權係數
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
