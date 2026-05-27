import React, { useState } from "react";
import ScreenLayout from "@/src/components/ScreenLayout";
import { StyleSheet, Text, View } from "react-native";
import CalendarGrid from "@/src/components/CalendarGrid";
import HolidayOvertimeModal from "@/src/components/HolidayOvertimeModal";
import RecordModal from "@/src/components/RecordModal";
import { isRestDayShift } from "@/src/logic/differentialHours";
import type { Overtime, ShiftItem } from "@/src/types";

export default function CalendarScreen() {
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [holidayOtOpen, setHolidayOtOpen] = useState(false);
  const [overtimeDate, setOvertimeDate] = useState("");
  const [overtimeExisting, setOvertimeExisting] = useState<Overtime | undefined>();
  const [overtimeShift, setOvertimeShift] = useState<ShiftItem | undefined>();

  const handleOvertime = (date: string, existing?: Overtime, shift?: ShiftItem) => {
    setOvertimeDate(date);
    setOvertimeExisting(existing);
    setOvertimeShift(shift);
    if (shift && isRestDayShift(shift)) {
      setHolidayOtOpen(true);
    } else {
      setOvertimeOpen(true);
    }
  };

  return (
    <ScreenLayout>

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
      <HolidayOvertimeModal
        visible={holidayOtOpen}
        onClose={() => setHolidayOtOpen(false)}
        date={overtimeDate}
        existing={overtimeExisting}
        shift={overtimeShift}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 6, paddingBottom: 8 },
});
