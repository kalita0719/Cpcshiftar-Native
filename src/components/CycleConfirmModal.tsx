import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Repeat, X } from "lucide-react-native";
import { cardShadow, colors } from "@/src/components/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  cycleStart: string | null;
  cycleEnd: string | null;
  fillDays: number;
  onChangeFillDays: (n: number) => void;
  onSubmit: () => void;
  generating: boolean;
};

export default function CycleConfirmModal({
  visible,
  onClose,
  cycleStart,
  cycleEnd,
  fillDays,
  onChangeFillDays,
  onSubmit,
  generating,
}: Props) {
  const rangeText =
    cycleStart && cycleEnd
      ? `${cycleStart <= cycleEnd ? cycleStart : cycleEnd} → ${cycleStart <= cycleEnd ? cycleEnd : cycleStart}`
      : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.card, cardShadow(10)]}>
          <View style={styles.head}>
            <View style={styles.titleRow}>
              <Repeat size={22} color={colors.green} />
              <Text style={styles.title}>生成週期班表</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={22} color={colors.text} />
            </Pressable>
          </View>
          <Text style={styles.desc}>
            以 <Text style={styles.bold}>{rangeText}</Text> 的班次為基準週期，循環填滿後續天數。
          </Text>
          <Text style={styles.label}>
            要循環填滿未來幾天？<Text style={styles.hint}>（最多 365 天）</Text>
          </Text>
          <TextInput
            keyboardType="number-pad"
            value={String(fillDays)}
            onChangeText={(t) => onChangeFillDays(Math.min(365, Math.max(1, parseInt(t, 10) || 1)))}
            style={styles.numInput}
          />
          <Pressable
            onPress={onSubmit}
            disabled={generating}
            style={[styles.btn, generating && { opacity: 0.6 }]}
          >
            <Repeat size={18} color="#fff" />
            <Text style={styles.btnText}>
              {generating ? "生成中..." : `生成 ${fillDays} 天週期班表`}
            </Text>
          </Pressable>
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
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  desc: { fontSize: 14, color: colors.muted, lineHeight: 22, marginBottom: 16 },
  bold: { fontWeight: "700", color: colors.text },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8 },
  hint: { fontWeight: "400", color: colors.muted, fontSize: 13 },
  numInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 12,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 18,
    backgroundColor: "#fafafa",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.green,
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
