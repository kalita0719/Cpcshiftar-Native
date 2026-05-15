import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { formatYMD } from "@/src/logic/dates";
import {
  buildPastShiftRowsFromDna,
  buildYearShiftRowsFromDna,
  shiftTemplatesBySystemTag,
  type SystemSlotCode,
} from "@/src/logic/shiftLogic";
import { colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";
import type { ShiftTemplate, SystemShiftTag } from "@/src/types";

const CODE_TO_TAG: Record<SystemSlotCode, SystemShiftTag> = {
  M: "早班",
  A: "中班",
  N: "夜班",
  O: "休假",
};

const CAT1_RULES: { id: string; title: string; dna: readonly SystemSlotCode[] }[] = [
  { id: "c1a", title: "白白中中休夜夜休", dna: ["M", "M", "A", "A", "O", "N", "N", "O"] },
  { id: "c1b", title: "中中早早夜夜休休", dna: ["A", "A", "M", "M", "N", "N", "O", "O"] },
  { id: "c1c", title: "夜夜中中早早休休", dna: ["N", "N", "A", "A", "M", "M", "O", "O"] },
];

const CAT2_RULES: { id: string; title: string; dna: readonly SystemSlotCode[] }[] = [
  { id: "c2a", title: "早早休休夜夜休休", dna: ["M", "M", "O", "O", "N", "N", "O", "O"] },
  { id: "c2b", title: "早早夜夜休休", dna: ["M", "M", "N", "N", "O", "O"] },
];

/** 班別按鈕標題：超過 3 字只顯示前 2 字，其餘完整顯示。 */
function formatButtonTitle(title: string): string {
  return title.length > 3 ? title.substring(0, 2) : title;
}

export type SmartSchedulePanelProps = {
  anchorYmd: string;
  /** 內嵌於排班中心主畫面（無 Modal 外殼）。 */
  embedded?: boolean;
  /** 一鍵寫入完成後（例如關閉 Modal）。 */
  onAfterBulkSchedule?: () => void;
};

function useCellResolver(templates: ShiftTemplate[]) {
  return useCallback(
    (code: SystemSlotCode) => {
      const tag = CODE_TO_TAG[code];
      const t = templates.find((x) => x.systemTag === tag);
      return {
        code,
        tag,
        name: t?.name ?? (tag === "休假" ? "休假" : tag),
        color: t?.color ?? "#94a3b8",
      };
    },
    [templates],
  );
}

export default function SmartSchedulePanel({ anchorYmd, embedded, onAfterBulkSchedule }: SmartSchedulePanelProps) {
  const { templates, bulkUpsertShifts } = useAppData();
  const anchor = anchorYmd || formatYMD(new Date());
  const [activeCategory, setActiveCategory] = useState<1 | 2 | 3>(1);
  const [customDna, setCustomDna] = useState<SystemSlotCode[]>([]);
  const resolveCell = useCellResolver(templates);

  const tagMap = useMemo(() => shiftTemplatesBySystemTag(templates), [templates]);
  const coreReady = useMemo(
    () =>
      tagMap.has("早班") && tagMap.has("中班") && tagMap.has("夜班") && tagMap.has("休假"),
    [tagMap],
  );

  const appendCode = (code: SystemSlotCode) => {
    setCustomDna((prev) => (prev.length >= 31 ? prev : [...prev, code]));
  };

  const popCode = () => setCustomDna((prev) => prev.slice(0, -1));
  const clearCustom = () => setCustomDna([]);

  const runBulk = useCallback(
    (dna: readonly SystemSlotCode[], todayIndex: number, ruleTitle: string, todayLabel: string) => {
      if (!coreReady) {
        Alert.alert("無法排班", "請先於右上角「班次設定」確認早、中、夜、休四種系統模板皆存在。");
        return;
      }
      Alert.alert(
        "確認排班",
        `你選擇了 ${ruleTitle}，且今日為 ${todayLabel}，系統將自錨定日起往後 365 天、並往前 365 天寫入班表，是否正確？`,
        [
          { text: "取消", style: "cancel" },
          {
            text: "確定",
            onPress: () => {
              const forward = buildYearShiftRowsFromDna(dna, todayIndex, anchor, tagMap, 365, null);
              const past = buildPastShiftRowsFromDna(dna, todayIndex, anchor, tagMap, 365, null);
              const rows = [...past, ...forward];
              if (rows.length === 0) {
                Alert.alert("無法排班", "無法產生任何班次列，請檢查模板或規則。");
                return;
              }
              void Promise.all([
                new Promise<void>((resolve) => {
                  InteractionManager.runAfterInteractions(() => {
                    bulkUpsertShifts(rows);
                    resolve();
                  });
                }),
              ]).then(() => onAfterBulkSchedule?.());
            },
          },
        ],
      );
    },
    [anchor, bulkUpsertShifts, coreReady, onAfterBulkSchedule, tagMap],
  );

  const onPickPresetSlot = (ruleTitle: string, dna: readonly SystemSlotCode[], slotIndex: number) => {
    const cell = resolveCell(dna[slotIndex]);
    runBulk(dna, slotIndex, ruleTitle, `${cell.name}（${cell.code}）`);
  };

  const onConfirmCustom = (slotIndex: number) => {
    if (customDna.length === 0) return;
    const cell = resolveCell(customDna[slotIndex]);
    runBulk(customDna, slotIndex, "自訂義輪班", `${cell.name}（${cell.code}）`);
  };

  const renderPatternRow = (
    ruleKey: string,
    ruleTitle: string,
    dna: readonly SystemSlotCode[],
    onPick: (slotIndex: number) => void,
    dividerAfter: boolean,
  ) => (
    <View key={ruleKey} style={[styles.ruleBlock, dividerAfter && styles.ruleBlockDivider]}>
      <View style={styles.presetSlotRow}>
        {dna.map((code, i) => {
          const c = resolveCell(code);
          const displayTitle = formatButtonTitle(c.name);
          return (
            <TouchableOpacity
              key={`${ruleKey}-${i}`}
              activeOpacity={0.85}
              style={[styles.presetSlotChip, { backgroundColor: c.color }]}
              onPress={() => onPick(i)}
            >
              <Text style={styles.patternSlotLabel} numberOfLines={1}>
                {displayTitle}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const catDim = (n: 1 | 2 | 3) => activeCategory !== n;

  return (
    <View style={embedded ? styles.embedWrap : undefined}>
      {embedded ? (
        <View style={styles.embedHeader}>
          <Text style={styles.embedTitle}>一鍵排班（5+1）</Text>
          <Text style={styles.hintTop}>請選擇你的輪班類型與今日班次</Text>
          <Text style={styles.anchorNote}>錨定日期：{anchor}</Text>
        </View>
      ) : null}

      <ScrollView
        style={embedded ? styles.scrollEmbedded : styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 }}
        nestedScrollEnabled
      >
        {!embedded ? (
          <>
            <Text style={styles.hintTop}>請選擇你的輪班類型與今日班次</Text>
            <Text style={styles.anchorNote}>錨定日期：{anchor}</Text>
          </>
        ) : null}
        <View style={[styles.catFrame, catDim(1) && styles.catFrameDim]}>
          <Pressable style={styles.catHeadingHit} onPress={() => setActiveCategory(1)}>
            <Text style={styles.catHeading}>第一大類：四班三輪</Text>
          </Pressable>
          <View pointerEvents={activeCategory === 1 ? "auto" : "none"}>
            {CAT1_RULES.map((r, idx) =>
              renderPatternRow(
                r.id,
                r.title,
                r.dna,
                (i) => onPickPresetSlot(r.title, r.dna, i),
                idx < CAT1_RULES.length - 1,
              ),
            )}
          </View>
        </View>

        <View style={[styles.catFrame, catDim(2) && styles.catFrameDim]}>
          <Pressable style={styles.catHeadingHit} onPress={() => setActiveCategory(2)}>
            <Text style={styles.catHeading}>第二大類：其他常規</Text>
          </Pressable>
          <View pointerEvents={activeCategory === 2 ? "auto" : "none"}>
            {CAT2_RULES.map((r, idx) =>
              renderPatternRow(
                r.id,
                r.title,
                r.dna,
                (i) => onPickPresetSlot(r.title, r.dna, i),
                idx < CAT2_RULES.length - 1,
              ),
            )}
          </View>
        </View>

        <View style={[styles.catFrame, catDim(3) && styles.catFrameDim]}>
          <Pressable style={styles.catHeadingHit} onPress={() => setActiveCategory(3)}>
            <Text style={styles.catHeading}>第三大類：自訂義</Text>
          </Pressable>
          <View pointerEvents={activeCategory === 3 ? "auto" : "none"}>
            <Text style={styles.subHint}>最多 31 天為一循環；點下方色塊加入，再點序列中某一天作為「今日」。</Text>
            <View style={styles.customToolbar}>
              {(["M", "A", "N", "O"] as const).map((code) => {
                const c = resolveCell(code);
                return (
                  <TouchableOpacity
                    key={code}
                    style={[styles.addChip, { backgroundColor: c.color }]}
                    onPress={() => appendCode(code)}
                    disabled={customDna.length >= 31}
                  >
                    <Text style={styles.addChipText}>+{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.ghostBtn} onPress={popCode} disabled={customDna.length === 0}>
                <Text style={styles.ghostBtnText}>退回</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={clearCustom} disabled={customDna.length === 0}>
                <Text style={styles.ghostBtnText}>清空</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.lenText}>目前長度：{customDna.length} / 31</Text>
            {customDna.length > 0 ? (
              <View style={styles.patternSlotGrid}>
                {customDna.map((code, i) => {
                  const c = resolveCell(code);
                  const displayTitle = formatButtonTitle(c.name);
                  return (
                    <TouchableOpacity
                      key={`c-${i}-${code}`}
                      activeOpacity={0.85}
                      style={[styles.patternSlotChip, { backgroundColor: c.color }]}
                      onPress={() => onConfirmCustom(i)}
                    >
                      <Text style={styles.patternSlotLabel} numberOfLines={1}>
                        {displayTitle}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.placeholder}>請先加入至少 1 個班次</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  embedWrap: { flexGrow: 0 },
  embedHeader: {
    paddingHorizontal: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  embedTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  hintTop: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.teal,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  anchorNote: { fontSize: 12, color: colors.muted, paddingTop: 4, paddingHorizontal: 4, marginBottom: 8 },
  scroll: { maxHeight: "100%", paddingHorizontal: 12, paddingTop: 10 },
  scrollEmbedded: { maxHeight: 520, paddingHorizontal: 4, paddingTop: 4 },
  catFrame: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  catFrameDim: {
    opacity: 0.5,
    backgroundColor: "#f8fafc",
  },
  catHeading: { fontSize: 15, fontWeight: "800", color: colors.text },
  catHeadingHit: {
    paddingVertical: 6,
    marginBottom: 4,
    borderRadius: 6,
  },
  subHint: { fontSize: 12, color: colors.muted, marginBottom: 8, lineHeight: 18 },
  ruleBlock: { marginBottom: 0 },
  /** 輪班規則之間：底部分隔虛線（最後一條不加）。 */
  ruleBlockDivider: {
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderStyle: "dashed",
  },
  /** 預設循環：單列均分（8 格一排；少於 8 格則該列均分）。 */
  presetSlotRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 3,
    alignItems: "stretch",
  },
  presetSlotChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  patternSlotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    rowGap: 6,
  },
  patternSlotChip: {
    width: "23%",
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 4,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  patternSlotLabel: { color: "#fff", fontWeight: "800", fontSize: 10, textAlign: "center" },
  customToolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  addChip: {
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  addChipText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  ghostBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.greyBg,
  },
  ghostBtnText: { fontSize: 12, fontWeight: "700", color: colors.text },
  lenText: { fontSize: 12, color: colors.muted, marginBottom: 6 },
  placeholder: { fontSize: 12, color: colors.muted, fontStyle: "italic", paddingVertical: 8 },
});
