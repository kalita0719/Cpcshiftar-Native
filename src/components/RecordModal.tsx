import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  PanResponder,
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
import { clampOvertimeNote, OVERTIME_NOTE_MAX_LENGTH } from "@/src/constants/overtimeNotes";
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
      style={{ width: trackW, height: THUMB, justifyContent: "center" }}
      {...pan.panHandlers}
    >
      <View
        style={{
          position: "absolute",
          left: THUMB / 2,
          right: THUMB / 2,
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
            top: (THUMB - OT_TRACK_H) / 2,
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
          top: (THUMB - OT_TRACK_H) / 2 - 2,
          backgroundColor: "#94a3b8",
          borderRadius: 1,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: thumbX - THUMB / 2,
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
  // 加班：單值，正數=延時，負數=提早
  const [sliderValue, setSliderValue] = useState(0);
  // 請假：[startPos, endPos]，單位 = 分鐘（相對班次開始）
  const [leaveRange, setLeaveRange] = useState<[number, number]>([0, 0]);
  const [notes, setNotes] = useState("");
  // 容器寬度供加班軌道繪製
  const [trackW, setTrackW] = useState(280);

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

  /* ── 打開彈窗時還原既有紀錄 ── */
  useEffect(() => {
    if (!visible) return;
    if (existing?.leaveStart && existing?.leaveEnd) {
      setTab("請假");
      const s = timeStrToPos(existing.leaveStart, shiftStartMin);
      const e = timeStrToPos(existing.leaveEnd, shiftStartMin);
      setLeaveRange([s, e]);
    } else if ((existing?.earlyHours ?? 0) > 0) {
      setTab("加班");
      setSliderValue(-Number(existing!.earlyHours));
    } else if ((existing?.lateHours ?? 0) > 0) {
      setTab("加班");
      setSliderValue(Number(existing!.lateHours));
    } else if ((existing?.earlyClassHours ?? 0) > 0) {
      setTab("上課");
      setSliderValue(-Number(existing!.earlyClassHours));
    } else if ((existing?.lateClassHours ?? 0) > 0) {
      setTab("上課");
      setSliderValue(Number(existing!.lateClassHours));
    } else {
      setTab("加班");
      setSliderValue(0);
      setLeaveRange(defaultFullLeaveRange(shiftDurationMin));
    }
    setNotes(clampOvertimeNote(existing?.notes ?? ""));
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
  const typeColor = tab === "加班" ? "#f97316" : tab === "上課" ? "#3b82f6" : colors.leave;
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

  /* ── 儲存 ── */
  const trimmedNotes = clampOvertimeNote(notes.trim());
  const hasNotes = trimmedNotes.length > 0;
  const savingLeave = tab === "請假" && !!shift && leaveEndPos > leaveStartPos;
  const savingOtHours = tab !== "請假" && hours > 0;
  const canSave = savingLeave || savingOtHours || hasNotes;

  const save = () => {
    if (!canSave) return;

    const payload = {
      date,
      earlyHours: existing?.earlyHours ?? 0,
      lateHours: existing?.lateHours ?? 0,
      earlyClassHours: existing?.earlyClassHours ?? 0,
      lateClassHours: existing?.lateClassHours ?? 0,
      leaveStart: existing?.leaveStart ?? null,
      leaveEnd: existing?.leaveEnd ?? null,
      notes: trimmedNotes || undefined,
    };

    if (savingLeave) {
      payload.leaveStart = leaveStartTimeStr;
      payload.leaveEnd = leaveEndTimeStr;
    }

    if (savingOtHours) {
      if (tab === "加班") {
        payload.earlyHours = isEarly ? hours : 0;
        payload.lateHours = isLate ? hours : 0;
        payload.earlyClassHours = 0;
        payload.lateClassHours = 0;
      } else {
        payload.earlyClassHours = isEarly ? hours : 0;
        payload.lateClassHours = isLate ? hours : 0;
        payload.earlyHours = 0;
        payload.lateHours = 0;
      }
    }

    upsertOvertime(payload);
    onClose();
  };

  const del = () => {
    deleteOvertimeByDate(date);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.card, cardShadow(8)]}>
          {/* 標題 */}
          <View style={styles.head}>
            <View>
              <Text style={styles.title}>加班/請假紀錄</Text>
              <Text style={styles.sub}>{formatDateLabel(date)}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* 類型切換 */}
          <View style={styles.tabs}>
            {(["加班", "上課", "請假"] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
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

          {/* ── 加班 / 上課 滑桿 ─────────────────────────────── */}
          {tab !== "請假" && (
            <>
              <View style={styles.timeLine}>
                {hours > 0 ? (
                  <>
                    <Text style={[styles.bigTime, { color: typeColor }]}>
                      {dispStart} — {dispEnd}
                    </Text>
                    <Text style={[styles.otHoursLine, { color: typeColor }]}>
                      {direction} {hours}h
                    </Text>
                  </>
                ) : (
                  <Text style={styles.mutedTime}>{baseStart} — {baseEnd}</Text>
                )}
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
          )}

          {/* ── 請假 雙拇指 Range Slider ─────────────────────── */}
          {tab === "請假" && (
            <View style={{ marginBottom: 16 }}>
              {!shift ? (
                <Text style={styles.warn}>此日無班次，無法新增請假紀錄</Text>
              ) : (
                <>
                  <View style={styles.timeLine}>
                    <Text style={[styles.bigTime, { color: colors.leave }]}>
                      {leaveStartTimeStr} — {leaveEndTimeStr}{"  "}請假{" "}
                      {Math.round((leaveEndPos - leaveStartPos) / 30) / 2}h
                    </Text>
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
                      // @ts-expect-error markerSize 執行期支援，型別定義未更新
                      markerSize={THUMB}
                      onValuesChange={(vals) => {
                        setLeaveRange([vals[0], vals[1]]);
                      }}
                      selectedStyle={{ backgroundColor: colors.leave }}
                      unselectedStyle={{ backgroundColor: "#e2e8f0" }}
                      containerStyle={{ alignSelf: "flex-start", width: trackW }}
                      trackStyle={{ height: 8, borderRadius: 4 }}
                      customMarker={() => <LeaveThumb />}
                      allowOverlap={false}
                      snapped
                      minMarkerOverlapDistance={30}
                    />
                  </View>

                  <View style={styles.leaveLabels}>
                    <Text style={styles.leaveLabel}>{leaveStartTimeStr} 開始</Text>
                    <Text style={styles.leaveLabel}>{leaveEndTimeStr} 結束</Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* 備註 */}
          <TextInput
            value={notes}
            onChangeText={(t) => setNotes(clampOvertimeNote(t))}
            placeholder={`備註（選填，最多 ${OVERTIME_NOTE_MAX_LENGTH} 字）`}
            placeholderTextColor={colors.muted}
            maxLength={OVERTIME_NOTE_MAX_LENGTH}
            style={styles.notes}
          />

          {/* 操作按鈕 */}
          <View style={styles.actions}>
            {existing ? (
              <Pressable onPress={del} style={styles.trash}>
                <Trash2 size={18} color={colors.destructive} />
              </Pressable>
            ) : (
              <View style={{ width: 48 }} />
            )}
            <Pressable
              onPress={save}
              disabled={!canSave}
              style={[styles.confirm, { backgroundColor: canSave ? typeColor : "#e2e8f0" }]}
            >
              <Text style={[styles.confirmText, !canSave && { color: colors.muted }]}>
                {existing ? "更新" : "確認"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  sub: { fontSize: 12, color: colors.teal, marginTop: 4, opacity: 0.85 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.greyBg,
    alignItems: "center",
    justifyContent: "center",
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
  timeLine: {
    minHeight: 36,
    justifyContent: "center",
    marginBottom: 8,
    alignItems: "center",
    gap: 4,
  },
  bigTime: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  otHoursLine: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  mutedTime: { fontSize: 13, color: colors.muted, textAlign: "center" },
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
  leaveLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 4,
  },
  leaveLabel: { color: colors.leave, fontSize: 11, fontWeight: "700" },
  warn: { textAlign: "center", color: colors.muted, paddingVertical: 12, fontSize: 13 },
  notes: {
    borderRadius: 12,
    backgroundColor: colors.greyBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 14,
    color: colors.text,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  trash: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  confirm: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  confirmText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
