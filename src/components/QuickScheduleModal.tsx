import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  ArrowLeft,
  CalendarRange,
  Palmtree,
  Pencil,
  Plus,
  Repeat,
  Settings,
  Trash2,
  X,
} from "lucide-react-native";
import { cardShadow, colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";
import type { ShiftTemplate } from "@/src/types";
import TemplateFormModal from "@/src/components/TemplateFormModal";

type ViewMode = "main" | "settings";

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedDate: string | null;
  onTemplateSelect: (template: ShiftTemplate) => void;
  onHolidaySelect: () => void;
  cycleMode: boolean;
  onCycleModeToggle: () => void;
  cycleStart: string | null;
  cycleEnd: string | null;
  onCycleGenerate: () => void;
  applying: boolean;
};

export default function QuickScheduleModal({
  visible,
  onClose,
  selectedDate,
  onTemplateSelect,
  onHolidaySelect,
  cycleMode,
  onCycleModeToggle,
  cycleStart,
  cycleEnd,
  onCycleGenerate,
  applying,
}: Props) {
  const { templates, deleteTemplate } = useAppData();
  const [view, setView] = useState<ViewMode>("main");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<ShiftTemplate | undefined>();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const cycleRangeReady = !!(cycleStart && cycleEnd);
  const cycleRangeLabel = (() => {
    if (!cycleStart) return "尚未選取";
    if (!cycleEnd) return `${cycleStart} → 請點選結束日`;
    const start = cycleStart <= cycleEnd ? cycleStart : cycleEnd;
    const end = cycleStart <= cycleEnd ? cycleEnd : cycleStart;
    const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
    return `${start} → ${end}（${days} 天）`;
  })();

  const handleClose = () => {
    setView("main");
    onClose();
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
          <View style={[styles.sheet, cardShadow(12)]}>
          {view === "main" ? (
            <>
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>
                    {cycleMode ? "週期輪班 — 圈選基準週期" : "快捷排班"}
                  </Text>
                  {cycleMode ? (
                    <Text style={styles.subGreen}>{cycleRangeLabel}</Text>
                  ) : selectedDate ? (
                    <Text style={styles.subTeal}>選取日期：{selectedDate} → 點班次自動跳下一天</Text>
                  ) : (
                    <Text style={styles.subMuted}>點選行事曆日期開始排班</Text>
                  )}
                </View>
                <Pressable onPress={handleClose} style={styles.iconHit}>
                  <X size={20} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 8 }}>
                {cycleMode ? (
                  <View style={styles.gap}>
                    <View style={styles.hintGreen}>
                      <CalendarRange size={18} color={colors.green} style={{ marginTop: 2 }} />
                      <Text style={styles.hintGreenText}>
                        在行事曆上點選起始日，再點選結束日，圈定基準週期（最多 30 天）。圈選後按下方「生成週期班表」。
                      </Text>
                    </View>
                    {cycleRangeReady && (
                      <Pressable
                        onPress={onCycleGenerate}
                        disabled={applying}
                        style={[styles.btnGreen, applying && { opacity: 0.6 }]}
                      >
                        <Repeat size={18} color="#fff" />
                        <Text style={styles.btnGreenText}>{applying ? "生成中..." : "生成週期班表"}</Text>
                      </Pressable>
                    )}
                  </View>
                ) : templates.length === 0 ? (
                  <Text style={styles.empty}>尚無班次模板，請點「班次設定」新增</Text>
                ) : (
                  <View style={styles.wrap}>
                    <Pressable
                      onPress={onHolidaySelect}
                      disabled={!selectedDate || applying}
                      style={[styles.chipGrey, (!selectedDate || applying) && { opacity: 0.4 }]}
                    >
                      <Palmtree size={16} color="#475569" />
                      <Text style={styles.chipGreyText}>休假</Text>
                    </Pressable>
                    {templates.map((t) => (
                      <Pressable
                        key={t.id}
                        onPress={() => onTemplateSelect(t)}
                        disabled={!selectedDate || applying}
                        style={[
                          styles.chipColor,
                          { backgroundColor: t.color },
                          (!selectedDate || applying) && { opacity: 0.4 },
                        ]}
                      >
                        <Text style={styles.chipColorTitle}>{t.name || "未命名"}</Text>
                        <Text style={styles.chipColorTime}>
                          {t.startTime}–{t.endTime}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.footer}>
                <Pressable
                  onPress={() => setView("settings")}
                  style={styles.footerBtn}
                >
                  <Settings size={16} color={colors.text} />
                  <Text style={styles.footerBtnText}>班次設定</Text>
                </Pressable>
                <Pressable
                  onPress={onCycleModeToggle}
                  style={[styles.footerBtn, cycleMode && styles.footerBtnGreen]}
                >
                  <Repeat size={16} color={cycleMode ? "#fff" : colors.text} />
                  <Text style={[styles.footerBtnText, cycleMode && { color: "#fff" }]}>
                    {cycleMode ? "退出週期" : "週期輪班"}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Pressable onPress={() => setView("main")} style={styles.rowLeft}>
                  <ArrowLeft size={20} color={colors.text} />
                  <Text style={styles.title}>班次設定</Text>
                </Pressable>
                <Pressable onPress={handleClose} style={styles.iconHit}>
                  <X size={20} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView style={styles.body}>
                {templates.length === 0 ? (
                  <Text style={styles.empty}>尚無班次模板</Text>
                ) : (
                  templates.map((t) => (
                    <View key={t.id} style={styles.settingRow}>
                      <View style={[styles.dot, { backgroundColor: t.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{t.name || "未命名"}</Text>
                        <Text style={styles.rowTime}>
                          {t.startTime} – {t.endTime}
                        </Text>
                      </View>
                      {deletingId === t.id ? (
                        <View style={styles.delConfirm}>
                          <Pressable
                            onPress={() => {
                              deleteTemplate(t.id);
                              setDeletingId(null);
                            }}
                            style={styles.delYes}
                          >
                            <Text style={styles.delYesText}>確定刪除</Text>
                          </Pressable>
                          <Pressable onPress={() => setDeletingId(null)}>
                            <Text style={styles.delNo}>取消</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={styles.rowActions}>
                          <Pressable
                            onPress={() => {
                              setEditTemplate(t);
                              setDialogOpen(true);
                            }}
                            style={styles.smallHit}
                          >
                            <Pencil size={16} color={colors.muted} />
                          </Pressable>
                          <Pressable onPress={() => setDeletingId(t.id)} style={styles.smallHit}>
                            <Trash2 size={16} color={colors.destructive} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
              <View style={styles.footerSingle}>
                <Pressable
                  onPress={() => {
                    setEditTemplate(undefined);
                    setDialogOpen(true);
                  }}
                  style={styles.addFull}
                >
                  <Plus size={18} color="#fff" />
                  <Text style={styles.addFullText}>新增班次</Text>
                </Pressable>
              </View>
            </>
          )}
          </View>
        </View>
      </Modal>

      <TemplateFormModal
        visible={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditTemplate(undefined);
        }}
        editTemplate={editTemplate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "78%",
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  subGreen: { fontSize: 12, fontWeight: "600", color: colors.green, marginTop: 4 },
  subTeal: { fontSize: 12, fontWeight: "600", color: colors.teal, marginTop: 4 },
  subMuted: { fontSize: 12, color: colors.muted, marginTop: 4 },
  iconHit: { padding: 8 },
  body: { maxHeight: 360, paddingHorizontal: 16, paddingTop: 12 },
  gap: { gap: 12 },
  hintGreen: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.greenSoft,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    padding: 12,
  },
  hintGreenText: { flex: 1, fontSize: 13, color: "#166534", lineHeight: 20 },
  btnGreen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.green,
    borderRadius: 14,
    paddingVertical: 12,
  },
  btnGreenText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipGrey: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipGreyText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  chipColor: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    minWidth: "45%",
    flexGrow: 1,
  },
  chipColorTitle: { color: "#fff", fontWeight: "700", fontSize: 14 },
  chipColorTime: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2 },
  empty: { textAlign: "center", color: colors.muted, paddingVertical: 16, fontSize: 13 },
  footer: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  footerSingle: { paddingHorizontal: 16, paddingTop: 10 },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.greyBg,
  },
  footerBtnGreen: { backgroundColor: colors.green, borderColor: colors.green },
  footerBtnText: { fontSize: 13, fontWeight: "600", color: colors.text },
  addFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.teal,
    paddingVertical: 12,
    borderRadius: 14,
  },
  addFullText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  rowName: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowTime: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowActions: { flexDirection: "row", gap: 4 },
  smallHit: { padding: 8 },
  delConfirm: { flexDirection: "row", gap: 6, alignItems: "center" },
  delYes: {
    backgroundColor: colors.destructive,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  delYesText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  delNo: { fontSize: 12, color: colors.muted, paddingHorizontal: 6 },
});
