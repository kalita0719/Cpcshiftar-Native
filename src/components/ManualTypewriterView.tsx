import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDays, formatYMD } from "@/src/logic/dates";
import CalendarGrid from "@/src/components/CalendarGrid";
import { colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";
import type { SystemShiftTag } from "@/src/types";
import { effectiveTemplateTimes } from "@/src/types";

const KEYS: { label: string; tag: SystemShiftTag }[] = [
  { label: "早", tag: "早班" },
  { label: "中", tag: "中班" },
  { label: "夜", tag: "夜班" },
  { label: "休", tag: "休假" },
];

type Props = {
  selectedYmd: string;
  onChangeSelectedYmd: (ymd: string) => void;
  onDone: () => void;
};

export default function ManualTypewriterView({ selectedYmd, onChangeSelectedYmd, onDone }: Props) {
  const { templates, upsertShiftForDate } = useAppData();

  const byTag = useMemo(() => {
    const m = new Map<SystemShiftTag, (typeof templates)[0]>();
    for (const t of templates) {
      if (t.systemTag) m.set(t.systemTag, t);
    }
    return m;
  }, [templates]);

  const applyTag = useCallback(
    (tag: SystemShiftTag) => {
      const t = byTag.get(tag);
      if (!t) return;
      const { startTime, endTime } = effectiveTemplateTimes(t);
      upsertShiftForDate({
        date: selectedYmd,
        name: t.name,
        color: t.color,
        startTime,
        endTime,
        systemTag: t.systemTag,
      });
      const next = formatYMD(addDays(new Date(selectedYmd + "T12:00:00"), 1));
      onChangeSelectedYmd(next);
    },
    [byTag, onChangeSelectedYmd, selectedYmd, upsertShiftForDate],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>🚀 快速編輯中</Text>
        <Pressable onPress={onDone} style={styles.doneBtn}>
          <Text style={styles.doneText}>完成</Text>
        </Pressable>
      </View>

      <View style={styles.calWrap}>
        <CalendarGrid
          scheduleMode
          selectedScheduleDate={selectedYmd}
          onDateSelect={onChangeSelectedYmd}
          typewriterDim
        />
      </View>

      <View style={styles.keyboard}>
        {KEYS.map((k) => (
          <Pressable
            key={k.tag}
            onPress={() => applyTag(k.tag)}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          >
            <Text style={styles.keyText}>{k.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#e2e8f0" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  doneBtn: {
    backgroundColor: colors.teal,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
  },
  doneText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  calWrap: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 6,
    backgroundColor: "#cbd5e1",
  },
  keyboard: {
    flexDirection: "row",
    borderTopWidth: 2,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 6,
  },
  key: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#f8fafc",
    minHeight: 48,
  },
  keyPressed: { opacity: 0.85, backgroundColor: "#e2e8f0" },
  keyText: { fontSize: 18, fontWeight: "900", color: colors.text },
});
