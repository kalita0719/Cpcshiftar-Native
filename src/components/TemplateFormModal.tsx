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
import { useAppData } from "@/src/state/AppDataContext";
import type { ShiftTemplate } from "@/src/types";

const PRESET_COLORS = [
  "#f59e0b",
  "#11928F",
  "#6B66E8",
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#ec4899",
  "#8b5cf6",
];

type Props = {
  visible: boolean;
  onClose: () => void;
  editTemplate?: ShiftTemplate;
};

export default function TemplateFormModal({ visible, onClose, editTemplate }: Props) {
  const { createTemplate, updateTemplate } = useAppData();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("15:00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!visible) return;
    if (editTemplate) {
      setName(editTemplate.name);
      setColor(editTemplate.color);
      setStartTime(editTemplate.startTime);
      setEndTime(editTemplate.endTime);
      setNotes(editTemplate.notes ?? "");
    } else {
      setName("");
      setColor(PRESET_COLORS[0]);
      setStartTime("09:00");
      setEndTime("17:00");
      setNotes("");
    }
  }, [editTemplate, visible]);

  const submit = () => {
    if (editTemplate) {
      updateTemplate(editTemplate.id, { name, color, startTime, endTime, notes: notes || null });
    } else {
      createTemplate({ name, color, startTime, endTime, notes: notes || null });
    }
    onClose();
  };

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
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>模板名稱（選填）</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="例：早班、午班、夜班"
              style={styles.input}
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>顏色</Text>
            <View style={styles.colors}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    color === c && styles.colorDotRing,
                  ]}
                />
              ))}
            </View>
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
          </ScrollView>
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
    maxHeight: "85%",
  },
  head: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  hTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: "#fafafa",
  },
  colors: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotRing: { borderWidth: 3, borderColor: colors.text },
  row2: { flexDirection: "row", gap: 12 },
  submit: {
    marginTop: 20,
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
