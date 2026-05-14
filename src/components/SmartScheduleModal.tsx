import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { X } from "lucide-react-native";
import { formatYMD } from "@/src/logic/dates";
import { cardShadow, colors } from "@/src/components/theme";
import SmartSchedulePanel from "@/src/components/SmartSchedulePanel";

type Props = {
  visible: boolean;
  onClose: () => void;
  anchorYmd?: string;
};

export default function SmartScheduleModal({ visible, onClose, anchorYmd }: Props) {
  const anchor = anchorYmd ?? formatYMD(new Date());
  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.sheet, cardShadow(16)]}>
          <View style={styles.header}>
            <Text style={styles.hTitle}>一鍵排班（5+1）</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeHit}>
              <X size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <SmartSchedulePanel anchorYmd={anchor} onAfterBulkSchedule={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
    paddingBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hTitle: { fontSize: 17, fontWeight: "800", color: colors.text, flex: 1 },
  closeHit: { padding: 4 },
});
