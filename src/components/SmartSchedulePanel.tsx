import { cardShadow, colors } from "@/src/components/theme";
import { formatYMD } from "@/src/logic/dates";
import { shiftTwoCharLabel } from "@/src/logic/shiftDisplay";
import {
  buildPastShiftRowsFromDna,
  buildYearShiftRowsFromDna,
  encodeTemplateSlot,
  isSystemSlotCode,
  rotationDnaIsSchedulable,
  shiftTemplatesById,
  shiftTemplatesBySystemTag,
  type SystemSlotCode,
} from "@/src/logic/shiftLogic";
import { useAppData } from "@/src/state/AppDataContext";
import type { RotationSlotCode, ShiftTemplate, SystemShiftTag } from "@/src/types";
import { Check } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ScrollView as ScrollViewType,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const CODE_TO_TAG: Record<SystemSlotCode, SystemShiftTag> = {
  M: "早班",
  A: "中班",
  N: "夜班",
  O: "休假",
};

const SLOT_SHORT: Record<SystemSlotCode, string> = {
  M: "早",
  A: "中",
  N: "夜",
  O: "休",
};

/** 五種預設輪班 + 自訂，不再分類。 */
const PRESET_RULES: {
  id: string;
  title: string;
  dna: readonly SystemSlotCode[];
}[] = [
  { id: "c1a", title: "四班三輪1", dna: ["M", "M", "A", "A", "O", "N", "N", "O"] },
  { id: "c1b", title: "四班三輪2", dna: ["A", "A", "M", "M", "N", "N", "O", "O"] },
  { id: "c1c", title: "四班三輪3", dna: ["N", "N", "A", "A", "M", "M", "O", "O"] },
  { id: "c2a", title: "常規1", dna: ["M", "M", "O", "O", "N", "N", "O", "O"] },
  { id: "c2b", title: "常規2", dna: ["M", "M", "N", "N", "O", "O"] },
];

const CUSTOM_ID = "custom";
const STEP_BADGE_BREATH_MS = 1400;
type WizardStep = 1 | 2 | 3;

type SelectedRule = {
  id: string;
  title: string;
  dna: readonly RotationSlotCode[];
};

export type SmartSchedulePanelProps = {
  anchorYmd: string;
  embedded?: boolean;
  hideEmbedTitle?: boolean;
  onAfterBulkSchedule?: () => void;
  /** 內嵌於外層 ScrollView（排班中心）時傳入，步驟 3 會自動捲到底 */
  hostScrollRef?: React.RefObject<ScrollViewType | null>;
};

/** 自訂輪班預覽色塊：名稱拆成上下兩行（寬度固定、各最多 2 字）。 */
function slotChipLines(name: string): [string, string] {
  const trimmed = name.trim();
  if (!trimmed) return ["?", ""];
  if (trimmed.length <= 2) return [trimmed, ""];
  const half = Math.ceil(trimmed.length / 2);
  return [trimmed.slice(0, half), trimmed.slice(half)];
}

function useSlotResolver(templates: ShiftTemplate[]) {
  const byId = useMemo(() => shiftTemplatesById(templates), [templates]);
  return useCallback(
    (slot: RotationSlotCode) => {
      if (isSystemSlotCode(slot)) {
        const tag = CODE_TO_TAG[slot];
        const t = templates.find((x) => x.systemTag === tag);
        return {
          name: t?.name ?? (tag === "休假" ? "休假" : tag),
          short: SLOT_SHORT[slot],
          color: t?.color ?? "#94a3b8",
        };
      }
      const id = Number(slot.slice(1));
      const t = byId.get(id);
      const name = t?.name ?? "已刪除";
      return {
        name,
        short: shiftTwoCharLabel(name),
        color: t?.color ?? "#94a3b8",
      };
    },
    [templates, byId],
  );
}

function StepBadge({ n, done, breathing }: { n: number; done?: boolean; breathing?: boolean }) {
  const pulse = useSharedValue(0);
  const showBreath = Boolean(breathing && !done);

  useEffect(() => {
    if (!showBreath) {
      pulse.value = withTiming(0, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: STEP_BADGE_BREATH_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [showBreath, pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: showBreath ? 0.18 + pulse.value * 0.42 : 0,
    transform: [{ scale: showBreath ? 1 + pulse.value * 0.55 : 1 }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: showBreath ? 1 + pulse.value * 0.1 : 1 }],
  }));

  if (done) {
    return (
      <View style={[styles.stepBadge, styles.stepBadgeDone]}>
        <Check size={12} color="#fff" strokeWidth={3} />
      </View>
    );
  }

  return (
    <View style={styles.stepBadgeWrap}>
      {showBreath ? (
        <Animated.View style={[styles.stepBadgeGlow, glowStyle]} pointerEvents="none" />
      ) : null}
      <Animated.View style={[styles.stepBadge, badgeStyle]}>
        <Text style={styles.stepBadgeText}>{n}</Text>
      </Animated.View>
    </View>
  );
}

function HintStepDot({ n }: { n: number }) {
  return (
    <View style={styles.hintStepDot}>
      <Text style={styles.hintStepDotText}>{n}</Text>
    </View>
  );
}

function QuickScheduleIntroHint({ compact }: { compact?: boolean }) {
  return (
    <View style={[styles.hintTopRow, compact && styles.hintTopRowCompact]}>
      <Text style={styles.hintTopText}>選擇</Text>
      <View style={styles.hintStepGroup}>
        <HintStepDot n={1} />
        <Text style={styles.hintTopText}>輪班排序</Text>
      </View>
      <Text style={styles.hintTopText}>與</Text>
      <View style={styles.hintStepGroup}>
        <HintStepDot n={2} />
        <Text style={styles.hintTopText}>今日班次</Text>
      </View>
      <Text style={styles.hintTopText}>，即可完成全年排班。</Text>
    </View>
  );
}

export default function SmartSchedulePanel({
  anchorYmd,
  embedded,
  hideEmbedTitle,
  onAfterBulkSchedule,
  hostScrollRef,
}: SmartSchedulePanelProps) {
  const { templates, bulkUpsertShifts, customRotation, saveCustomRotation } = useAppData();
  const anchor = anchorYmd || formatYMD(new Date());
  const resolveSlot = useSlotResolver(templates);
  const scrollRef = useRef<ScrollViewType>(null);

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [selectedRule, setSelectedRule] = useState<SelectedRule | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [customDna, setCustomDna] = useState<RotationSlotCode[]>([]);
  const [customDraftOpen, setCustomDraftOpen] = useState(false);
  const [showCompleteToast, setShowCompleteToast] = useState(false);

  const tagMap = useMemo(() => shiftTemplatesBySystemTag(templates), [templates]);
  const templateById = useMemo(() => shiftTemplatesById(templates), [templates]);
  const userTemplates = useMemo(
    () => templates.filter((t) => !t.systemTag),
    [templates],
  );
  const coreReady = useMemo(
    () =>
      tagMap.has("早班") && tagMap.has("中班") && tagMap.has("夜班") && tagMap.has("休假"),
    [tagMap],
  );

  const resetWizard = useCallback(() => {
    setWizardStep(1);
    setSelectedRule(null);
    setSelectedSlotIndex(null);
    setCustomDna([]);
    setCustomDraftOpen(false);
    setShowCompleteToast(false);
  }, []);

  useEffect(() => {
    if (!showCompleteToast) return;
    const timer = setTimeout(() => {
      setShowCompleteToast(false);
      if (onAfterBulkSchedule) {
        onAfterBulkSchedule();
      } else {
        resetWizard();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [showCompleteToast, onAfterBulkSchedule, resetWizard]);

  const appendSlot = (slot: RotationSlotCode) => {
    setCustomDna((prev) => (prev.length >= 31 ? prev : [...prev, slot]));
  };
  const popCode = () => setCustomDna((prev) => prev.slice(0, -1));
  const clearCustom = () => setCustomDna([]);

  const selectPresetRule = (rule: (typeof PRESET_RULES)[number]) => {
    setSelectedRule({
      id: rule.id,
      title: rule.title,
      dna: rule.dna,
    });
    setCustomDraftOpen(false);
    setWizardStep(2);
  };

  const openCustomEditor = (dna?: RotationSlotCode[]) => {
    setCustomDna(dna ?? customRotation?.dna ?? []);
    setCustomDraftOpen(true);
  };

  const selectSavedCustomRule = () => {
    if (!customRotation) {
      openCustomEditor();
      return;
    }
    setSelectedRule({
      id: CUSTOM_ID,
      title: "自訂義輪班",
      dna: customRotation.dna,
    });
    setCustomDraftOpen(false);
    setWizardStep(2);
  };

  const confirmCustomRule = () => {
    const dna = [...customDna];
    saveCustomRotation(dna);
    setSelectedRule({
      id: CUSTOM_ID,
      title: "自訂義輪班",
      dna,
    });
    setCustomDraftOpen(false);
    setWizardStep(2);
  };

  const selectTodaySlot = (slotIndex: number) => {
    setSelectedSlotIndex(slotIndex);
    setWizardStep(3);
  };

  const scrollToConfirm = useCallback(() => {
    if (embedded) {
      hostScrollRef?.current?.scrollToEnd({ animated: true });
      return;
    }
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [embedded, hostScrollRef]);

  useEffect(() => {
    if (wizardStep !== 3) return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) scrollToConfirm();
    };
    const interaction = InteractionManager.runAfterInteractions(run);
    const retryA = setTimeout(run, 100);
    const retryB = setTimeout(run, 320);
    return () => {
      cancelled = true;
      interaction.cancel();
      clearTimeout(retryA);
      clearTimeout(retryB);
    };
  }, [wizardStep, scrollToConfirm]);

  const runBulk = useCallback(() => {
    if (!selectedRule || selectedSlotIndex === null) return;
    const schedulable =
      selectedRule.id === CUSTOM_ID
        ? rotationDnaIsSchedulable(selectedRule.dna, tagMap, templateById)
        : coreReady;
    if (!schedulable) {
      Alert.alert(
        "無法排班",
        selectedRule.id === CUSTOM_ID
          ? "輪班排序中有班次尚未設定或已被刪除，請至「班次設定」檢查。"
          : "請先於右上角「班次設定」確認早、中、夜、休四種系統模板皆存在。",
      );
      return;
    }
    const forward = buildYearShiftRowsFromDna(
      selectedRule.dna,
      selectedSlotIndex,
      anchor,
      tagMap,
      templateById,
      365,
      null,
    );
    const past = buildPastShiftRowsFromDna(
      selectedRule.dna,
      selectedSlotIndex,
      anchor,
      tagMap,
      templateById,
      365,
      null,
    );
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
    ]).then(() => {
      setShowCompleteToast(true);
    });
  }, [
    anchor,
    bulkUpsertShifts,
    coreReady,
    selectedRule,
    selectedSlotIndex,
    tagMap,
    templateById,
  ]);

  const renderPatternPreview = (
    dna: readonly RotationSlotCode[],
    size: "step1" | "compact" | "normal" = "normal",
    options?: { wrap?: boolean; twoLine?: boolean },
  ) => {
    const twoLine = Boolean(options?.twoLine);
    const chipStyle = twoLine
      ? styles.patternChipCustom
      : size === "step1"
        ? styles.patternChipStep1
        : size === "compact"
          ? styles.patternChipCompact
          : styles.patternChip;
    const chipTextStyle = twoLine
      ? styles.patternChipTextCustom
      : size === "step1"
        ? styles.patternChipTextStep1
        : styles.patternChipText;
    return (
      <View
        style={[
          styles.patternRow,
          size === "step1" && styles.patternRowStep1,
          options?.wrap && styles.patternRowWrap,
        ]}
      >
        {dna.map((slot, i) => {
          const c = resolveSlot(slot);
          const [line1, line2] = twoLine ? slotChipLines(c.name) : [c.short, ""];
          return (
            <View
              key={`${slot}-${i}`}
              style={[chipStyle, { backgroundColor: c.color, borderColor: "rgba(0,0,0,0.12)" }]}
            >
              {twoLine ? (
                <View style={styles.patternChipTextStack}>
                  <Text
                    style={[chipTextStyle, styles.chipTextOnColor]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {line1}
                  </Text>
                  {line2 ? (
                    <Text
                      style={[chipTextStyle, styles.chipTextOnColor]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {line2}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={[chipTextStyle, styles.chipTextOnColor]}>{c.short}</Text>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const ruleSummaryLabel =
    selectedRule?.id === CUSTOM_ID && selectedRule.dna.length === 0
      ? "自訂義輪班 · 未排入班次"
      : (selectedRule?.title ?? "");
  const hasSchedulePattern = (selectedRule?.dna.length ?? 0) > 0;

  const todaySummaryLabel =
    selectedRule && selectedSlotIndex !== null
      ? `第 ${selectedSlotIndex + 1} 天 · ${resolveSlot(selectedRule.dna[selectedSlotIndex]).name}`
      : "";

  const scrollStyle = embedded ? styles.scrollEmbedded : styles.scroll;

  const wizardStepsContent = (
    <>
      {/* Step 1 */}
      <View style={[styles.stepCard, cardShadow(3)]}>
              <View style={styles.stepHeader}>
                <StepBadge n={1} done={wizardStep > 1} breathing={wizardStep === 1} />
                <Text style={[styles.stepTitle, wizardStep > 1 && styles.stepTitleDone]}>
                  選擇輪班排序
                </Text>
                {wizardStep > 1 ? (
                  <Pressable onPress={resetWizard} hitSlop={8}>
                    <Text style={styles.editLink}>修改</Text>
                  </Pressable>
                ) : null}
              </View>

              {wizardStep > 1 && selectedRule ? (
                <Text style={styles.stepSummary}>{ruleSummaryLabel}</Text>
              ) : (
                <View style={styles.stepBody}>
                  {PRESET_RULES.map((rule) => (
                    <Pressable
                      key={rule.id}
                      style={({ pressed }) => [
                        styles.ruleOption,
                        pressed && styles.ruleOptionPressed,
                      ]}
                      onPress={() => selectPresetRule(rule)}
                    >
                      <View style={styles.ruleOptionInner}>
                        <Text style={styles.ruleOptionTitle} numberOfLines={1}>
                          {rule.title}
                        </Text>
                        {renderPatternPreview(rule.dna, "step1")}
                      </View>
                    </Pressable>
                  ))}

                  <View
                    style={[
                      styles.ruleOption,
                      customDraftOpen && styles.ruleOptionActive,
                      customRotation && !customDraftOpen && styles.ruleOptionSaved,
                    ]}
                  >
                    <View style={styles.customOptionHeader}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.customOptionMain,
                          pressed && styles.ruleOptionPressed,
                        ]}
                        onPress={() =>
                          customRotation && !customDraftOpen
                            ? selectSavedCustomRule()
                            : openCustomEditor()
                        }
                      >
                        <View style={styles.ruleOptionInner}>
                          <Text style={styles.ruleOptionTitle}>自訂義輪班</Text>
                          {customRotation && !customDraftOpen ? (
                            <>
                              <Text style={styles.customHint}>
                                {customRotation.dna.length > 0
                                  ? `共 ${customRotation.dna.length} 天 · 點擊使用此排序`
                                  : "未排入班次 · 點擊修改"}
                              </Text>
                              {customRotation.dna.length > 0
                                ? renderPatternPreview(customRotation.dna, "step1", {
                                    wrap: true,
                                    twoLine: true,
                                  })
                                : null}
                            </>
                          ) : (
                            <Text style={styles.customHint}>
                              {customDraftOpen
                                ? "編輯中…"
                                : "自行組合輪班（最多 31 天）"}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                      {customRotation && !customDraftOpen ? (
                        <Pressable
                          style={styles.customEditHit}
                          onPress={() => openCustomEditor(customRotation.dna)}
                          hitSlop={8}
                        >
                          <Text style={styles.editLink}>修改</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  {customDraftOpen ? (
                    <View style={styles.customBuilder}>
                      <Text style={styles.subHint}>
                        點下方色塊加入班次；亦可留空確認（不顯示班表、不進入自動排班）。
                      </Text>
                      <Text style={styles.lenText}>目前長度：{customDna.length} / 31</Text>
                      <View style={styles.customPreviewArea}>
                        {customDna.length > 0 ? (
                          renderPatternPreview(customDna, "step1", { wrap: true, twoLine: true })
                        ) : (
                          <Text style={styles.placeholder}>尚未排入班次</Text>
                        )}
                      </View>
                      <View style={styles.customToolbarFrame}>
                        <View style={styles.customToolbarCoreRow}>
                          {(["M", "A", "N", "O"] as const).map((code) => {
                            const c = resolveSlot(code);
                            return (
                              <TouchableOpacity
                                key={code}
                                style={[styles.addChipCore, { backgroundColor: c.color }]}
                                onPress={() => appendSlot(code)}
                                disabled={customDna.length >= 31}
                              >
                                <Text
                                  style={styles.addChipCoreText}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.8}
                                >
                                  +{shiftTwoCharLabel(c.name)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <View style={styles.customToolbar}>
                          {userTemplates.map((t) => (
                            <TouchableOpacity
                              key={`tpl-${t.id}`}
                              style={[styles.addChip, { backgroundColor: t.color }]}
                              onPress={() => appendSlot(encodeTemplateSlot(t.id))}
                              disabled={customDna.length >= 31}
                            >
                              <Text
                                style={styles.addChipText}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.8}
                              >
                                +{shiftTwoCharLabel(t.name.trim() || "班次")}
                              </Text>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity
                            style={styles.ghostBtn}
                            onPress={popCode}
                            disabled={customDna.length === 0}
                          >
                            <Text style={styles.ghostBtnText}>退回</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.ghostBtn}
                            onPress={clearCustom}
                            disabled={customDna.length === 0}
                          >
                            <Text style={styles.ghostBtnText}>清空</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.confirmCustomBtn}
                        onPress={confirmCustomRule}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.confirmCustomBtnText}>確認輪班排序</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              )}
            </View>

            {/* Step 2 */}
            {wizardStep >= 2 && selectedRule && hasSchedulePattern ? (
              <View style={[styles.stepCard, cardShadow(3)]}>
                <View style={styles.stepHeader}>
                  <StepBadge n={2} done={wizardStep > 2} breathing={wizardStep === 2} />
                  <Text style={[styles.stepTitle, wizardStep > 2 && styles.stepTitleDone]}>
                    選擇今日班別
                  </Text>
                  {wizardStep > 2 ? (
                    <Pressable
                      onPress={() => {
                        setSelectedSlotIndex(null);
                        setWizardStep(2);
                      }}
                      hitSlop={8}
                    >
                      <Text style={styles.editLink}>修改</Text>
                    </Pressable>
                  ) : null}
                </View>

                {wizardStep > 2 ? (
                  <Text style={styles.stepSummary}>{todaySummaryLabel}</Text>
                ) : (
                  <View style={styles.stepBody}>
                    <Text style={styles.step2Hint}>
                      今天是 <Text style={styles.step2Date}>{anchor}</Text>
                      ，請點選今班別
                    </Text>
                    {selectedRule.id === CUSTOM_ID ? (
                      <View style={styles.dayGrid}>
                        {selectedRule.dna.map((slot, i) => {
                          const c = resolveSlot(slot);
                          return (
                            <View key={`day-${i}`} style={styles.dayCell}>
                              <Text style={styles.dayLabel}>第{i + 1}天</Text>
                              <TouchableOpacity
                                activeOpacity={0.85}
                                style={[
                                  styles.dayChip,
                                  { backgroundColor: c.color, borderColor: "rgba(0,0,0,0.12)" },
                                ]}
                                onPress={() => selectTodaySlot(i)}
                              >
                                <Text style={[styles.dayChipText, styles.chipTextOnColor]}>
                                  {c.short}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={styles.dayGridPreset}>
                        {Array.from(
                          { length: Math.ceil(selectedRule.dna.length / 4) },
                          (_, rowIdx) => (
                            <View key={`preset-row-${rowIdx}`} style={styles.dayGridPresetRow}>
                              {Array.from({ length: 4 }, (_, colIdx) => {
                                const i = rowIdx * 4 + colIdx;
                                const slot = selectedRule.dna[i];
                                if (slot === undefined) {
                                  return (
                                    <View
                                      key={`empty-${colIdx}`}
                                      style={styles.dayCellPresetSpacer}
                                    />
                                  );
                                }
                                const c = resolveSlot(slot);
                                return (
                                  <View key={`day-${i}`} style={styles.dayCellPreset}>
                                    <Text style={styles.dayLabel}>第{i + 1}天</Text>
                                    <TouchableOpacity
                                      activeOpacity={0.85}
                                      style={[
                                        styles.dayChip,
                                        styles.dayChipPreset,
                                        {
                                          backgroundColor: c.color,
                                          borderColor: "rgba(0,0,0,0.12)",
                                        },
                                      ]}
                                      onPress={() => selectTodaySlot(i)}
                                    >
                                      <Text
                                        style={[
                                          styles.dayChipTextPreset,
                                          styles.chipTextOnColor,
                                        ]}
                                      >
                                        {c.short}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                );
                              })}
                            </View>
                          ),
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            ) : null}

            {/* Step 3 */}
            {wizardStep === 3 && selectedRule && selectedSlotIndex !== null ? (
              <View style={[styles.stepCard, styles.stepCardConfirm, cardShadow(4)]}>
                <View style={styles.stepHeader}>
                  <StepBadge n={3} breathing={wizardStep === 3} />
                  <Text style={styles.stepTitle}>確認排班設定</Text>
                </View>
                <View style={styles.stepBody}>
                  <View style={styles.confirmSummaryBox}>
                    <ConfirmRow label="輪班排序" value={ruleSummaryLabel} />
                    <ConfirmRow label="輪班週期" value={`${selectedRule.dna.length} 天`} />
                    <ConfirmRow label="今日班別" value={todaySummaryLabel} />
                    <ConfirmRow label="錨定日期" value={anchor} />
                  </View>
                  <Text style={styles.confirmNote}>
                    系統將自今日起往前、往後各 365 天寫入班表。
                  </Text>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={runBulk}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.confirmBtnText}>確認並開始自動排班</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
    </>
  );

  return (
    <View style={[styles.panelWrap, embedded && styles.embedWrap]}>
      {embedded ? (
        <View
          style={[
            styles.embedHeader,
            hideEmbedTitle && styles.embedHeaderCompact,
            hideEmbedTitle && styles.embedHeaderSeamless,
          ]}
        >
          {hideEmbedTitle ? null : <Text style={styles.embedTitle}>快速排班</Text>}
          <QuickScheduleIntroHint compact={hideEmbedTitle} />
        </View>
      ) : null}

      {embedded ? (
        <View style={[styles.embedBody, styles.scrollContent]}>{wizardStepsContent}</View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={scrollStyle}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
        >
          <QuickScheduleIntroHint />
          {wizardStepsContent}
        </ScrollView>
      )}

      {showCompleteToast ? (
        <View style={styles.toastOverlay} pointerEvents="none">
          <View style={[styles.toastBox, cardShadow(8)]}>
            <Check size={22} color={colors.green} strokeWidth={2.5} />
            <Text style={styles.toastText}>排班完成</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.confirmRow}>
      <Text style={styles.confirmRowLabel}>{label}</Text>
      <Text style={styles.confirmRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panelWrap: { position: "relative", flexGrow: 0 },
  embedWrap: { flexGrow: 0 },
  embedHeader: {
    paddingHorizontal: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  embedHeaderCompact: { paddingBottom: 6, marginBottom: 6 },
  embedHeaderSeamless: { borderBottomWidth: 0, marginBottom: 4 },
  embedTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  hintTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 4,
    rowGap: 6,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  hintStepGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  hintTopRowCompact: { paddingTop: 0 },
  hintTopText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    lineHeight: 20,
  },
  hintStepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  hintStepDotText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  anchorNote: {
    fontSize: 12,
    color: colors.muted,
    paddingTop: 4,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  scroll: { maxHeight: "100%", paddingHorizontal: 12, paddingTop: 10 },
  embedBody: { paddingHorizontal: 4, paddingTop: 4 },
  scrollEmbedded: { maxHeight: 560, paddingHorizontal: 4, paddingTop: 4 },
  scrollContent: { paddingBottom: 24, gap: 8 },

  stepCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepCardConfirm: {
    borderColor: colors.teal,
    borderWidth: 1.5,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  stepBadgeWrap: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeGlow: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.teal,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeDone: { backgroundColor: colors.green },
  stepBadgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  stepTitle: { flex: 1, fontSize: 14, fontWeight: "800", color: colors.text },
  stepTitleDone: { color: colors.green },
  editLink: { fontSize: 13, fontWeight: "700", color: colors.teal },
  stepSummary: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    marginLeft: 30,
    fontWeight: "600",
  },
  stepBody: { marginTop: 6 },

  ruleOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 5,
    backgroundColor: "#fafbfc",
  },
  ruleOptionPressed: { backgroundColor: "#f0fdfa", borderColor: colors.teal },
  ruleOptionActive: { borderColor: colors.teal, backgroundColor: "#f0fdfa" },
  ruleOptionSaved: { borderColor: colors.teal },
  customOptionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  customOptionMain: { flex: 1, minWidth: 0 },
  customEditHit: { paddingTop: 2, paddingLeft: 4 },
  ruleOptionInner: { gap: 4, width: "100%", minWidth: 0 },
  ruleOptionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  customHint: { fontSize: 10, color: colors.muted },

  patternRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
  },
  patternRowStep1: { gap: 3 },
  patternRowWrap: {
    flexWrap: "wrap",
    alignSelf: "stretch",
    width: "100%",
    rowGap: 4,
    columnGap: 3,
  },
  patternChip: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  patternChipStep1: {
    width: 30,
    height: 30,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  patternChipCustom: {
    width: 30,
    height: 42,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  patternChipTextStack: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    width: "100%",
    paddingHorizontal: 1,
  },
  patternChipCompact: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  patternChipText: { fontSize: 9, fontWeight: "800" },
  patternChipTextStep1: { fontSize: 10, fontWeight: "800" },
  patternChipTextCustom: {
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
    textAlign: "center",
    width: "100%",
  },
  chipTextOnColor: { color: "#fff" },

  customBuilder: {
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: "100%",
    minWidth: 0,
  },
  subHint: { fontSize: 12, color: colors.muted, marginBottom: 8, lineHeight: 18 },
  customPreviewArea: {
    minHeight: 48,
    marginBottom: 10,
    width: "100%",
  },
  customToolbarFrame: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.greyBg,
    padding: 8,
    marginBottom: 10,
    width: "100%",
  },
  customToolbarCoreRow: {
    flexDirection: "row",
    gap: 6,
    width: "100%",
    marginBottom: 8,
  },
  customToolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  addChipCore: {
    flex: 1,
    minWidth: 0,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  addChipCoreText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "center",
  },
  addChip: { borderRadius: 6, paddingVertical: 8, paddingHorizontal: 9 },
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
  placeholder: { fontSize: 12, color: colors.muted, fontStyle: "italic", marginBottom: 8 },
  confirmCustomBtn: {
    marginTop: 12,
    backgroundColor: colors.teal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmCustomBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  step2Hint: { fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: 12 },
  step2Date: { color: colors.teal, fontWeight: "800" },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
  },
  dayGridPreset: { gap: 6 },
  dayGridPresetRow: {
    flexDirection: "row",
    gap: 6,
  },
  dayCell: { width: "20%", alignItems: "center", minWidth: 52 },
  dayCellPreset: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  dayCellPresetSpacer: { flex: 1, minWidth: 0 },
  dayLabel: { fontSize: 10, color: colors.muted, marginBottom: 4, fontWeight: "600" },
  dayChip: {
    width: "100%",
    aspectRatio: 1,
    maxWidth: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipPreset: {
    width: 50,
    height: 38,
    maxWidth: 50,
    aspectRatio: undefined,
    alignSelf: "center",
    borderRadius: 6,
  },
  dayChipText: { fontSize: 13, fontWeight: "800" },
  dayChipTextPreset: { fontSize: 11 },

  confirmSummaryBox: {
    backgroundColor: colors.greyBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    gap: 8,
  },
  confirmRowLabel: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  confirmRowValue: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    flexShrink: 1,
    textAlign: "right",
  },
  confirmNote: { fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 14 },
  confirmBtn: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  toastOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    zIndex: 20,
  },
  toastBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toastText: { fontSize: 16, fontWeight: "800", color: colors.text },
});
