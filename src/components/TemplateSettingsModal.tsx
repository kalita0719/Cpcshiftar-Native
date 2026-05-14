import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Plus, Pencil, Trash2, X } from "lucide-react-native";
import { cardShadow, colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";
import type { ShiftTemplate } from "@/src/types";
import { effectiveTemplateTimes } from "@/src/types";
import TemplateFormModal from "@/src/components/TemplateFormModal";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function TemplateSettingsModal({ visible, onClose }: Props) {
  const { templates, deleteTemplate } = useAppData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<ShiftTemplate | undefined>();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.root}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
          <View style={[styles.sheet, cardShadow(14)]}>
            <View style={styles.header}>
              <Text style={styles.title}>班次設定</Text>
              <Pressable onPress={onClose} style={styles.iconHit}>
                <X size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 16 }}>
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
            <View style={styles.footer}>
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
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  iconHit: { padding: 8 },
  body: { maxHeight: 420, paddingHorizontal: 16, paddingTop: 12 },
  empty: { textAlign: "center", color: colors.muted, paddingVertical: 20, fontSize: 13 },
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
  footer: { paddingHorizontal: 16, paddingTop: 8 },
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
});
