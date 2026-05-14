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
import { Palmtree, X, Zap } from "lucide-react-native";
import { cardShadow, colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";
import type { ShiftItem, SystemShiftTag } from "@/src/types";
import { effectiveTemplateTimes } from "@/src/types";

const HOLIDAY_NAME = "休假";
const HOLIDAY_COLOR = "#94a3b8";
const PRESET_COLORS = ["#11928F", "#F29D11", "#6B66E8", "#10b981", "#ef4444", "#3b82f6", "#ec4899"];

type Props = {
  visible: boolean;
  onClose: () => void;
  defaultDate?: string;
  editShift?: ShiftItem;
};

export default function ShiftFormModal({ visible, onClose, defaultDate, editShift }: Props) {
  const { templates, upsertShiftForDate, updateShift } = useAppData();
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [date, setDate] = useState(defaultDate ?? today);
  const [notes, setNotes] = useState("");
  const [systemTag, setSystemTag] = useState<SystemShiftTag | undefined>(undefined);

  const hideTimes = systemTag === "休假";

  useEffect(() => {
    if (!visible) return;
    if (editShift) {
      setName(editShift.name);
      setColor(editShift.color);
      setStartTime(editShift.startTime);
      setEndTime(editShift.endTime);
      setDate(editShift.date);
      setNotes(editShift.notes ?? "");
      setSystemTag(editShift.systemTag);
    } else {
      setName("");
      setColor(PRESET_COLORS[0]);
      setStartTime("09:00");
      setEndTime("17:00");
      setDate(defaultDate ?? today);
      setNotes("");
      setSystemTag(undefined);
    }
  }, [editShift, defaultDate, visible, today]);

  const applyHoliday = () => {
    setName(HOLIDAY_NAME);
    setColor(HOLIDAY_COLOR);
    setSystemTag("休假");
  };

  const submit = () => {
    const st = hideTimes ? "00:00" : startTime;
    const et = hideTimes ? "00:00" : endTime;
    if (editShift) {
      updateShift(editShift.id, { name, color, startTime: st, endTime: et, date, notes: notes || null, systemTag });
    } else {
      upsertShiftForDate({ name, color, startTime: st, endTime: et, date, notes: notes || null, systemTag });
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.card, cardShadow(8)]}>
          <View style={styles.head}>
            <Text style={styles.title}>{editShift ? "編輯班次" : "新增班次"}</Text>
            <Pressable onPress={onClose}>
              <X size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView>
            {systemTag ? (
              <View style={styles.sysBadge}>
                <Text style={styles.sysBadgeText}>系統屬性：{systemTag}</Text>
              </View>
            ) : null}
            <Text style={styles.label}>日期</Text>
            <TextInput value={date} onChangeText={setDate} style={styles.input} />
            <Text style={styles.label}>名稱</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="班次名稱" />
            <Text style={styles.label}>快速套用模板</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tplRow}>
              {templates.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    setName(t.name);
                    setColor(t.color);
                    const tt = effectiveTemplateTimes(t);
                    setStartTime(tt.startTime);
                    setEndTime(tt.endTime);
                    setSystemTag(t.systemTag);
                  }}
                  style={[styles.tplChip, { borderColor: t.color }]}
                >
                  <Zap size={14} color={t.color} />
                  <Text style={styles.tplText}>{t.name || "模板"}</Text>
                </Pressable>
              ))}
              <Pressable onPress={applyHoliday} style={styles.tplChip}>
                <Palmtree size={14} color="#64748b" />
                <Text style={styles.tplText}>休假</Text>
              </Pressable>
            </ScrollView>
            <Text style={styles.label}>顏色</Text>
            <View style={styles.colors}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[styles.dot, { backgroundColor: c }, color === c && styles.dotRing]}
                />
              ))}
            </View>
            {!hideTimes ? (
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>開始</Text>
                  <TextInput value={startTime} onChangeText={setStartTime} style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>結束</Text>
                  <TextInput value={endTime} onChangeText={setEndTime} style={styles.input} />
                </View>
              </View>
            ) : null}
            <Text style={styles.label}>備註</Text>
            <TextInput value={notes} onChangeText={setNotes} style={styles.input} />
            <Pressable onPress={submit} style={styles.submit}>
              <Text style={styles.submitText}>儲存</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "rgba(0,0,0,0.4)" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  sysBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 6,
  },
  sysBadgeText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#fafafa",
    color: colors.text,
  },
  tplRow: { flexDirection: "row", marginBottom: 4 },
  tplChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  tplText: { fontSize: 13, fontWeight: "600", color: colors.text },
  colors: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  dot: { width: 32, height: 32, borderRadius: 16 },
  dotRing: { borderWidth: 3, borderColor: colors.text },
  row2: { flexDirection: "row", gap: 10 },
  submit: {
    marginTop: 18,
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
