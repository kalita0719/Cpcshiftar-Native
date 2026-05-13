import { useState } from "react";
import { motion } from "framer-motion";
import {
  format,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import { useListShifts } from "@workspace/api-client-react";
import { useOvertimeRange, type Overtime } from "@/hooks/useOvertime";

const DAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];

function shiftTime(timeStr: string, deltaHours: number): string {
  if (!timeStr || !timeStr.includes(":")) return timeStr;
  const [h, m] = timeStr.split(":").map(Number);
  const total = ((h * 60 + m + Math.round(deltaHours * 60)) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function timeToMin(t: string): number {
  if (!t || !t.includes(":")) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function timeCoord(timeStr: string, shiftStartMin: number): number {
  const min = timeToMin(timeStr);
  return min >= shiftStartMin ? min : min + 1440;
}

function leaveCase(
  shiftStartTime: string,
  shiftEndTime: string,
  leaveStart: string,
  leaveEnd: string,
): 9 | 10 | 11 | 12 {
  const ssm = timeToMin(shiftStartTime);
  const sc = timeCoord(shiftStartTime, ssm);
  const ec = timeCoord(shiftEndTime, ssm);
  const lsc = timeCoord(leaveStart, ssm);
  const lec = timeCoord(leaveEnd, ssm);
  const startCovered = sc >= lsc && sc <= lec;
  const endCovered = ec >= lsc && ec <= lec;
  if (startCovered && endCovered) return 9;
  if (startCovered) return 10;
  if (endCovered) return 11;
  return 12;
}

const LEAVE_COLOR = "#ec4899";

export type ShiftItem = {
  id: number;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  date: string;
  notes?: string | null;
  createdAt: string;
};

const isHoliday = (name: string) => name === "休假";

function ls(key: string, fallback = "") {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

const HO = 0.25;

export default function MonthView({
  onShiftClick,
  onOvertime,
  scheduleMode,
  selectedScheduleDate,
  onDateSelect,
  cycleMode,
  cycleStart,
  cycleEnd,
}: {
  onShiftClick?: (date: Date, existing?: ShiftItem) => void;
  onOvertime?: (date: string, existing?: Overtime, shift?: ShiftItem) => void;
  scheduleMode?: boolean;
  selectedScheduleDate?: string | null;
  onDateSelect?: (dateStr: string) => void;
  cycleMode?: boolean;
  cycleStart?: string | null;
  cycleEnd?: string | null;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [handoverEnabled] = useState(() => ls("ot_handover_enabled", "false") === "true");
  const { data: allShifts, isLoading } = useListShifts();
  const today = format(new Date(), "yyyy-MM-dd");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 6);
  const calendarDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const rangeFrom = format(gridStart, "yyyy-MM-dd");
  const rangeTo = format(gridEnd, "yyyy-MM-dd");
  const { data: overtimeData } = useOvertimeRange(rangeFrom, rangeTo);
  const overtimeMap = new Map((overtimeData ?? []).map((o) => [o.date, o]));

  const shiftForDay = (date: Date): ShiftItem | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return (allShifts ?? []).find((s) => s.date === dateStr);
  };

  const isInCycleRange = (dateStr: string): boolean => {
    if (!cycleStart) return false;
    const lo = cycleEnd && cycleStart > cycleEnd ? cycleEnd : cycleStart;
    const hi = cycleEnd && cycleStart > cycleEnd ? cycleStart : (cycleEnd ?? cycleStart);
    return dateStr >= lo && dateStr <= hi;
  };

  const isCycleEndpoint = (dateStr: string): boolean => {
    if (!cycleStart) return false;
    return dateStr === cycleStart || (!!cycleEnd && dateStr === cycleEnd);
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-foreground font-bold text-xl flex-1">
          {format(currentMonth, "yyyy年 M月")}
        </p>
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="w-9 h-9 flex items-center justify-center rounded-full border border-border hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => setCurrentMonth(startOfMonth(new Date()))} className="px-3 py-1.5 text-xs rounded-full border border-border hover:bg-muted transition-colors font-medium">
          本月
        </button>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="w-9 h-9 flex items-center justify-center rounded-full border border-border hover:bg-muted transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0 mb-1">
        {DAY_NAMES.map((name) => (
          <div key={name} className="text-center text-xs font-medium text-muted-foreground py-1">
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0">
        {calendarDays.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isToday = dateStr === today;
          const inCurrentMonth = isSameMonth(day, currentMonth);
          const shift = shiftForDay(day);
          const overtime = overtimeMap.get(dateStr);

          const isOvertimeMode = !!onOvertime && !onShiftClick && !scheduleMode && !cycleMode;
          const isShiftMode = !!onShiftClick && !scheduleMode && !cycleMode;
          const isScheduleOrCycleMode = !!(scheduleMode || cycleMode);
          const isWork = !!shift && !isHoliday(shift.name);

          const isSelectedScheduleDate = scheduleMode && selectedScheduleDate === dateStr;
          const inCycleRange = cycleMode && isInCycleRange(dateStr);
          const isCycleEP = cycleMode && isCycleEndpoint(dateStr);

          const handleCellClick = () => {
            if (!inCurrentMonth) return;
            if (isScheduleOrCycleMode) {
              onDateSelect?.(dateStr);
            } else if (isShiftMode) {
              onShiftClick!(day, shift);
            } else if (isOvertimeMode) {
              onOvertime!(dateStr, overtime, shift);
            }
          };

          const interactive = inCurrentMonth && (isShiftMode || isOvertimeMode || isScheduleOrCycleMode);

          const ho = handoverEnabled ? HO : 0;

          const leaveStart = overtime?.leaveStart;
          const leaveEnd = overtime?.leaveEnd;
          const isLeave = !!(inCurrentMonth && isWork && overtime && leaveStart && leaveEnd);
          const lCase = isLeave && shift
            ? leaveCase(shift.startTime, shift.endTime, leaveStart!, leaveEnd!)
            : 0;

          let earlyContent: React.ReactNode = null;
          if (isLeave && shift && lCase !== 12) {
            if (lCase === 9) {
              earlyContent = (
                <div className="w-full h-full px-0 flex items-center gap-0 whitespace-nowrap overflow-hidden" style={{ lineHeight: 1.0, borderRadius: 1, background: "#fce7f3", color: LEAVE_COLOR }}>
                  <span className="text-[11px] leading-none mr-[-1px]">🏖️</span>
                  <span className="text-[12px] font-medium leading-none opacity-90">{leaveStart}</span>
                </div>
              );
            } else if (lCase === 10) {
              earlyContent = (
                <div className="w-full h-full px-0 flex items-center gap-0 whitespace-nowrap overflow-hidden" style={{ lineHeight: 1.0, borderRadius: 1, background: "#fce7f3", color: LEAVE_COLOR }}>
                  <span className="text-[11px] leading-none mr-[-1px]">🏖️</span>
                  <span className="text-[12px] font-medium leading-none opacity-90">{leaveEnd}</span>
                </div>
              );
            }
          } else if (inCurrentMonth && isWork && overtime) {
            const earlyHours = overtime.earlyHours ?? 0;
            const earlyClass = overtime.earlyClassHours ?? 0;
            if (earlyHours > 0) {
              earlyContent = (
                <div className="w-full h-full px-0 bg-orange-100 text-orange-600 flex items-center gap-0 whitespace-nowrap overflow-hidden" style={{ lineHeight: 1.0, borderRadius: 1 }}>
                  <span className="text-[11px] leading-none mr-[-1px]">🕒</span>
                  <span className="text-[12.5px] font-medium leading-none">{shiftTime(shift!.startTime, -(earlyHours + ho))}</span>
                </div>
              );
            } else if (earlyClass > 0) {
              earlyContent = (
                <div className="w-full h-full px-0 bg-blue-100 text-blue-600 flex items-center gap-0 whitespace-nowrap overflow-hidden" style={{ lineHeight: 1.0, borderRadius: 1 }}>
                  <span className="text-[11px] leading-none mr-[-1px]">📝</span>
                  <span className="text-[12.5px] font-medium leading-none">{shiftTime(shift!.startTime, -(earlyClass + ho))}</span>
                </div>
              );
            }
          }

          let lateContent: React.ReactNode = null;
          if (isLeave && shift && lCase !== 12) {
            if (lCase === 9) {
              lateContent = (
                <div className="w-full h-full px-0 flex items-center gap-0 whitespace-nowrap overflow-hidden" style={{ lineHeight: 1.0, borderRadius: 1, background: "#fce7f3", color: LEAVE_COLOR }}>
                  <span className="text-[11px] leading-none mr-[-1px]">🏖️</span>
                  <span className="text-[12.5px] font-medium leading-none opacity-90">{leaveEnd}</span>
                </div>
              );
            } else if (lCase === 11) {
              lateContent = (
                <div className="w-full h-full px-0 flex items-center gap-0 whitespace-nowrap overflow-hidden" style={{ lineHeight: 1.0, borderRadius: 1, background: "#fce7f3", color: LEAVE_COLOR }}>
                  <span className="text-[11px] leading-none mr-[-1px]">🏖️</span>
                  <span className="text-[12.5px] font-medium leading-none opacity-90">{leaveStart}</span>
                </div>
              );
            }
          } else if (inCurrentMonth && isWork && overtime) {
            const lateHours = overtime.lateHours ?? 0;
            const lateClass = overtime.lateClassHours ?? 0;
            if (lateHours > 0) {
              lateContent = (
                <div className="w-full h-full px-0 bg-amber-100 text-amber-600 flex items-center gap-0 whitespace-nowrap overflow-hidden" style={{ lineHeight: 1.0, borderRadius: 1 }}>
                  <span className="text-[11px] leading-none mr-[-1px]">🕒</span>
                  <span className="text-[12.5px] font-medium leading-none">{shiftTime(shift!.endTime, lateHours + ho)}</span>
                </div>
              );
            } else if (lateClass > 0) {
              lateContent = (
                <div className="w-full h-full px-0 bg-indigo-100 text-indigo-600 flex items-center gap-0 whitespace-nowrap overflow-hidden" style={{ lineHeight: 1.0, borderRadius: 1 }}>
                  <span className="text-[11px] leading-none mr-[-1px]">📝</span>
                  <span className="text-[12.5px] font-medium leading-none">{shiftTime(shift!.endTime, lateClass + ho)}</span>
                </div>
              );
            }
          }

          let cellBorderClass = "";
          if (isSelectedScheduleDate) {
            cellBorderClass = "ring-2 ring-primary ring-inset z-10";
          } else if (isCycleEP) {
            cellBorderClass = "border-2 border-dashed border-green-500 z-10";
          } else if (inCycleRange) {
            cellBorderClass = "border-2 border-dashed border-green-400 bg-green-50";
          } else if (isToday) {
            cellBorderClass = "border-2 border-red-500 z-10";
          }

          return (
            <motion.div
              key={dateStr}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.008 }}
              onClick={handleCellClick}
              className={`rounded-none min-h-[98px] flex flex-col overflow-hidden group transition-shadow border-r border-b ${
                interactive ? "cursor-pointer hover:shadow-sm" : ""
              } ${
                cellBorderClass
                  ? cellBorderClass
                  : isToday
                  ? "border-2 border-red-500 bg-card z-10"
                  : inCurrentMonth
                  ? "border border-card-border bg-card"
                  : "border border-border/40 bg-muted/30"
              } ${inCycleRange && !isCycleEP ? "bg-green-50" : inCurrentMonth && !isSelectedScheduleDate && !isCycleEP && !isToday ? "bg-card" : ""}`}
            >
              {/* Date number row */}
              <div className="flex items-start justify-between px-0.5 pt-0.5 pb-0">
                <span
                  className={`text-xl font-semibold leading-none flex items-center justify-center flex-shrink-0 -translate-y-px ${
                    isToday
                      ? "text-red-500"
                      : inCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {format(day, "d")}
                </span>
                {inCurrentMonth && !overtime && isOvertimeMode && (
                  <span className="opacity-0 group-hover:opacity-50 flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground transition-opacity">
                    <Clock className="w-2.5 h-2.5" />
                    加班
                  </span>
                )}
              </div>

              {/* Stacked: early slot → shift → late slot */}
              <div className="flex-1 flex flex-col px-0.5 pb-1 gap-0.5">

                {/* Early slot */}
                <div className="h-[22px] flex-shrink-0">
                  {earlyContent}
                </div>

                {!isLoading && shift && lCase === 9 && (
                  <motion.div
                    key={`${shift.id}-leave`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="font-medium overflow-hidden text-center py-0 text-white"
                    style={{ borderRadius: 1, backgroundColor: LEAVE_COLOR }}
                  >
                    <div className="text-[17px] font-semibold leading-tight whitespace-nowrap">請假</div>
                  </motion.div>
                )}
                {!isLoading && shift && lCase !== 9 && (
                  <motion.div
                    key={shift.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`font-medium overflow-hidden text-center py-0 ${
                      isHoliday(shift.name)
                        ? "bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center gap-0.5"
                        : "text-white"
                    }`}
                    style={{ borderRadius: 1, ...(isHoliday(shift.name) ? {} : { backgroundColor: shift.color }) }}
                  >
                    <div className="text-[17px] font-semibold leading-tight whitespace-nowrap">{shift.name}</div>
                  </motion.div>
                )}
                {!isLoading && !shift && inCurrentMonth && isShiftMode && (
                  <div className="opacity-0 group-hover:opacity-40 transition-opacity flex items-center justify-center h-full">
                    <Plus className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
                {!isLoading && !shift && inCurrentMonth && isScheduleOrCycleMode && (
                  <div className="opacity-0 group-hover:opacity-30 transition-opacity flex items-center justify-center h-full">
                    <Plus className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}

                {/* Late slot */}
                <div className="h-[22px] flex-shrink-0">
                  {lateContent}
                </div>

              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
