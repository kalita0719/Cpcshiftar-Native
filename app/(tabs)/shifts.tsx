import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Clock, Layers, Repeat } from "lucide-react-native";
import { formatYMD } from "@/src/logic/dates";
import CalendarGrid from "@/src/components/CalendarGrid";
import RecurringPanel from "@/src/components/RecurringPanel";
import ShiftFormModal from "@/src/components/ShiftFormModal";
import { colors } from "@/src/components/theme";
import type { ShiftItem } from "@/src/types";

type Tab = "shifts" | "recurring";

export default function ShiftsScreen() {
  const [tab, setTab] = useState<Tab>("shifts");
  const [showTemplates, setShowTemplates] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [editShift, setEditShift] = useState<ShiftItem | undefined>();

  const handleShiftClick = (date: Date, existing?: ShiftItem) => {
    setSelectedDate(formatYMD(date));
    setEditShift(existing);
    setShiftOpen(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Text style={styles.h1}>班次管理</Text>
        {showTemplates ? (
          <Pressable onPress={() => setShowTemplates(false)} style={styles.backChip}>
            <ChevronLeft size={18} color={colors.text} />
            <Text style={styles.backChipText}>返回</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setShowTemplates(true)} style={styles.backChip}>
            <Layers size={18} color={colors.text} />
            <Text style={styles.backChipText}>班次模板</Text>
          </Pressable>
        )}
      </View>

      {showTemplates ? (
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.intro}>
            班次模板定義預設的上班時段；請於「行事曆 → 快捷排班 → 班次設定」中管理模板。此處提供週期排班與月曆點選編輯。
          </Text>
          <Pressable onPress={() => setShowTemplates(false)} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>前往快捷排班管理模板</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.pad}>
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setTab("shifts")}
              style={[styles.tab, tab === "shifts" && styles.tabOn]}
            >
              <Clock size={14} color={tab === "shifts" ? colors.text : colors.muted} />
              <Text style={[styles.tabText, tab === "shifts" && styles.tabTextOn]}>班次編輯</Text>
            </Pressable>
            <Pressable
              onPress={() => setTab("recurring")}
              style={[styles.tab, tab === "recurring" && styles.tabOn]}
            >
              <Repeat size={14} color={tab === "recurring" ? colors.text : colors.muted} />
              <Text style={[styles.tabText, tab === "recurring" && styles.tabTextOn]}>週期排班</Text>
            </Pressable>
          </View>

          {tab === "shifts" ? (
            <CalendarGrid onShiftClick={handleShiftClick} />
          ) : (
            <RecurringPanel />
          )}
        </ScrollView>
      )}

      <ShiftFormModal
        visible={shiftOpen}
        onClose={() => {
          setShiftOpen(false);
          setEditShift(undefined);
          setSelectedDate(undefined);
        }}
        defaultDate={selectedDate}
        editShift={editShift}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.greyBg },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  h1: { fontSize: 20, fontWeight: "800", color: colors.text },
  backChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  backChipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  pad: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: 12 },
  linkBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.teal,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  linkBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    alignSelf: "flex-start",
    gap: 4,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabOn: { backgroundColor: colors.card, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  tabTextOn: { color: colors.text },
});
