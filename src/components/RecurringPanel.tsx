import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CalendarCheck, GripVertical, Minus, Plus, Repeat } from "lucide-react-native";
import { addDays, formatYMD } from "@/src/logic/dates";
import { colors } from "@/src/components/theme";
import { useAppData, useApplyCyclePattern } from "@/src/state/AppDataContext";
import type { ShiftTemplate } from "@/src/types";

const today = formatYMD(new Date());
const minStart = formatYMD(addDays(new Date(), -180));

export default function RecurringPanel() {
  const { templates } = useAppData();
  const applyCycle = useApplyCyclePattern();
  const [pattern, setPattern] = useState<(number | null)[]>(Array(8).fill(null));
  const [startDate, setStartDate] = useState(today);
  const [cycles, setCycles] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (templates.length > 0) {
      setPattern(Array.from({ length: 8 }, (_, i) => templates[i % templates.length]?.id ?? null));
    }
  }, [templates]);

  const cycleModeEndDate = (() => {
    if (!startDate || pattern.length === 0) return "";
    const totalDays = cycles * pattern.length;
    return formatYMD(addDays(new Date(startDate + "T12:00:00"), totalDays - 1));
  })();

  const previewCount = (() => {
    if (!startDate) return 0;
    const nonHoliday = pattern.filter((p) => p !== null).length;
    return cycles * nonHoliday;
  })();

  const setCycleSlot = (idx: number, val: number | null) => {
    setPattern((prev) => prev.map((v, i) => (i === idx ? val : v)));
  };

  const handleSubmit = () => {
    if (!startDate || !cycleModeEndDate) return;
    setSubmitting(true);
    setError("");
    try {
      const n = applyCycle(pattern, startDate, cycleModeEndDate, notes || null);
      setResult(n);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "建立失敗，請重試");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError("");
    setStartDate(today);
    setCycles(1);
    setNotes("");
  };

  if (result !== null) {
    return (
      <View style={styles.done}>
        <View style={styles.doneIcon}>
          <CalendarCheck size={36} color={colors.teal} />
        </View>
        <Text style={styles.doneTitle}>排班完成！</Text>
        <Text style={styles.doneSub}>
          已成功寫入 <Text style={styles.doneEm}>{result}</Text> 個班次
        </Text>
        <Pressable onPress={reset} style={styles.doneBtn}>
          <Text style={styles.doneBtnText}>再次排班</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.intro}>依自訂輪班週期批量建立班次，循環重複至週期數結束（演算法與網頁版後端 cycle 模式一致）。</Text>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>
          週期設定 <Text style={styles.muted}>（{pattern.length} 天循環）</Text>
        </Text>
        <View style={styles.plusminus}>
          <Pressable
            onPress={() => setPattern((p) => (p.length > 2 ? p.slice(0, -1) : p))}
            disabled={pattern.length <= 2}
            style={styles.pmBtn}
          >
            <Minus size={16} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => setPattern((p) => (p.length < 30 ? [...p, null] : p))}
            disabled={pattern.length >= 30}
            style={styles.pmBtn}
          >
            <Plus size={16} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <Text style={styles.hint}>預設 8 天對應四班三輪常見週期；可自行增減天數。</Text>

      <View style={styles.patternList}>
        {pattern.map((tplId, idx) => (
          <View key={idx} style={styles.patternRow}>
            <View style={styles.dayLabel}>
              <GripVertical size={14} color="#cbd5e1" />
              <Text style={styles.dayText}>第{idx + 1}天</Text>
            </View>
            <View style={styles.patternBtns}>
              <Pressable
                onPress={() => setCycleSlot(idx, null)}
                style={[styles.miniChip, tplId === null && styles.miniChipOn]}
              >
                <Text style={styles.miniChipText}>休假</Text>
              </Pressable>
              {templates.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setCycleSlot(idx, t.id)}
                  style={[
                    styles.miniChip,
                    tplId === t.id && { backgroundColor: t.color, borderColor: t.color },
                  ]}
                >
                  <Text
                    style={[styles.miniChipText, tplId === t.id && { color: "#fff", fontWeight: "700" }]}
                  >
                    {t.name || "未命名"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>開始日期</Text>
          <TextInput value={startDate} onChangeText={setStartDate} style={styles.input} />
          <Text style={styles.mini}>不得早於 {minStart}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>循環週期數（最多 50）</Text>
          <View style={styles.cycleStep}>
            <Pressable onPress={() => setCycles((c) => Math.max(1, c - 1))} style={styles.pmBtn}>
              <Minus size={16} />
            </Pressable>
            <TextInput
              keyboardType="numeric"
              value={String(cycles)}
              onChangeText={(t) => setCycles(Math.min(50, Math.max(1, parseInt(t, 10) || 1)))}
              style={[styles.input, { flex: 1, textAlign: "center" }]}
            />
            <Pressable onPress={() => setCycles((c) => Math.min(50, c + 1))} style={styles.pmBtn}>
              <Plus size={16} />
            </Pressable>
          </View>
          {cycleModeEndDate ? (
            <Text style={styles.mini}>至 {cycleModeEndDate}</Text>
          ) : null}
        </View>
      </View>

      <Text style={styles.label}>備註（選填）</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="套用到所有班次的備註…"
        style={styles.input}
        placeholderTextColor={colors.muted}
      />

      {previewCount > 0 && (
        <View style={styles.preview}>
          <Text style={styles.previewText}>
            將寫入 <Text style={styles.previewBold}>{previewCount}</Text> 個班次
            {cycleModeEndDate ? (
              <Text style={styles.muted}>
                {" "}
                （{startDate} 至 {cycleModeEndDate}，共 {cycles} 週期）
              </Text>
            ) : null}
          </Text>
        </View>
      )}

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting || previewCount === 0}
        style={[styles.submit, (submitting || previewCount === 0) && { opacity: 0.55 }]}
      >
        <Repeat size={18} color="#fff" />
        <Text style={styles.submitText}>{submitting ? "建立中…" : "確認建立"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 20 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  muted: { fontWeight: "400", color: colors.muted, fontSize: 12 },
  plusminus: { flexDirection: "row", gap: 6 },
  pmBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  hint: { fontSize: 11, color: colors.muted, marginTop: 6, marginBottom: 10 },
  patternList: { maxHeight: 220, marginBottom: 12 },
  patternRow: { marginBottom: 8 },
  dayLabel: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  dayText: { fontSize: 11, fontWeight: "600", color: colors.muted, width: 52 },
  patternBtns: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.greyBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniChipOn: { backgroundColor: "#e2e8f0" },
  miniChipText: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  row2: { flexDirection: "row", gap: 10, marginTop: 8 },
  label: { fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#fafafa",
    color: colors.text,
  },
  mini: { fontSize: 10, color: colors.muted, marginTop: 4 },
  cycleStep: { flexDirection: "row", gap: 6, alignItems: "center" },
  preview: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(17,146,143,0.08)",
    borderWidth: 1,
    borderColor: "rgba(17,146,143,0.25)",
  },
  previewText: { fontSize: 13, textAlign: "center", color: colors.text },
  previewBold: { fontWeight: "800", color: colors.teal },
  err: { color: colors.destructive, textAlign: "center", marginTop: 8, fontSize: 13 },
  submit: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 14,
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  done: { alignItems: "center", paddingVertical: 40 },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(17,146,143,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  doneTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  doneSub: { fontSize: 14, color: colors.muted, marginTop: 6 },
  doneEm: { color: colors.teal, fontWeight: "800" },
  doneBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.teal,
  },
  doneBtnText: { color: "#fff", fontWeight: "700" },
});
