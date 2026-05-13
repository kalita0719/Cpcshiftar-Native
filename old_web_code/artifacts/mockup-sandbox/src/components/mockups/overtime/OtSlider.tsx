import { useState, useRef, useCallback } from "react";

const MAX_H = 5;
const MIN_H = -MAX_H;
const STEP = 0.5;

function shiftTime(timeStr: string, deltaHours: number): string {
  if (!timeStr || !timeStr.includes(":")) return timeStr;
  const [h, m] = timeStr.split(":").map(Number);
  const total = ((h * 60 + m + Math.round(deltaHours * 60)) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const MOCK_SHIFT = { startTime: "07:00", endTime: "16:00" };

const RULER_VALUES: { v: number; pct: number }[] = [];
for (let v = -4; v <= 4; v++) {
  RULER_VALUES.push({ v, pct: ((v - MIN_H) / (MAX_H - MIN_H)) * 100 });
}

const TICKS: { v: number; pct: number; major: boolean }[] = [];
for (let i = 0; i <= Math.round((MAX_H - MIN_H) / STEP); i++) {
  const v = Math.round((MIN_H + i * STEP) * 100) / 100;
  const major = Number.isInteger(v);
  TICKS.push({ v, pct: ((v - MIN_H) / (MAX_H - MIN_H)) * 100, major });
}

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

export function OtSlider() {
  const [type, setType] = useState<"加班" | "上課">("加班");
  const [value, setValue] = useState(2.5);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hours = Math.abs(value);
  const isEarly = value < 0;
  const isLate = value > 0;
  const direction = isEarly ? "提早" : isLate ? "延時" : "";
  const typeColor = type === "加班" ? "#f97316" : "#3b82f6";

  const dispStart = isEarly ? shiftTime(MOCK_SHIFT.startTime, value) : MOCK_SHIFT.startTime;
  const dispEnd = isLate ? shiftTime(MOCK_SHIFT.endTime, value) : MOCK_SHIFT.endTime;

  const thumbPct = ((value - MIN_H) / (MAX_H - MIN_H)) * 100;

  const computeValue = useCallback((clientX: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = MIN_H + pct * (MAX_H - MIN_H);
    const stepped = Math.round(raw / STEP) * STEP;
    return Math.max(MIN_H, Math.min(MAX_H, Math.round(stepped * 100) / 100));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setValue(computeValue(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setValue(computeValue(e.clientX));
  };

  const handlePointerUp = () => setIsDragging(false);

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex items-center justify-center p-4">
      <div className="w-full max-w-[360px]">
        {/* Type toggle */}
        <div className="flex bg-[#252b3b] rounded-2xl p-1 mb-6">
          <button
            onClick={() => setType("加班")}
            className={`flex-1 py-3 rounded-xl text-sm font-bold tracking-[0.2em] transition-all duration-200 ${
              type === "加班"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            加 班
          </button>
          <button
            onClick={() => setType("上課")}
            className={`flex-1 py-3 rounded-xl text-sm font-bold tracking-[0.2em] transition-all duration-200 ${
              type === "上課"
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            上 課
          </button>
        </div>

        {/* Time display — ABOVE ruler */}
        <div
          className="text-center mb-4"
          style={{ minHeight: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
        >
          {hours > 0 ? (
            <>
              <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>
                {dispStart} — {dispEnd} ({isEarly ? "−" : "+"}{hours} hrs)
              </div>
              <div style={{ color: typeColor, fontSize: 20, fontWeight: 700 }}>
                {dispStart} — {dispEnd}&nbsp;&nbsp;{direction} {hours}h
              </div>
            </>
          ) : (
            <div style={{ color: "#64748b", fontSize: 16 }}>
              {MOCK_SHIFT.startTime} — {MOCK_SHIFT.endTime}
            </div>
          )}
        </div>

        {/* Slider */}
        <div style={{ paddingLeft: 4, paddingRight: 4, marginBottom: 32 }}>
          <div
            ref={containerRef}
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
            {/* Ruler numbers */}
            {RULER_VALUES.map(({ v, pct }) => (
              <span
                key={v}
                style={{
                  position: "absolute",
                  top: 0,
                  left: `${pct}%`,
                  transform: "translateX(-50%)",
                  lineHeight: `${NUMBERS_H}px`,
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "#64748b",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {Math.abs(v)}
              </span>
            ))}

            {/* Tick marks */}
            {TICKS.map(({ v, pct, major }) => (
              <div
                key={v}
                style={{
                  position: "absolute",
                  top: NUMBERS_H,
                  left: `${pct}%`,
                  transform: "translateX(-50%)",
                  width: 1.5,
                  height: major ? TICKS_H : TICKS_H * 0.55,
                  background: major ? "#475569" : "#334155",
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* Track — uniform light gray */}
            <div
              style={{
                position: "absolute",
                top: TRACK_TOP,
                left: 0,
                right: 0,
                height: TRACK_H,
                background: "#334155",
                borderRadius: 9999,
                pointerEvents: "none",
              }}
            />

            {/* Thumb: line + circle */}
            <div
              style={{
                position: "absolute",
                top: LINE_TOP,
                left: `${thumbPct}%`,
                transform: "translateX(-50%)",
                width: CIRCLE_D,
                height: LINE_H + CIRCLE_D,
                pointerEvents: "none",
              }}
            >
              {/* Vertical line — from ruler bottom down to circle center */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 2,
                  height: LINE_H,
                  background: typeColor,
                  borderRadius: 1,
                }}
              />
              {/* Circle — centered on track */}
              <div
                style={{
                  position: "absolute",
                  top: LINE_H - CIRCLE_R,
                  left: 0,
                  width: CIRCLE_D,
                  height: CIRCLE_D,
                  borderRadius: "50%",
                  background: typeColor,
                  boxShadow: `0 2px 10px ${typeColor}60`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Confirm */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            style={{
              background: "#252b3b",
              border: "1px solid #475569",
              color: "#e2e8f0",
              borderRadius: 9999,
              padding: "12px 56px",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "0.2em",
              cursor: "pointer",
            }}
          >
            確 認
          </button>
        </div>
      </div>
    </div>
  );
}
