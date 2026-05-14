import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Palmtree, Pencil, Plus, Settings, Trash2, X } from "lucide-react-native";
import { cardShadow, colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";
import type { ShiftTemplate } from "@/src/types";
import { effectiveTemplateTimes } from "@/src/types";
import TemplateFormModal from "@/src/components/TemplateFormModal";

type ViewMode = "main" | "settings";

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedDate: string | null;
  onTemplateSelect: (template: ShiftTemplate) => void;
  onHolidaySelect: () => void;
  applying: boolean;
};

export default function QuickScheduleModal({
  visible,
  onClose,
  selectedDate,
  onTemplateSelect,
  onHolidaySelect,
  applying,
}: Props) {
  const { templates, deleteTemplate } = useAppData();
  const [view, setView] = useState<ViewMode>("main");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<ShiftTemplate | undefined>();
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
                    <Text style={styles.title}>快捷排班</Text>
                    {selectedDate ? (
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
                  {templates.length === 0 ? (
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
                            {t.systemTag === "休假"
                              ? "無時段"
                              : `${effectiveTemplateTimes(t).startTime}–${effectiveTemplateTimes(t).endTime}`}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </ScrollView>

                <View style={styles.footerSingle}>
                  <Pressable onPress={() => setView("settings")} style={styles.footerBtnWide}>
                    <Settings size={16} color={colors.text} />
                    <Text style={styles.footerBtnText}>班次設定</Text>
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
                            {t.systemTag === "休假"
                              ? "無時段"
                              : `${effectiveTemplateTimes(t).startTime} – ${effectiveTemplateTimes(t).endTime}`}
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
                            {t.isFixed ? null : (
                              <Pressable onPress={() => setDeletingId(t.id)} style={styles.smallHit}>
                                <Trash2 size={16} color={colors.destructive} />
                              </Pressable>
                            )}
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
  subTeal: { fontSize: 12, fontWeight: "600", color: colors.teal, marginTop: 4 },
  subMuted: { fontSize: 12, color: colors.muted, marginTop: 4 },
  iconHit: { padding: 8 },
  body: { maxHeight: 360, paddingHorizontal: 16, paddingTop: 12 },
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
  footerSingle: { paddingHorizontal: 16, paddingTop: 10 },
  footerBtnWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.greyBg,
  },
  footerBtnText: { fontSize: 13, fontWeight: "600", color: colors.text },
  addFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.teal,
    paddingVertical: 12,
    borderRadius: 6,
  },
  addFullText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 6,
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
    borderRadius: 6,
  },
  delYesText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  delNo: { fontSize: 12, color: colors.muted, paddingHorizontal: 6 },
});
