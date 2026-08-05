import React, { useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  const [notesFocused, setNotesFocused] = useState(false);
  const [disasterStop, setDisasterStop] = useState(false);

  useEffect(() => {
    if (!visible) {
      setNotesFocused(false);
      return;
    }
    if (hasHolidayWork(existing)) {
      setWorkStart(snapTimeToQuarter(existing!.holidayWorkStart!));
      setWorkEnd(snapTimeToQuarter(existing!.holidayWorkEnd!));
    } else {
      setWorkStart("09:00");
      setWorkEnd("17:00");
    }
    setNotes(clampOvertimeNote(existing?.notes ?? ""));
    setDisasterStop(!!existing?.disasterStop);
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

  const trimmedNotes = clampOvertimeNote(notes.trim());
  const existingNotes = clampOvertimeNote(existing?.notes ?? "");
  const canSaveSchedule = hours > 0 && !overlapError;
  const canSaveNotes = trimmedNotes !== existingNotes;

  const saveSchedule = () => {
    if (!canSaveSchedule) return;
    // 不傳 notes，保留既有備註
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
    });
    onClose();
  };

  const saveNotes = () => {
    if (!canSaveNotes) return;
    // 不傳 holidayWork*，保留既有休假日加班時段
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
            <View style={styles.head}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.title}>休假日加班</Text>
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
            </View>

            {overlapError ? <Text style={styles.error}>{overlapError}</Text> : null}

            <View style={styles.actions}>
              {existing && hasHolidayWork(existing) ? (
                <Pressable onPress={del} style={[styles.trash, styles.trashAbsolute]}>
                  <Trash2 size={18} color={colors.destructive} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={saveSchedule}
                disabled={!canSaveSchedule}
                style={[styles.confirm, { backgroundColor: canSaveSchedule ? "#7c3aed" : "#e2e8f0" }]}
              >
                <Text style={[styles.confirmText, !canSaveSchedule && { color: colors.muted }]}>
                  {existing && hasHolidayWork(existing) ? "更新時段" : "確認時段"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.notesSection}>
              <Text style={styles.notesSectionTitle}>備註</Text>
              <View style={styles.notesRow}>
                <TextInput
                  value={notes}
                  onChangeText={(t) => setNotes(clampOvertimeNote(t))}
                  placeholder={`選填，最多 ${OVERTIME_NOTE_MAX_LENGTH} 字`}
                  placeholderTextColor={colors.muted}
                  maxLength={OVERTIME_NOTE_MAX_LENGTH}
                  style={styles.notes}
                  onFocus={() => setNotesFocused(true)}
                  onBlur={() => setNotesFocused(false)}
                />
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
    marginBottom: 12,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  sub: { fontSize: 12, color: colors.teal, marginTop: 4, opacity: 0.85 },
  shiftTag: { fontSize: 11, color: colors.muted, marginTop: 2 },
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
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.greyBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    position: "relative",
    minHeight: 48,
  },
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
  notesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notes: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.greyBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  notesConfirm: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  notesConfirmText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
