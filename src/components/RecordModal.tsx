import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MultiSlider from "@ptomasroos/react-native-multi-slider";
import { Trash2, X } from "lucide-react-native";
import { timeToMin } from "@/src/logic/shiftLogic";
import { cardShadow, colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";
import {
  applyOvertimeNoteInput,
  finalizeOvertimeNote,
  OVERTIME_NOTE_MAX_LENGTH,
} from "@/src/constants/overtimeNotes";
import type { Overtime, ShiftItem } from "@/src/types";

const MAX_H = 5;
const MIN_H = -5;
const STEP = 0.5;
const HO = 0.25;
/* ── 時間工具 ─────────────────────────────────────────────── */
function minToTimeStr(min: number): string {
  const total = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function shiftTimeStr(timeStr: string, deltaHours: number): string {
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
function formatDateLabel(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return `${dateStr} (${DAY_MAP[d.getDay()]})`;
}

const THUMB = 22;
const LEAVE_STEP_MIN = 30;
const LEAVE_LABEL_W = 20;
const OT_TRACK_H = 8;
const OT_RULER_VALS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5] as const;
const RULER_NUM_H = 18;
const RULER_GAP = 4;
const TICK_MAJOR_H = 10;
const TICK_MINOR_H = 5;
/** 與 MultiSlider 預設高度一致，避免切換 tab 時卡片跳動 */
const PANEL_SLIDER_H = 50;
const PANEL_SLOT_MIN_H =
  36 + // timeLine minHeight
  8 + // timeLine marginBottom
  RULER_NUM_H +
  RULER_GAP +
  TICK_MAJOR_H +
  4 + // ruler marginBottom
  PANEL_SLIDER_H +
  8; // sliderWrap marginBottom

const rulerLabelStyle = {
  lineHeight: RULER_NUM_H,
  textAlign: "center" as const,
  includeFontPadding: false,
};

const OT_TICKS: { v: number; major: boolean }[] = [];
for (let i = 0; i <= (MAX_H - MIN_H) / STEP; i++) {
  const v = Math.round((MIN_H + i * STEP) * 100) / 100;
  OT_TICKS.push({ v, major: Number.isInteger(v) });
}

function otValueToX(v: number, trackW: number): number {
  const trackInner = Math.max(trackW - THUMB, 1);
  return THUMB / 2 + ((v - MIN_H) / (MAX_H - MIN_H)) * trackInner;
}

/** 與 MultiSlider（min/max/step）相同的離散刻度。 */
function buildLeaveOptions(maxPos: number, step = LEAVE_STEP_MIN): number[] {
  const options: number[] = [];
  for (let v = 0; v <= maxPos; v += step) options.push(v);
  return options;
}

/** 預設請假區間：整段上班時間（對齊 30 分鐘刻度）。 */
function defaultFullLeaveRange(shiftDurationMin: number): [number, number] {
  const options = buildLeaveOptions(shiftDurationMin);
  const end = options[options.length - 1] ?? 0;
  return end > 0 ? [0, end] : [0, 0];
}

/** 與 @ptomasroos/react-native-multi-slider 的 valueToPosition 一致，對齊圓點中心。 */
function leaveValueToX(value: number, sliderLength: number, options: number[]): number {
  if (options.length <= 1) return 0;
  let index = options.indexOf(value);
  if (index < 0) {
    index = options.reduce(
      (best, v, i) => (Math.abs(v - value) < Math.abs(options[best]! - value) ? i : best),
      0,
    );
  }
  return (sliderLength * index) / (options.length - 1);
}

/** 請假刻度標籤：只顯示「時」，不顯示分。 */
function leaveHourLabel(timeStr: string): string {
  const h = parseInt(timeStr.split(":")[0] ?? "0", 10);
  return String(Number.isNaN(h) ? 0 : h);
}

function leaveHourLabelAtPos(pos: number, shiftStartMin: number): string {
  const abs = (shiftStartMin + pos) % 1440;
  return String(Math.floor(abs / 60) % 24);
}

function RulerTickLine({ x, top, major }: { x: number; top: number; major: boolean }) {
  const h = major ? TICK_MAJOR_H : TICK_MINOR_H;
  return (
    <View
      style={{
        position: "absolute",
        left: x - 0.75,
        top,
        width: 1.5,
        height: h,
        backgroundColor: major ? "#94a3b8" : "#cbd5e1",
        borderRadius: 0.75,
      }}
    />
  );
}

/** 加班／上課刻度：與圓點使用相同 X 換算 */
function OtRuler({ trackW }: { trackW: number }) {
  return (
    <View style={{ width: trackW, marginBottom: 4 }}>
      <View style={{ width: trackW, height: RULER_NUM_H, position: "relative" }}>
        {OT_RULER_VALS.map((v) => (
          <Text
            key={v}
            style={[
              styles.rulerNum,
              rulerLabelStyle,
              {
                position: "absolute",
                top: 0,
                left: otValueToX(v, trackW) - 7,
                width: 14,
              },
            ]}
          >
            {Math.abs(v)}
          </Text>
        ))}
      </View>
      <View style={{ height: RULER_GAP }} />
      <View style={{ width: trackW, height: TICK_MAJOR_H, position: "relative" }}>
        {OT_TICKS.map(({ v, major }) => (
          <RulerTickLine key={v} x={otValueToX(v, trackW)} top={0} major={major} />
        ))}
      </View>
    </View>
  );
}

/** 請假刻度：當日上班起訖；標籤僅顯示「時」；最小刻度 30 分鐘；與滑桿圓點對齊。 */
function LeaveRuler({
  trackW,
  shiftStartMin,
  shift,
  leaveOptions,
}: {
  trackW: number;
  shiftStartMin: number;
  shift: ShiftItem;
  leaveOptions: number[];
}) {
  const hourMarks = useMemo(() => {
    const lastPos = leaveOptions[leaveOptions.length - 1] ?? 0;
    const marks: { pos: number; label: string }[] = [];
    for (const pos of leaveOptions) {
      const isStart = pos === 0;
      const isEnd = pos === lastPos;
      const onClockHour = ((shiftStartMin + pos) % 1440) % 60 === 0;
      if (!isStart && !isEnd && !onClockHour) continue;

      const label = isStart
        ? leaveHourLabel(shift.startTime)
        : isEnd
          ? leaveHourLabel(shift.endTime)
          : leaveHourLabelAtPos(pos, shiftStartMin);
      marks.push({ pos, label });
    }
    return marks;
  }, [leaveOptions, shift.startTime, shift.endTime, shiftStartMin]);

  const leaveTicks = useMemo(() => {
    const lastPos = leaveOptions[leaveOptions.length - 1] ?? 0;
    return leaveOptions.map((pos) => ({
      pos,
      major: pos === 0 || pos === lastPos || ((shiftStartMin + pos) % 1440) % 60 === 0,
    }));
  }, [leaveOptions, shiftStartMin]);

  return (
    <View style={{ width: trackW, marginBottom: 4 }}>
      <View style={{ width: trackW, height: RULER_NUM_H, position: "relative", overflow: "visible" }}>
        {hourMarks.map(({ pos, label }) => {
          const x = leaveValueToX(pos, trackW, leaveOptions);
          return (
            <Text
              key={`leave-label-${pos}`}
              numberOfLines={1}
              ellipsizeMode="clip"
              style={[
                styles.rulerNum,
                rulerLabelStyle,
                styles.leaveRulerLabel,
                {
                  left: x,
                  transform: [{ translateX: -LEAVE_LABEL_W / 2 }],
                },
              ]}
            >
              {label}
            </Text>
          );
        })}
      </View>
      <View style={{ height: RULER_GAP }} />
      <View style={{ width: trackW, height: TICK_MAJOR_H, position: "relative" }}>
        {leaveTicks.map(({ pos, major }) => (
          <RulerTickLine
            key={`leave-tick-${pos}`}
            x={leaveValueToX(pos, trackW, leaveOptions)}
            top={0}
            major={major}
          />
        ))}
      </View>
    </View>
  );
}

/** 加班／上課：以 0 為中心，僅點亮 0 與圓點之間的軌道 */
function OtCenterSlider({
  value,
  onChange,
  color,
  trackW,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
  trackW: number;
}) {
  const trackInner = Math.max(trackW - THUMB, 1);

  const valueToX = useCallback((v: number) => otValueToX(v, trackW), [trackW]);

  const xToValue = useCallback(
    (x: number) => {
      const t = Math.max(0, Math.min(1, (x - THUMB / 2) / trackInner));
      const raw = MIN_H + t * (MAX_H - MIN_H);
      return Math.round(raw / STEP) * STEP;
    },
    [trackInner],
  );

  const thumbX = valueToX(value);
  const centerX = valueToX(0);
  const wrapRef = useRef<View>(null);

  const setFromPageX = useCallback(
    (pageX: number) => {
      wrapRef.current?.measure((_x, _y, width, _h, pageLeft) => {
        const localX = Math.max(THUMB / 2, Math.min(pageX - pageLeft, width - THUMB / 2));
        onChange(xToValue(localX));
      });
    },
    [onChange, xToValue],
  );

  const setFromPageXRef = useRef(setFromPageX);
  setFromPageXRef.current = setFromPageX;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => setFromPageXRef.current(evt.nativeEvent.pageX),
        onPanResponderMove: (evt) => setFromPageXRef.current(evt.nativeEvent.pageX),
      }),
    [],
  );

  const fillStyle =
    value < 0
      ? { left: thumbX, width: Math.max(0, centerX - thumbX) }
      : value > 0
        ? { left: centerX, width: Math.max(0, thumbX - centerX) }
        : { left: centerX, width: 0 };

  return (
    <View
      ref={wrapRef}
      style={{ width: trackW, height: PANEL_SLIDER_H, justifyContent: "center" }}
      {...pan.panHandlers}
    >
      <View
        style={{
          position: "absolute",
          left: THUMB / 2,
          right: THUMB / 2,
          top: (PANEL_SLIDER_H - OT_TRACK_H) / 2,
          height: OT_TRACK_H,
          borderRadius: 4,
          backgroundColor: "#e2e8f0",
        }}
      />
      {value !== 0 ? (
        <View
          style={{
            position: "absolute",
            height: OT_TRACK_H,
            borderRadius: 4,
            backgroundColor: color,
            top: (PANEL_SLIDER_H - OT_TRACK_H) / 2,
            ...fillStyle,
          }}
        />
      ) : null}
      <View
        style={{
          position: "absolute",
          left: centerX - 1,
          width: 2,
          height: OT_TRACK_H + 4,
          top: (PANEL_SLIDER_H - OT_TRACK_H) / 2 - 2,
          backgroundColor: "#94a3b8",
          borderRadius: 1,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: thumbX - THUMB / 2,
          top: (PANEL_SLIDER_H - THUMB) / 2,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 4,
          elevation: 4,
        }}
      />
    </View>
  );
}

/* ── 請假滑桿 Thumb ─────────────────────────────────────────── */
function LeaveThumb() {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.leave,
        shadowColor: colors.leave,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
        elevation: 4,
      }}
    />
  );
}

/* ── 主元件 ─────────────────────────────────────────────────── */
type Tab = "加班" | "上課" | "請假";

type Props = {
  visible: boolean;
  onClose: () => void;
  date: string;
  existing?: Overtime | null;
  shift?: ShiftItem;
};

export default function RecordModal({ visible, onClose, date, existing, shift }: Props) {
  const { upsertOvertime, deleteOvertimeByDate, settings } = useAppData();
  const handoverEnabled = settings.handoverEnabled;
  const ho = handoverEnabled ? HO : 0;

  const [tab, setTab] = useState<Tab>("加班");
  /** 加班／上課滑桿對應類型（切到請假 tab 時仍保留，以便同日合併儲存）。 */
  const [otKind, setOtKind] = useState<"加班" | "上課">("加班");
  // 加班／上課：單值，正數=延時，負數=提早
  const [sliderValue, setSliderValue] = useState(0);
  // 請假：[startPos, endPos]，單位 = 分鐘（相對班次開始）
  const [leaveRange, setLeaveRange] = useState<[number, number]>([0, 0]);
  const [notes, setNotes] = useState("");
  const [disasterStop, setDisasterStop] = useState(false);
  // 容器寬度供加班軌道繪製
  const [trackW, setTrackW] = useState(280);
  const [notesFocused, setNotesFocused] = useState(false);

  const shiftStartMin = useMemo(() => timeToMin(shift?.startTime ?? "00:00"), [shift?.startTime]);
  const shiftEndMin = useMemo(() => timeToMin(shift?.endTime ?? "00:00"), [shift?.endTime]);
  const shiftDurationMin = useMemo(() => {
    if (!shift) return 480;
    return shiftEndMin > shiftStartMin
      ? shiftEndMin - shiftStartMin
      : 1440 - shiftStartMin + shiftEndMin;
  }, [shift, shiftStartMin, shiftEndMin]);

  const leaveOptions = useMemo(
    () => buildLeaveOptions(shiftDurationMin, LEAVE_STEP_MIN),
    [shiftDurationMin],
  );

  useEffect(() => {
    if (!visible) setNotesFocused(false);
  }, [visible]);

  /* ── 打開彈窗時還原既有紀錄（加班與請假可並存，兩邊都還原） ── */
  useEffect(() => {
    if (!visible) return;

    const hasLeave = !!(existing?.leaveStart && existing?.leaveEnd);
    if (hasLeave) {
      const s = timeStrToPos(existing!.leaveStart!, shiftStartMin);
      const e = timeStrToPos(existing!.leaveEnd!, shiftStartMin);
      setLeaveRange([s, e]);
    } else {
      setLeaveRange(defaultFullLeaveRange(shiftDurationMin));
    }

    const earlyH = existing?.earlyHours ?? 0;
    const lateH = existing?.lateHours ?? 0;
    const earlyClass = existing?.earlyClassHours ?? 0;
    const lateClass = existing?.lateClassHours ?? 0;
    const hasOt = earlyH > 0 || lateH > 0;
    const hasClass = earlyClass > 0 || lateClass > 0;

    if (earlyH > 0) {
      setOtKind("加班");
      setSliderValue(-Number(earlyH));
    } else if (lateH > 0) {
      setOtKind("加班");
      setSliderValue(Number(lateH));
    } else if (earlyClass > 0) {
      setOtKind("上課");
      setSliderValue(-Number(earlyClass));
    } else if (lateClass > 0) {
      setOtKind("上課");
      setSliderValue(Number(lateClass));
    } else {
      setOtKind("加班");
      setSliderValue(0);
    }

    if (hasLeave && !hasOt && !hasClass) setTab("請假");
    else if (hasClass && !hasOt) setTab("上課");
    else setTab("加班");

    setNotes(finalizeOvertimeNote(existing?.notes ?? ""));
    setDisasterStop(!!existing?.disasterStop);
  }, [visible, existing, shiftStartMin, shiftDurationMin]);

  /* ── 切到「請假」tab 時：無既有請假則預設整段上班時間 */
  useEffect(() => {
    if (tab === "請假" && !existing?.leaveStart && shift) {
      setLeaveRange(defaultFullLeaveRange(shiftDurationMin));
    }
  }, [tab, existing?.leaveStart, shift, shiftDurationMin]);

  /* ── 加班 derived ── */
  const hours = Math.abs(sliderValue);
  const isEarly = sliderValue < 0;
  const isLate = sliderValue > 0;
  const direction = isEarly ? "提早" : isLate ? "延時" : "";
  const activeOtKind = tab === "上課" || tab === "加班" ? tab : otKind;
  const typeColor =
    tab === "請假" ? colors.leave : activeOtKind === "上課" ? "#3b82f6" : "#f97316";
  const baseStart = shift?.startTime ?? "--:--";
  const baseEnd = shift?.endTime ?? "--:--";
  const dispStart = isEarly ? shiftTimeStr(baseStart, sliderValue - ho) : baseStart;
  const dispEnd = isLate ? shiftTimeStr(baseEnd, sliderValue + ho) : baseEnd;

  /* ── 請假 derived ── */
  const [leaveStartPos, leaveEndPos] = leaveRange;
  const leaveStartTimeStr = posToTimeStr(leaveStartPos, shiftStartMin);
  const leaveEndTimeStr = posToTimeStr(leaveEndPos, shiftStartMin);

  /* ── 加班軌道寬度（MultiSlider 需要明確數值） ── */
  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 10) setTrackW(w);
  };

  /* ── 儲存：加班／請假與備註分區確認 ── */
  const trimmedNotes = finalizeOvertimeNote(notes.trim());
  const existingNotes = finalizeOvertimeNote(existing?.notes ?? "");
  const notesDirty = trimmedNotes !== existingNotes;
  const savingLeave = tab === "請假" && !!shift && leaveEndPos > leaveStartPos;
  const savingOtHours = tab !== "請假" && hours > 0;
  const canSaveSchedule = savingLeave || savingOtHours;
  const canSaveNotes = notesDirty;

  const saveSchedule = () => {
    if (!canSaveSchedule) return;

    const kindForOt = tab === "上課" || tab === "加班" ? tab : otKind;
    const nextOt = {
      earlyHours: kindForOt === "加班" && isEarly ? hours : 0,
      lateHours: kindForOt === "加班" && isLate ? hours : 0,
      earlyClassHours: kindForOt === "上課" && isEarly ? hours : 0,
      lateClassHours: kindForOt === "上課" && isLate ? hours : 0,
    };

    const nextLeave =
      tab === "請假"
        ? savingLeave
          ? { leaveStart: leaveStartTimeStr, leaveEnd: leaveEndTimeStr }
          : { leaveStart: null as string | null, leaveEnd: null as string | null }
        : {
            leaveStart: existing?.leaveStart ?? null,
            leaveEnd: existing?.leaveEnd ?? null,
          };

    // 不傳 notes，保留既有備註
    upsertOvertime({
      date,
      ...nextOt,
      ...nextLeave,
    });

    onClose();
  };

  const saveNotes = () => {
    if (!canSaveNotes) return;
    upsertOvertime({
      date,
      earlyHours: existing?.earlyHours ?? 0,
      lateHours: existing?.lateHours ?? 0,
      earlyClassHours: existing?.earlyClassHours ?? 0,
      lateClassHours: existing?.lateClassHours ?? 0,
      leaveStart: existing?.leaveStart ?? null,
      leaveEnd: existing?.leaveEnd ?? null,
      notes: trimmedNotes,
    });
    onClose();
  };

  const del = () => {
    deleteOvertimeByDate(date);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={[styles.overlay, notesFocused && styles.overlayKeyboard]}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => {
              Keyboard.dismiss();
              onClose();
            }}
          />
          <View style={[styles.card, cardShadow(8)]}>
          {/* 標題 */}
          <View style={styles.head}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.title}>加班/請假紀錄</Text>
              <Text style={styles.sub}>{formatDateLabel(date)}</Text>
            </View>
            <Pressable
              onPress={() => {
                const next = !disasterStop;
                setDisasterStop(next);
                upsertOvertime({
                  date,
                  earlyHours: existing?.earlyHours ?? 0,
                  lateHours: existing?.lateHours ?? 0,
                  earlyClassHours: existing?.earlyClassHours ?? 0,
                  lateClassHours: existing?.lateClassHours ?? 0,
                  leaveStart: existing?.leaveStart ?? null,
                  leaveEnd: existing?.leaveEnd ?? null,
                  disasterStop: next,
                });
              }}
              style={[styles.disasterBtn, disasterStop && styles.disasterBtnOn]}
            >
              <Text
                style={[
                  styles.disasterBtnEmoji,
                  disasterStop && styles.disasterBtnTextOn,
                ]}
              >
                {"\u{1F300}"}
              </Text>
              <Text
                style={[
                  styles.disasterBtnText,
                  disasterStop && styles.disasterBtnTextOn,
                ]}
              >
                天災停班
              </Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* 類型切換 */}
          <View style={styles.tabs}>
            {(["加班", "上課", "請假"] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  setTab(t);
                  if (t === "加班" || t === "上課") setOtKind(t);
                }}
                style={[
                  styles.tab,
                  tab === t && {
                    backgroundColor:
                      t === "加班" ? "#f97316" : t === "上課" ? "#3b82f6" : colors.leave,
                  },
                ]}
              >
                <Text style={[styles.tabText, tab === t && { color: "#fff" }]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {/* ── 加班／上課／請假 內容（固定高度避免切換跳動） ── */}
          <View style={styles.panelSlot}>
            {tab !== "請假" ? (
              <>
                <View style={styles.timeLine}>
                  <Text
                    style={[
                      styles.timeRange,
                      hours > 0 ? styles.bigTime : styles.mutedTime,
                      hours > 0 && { color: typeColor },
                    ]}
                  >
                    {hours > 0 ? `${dispStart} — ${dispEnd}` : `${baseStart} — ${baseEnd}`}
                  </Text>
                  <View style={styles.otHoursSlot}>
                    {hours > 0 ? (
                      <Text style={[styles.otHoursLine, { color: typeColor }]}>
                        {direction} {hours}h
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.sliderWrap} onLayout={onTrackLayout}>
                  <OtRuler trackW={trackW} />
                  <OtCenterSlider
                    value={sliderValue}
                    onChange={setSliderValue}
                    color={typeColor}
                    trackW={trackW}
                  />
                </View>
              </>
            ) : !shift ? (
              <View style={styles.panelEmpty}>
                <Text style={styles.warn}>此日無班次，無法新增請假紀錄</Text>
              </View>
            ) : (
              <>
                <View style={styles.timeLine}>
                  <Text style={[styles.timeRange, styles.bigTime, { color: colors.leave }]}>
                    {leaveStartTimeStr} — {leaveEndTimeStr}
                  </Text>
                  <View style={styles.otHoursSlot}>
                    <Text style={[styles.otHoursLine, { color: colors.leave }]}>
                      請假 {Math.round((leaveEndPos - leaveStartPos) / 30) / 2}h
                    </Text>
                  </View>
                </View>

                <View style={styles.sliderWrap} onLayout={onTrackLayout}>
                  <LeaveRuler
                    trackW={trackW}
                    shiftStartMin={shiftStartMin}
                    shift={shift}
                    leaveOptions={leaveOptions}
                  />
                  <MultiSlider
                    values={[leaveStartPos, leaveEndPos]}
                    min={0}
                    max={shiftDurationMin}
                    step={LEAVE_STEP_MIN}
                    sliderLength={trackW}
                    height={PANEL_SLIDER_H}
                    // @ts-expect-error markerSize 執行期支援，型別定義未更新
                    markerSize={THUMB}
                    onValuesChange={(vals) => {
                      setLeaveRange([vals[0], vals[1]]);
                    }}
                    selectedStyle={{ backgroundColor: colors.leave }}
                    unselectedStyle={{ backgroundColor: "#e2e8f0" }}
                    containerStyle={{
                      alignSelf: "flex-start",
                      width: trackW,
                      height: PANEL_SLIDER_H,
                    }}
                    trackStyle={{ height: 8, borderRadius: 4 }}
                    customMarker={() => <LeaveThumb />}
                    allowOverlap={false}
                    snapped
                    minMarkerOverlapDistance={30}
                  />
                </View>
              </>
            )}
          </View>
          {/* 加班／請假確認 */}
          <View style={styles.actions}>
            {existing ? (
              <Pressable onPress={del} style={[styles.trash, styles.trashAbsolute]}>
                <Trash2 size={18} color={colors.destructive} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={saveSchedule}
              disabled={!canSaveSchedule}
              style={[styles.confirm, { backgroundColor: canSaveSchedule ? typeColor : "#e2e8f0" }]}
            >
              <Text style={[styles.confirmText, !canSaveSchedule && { color: colors.muted }]}>
                {existing ? "更新時段" : "確認時段"}
              </Text>
            </Pressable>
          </View>

          {/* 備註（獨立區塊） */}
          <View style={styles.notesSection}>
            <View style={styles.notesSectionHead}>
              <Text style={styles.notesSectionTitle}>備註</Text>
              <Pressable
                onPress={saveNotes}
                disabled={!canSaveNotes}
                style={[
                  styles.notesConfirm,
                  { backgroundColor: canSaveNotes ? colors.teal : "#e2e8f0" },
                ]}
              >
                <Text style={[styles.notesConfirmText, !canSaveNotes && { color: colors.muted }]}>
                  確認
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={notes}
              onChangeText={(t) => setNotes(applyOvertimeNoteInput(t))}
              placeholder={`選填，最多 ${OVERTIME_NOTE_MAX_LENGTH} 字；換行自動編號`}
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              style={styles.notes}
              onFocus={() => setNotesFocused(true)}
              onBlur={() => {
                setNotesFocused(false);
                setNotes(finalizeOvertimeNote(notes));
              }}
            />
          </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  overlayKeyboard: {
    justifyContent: "flex-end",
    paddingBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  disasterBtn: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.greyBg,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  disasterBtnOn: {
    backgroundColor: "#fff7ed",
    borderColor: "#f59e0b",
  },
  disasterBtnEmoji: { fontSize: 14, lineHeight: 16, textAlign: "center" },
  disasterBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textAlign: "center",
    lineHeight: 14,
  },
  disasterBtnTextOn: { color: "#b45309" },
  sub: { fontSize: 12, color: colors.teal, marginTop: 4, opacity: 0.85 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.greyBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.greyBg,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 12,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  panelSlot: {
    minHeight: PANEL_SLOT_MIN_H,
  },
  panelEmpty: {
    flex: 1,
    minHeight: PANEL_SLOT_MIN_H,
    alignItems: "center",
    justifyContent: "center",
  },
  timeLine: {
    minHeight: 36,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  timeRange: {
    width: 170,
    textAlign: "center",
  },
  bigTime: { fontSize: 17, fontWeight: "700" },
  otHoursSlot: {
    width: 96,
    minHeight: 22,
    justifyContent: "center",
  },
  otHoursLine: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "left",
  },
  mutedTime: { fontSize: 17, fontWeight: "700", color: colors.muted },
  rulerNum: { fontSize: 10, color: "#94a3b8" },
  leaveRulerLabel: {
    position: "absolute",
    top: 0,
    width: LEAVE_LABEL_W,
    textAlign: "center",
  },
  sliderWrap: {
    alignSelf: "stretch",
    marginBottom: 8,
    overflow: "visible",
  },
  edgeText: { fontSize: 10, color: colors.muted, fontWeight: "600" },
  warn: { textAlign: "center", color: colors.muted, paddingVertical: 12, fontSize: 13 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    position: "relative",
    minHeight: 48,
  },
  notesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  notesSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  notes: {
    alignSelf: "stretch",
    minHeight: 72,
    maxHeight: 160,
    borderRadius: 12,
    backgroundColor: colors.greyBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  notesConfirm: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notesConfirmText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  trash: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  trashAbsolute: {
    position: "absolute",
    left: 0,
    zIndex: 1,
  },
  confirm: {
    minWidth: "55%",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  confirmText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
