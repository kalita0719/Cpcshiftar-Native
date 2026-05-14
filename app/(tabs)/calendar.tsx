import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CalendarGrid from "@/src/components/CalendarGrid";
import RecordModal from "@/src/components/RecordModal";
import { colors } from "@/src/components/theme";
import type { Overtime, ShiftItem } from "@/src/types";

export default function CalendarScreen() {
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [overtimeDate, setOvertimeDate] = useState("");
  const [overtimeExisting, setOvertimeExisting] = useState<Overtime | undefined>();
  const [overtimeShift, setOvertimeShift] = useState<ShiftItem | undefined>();

  const handleOvertime = (date: string, existing?: Overtime, shift?: ShiftItem) => {
    setOvertimeDate(date);
    setOvertimeExisting(existing);
    setOvertimeShift(shift);
    setOvertimeOpen(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.toolbar}>
        <Text style={styles.screenTitle}>行事曆</Text>
      </View>
      <Text style={styles.subtle}>檢視班表；點選日期可紀錄加班／請假</Text>
      <View style={styles.body}>
        <CalendarGrid onOvertime={handleOvertime} />
      </View>

      <RecordModal
        visible={overtimeOpen}
        onClose={() => setOvertimeOpen(false)}
        date={overtimeDate}
        existing={overtimeExisting}
        shift={overtimeShift}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.greyBg },
  toolbar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  screenTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  subtle: { fontSize: 12, color: colors.muted, paddingHorizontal: 16, marginBottom: 6 },
  body: { flex: 1, paddingHorizontal: 6, paddingBottom: 8 },
});
