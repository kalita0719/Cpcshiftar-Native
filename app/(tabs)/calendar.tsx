import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDays, formatYMD, parseYMD } from "@/src/logic/dates";
import { buildRawFillFromExistingPattern } from "@/src/logic/shiftLogic";
import CalendarGrid from "@/src/components/CalendarGrid";
import CycleConfirmModal from "@/src/components/CycleConfirmModal";
import QuickScheduleModal from "@/src/components/QuickScheduleModal";
import RecordModal from "@/src/components/RecordModal";
import { colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";
import type { Overtime, ShiftItem, ShiftTemplate } from "@/src/types";

const HOLIDAY_NAME = "休假";
const HOLIDAY_COLOR = "#94a3b8";

export default function CalendarScreen() {
  const { shifts, upsertShiftForDate, bulkUpsertShifts } = useAppData();

  const [shiftPanelOpen, setShiftPanelOpen] = useState(false);
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [overtimeDate, setOvertimeDate] = useState("");
  const [overtimeExisting, setOvertimeExisting] = useState<Overtime | undefined>();
  const [overtimeShift, setOvertimeShift] = useState<ShiftItem | undefined>();

  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const [cycleMode, setCycleMode] = useState(false);
  const [cycleStart, setCycleStart] = useState<string | null>(null);
  const [cycleEnd, setCycleEnd] = useState<string | null>(null);
  const [cycleConfirmOpen, setCycleConfirmOpen] = useState(false);
  const [cycleFillDays, setCycleFillDays] = useState(30);
  const [cycleGenerating, setCycleGenerating] = useState(false);
  const [cycleToast, setCycleToast] = useState<number | null>(null);

  useEffect(() => {
    if (!shiftPanelOpen) {
      setSelectedScheduleDate(null);
      setCycleMode(false);
      setCycleStart(null);
      setCycleEnd(null);
      setCycleConfirmOpen(false);
      setCycleToast(null);
    }
  }, [shiftPanelOpen]);

  const handleCycleModeToggle = () => {
    if (cycleMode) {
      setCycleMode(false);
      setCycleStart(null);
      setCycleEnd(null);
      setCycleConfirmOpen(false);
    } else {
      setCycleMode(true);
      setSelectedScheduleDate(null);
      setCycleStart(null);
      setCycleEnd(null);
    }
  };

  const handleDateSelect = (dateStr: string) => {
    if (cycleMode) {
      if (!cycleStart) {
        setCycleStart(dateStr);
        setCycleEnd(null);
      } else if (!cycleEnd) {
        if (dateStr === cycleStart) setCycleStart(null);
        else setCycleEnd(dateStr);
      } else {
        setCycleStart(dateStr);
        setCycleEnd(null);
      }
    } else {
      setSelectedScheduleDate(dateStr);
    }
  };

  const handleOvertime = (date: string, existing?: Overtime, shift?: ShiftItem) => {
    setOvertimeDate(date);
    setOvertimeExisting(existing);
    setOvertimeShift(shift);
    setOvertimeOpen(true);
  };

  const handleTemplateSelect = async (template: ShiftTemplate) => {
    if (!selectedScheduleDate) return;
    setApplying(true);
    try {
      upsertShiftForDate({
        date: selectedScheduleDate,
        name: template.name,
        color: template.color,
        startTime: template.startTime,
        endTime: template.endTime,
      });
      const next = addDays(new Date(selectedScheduleDate + "T12:00:00"), 1);
      setSelectedScheduleDate(formatYMD(next));
    } finally {
      setApplying(false);
    }
  };

  const handleHolidaySelect = async () => {
    if (!selectedScheduleDate) return;
    setApplying(true);
    try {
      upsertShiftForDate({
        date: selectedScheduleDate,
        name: HOLIDAY_NAME,
        color: HOLIDAY_COLOR,
        startTime: "00:00",
        endTime: "00:00",
      });
      const next = addDays(new Date(selectedScheduleDate + "T12:00:00"), 1);
      setSelectedScheduleDate(formatYMD(next));
    } finally {
      setApplying(false);
    }
  };

  const handleCycleGenerate = () => {
    if (!cycleStart || !cycleEnd) return;
    setCycleFillDays(30);
    setCycleConfirmOpen(true);
  };

  const handleCycleSubmit = () => {
    if (!cycleStart || !cycleEnd) return;
    const lo = cycleStart <= cycleEnd ? cycleStart : cycleEnd;
    const hi = cycleStart <= cycleEnd ? cycleEnd : cycleStart;
    const map = new Map(shifts.map((s) => [s.date, s]));
    const existingByDate = new Map<string, { name: string; color: string; startTime: string; endTime: string }>();
    for (let d = parseYMD(lo); formatYMD(d) <= hi; d = addDays(d, 1)) {
      const ds = formatYMD(d);
      const s = map.get(ds);
      if (s) existingByDate.set(ds, { name: s.name, color: s.color, startTime: s.startTime, endTime: s.endTime });
    }
    setCycleGenerating(true);
    try {
      const fill = buildRawFillFromExistingPattern(lo, hi, existingByDate, cycleFillDays);
      const n = bulkUpsertShifts(fill);
      setCycleToast(n);
      setCycleConfirmOpen(false);
      setCycleMode(false);
      setCycleStart(null);
      setCycleEnd(null);
    } finally {
      setCycleGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.toolbar}>
        <Text style={styles.screenTitle}>行事曆</Text>
        <Pressable onPress={() => setShiftPanelOpen(true)} style={styles.openPanel}>
          <Text style={styles.openPanelText}>快捷排班</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <CalendarGrid
          onOvertime={shiftPanelOpen ? undefined : handleOvertime}
          scheduleMode={shiftPanelOpen && !cycleMode}
          selectedScheduleDate={selectedScheduleDate}
          onDateSelect={shiftPanelOpen ? handleDateSelect : undefined}
          cycleMode={shiftPanelOpen && cycleMode}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
        />
      </View>

      {cycleToast !== null && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>
            週期排班完成！已寫入 <Text style={styles.toastEm}>{cycleToast}</Text> 個班次
          </Text>
          <Pressable onPress={() => setCycleToast(null)}>
            <Text style={styles.toastX}>✕</Text>
          </Pressable>
        </View>
      )}

      <RecordModal
        visible={overtimeOpen}
        onClose={() => setOvertimeOpen(false)}
        date={overtimeDate}
        existing={overtimeExisting}
        shift={overtimeShift}
      />

      <QuickScheduleModal
        visible={shiftPanelOpen}
        onClose={() => setShiftPanelOpen(false)}
        selectedDate={selectedScheduleDate}
        onTemplateSelect={handleTemplateSelect}
        onHolidaySelect={handleHolidaySelect}
        cycleMode={cycleMode}
        onCycleModeToggle={handleCycleModeToggle}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        onCycleGenerate={handleCycleGenerate}
        applying={applying}
      />

      <CycleConfirmModal
        visible={cycleConfirmOpen}
        onClose={() => setCycleConfirmOpen(false)}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        fillDays={cycleFillDays}
        onChangeFillDays={setCycleFillDays}
        onSubmit={handleCycleSubmit}
        generating={cycleGenerating}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.greyBg },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  screenTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  openPanel: {
    backgroundColor: colors.teal,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  openPanelText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  body: { flex: 1, paddingHorizontal: 6, paddingBottom: 8 },
  toast: {
    position: "absolute",
    bottom: 100,
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  toastText: { flex: 1, fontSize: 13, color: colors.text, fontWeight: "600" },
  toastEm: { color: colors.teal, fontWeight: "800" },
  toastX: { fontSize: 16, color: colors.muted, paddingLeft: 8 },
});
