import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Trash2, X } from "lucide-react-native";
import WheelTimePicker, { snapTimeToQuarter } from "@/src/components/WheelTimePicker";
import { cardShadow, colors } from "@/src/components/theme";
import {
  holidayWorkHours,
  hasHolidayWork,
  validateHolidayWorkOverlap,
} from "@/src/logic/holidayOvertime";
import { useAppData } from "@/src/state/AppDataContext";
import { clampOvertimeNote, OVERTIME_NOTE_MAX_LENGTH } from "@/src/constants/overtimeNotes";
import type { Overtime, ShiftItem } from "@/src/types";

const DAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];

function formatDateLabel(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return `${dateStr} (${DAY_ZH[d.getDay()]})`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  date: string;
  existing?: Overtime | null;
  shift?: ShiftItem;
};

export default function HolidayOvertimeModal({ visible, onClose, date, existing, shift }: Props) {
  const { shifts, overtime, settings, upsertOvertime, deleteOvertimeByDate } = useAppData();
  const handoverEnabled = settings.handoverEnabled;

  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("17:00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!visible) return;
    if (hasHolidayWork(existing)) {
      setWorkStart(snapTimeToQuarter(existing!.holidayWorkStart!));
      setWorkEnd(snapTimeToQuarter(existing!.holidayWorkEnd!));
    } else {
      setWorkStart("09:00");
      setWorkEnd("17:00");
    }
    setNotes(clampOvertimeNote(existing?.notes ?? ""));
  }, [visible, existing]);

  const overlapError = useMemo(
    () =>
      validateHolidayWorkOverlap(date, workStart, workEnd, shifts, overtime, handoverEnabled),
    [date, workStart, workEnd, shifts, overtime, handoverEnabled],
  );

  const hours = useMemo(
    () =>
      holidayWorkHours({
        holidayWorkStart: workStart,
        holidayWorkEnd: workEnd,
      }),
    [workStart, workEnd],
  );

  const canSave = hours > 0 && !overlapError;

  const save = () => {
    if (!canSave) return;
    upsertOvertime({
      date,
      earlyHours: 0,
      lateHours: 0,
      earlyClassHours: 0,
      lateClassHours: 0,
      holidayWorkStart: snapTimeToQuarter(workStart),
      holidayWorkEnd: snapTimeToQuarter(workEnd),
      leaveStart: undefined,
      leaveEnd: undefined,
      notes: clampOvertimeNote(notes.trim()) || undefined,
    });
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
          <View style={styles.head}>
            <View>
              <Text style={styles.title}>休假日加班</Text>
              <Text style={styles.sub}>{formatDateLabel(date)}</Text>
              {shift ? (
                <Text style={styles.shiftTag}>{shift.name}</Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.hint}>
            設定當日上班時段（15 分鐘刻度），不得與前後日的班表、加班及交接班時段重疊。
          </Text>

          <View style={styles.pickerRow}>
            <View style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>開始</Text>
              <WheelTimePicker value={workStart} onChange={setWorkStart} />
            </View>
            <Text style={styles.rangeSep}>—</Text>
            <View style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>結束</Text>
              <WheelTimePicker value={workEnd} onChange={setWorkEnd} />
            </View>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryHours}>
              加班 <Text style={styles.summaryEm}>{hours}h</Text>
            </Text>
            <Text style={styles.summaryNote}>依一般加班費累進計算；津貼與交接班規則同上班日</Text>
          </View>

          {overlapError ? <Text style={styles.error}>{overlapError}</Text> : null}

          <TextInput
            value={notes}
            onChangeText={(t) => setNotes(clampOvertimeNote(t))}
            placeholder={`備註（選填，最多 ${OVERTIME_NOTE_MAX_LENGTH} 字）`}
            placeholderTextColor={colors.muted}
            maxLength={OVERTIME_NOTE_MAX_LENGTH}
            style={styles.notes}
          />

          <View style={styles.actions}>
            {existing && hasHolidayWork(existing) ? (
              <Pressable onPress={del} style={styles.trash}>
                <Trash2 size={18} color={colors.destructive} />
              </Pressable>
            ) : (
              <View style={{ width: 48 }} />
            )}
            <Pressable
              onPress={save}
              disabled={!canSave}
              style={[styles.confirm, { backgroundColor: canSave ? "#7c3aed" : "#e2e8f0" }]}
            >
              <Text style={[styles.confirmText, !canSave && { color: colors.muted }]}>
                {existing && hasHolidayWork(existing) ? "更新" : "確認"}
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
  head: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  sub: { fontSize: 12, color: colors.teal, marginTop: 4, opacity: 0.85 },
  shiftTag: { fontSize: 11, color: colors.muted, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.greyBg,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 14 },
  pickerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 12 },
  pickerCol: { flex: 1 },
  pickerLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 6,
    textAlign: "center",
  },
  rangeSep: { fontSize: 18, fontWeight: "700", color: colors.text, paddingBottom: 48 },
  summaryBox: {
    backgroundColor: colors.greyBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  summaryHours: { fontSize: 15, fontWeight: "600", color: colors.text, textAlign: "center" },
  summaryEm: { fontSize: 18, fontWeight: "800", color: "#7c3aed" },
  summaryNote: { fontSize: 10, color: colors.muted, textAlign: "center", marginTop: 6 },
  error: { fontSize: 12, color: colors.destructive, marginBottom: 10, textAlign: "center" },
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
