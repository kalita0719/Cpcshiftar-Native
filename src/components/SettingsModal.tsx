import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Settings2, X } from "lucide-react-native";
import { cardShadow, colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SettingsModal({ visible, onClose }: Props) {
  const { settings, updateSettings } = useAppData();
  const [salary, setSalary] = useState(settings.baseSalary);
  const [startDay, setStartDay] = useState(settings.startDay);
  const [handover, setHandover] = useState(settings.handoverEnabled);
  const [mid, setMid] = useState(settings.midAllowance);
  const [night, setNight] = useState(settings.nightAllowance);

  useEffect(() => {
    if (!visible) return;
    setSalary(settings.baseSalary);
    setStartDay(settings.startDay);
    setHandover(settings.handoverEnabled);
    setMid(settings.midAllowance);
    setNight(settings.nightAllowance);
  }, [visible, settings]);

  const baseSalary = parseFloat(salary) || 0;
  const hourlyRate = baseSalary / 240;

  const commit = () => {
    const n = Math.min(28, Math.max(1, parseInt(startDay, 10) || 1));
    updateSettings({
      baseSalary: salary,
      startDay: String(n),
      handoverEnabled: handover,
      midAllowance: mid,
      nightAllowance: night,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.card, cardShadow(10)]}>
          <View style={styles.head}>
            <View style={styles.titleRow}>
              <Settings2 size={20} color={colors.teal} />
              <Text style={styles.title}>設定</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>月底薪 (元)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={salary}
                  onChangeText={setSalary}
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>薪資計算起始日 (每月)</Text>
                <View style={styles.dayRow}>
                  <TextInput
                    keyboardType="numeric"
                    value={startDay}
                    onChangeText={setStartDay}
                    style={[styles.input, { flex: 1 }]}
                  />
                  <Text style={styles.suffix}>號</Text>
                </View>
              </View>
            </View>

            <View style={styles.toggleBlock}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>啟用交接班</Text>
                <Text style={styles.toggleDesc}>
                  每班提早 15 分鐘上班、延後 15 分鐘下班 (+0.5h)，與當日加班合併累進計算
                </Text>
              </View>
              <Switch value={handover} onValueChange={setHandover} trackColor={{ true: colors.teal }} />
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>中班津貼 (元 / 次)</Text>
                <TextInput keyboardType="numeric" value={mid} onChangeText={setMid} style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>晚班津貼 (元 / 次)</Text>
                <TextInput keyboardType="numeric" value={night} onChangeText={setNight} style={styles.input} />
              </View>
            </View>

            {baseSalary > 0 && (
              <View style={styles.rates}>
                <Text style={styles.rateLine}>
                  時薪基數：<Text style={styles.rateEm}>${hourlyRate.toFixed(1)}</Text> 元
                </Text>
                <Text style={styles.rateLine}>
                  1.33×：<Text style={styles.rateEm}>${(hourlyRate * 1.33).toFixed(1)}</Text>
                </Text>
                <Text style={styles.rateLine}>
                  1.66×：<Text style={styles.rateEm}>${(hourlyRate * 1.66).toFixed(1)}</Text>
                </Text>
                <Text style={styles.rateLine}>
                  2.0×：<Text style={styles.rateEm}>${(hourlyRate * 2.0).toFixed(1)}</Text>
                </Text>
              </View>
            )}

            <Pressable onPress={commit} style={styles.save}>
              <Text style={styles.saveText}>完成</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 48,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  label: { fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fafafa",
    color: colors.text,
  },
  row2: { flexDirection: "row", gap: 12, marginBottom: 14 },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  suffix: { fontSize: 14, color: colors.muted },
  toggleBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  toggleTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  toggleDesc: { fontSize: 11, color: colors.muted, marginTop: 4, lineHeight: 16 },
  rates: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  rateLine: { fontSize: 12, color: colors.muted },
  rateEm: { fontWeight: "700", color: colors.text },
  save: {
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
