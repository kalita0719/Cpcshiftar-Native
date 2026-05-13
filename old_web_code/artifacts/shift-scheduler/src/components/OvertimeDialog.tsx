import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2 } from "lucide-react";
import { useUpsertOvertime, useDeleteOvertime, type Overtime } from "@/hooks/useOvertime";
import type { ShiftItem } from "@/components/MonthView";

/* ── OT / Class slider constants ─────────────────────────── */
const MAX_H = 5;
const MIN_H = -MAX_H;
const STEP = 0.5;
const HO = 0.25;

const NUMBERS_H = 22;
const TICKS_H = 18;
const TRACK_H = 10;
const CIRCLE_D = 22;
const CIRCLE_R = CIRCLE_D / 2;
const TRACK_TOP = NUMBERS_H + TICKS_H;
const TRACK_CENTER = TRACK_TOP + TRACK_H / 2;
const LINE_TOP = 4;
const LINE_H = TRACK_CENTER - LINE_TOP;
const CONTAINER_H = TRACK_TOP + TRACK_H + CIRCLE_R + 6;

const RULER_VALUES: { v: number; pct: number }[] = [];
for (let v = -4; v <= 4; v++) {
  RULER_VALUES.push({ v, pct: ((v - MIN_H) / (MAX_H - MIN_H)) * 100 });
}
const TICKS: { v: number; pct: number; major: boolean }[] = [];
for (let i = 0; i <= Math.round((MAX_H - MIN_H) / STEP); i++) {
  const v = Math.round((MIN_H + i * STEP) * 100) / 100;
  TICKS.push({ v, pct: ((v - MIN_H) / (MAX_H - MIN_H)) * 100, major: Number.isInteger(v) });
}

/* ── Range slider constants ──────────────────────────────── */
const R_RULER_H = 22;
const R_TRACK_TOP = 30;
const R_TRACK_H = 8;
const R_TRACK_CENTER = R_TRACK_TOP + R_TRACK_H / 2;
const R_CIRCLE_D = 20;
const R_CIRCLE_R = R_CIRCLE_D / 2;
const R_CIRCLE_TOP = R_TRACK_CENTER - R_CIRCLE_R;
const R_LABEL_TOP = R_CIRCLE_TOP + R_CIRCLE_D + 4;
const R_CONTAINER_H = R_LABEL_TOP + 30;
const LEAVE_COLOR = "#ec4899";

/* ── Helpers ─────────────────────────────────────────────── */
function ls(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function timeToMin(t: string): number {
  if (!t || !t.includes(":")) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minToTimeStr(min: number): string {
  const total = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function shiftTime(timeStr: string, deltaHours: number): string {
  if (!timeStr || !timeStr.includes(":")) return timeStr;
  const [h, m] = timeStr.split(":").map(Number);
  const total = ((h * 60 + m + Math.round(deltaHours * 60)) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function posToTimeStr(pos: number, shiftStartMin: number): string {
  return minToTimeStr(shiftStartMin + pos);
}

function timeStrToPos(timeStr: string, shiftStartMin: number): number {
  const min = timeToMin(timeStr);
  let pos = min - shiftStartMin;
  if (pos < 0) pos += 1440;
  return pos;
}

const DAY_MAP = ["日", "一", "二", "三", "四", "五", "六"];
function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${dateStr} (${DAY_MAP[d.getDay()]})`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
  existing?: Overtime | null;
  shift?: ShiftItem;
}

export default function OvertimeDialog({ open, onOpenChange, date, existing, shift }: Props) {
  const upsert = useUpsertOvertime();
  const del = useDeleteOvertime();

  const [type, setType] = useState<"加班" | "上課" | "請假">("加班");
  const [sliderValue, setSliderValue] = useState(0);
  const [leaveStartPos, setLeaveStartPos] = useState(0);
  const [leaveEndPos, setLeaveEndPos] = useState(0);
  const [notes, setNotes] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const otContainerRef = useRef<HTMLDivElement>(null);
  const leaveContainerRef = useRef<HTMLDivElement>(null);

  const handoverEnabled = useMemo(() => ls("ot_handover_enabled", "false") === "true", []);
  const ho = handoverEnabled ? HO : 0;

  const shiftStartMin = useMemo(() => timeToMin(shift?.startTime ?? "00:00"), [shift?.startTime]);
  const shiftEndMin   = useMemo(() => timeToMin(shift?.endTime   ?? "00:00"), [shift?.endTime]);
  const shiftDurationMin = useMemo(() => {
    if (!shift) return 480;
    return shiftEndMin > shiftStartMin
      ? shiftEndMin - shiftStartMin
      : 1440 - shiftStartMin + shiftEndMin;
  }, [shift, shiftStartMin, shiftEndMin]);

  useEffect(() => {
    if (!open) return;
    if (existing?.leaveStart && existing?.leaveEnd) {
      setType("請假");
      setLeaveStartPos(timeStrToPos(existing.leaveStart, shiftStartMin));
      setLeaveEndPos(timeStrToPos(existing.leaveEnd, shiftStartMin));
    } else if ((existing?.earlyHours ?? 0) > 0) {
      setType("加班"); setSliderValue(-Number(existing!.earlyHours));
    } else if ((existing?.lateHours ?? 0) > 0) {
      setType("加班"); setSliderValue(Number(existing!.lateHours));
    } else if ((existing?.earlyClassHours ?? 0) > 0) {
      setType("上課"); setSliderValue(-Number(existing!.earlyClassHours));
    } else if ((existing?.lateClassHours ?? 0) > 0) {
      setType("上課"); setSliderValue(Number(existing!.lateClassHours));
    } else {
      setType("加班"); setSliderValue(0);
    }
    setNotes(existing?.notes ?? "");
  }, [open, existing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (type === "請假" && !existing?.leaveStart) {
      setLeaveStartPos(0);
      setLeaveEndPos(shiftDurationMin);
    }
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── OT slider ──────────────────────────────────────────── */
  const hours = Math.abs(sliderValue);
  const isEarly = sliderValue < 0;
  const isLate = sliderValue > 0;
  const direction = isEarly ? "提早" : isLate ? "延時" : "";
  const typeColor = type === "加班" ? "#f97316" : type === "上課" ? "#3b82f6" : LEAVE_COLOR;
  const baseStart = shift?.startTime ?? "--:--";
  const baseEnd = shift?.endTime ?? "--:--";
  const dispStart = isEarly ? shiftTime(baseStart, sliderValue - ho) : baseStart;
  const dispEnd = isLate ? shiftTime(baseEnd, sliderValue + ho) : baseEnd;
  const thumbPct = ((sliderValue - MIN_H) / (MAX_H - MIN_H)) * 100;

  const computeOtValue = useCallback((clientX: number): number => {
    if (!otContainerRef.current) return 0;
    const rect = otContainerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = MIN_H + pct * (MAX_H - MIN_H);
    const stepped = Math.round(raw / STEP) * STEP;
    return Math.max(MIN_H, Math.min(MAX_H, Math.round(stepped * 100) / 100));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setSliderValue(computeOtValue(e.clientX));
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setSliderValue(computeOtValue(e.clientX));
  };
  const handlePointerUp = () => setIsDragging(false);

  /* ── Leave range slider ──────────────────────────────────── */
  const computeLeavePos = useCallback((clientX: number): number => {
    if (!leaveContainerRef.current) return 0;
    const rect = leaveContainerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = pct * shiftDurationMin;
    const stepped = Math.round(raw / 30) * 30;
    return Math.max(0, Math.min(shiftDurationMin, stepped));
  }, [shiftDurationMin]);

  const leaveStartPct = shiftDurationMin > 0 ? (leaveStartPos / shiftDurationMin) * 100 : 0;
  const leaveEndPct = shiftDurationMin > 0 ? (leaveEndPos / shiftDurationMin) * 100 : 100;
  const leaveStartTimeStr = posToTimeStr(leaveStartPos, shiftStartMin);
  const leaveEndTimeStr = posToTimeStr(leaveEndPos, shiftStartMin);

  const leaveTickPositions = useMemo(
    () => Array.from({ length: Math.floor(shiftDurationMin / 30) + 1 }, (_, i) => i * 30),
    [shiftDurationMin],
  );

  const leaveHourMarks = useMemo(() => {
    if (!shift) return [];
    const marks: { pos: number; label: string; isEdge: boolean }[] = [
      { pos: 0, label: shift.startTime, isEdge: true },
      { pos: shiftDurationMin, label: shift.endTime, isEdge: true },
    ];
    for (let pos = 60; pos < shiftDurationMin; pos += 60) {
      const abs = (shiftStartMin + pos) % 1440;
      marks.push({ pos, label: String(Math.floor(abs / 60) % 24), isEdge: false });
    }
    return marks.sort((a, b) => a.pos - b.pos);
  }, [shift, shiftDurationMin, shiftStartMin]);

  /* ── Submit / Delete ─────────────────────────────────────── */
  const canSaveLeave = type === "請假" && !!shift && leaveEndPos > leaveStartPos;
  const canSaveOt = type !== "請假" && hours > 0;
  const canSave = type === "請假" ? canSaveLeave : canSaveOt;

  const handleSubmit = () => {
    if (type === "請假") {
      upsert.mutate(
        {
          date,
          earlyHours: 0, lateHours: 0, earlyClassHours: 0, lateClassHours: 0,
          leaveStart: leaveStartTimeStr,
          leaveEnd: leaveEndTimeStr,
          notes: notes || undefined,
        },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      upsert.mutate(
        {
          date,
          earlyHours:      type === "加班" && isEarly ? hours : 0,
          lateHours:       type === "加班" && isLate  ? hours : 0,
          earlyClassHours: type === "上課" && isEarly ? hours : 0,
          lateClassHours:  type === "上課" && isLate  ? hours : 0,
          leaveStart: undefined,
          leaveEnd: undefined,
          notes: notes || undefined,
        },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  const handleDelete = () => {
    del.mutate(date, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-foreground">加班/請假紀錄</h2>
                <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>

            {/* Type toggle — 3 buttons */}
            <div className="flex bg-muted rounded-xl p-1 mb-4">
              {(["加班", "上課", "請假"] as const).map((t) => {
                const colors: Record<string, string> = {
                  加班: "bg-orange-500 shadow-orange-500/30",
                  上課: "bg-blue-500 shadow-blue-500/30",
                  請假: "bg-pink-500 shadow-pink-500/30",
                };
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold tracking-[0.2em] transition-all duration-200 ${
                      type === t
                        ? `${colors[t]} text-white shadow`
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "加班" ? "加 班" : t === "上課" ? "上 課" : "請 假"}
                  </button>
                );
              })}
            </div>

            {/* ── 加班/上課 content ────────────────────────────── */}
            {type !== "請假" && (
              <>
                {/* Time display */}
                <div className="text-center mb-3 h-8 flex items-center justify-center">
                  {hours > 0 ? (
                    <div className="text-xl font-bold" style={{ color: typeColor }}>
                      {dispStart} — {dispEnd}&nbsp;&nbsp;{direction} {hours}h
                    </div>
                  ) : (
                    <div className="text-base text-muted-foreground">
                      {baseStart} — {baseEnd}
                    </div>
                  )}
                </div>

                {/* OT Slider */}
                <div style={{ paddingLeft: 4, paddingRight: 4, marginBottom: 20 }}>
                  <div
                    ref={otContainerRef}
                    style={{
                      position: "relative",
                      height: CONTAINER_H,
                      touchAction: "none",
                      cursor: isDragging ? "grabbing" : "pointer",
                      userSelect: "none",
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  >
                    {RULER_VALUES.map(({ v, pct }) => (
                      <span
                        key={v}
                        style={{
                          position: "absolute", top: 0, left: `${pct}%`,
                          transform: "translateX(-50%)", lineHeight: `${NUMBERS_H}px`,
                          fontSize: 11, fontFamily: "monospace", color: "#94a3b8",
                          pointerEvents: "none", whiteSpace: "nowrap",
                        }}
                      >
                        {Math.abs(v)}
                      </span>
                    ))}
                    {TICKS.map(({ v, pct, major }) => (
                      <div
                        key={v}
                        style={{
                          position: "absolute", top: NUMBERS_H, left: `${pct}%`,
                          transform: "translateX(-50%)", width: 1.5,
                          height: major ? TICKS_H : TICKS_H * 0.55,
                          background: major ? "#94a3b8" : "#cbd5e1", pointerEvents: "none",
                        }}
                      />
                    ))}
                    <div
                      style={{
                        position: "absolute", top: TRACK_TOP, left: 0, right: 0,
                        height: TRACK_H, background: "#e2e8f0", borderRadius: 9999, pointerEvents: "none",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute", top: LINE_TOP, left: `${thumbPct}%`,
                        transform: "translateX(-50%)", width: CIRCLE_D,
                        height: LINE_H + CIRCLE_D, pointerEvents: "none",
                      }}
                    >
                      <div style={{
                        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                        width: 2, height: LINE_H, background: typeColor, borderRadius: 1,
                      }} />
                      <div style={{
                        position: "absolute", top: LINE_H - CIRCLE_R, left: 0,
                        width: CIRCLE_D, height: CIRCLE_D, borderRadius: "50%",
                        background: typeColor, boxShadow: `0 2px 10px ${typeColor}40`,
                      }} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── 請假 content ─────────────────────────────────── */}
            {type === "請假" && (
              <div style={{ marginBottom: 20 }}>
                {!shift ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    此日無班次，無法新增請假紀錄
                  </div>
                ) : (
                  <>
                    {/* Leave time display */}
                    <div className="text-center mb-3 h-8 flex items-center justify-center">
                      <div className="text-xl font-bold" style={{ color: LEAVE_COLOR }}>
                        {leaveStartTimeStr} — {leaveEndTimeStr}
                        &nbsp;&nbsp;請假 {Math.round((leaveEndPos - leaveStartPos) / 30) / 2}h
                      </div>
                    </div>

                    {/* Range slider */}
                    <div
                      ref={leaveContainerRef}
                      style={{
                        position: "relative",
                        height: R_CONTAINER_H,
                        touchAction: "none",
                        userSelect: "none",
                        paddingLeft: 0,
                        paddingRight: 0,
                      }}
                    >
                      {/* Hour ruler labels */}
                      {leaveHourMarks.map(({ pos, label, isEdge }) => (
                        <span
                          key={pos}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: `${(pos / shiftDurationMin) * 100}%`,
                            transform: "translateX(-50%)",
                            lineHeight: `${R_RULER_H}px`,
                            fontSize: isEdge ? 10 : 11,
                            fontFamily: "monospace",
                            color: isEdge ? "#64748b" : "#94a3b8",
                            fontWeight: isEdge ? 600 : 400,
                            pointerEvents: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {label}
                        </span>
                      ))}

                      {/* Track base */}
                      <div
                        style={{
                          position: "absolute",
                          top: R_TRACK_TOP,
                          left: 0,
                          right: 0,
                          height: R_TRACK_H,
                          background: "#e2e8f0",
                          borderRadius: 9999,
                          pointerEvents: "none",
                        }}
                      />

                      {/* Pink fill between thumbs */}
                      <div
                        style={{
                          position: "absolute",
                          top: R_TRACK_TOP,
                          left: `${leaveStartPct}%`,
                          width: `${leaveEndPct - leaveStartPct}%`,
                          height: R_TRACK_H,
                          background: LEAVE_COLOR,
                          pointerEvents: "none",
                        }}
                      />

                      {/* Half-hour tick marks */}
                      {leaveTickPositions.map((pos) => {
                        const pct = (pos / shiftDurationMin) * 100;
                        const isMajor = pos % 60 === 0;
                        return (
                          <div
                            key={pos}
                            style={{
                              position: "absolute",
                              top: R_TRACK_TOP - (isMajor ? 4 : 2),
                              left: `${pct}%`,
                              transform: "translateX(-50%)",
                              width: 1,
                              height: isMajor ? 4 : 2,
                              background: isMajor ? "#94a3b8" : "#cbd5e1",
                              pointerEvents: "none",
                            }}
                          />
                        );
                      })}

                      {/* Start thumb circle */}
                      <div
                        style={{
                          position: "absolute",
                          top: R_CIRCLE_TOP,
                          left: `${leaveStartPct}%`,
                          transform: "translateX(-50%)",
                          width: R_CIRCLE_D,
                          height: R_CIRCLE_D,
                          borderRadius: "50%",
                          background: LEAVE_COLOR,
                          boxShadow: `0 2px 8px ${LEAVE_COLOR}50`,
                          cursor: "grab",
                          touchAction: "none",
                          zIndex: 2,
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (!e.buttons) return;
                          const newPos = computeLeavePos(e.clientX);
                          setLeaveStartPos(Math.min(newPos, leaveEndPos - 30));
                        }}
                        onPointerUp={(e) => {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        }}
                      />
                      {/* Start label */}
                      <div
                        style={{
                          position: "absolute",
                          top: R_LABEL_TOP,
                          left: `${leaveStartPct}%`,
                          transform: "translateX(-50%)",
                          textAlign: "center",
                          pointerEvents: "none",
                          lineHeight: 1.2,
                          minWidth: 36,
                        }}
                      >
                        <div style={{ fontSize: 11, color: LEAVE_COLOR, fontWeight: 700 }}>{leaveStartTimeStr}</div>
                        <div style={{ fontSize: 9, color: "#9ca3af" }}>開始</div>
                      </div>

                      {/* End thumb circle */}
                      <div
                        style={{
                          position: "absolute",
                          top: R_CIRCLE_TOP,
                          left: `${leaveEndPct}%`,
                          transform: "translateX(-50%)",
                          width: R_CIRCLE_D,
                          height: R_CIRCLE_D,
                          borderRadius: "50%",
                          background: LEAVE_COLOR,
                          boxShadow: `0 2px 8px ${LEAVE_COLOR}50`,
                          cursor: "grab",
                          touchAction: "none",
                          zIndex: 2,
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (!e.buttons) return;
                          const newPos = computeLeavePos(e.clientX);
                          setLeaveEndPos(Math.max(newPos, leaveStartPos + 30));
                        }}
                        onPointerUp={(e) => {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        }}
                      />
                      {/* End label */}
                      <div
                        style={{
                          position: "absolute",
                          top: R_LABEL_TOP,
                          left: `${leaveEndPct}%`,
                          transform: "translateX(-50%)",
                          textAlign: "center",
                          pointerEvents: "none",
                          lineHeight: 1.2,
                          minWidth: 36,
                        }}
                      >
                        <div style={{ fontSize: 11, color: LEAVE_COLOR, fontWeight: 700 }}>{leaveEndTimeStr}</div>
                        <div style={{ fontSize: 9, color: "#9ca3af" }}>結束</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Notes */}
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="備註（選填）"
              className="w-full bg-muted text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-3 text-sm mb-5 outline-none focus:ring-2 focus:ring-border border border-transparent focus:border-border"
            />

            {/* Actions */}
            <div className="flex items-center gap-3">
              {existing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={del.isPending}
                  className="w-11 h-11 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={upsert.isPending || !canSave}
                className={`flex-1 py-3 rounded-xl font-bold tracking-[0.15em] text-sm transition-all duration-200 ${
                  canSave ? "text-white" : "bg-muted text-muted-foreground opacity-40"
                }`}
                style={canSave ? { backgroundColor: typeColor } : {}}
              >
                {existing ? "更 新" : "確 認"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
