import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { cardShadow, colors } from "@/src/components/theme";
import { SHIFT_PRESET_COLORS } from "@/src/constants/shiftPresetColors";
import WheelTimePicker, { snapTimeToQuarter } from "@/src/components/WheelTimePicker";
import { useAppData } from "@/src/state/AppDataContext";
import type { ShiftTemplate } from "@/src/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  editTemplate?: ShiftTemplate;
};

export default function TemplateFormModal({ visible, onClose, editTemplate }: Props) {
  const { createTemplate, updateTemplate } = useAppData();
  const [name, setName] = useState("");
  const [color, setColor] = useState(SHIFT_PRESET_COLORS[0]);
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("15:00");
  const [notes, setNotes] = useState("");

  const leaveEdit = editTemplate?.systemTag === "休假";

  useEffect(() => {
    if (!visible) return;
    if (editTemplate) {
      setName(editTemplate.name);
      setColor(editTemplate.color);
      if (editTemplate.systemTag === "休假") {
        setStartTime("");
        setEndTime("");
      } else {
        setStartTime(snapTimeToQuarter(editTemplate.startTime ?? "09:00"));
        setEndTime(snapTimeToQuarter(editTemplate.endTime ?? "17:00"));
      }
      setNotes(editTemplate.notes ?? "");
    } else {
      setName("");
      setColor(SHIFT_PRESET_COLORS[0]);
      setStartTime("09:00");
      setEndTime("17:00");
      setNotes("");
    }
  }, [editTemplate, visible]);

  const submit = () => {
    if (editTemplate) {
      if (editTemplate.systemTag === "休假") {
        updateTemplate(editTemplate.id, { name, color, startTime: null, endTime: null, notes: notes || null });
      } else {
        updateTemplate(editTemplate.id, { name, color, startTime, endTime, notes: notes || null });
      }
    } else {
      createTemplate({
        name,
        color,
        startTime,
        endTime,
        notes: notes || null,
        isFixed: false,
      });
    }
    onClose();
  };

  const systemBadge = editTemplate?.systemTag;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.card, cardShadow(8)]}>
          <View style={styles.head}>
            <Text style={styles.hTitle}>{editTemplate ? "編輯班次模板" : "新增班次模板"}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.body}>
            <View style={styles.nameLabelRow}>
              <Text style={[styles.label, styles.labelInRow]}>模板名稱（選填）</Text>
              {systemBadge ? (
                <View style={styles.sysBadge}>
                  <Text style={styles.sysBadgeText}>系統屬性：{systemBadge}</Text>
                </View>
              ) : null}
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="例：早班、午班、夜班"
              style={styles.input}
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>顏色</Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorsRow}
            >
              {SHIFT_PRESET_COLORS.map((c, i) => (
                <Pressable
                  key={`preset-${i}`}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    color === c && styles.colorDotRing,
                  ]}
                />
              ))}
            </ScrollView>
            {!leaveEdit ? (
              <View style={styles.row2}>
                <View style={styles.timeCol}>
                  <Text style={styles.label}>開始</Text>
                  <WheelTimePicker value={startTime} onChange={setStartTime} />
                </View>
                <View style={styles.timeCol}>
                  <Text style={styles.label}>結束</Text>
                  <WheelTimePicker value={endTime} onChange={setEndTime} />
                </View>
              </View>
            ) : null}
            <Text style={styles.label}>備註（選填）</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              style={styles.input}
              placeholderTextColor={colors.muted}
            />
            <Pressable onPress={submit} style={styles.submit}>
              <Text style={styles.submitText}>儲存</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.4)" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  head: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  body: { flexGrow: 0 },
  hTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  nameLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 6,
  },
  sysBadge: {
    flexShrink: 0,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sysBadgeText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 8, marginBottom: 4 },
  labelInRow: { marginTop: 0, marginBottom: 0 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
    backgroundColor: "#fafafa",
  },
  colorsRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotRing: { borderWidth: 3, borderColor: colors.text },
  row2: { flexDirection: "row", gap: 12 },
  timeCol: { flex: 1, minWidth: 0 },
  submit: {
    marginTop: 12,
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
