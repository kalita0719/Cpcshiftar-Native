import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useGetWeeklyShifts } from "@workspace/api-client-react";
import { Clock, Calendar, TrendingUp } from "lucide-react";
import { format, startOfWeek, addDays, getDaysInMonth } from "date-fns";
import OvertimeSettingsDialog from "@/components/OvertimeSettingsDialog";
import { useOvertimeRange } from "@/hooks/useOvertime";

// ─── localStorage helpers ─────────────────────────────────────────────────────
function ls(key: string, fallback = "") {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function shiftTime(timeStr: string, deltaHours: number): string {
  if (!timeStr || !timeStr.includes(":")) return timeStr;
  const [h, m] = timeStr.split(":").map(Number);
  const total = ((h * 60 + m + Math.round(deltaHours * 60)) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ─── Period calculation (same as OvertimePay) ─────────────────────────────────
function getPeriod(startDay: number): { from: string; to: string; label: string } {
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth();

  if (startDay <= 1) {
    const y = year, m = month;
    const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const to   = `${y}-${String(m + 1).padStart(2, "0")}-${String(getDaysInMonth(new Date(y, m))).padStart(2, "0")}`;
    return { from, to, label: `${y}年${m + 1}月` };
  }

  const day = today.getDate();
  const periodStart = day >= startDay
    ? new Date(year, month, startDay)
    : new Date(year, month - 1, startDay);
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, startDay - 1);

  return {
    from:  format(periodStart, "yyyy-MM-dd"),
    to:    format(periodEnd,   "yyyy-MM-dd"),
    label: `${format(periodStart, "M/d")} ～ ${format(periodEnd, "M/d")}`,
  };
}

export default function Dashboard() {
  const startDay = parseInt(ls("ot_start_day", "1"));
  const [handoverEnabled] = useState(() => ls("ot_handover_enabled", "false") === "true");

  const today    = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const period = useMemo(() => getPeriod(startDay), [startDay]);

  const { data: overtimeData }  = useOvertimeRange(period.from, period.to);
  const { data: nearOtData }    = useOvertimeRange(today, tomorrow);

  // Overtime map for today/tomorrow
  const nearOtMap = useMemo(
    () => new Map((nearOtData ?? []).map((o) => [o.date, o])),
    [nearOtData],
  );

  // Total overtime hours for the current salary period (excludes handover accumulation)
  const totalOtHours = useMemo(() => {
    if (!overtimeData) return null;
    return overtimeData.reduce((s, r) => s + (r.earlyHours ?? 0) + (r.lateHours ?? 0), 0);
  }, [overtimeData]);

  // Today/tomorrow shifts
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const { data: weekShifts } = useGetWeeklyShifts({ weekStart: format(weekStart, "yyyy-MM-dd") });

  const todayShifts    = weekShifts?.filter((s) => s.date === today)    ?? [];
  const tomorrowShifts = weekShifts?.filter((s) => s.date === tomorrow) ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {format(new Date(), "M月d日")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {["週日","週一","週二","週三","週四","週五","週六"][new Date().getDay()]}，祝你有個美好的一天
          </p>
        </div>
        <OvertimeSettingsDialog />
      </motion.div>

      {/* 本月加班時數 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-card border border-card-border rounded-2xl p-5 shadow-sm mb-8 flex items-center gap-5"
      >
        <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
          <TrendingUp className="w-7 h-7" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-3xl font-bold text-foreground">
            {totalOtHours === null ? "—" : `${totalOtHours}h`}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">本期加班時數</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
            {period.label}
          </div>
          {handoverEnabled && (
            <div className="text-[11px] text-muted-foreground mt-1.5">含交接班 0.5h</div>
          )}
        </div>
      </motion.div>

      {/* Today / Tomorrow */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> 今日班次
          </h2>
          {todayShifts.length === 0 ? (
            <p className="text-muted-foreground text-sm">今天沒有班次</p>
          ) : (
            <div className="space-y-3">
              {todayShifts.map((shift) => {
                const isWork = shift.name !== "休假";
                const ot = nearOtMap.get(today);
                const earlyH = (ot?.earlyHours ?? 0) || (ot?.earlyClassHours ?? 0);
                const lateH  = (ot?.lateHours  ?? 0) || (ot?.lateClassHours  ?? 0);
                const ho = handoverEnabled && isWork ? 0.25 : 0;
                const dispStart = isWork ? shiftTime(shift.startTime, -(earlyH + ho)) : shift.startTime;
                const dispEnd   = isWork ? shiftTime(shift.endTime,    lateH  + ho)   : shift.endTime;
                const changed = isWork && (earlyH > 0 || lateH > 0 || ho > 0);
                return (
                  <motion.div
                    key={shift.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted"
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: shift.color }} />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-foreground">{shift.name}</div>
                      <div className={`text-xs ${changed ? "text-orange-500 font-medium" : "text-muted-foreground"}`}>
                        {dispStart} - {dispEnd}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> 明日班次
          </h2>
          {tomorrowShifts.length === 0 ? (
            <p className="text-muted-foreground text-sm">明天沒有班次</p>
          ) : (
            <div className="space-y-3">
              {tomorrowShifts.map((shift) => {
                const isWork = shift.name !== "休假";
                const ot = nearOtMap.get(tomorrow);
                const earlyH = (ot?.earlyHours ?? 0) || (ot?.earlyClassHours ?? 0);
                const lateH  = (ot?.lateHours  ?? 0) || (ot?.lateClassHours  ?? 0);
                const ho = handoverEnabled && isWork ? 0.25 : 0;
                const dispStart = isWork ? shiftTime(shift.startTime, -(earlyH + ho)) : shift.startTime;
                const dispEnd   = isWork ? shiftTime(shift.endTime,    lateH  + ho)   : shift.endTime;
                const changed = isWork && (earlyH > 0 || lateH > 0 || ho > 0);
                return (
                  <div key={shift.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: shift.color }} />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-foreground">{shift.name}</div>
                      <div className={`text-xs ${changed ? "text-orange-500 font-medium" : "text-muted-foreground"}`}>
                        {dispStart} - {dispEnd}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
