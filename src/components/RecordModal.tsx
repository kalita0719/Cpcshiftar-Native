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
import type { Overtime, ShiftItem } from "@/src/types";

const MAX_H = 5;
const MIN_H = -5;
const STEP = 0.5;
const HO = 0.25;
const LEAVE_COLOR = "#ec4899";

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

/* ── 加班自訂滑桿 Thumb ────────────────────────────────────── */
function OtThumb({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: color,
        shadowColor: color,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
        elevation: 4,
      }}
    />
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
        backgroundColor: LEAVE_COLOR,
        shadowColor: LEAVE_COLOR,
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
  const [leaveRange, setLeaveRange] = useState<[number, number]>([0, 480]);
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
    }
    setNotes(existing?.notes ?? "");
  }, [visible, existing, shiftStartMin]);

  /* ── 切到「請假」tab 時預設全程 ── */
  useEffect(() => {
    if (tab === "請假" && !existing?.leaveStart) {
      setLeaveRange([0, shiftDurationMin]);
    }
  }, [tab, existing?.leaveStart, shiftDurationMin]);

  /* ── 加班 derived ── */
  const hours = Math.abs(sliderValue);
  const isEarly = sliderValue < 0;
  const isLate = sliderValue > 0;
  const direction = isEarly ? "提早" : isLate ? "延時" : "";
  const typeColor = tab === "加班" ? "#f97316" : tab === "上課" ? "#3b82f6" : LEAVE_COLOR;
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

  /* ── 加班單值 slider：把 MultiSlider 值域 [-50,50] / 10 轉成 0.5 步 ── */
  // MultiSlider 只支援整數步進，因此乘以 10 再除回來
  const otIntValue = Math.round(sliderValue * 10);

  /* ── 儲存 ── */
  const canSaveLeave = tab === "請假" && !!shift && leaveEndPos > leaveStartPos;
  const canSaveOt = tab !== "請假" && hours > 0;
  const canSave = tab === "請假" ? canSaveLeave : canSaveOt;

  const save = () => {
    if (tab === "請假") {
      upsertOvertime({
        date,
        earlyHours: existing?.earlyHours ?? 0,
        lateHours: existing?.lateHours ?? 0,
        earlyClassHours: existing?.earlyClassHours ?? 0,
        lateClassHours: existing?.lateClassHours ?? 0,
        leaveStart: leaveStartTimeStr,
        leaveEnd: leaveEndTimeStr,
        notes: notes || undefined,
      });
    } else {
      upsertOvertime({
        date,
        earlyHours: tab === "加班" && isEarly ? hours : 0,
        lateHours: tab === "加班" && isLate ? hours : 0,
        earlyClassHours: tab === "上課" && isEarly ? hours : 0,
        lateClassHours: tab === "上課" && isLate ? hours : 0,
        notes: notes || undefined,
      });
    }
    onClose();
  };

  const del = () => {
    deleteOvertimeByDate(date);
    onClose();
  };

  const rulerVals = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

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
                      t === "加班" ? "#f97316" : t === "上課" ? "#3b82f6" : LEAVE_COLOR,
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
                  <Text style={[styles.bigTime, { color: typeColor }]}>
                    {dispStart} — {dispEnd}{"  "}{direction} {hours}h
                  </Text>
                ) : (
                  <Text style={styles.mutedTime}>{baseStart} — {baseEnd}</Text>
                )}
              </View>

              {/* 刻度標籤 */}
              <View style={styles.rulerRow}>
                {rulerVals.map((v) => (
                  <Text key={v} style={styles.rulerNum}>{Math.abs(v)}</Text>
                ))}
              </View>

              {/* MultiSlider 單拇指：步進 0.5h，範圍 -5…5 */}
              <View style={styles.sliderWrap} onLayout={onTrackLayout}>
                <MultiSlider
                  values={[otIntValue]}
                  min={-50}
                  max={50}
                  step={5}             // 步進 5 / 10 = 0.5h
                  sliderLength={trackW - 4}
                  onValuesChange={(vals) => setSliderValue(vals[0] / 10)}
                  selectedStyle={{ backgroundColor: typeColor }}
                  unselectedStyle={{ backgroundColor: "#e2e8f0" }}
                  containerStyle={{ alignSelf: "center" }}
                  trackStyle={{ height: 8, borderRadius: 4 }}
                  customMarker={() => <OtThumb color={typeColor} />}
                  enabledOne
                  snapped
                  allowOverlap={false}
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
                    <Text style={[styles.bigTime, { color: LEAVE_COLOR }]}>
                      {leaveStartTimeStr} — {leaveEndTimeStr}{"  "}請假{" "}
                      {Math.round((leaveEndPos - leaveStartPos) / 30) / 2}h
                    </Text>
                  </View>

                  {/* 班次起訖標籤 */}
                  <View style={styles.leaveEdges}>
                    <Text style={styles.edgeText}>{shift.startTime}</Text>
                    <Text style={styles.edgeText}>{shift.endTime}</Text>
                  </View>

                  {/* ← MultiSlider 雙拇指：兩個拇指各有獨立 PanResponder，不互相干擾 */}
                  <View style={styles.sliderWrap} onLayout={onTrackLayout}>
                    <MultiSlider
                      values={[leaveStartPos, leaveEndPos]}
                      min={0}
                      max={shiftDurationMin}
                      step={30}            // 每步 30 分鐘
                      sliderLength={trackW - 4}
                      onValuesChange={(vals) => {
                        setLeaveRange([vals[0], vals[1]]);
                      }}
                      selectedStyle={{ backgroundColor: LEAVE_COLOR }}
                      unselectedStyle={{ backgroundColor: "#e2e8f0" }}
                      containerStyle={{ alignSelf: "center" }}
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
            onChangeText={setNotes}
            placeholder="備註（選填）"
            placeholderTextColor={colors.muted}
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
  timeLine: { minHeight: 36, justifyContent: "center", marginBottom: 8, alignItems: "center" },
  bigTime: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  mutedTime: { fontSize: 15, color: colors.muted, textAlign: "center" },
  rulerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  rulerNum: { fontSize: 10, color: "#94a3b8" },
  sliderWrap: {
    alignItems: "center",
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  leaveEdges: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  edgeText: { fontSize: 10, color: colors.muted, fontWeight: "600" },
  leaveLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 4,
  },
  leaveLabel: { color: LEAVE_COLOR, fontSize: 11, fontWeight: "700" },
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
