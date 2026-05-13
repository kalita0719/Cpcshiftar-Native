import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar, Clock, Settings2, TrendingUp } from "lucide-react-native";
import { addDays, formatYMD, startOfWeekMonday } from "@/src/logic/dates";
import { getPeriod, shiftTime } from "@/src/logic/shiftLogic";
import { Card } from "@/src/components/Card";
import SettingsModal from "@/src/components/SettingsModal";
import { colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";

const DAY_ZH = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export default function HomeScreen() {
  const { overtime, shifts, settings, getWeeklyShifts } = useAppData();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const startDay = Math.min(28, Math.max(1, parseInt(settings.startDay, 10) || 1));
  const period = useMemo(() => getPeriod(startDay, 0), [startDay]);

  const overtimeData = useMemo(
    () => overtime.filter((o) => o.date >= period.from && o.date <= period.to),
    [overtime, period.from, period.to],
  );

  const totalOtHours = useMemo(() => {
    return overtimeData.reduce((s, r) => s + (r.earlyHours ?? 0) + (r.lateHours ?? 0), 0);
  }, [overtimeData]);

  const today = formatYMD(new Date());
  const tomorrow = formatYMD(addDays(new Date(), 1));
  const nearOtMap = useMemo(() => {
    const m = new Map<string, (typeof overtime)[0]>();
    for (const o of overtime) {
      if (o.date === today || o.date === tomorrow) m.set(o.date, o);
    }
    return m;
  }, [overtime, today, tomorrow]);

  const weekStart = formatYMD(startOfWeekMonday(new Date()));
  const weekShifts = getWeeklyShifts(weekStart);
  const todayShifts = weekShifts.filter((s) => s.date === today);
  const tomorrowShifts = weekShifts.filter((s) => s.date === tomorrow);

  const handoverEnabled = settings.handoverEnabled;
  const ho = handoverEnabled ? 0.25 : 0;

  const renderShift = (shift: (typeof shifts)[0], day: string) => {
    const isWork = shift.name !== "休假";
    const ot = nearOtMap.get(day);
    const earlyH = (ot?.earlyHours ?? 0) || (ot?.earlyClassHours ?? 0);
    const lateH = (ot?.lateHours ?? 0) || (ot?.lateClassHours ?? 0);
    const hov = handoverEnabled && isWork ? 0.25 : 0;
    const dispStart = isWork ? shiftTime(shift.startTime, -(earlyH + hov)) : shift.startTime;
    const dispEnd = isWork ? shiftTime(shift.endTime, lateH + hov) : shift.endTime;
    const changed = isWork && (earlyH > 0 || lateH > 0 || hov > 0);
    return (
      <View key={shift.id} style={styles.shiftRow}>
        <View style={[styles.dot, { backgroundColor: shift.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.shiftName}>{shift.name}</Text>
          <Text style={[styles.shiftTime, changed && { color: colors.orange, fontWeight: "700" }]}>
            {dispStart} - {dispEnd}
          </Text>
        </View>
      </View>
    );
  };

  const now = new Date();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.dateBig}>
              {now.getMonth() + 1}月{now.getDate()}日
            </Text>
            <Text style={styles.dateSub}>
              {DAY_ZH[now.getDay()]}，祝你有個美好的一天
            </Text>
          </View>
          <Pressable onPress={() => setSettingsOpen(true)} style={styles.gear}>
            <Settings2 size={20} color={colors.teal} />
          </Pressable>
        </View>

        <Card style={styles.otCard}>
          <View style={styles.otIconWrap}>
            <TrendingUp size={28} color={colors.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.otHours}>{totalOtHours}h</Text>
            <Text style={styles.otLabel}>本期加班時數</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View style={styles.periodChip}>
              <Text style={styles.periodChipText}>{period.label}</Text>
            </View>
            {handoverEnabled && (
              <Text style={styles.handNote}>含交接班 0.5h</Text>
            )}
          </View>
        </Card>

        <View style={styles.twoCol}>
          <Card style={styles.halfCard}>
            <View style={styles.cardTitleRow}>
              <Calendar size={16} color={colors.teal} />
              <Text style={styles.cardTitle}>今日班次</Text>
            </View>
            {todayShifts.length === 0 ? (
              <Text style={styles.empty}>今天沒有班次</Text>
            ) : (
              todayShifts.map((s) => renderShift(s, today))
            )}
          </Card>

          <Card style={styles.halfCard}>
            <View style={styles.cardTitleRow}>
              <Clock size={16} color={colors.teal} />
              <Text style={styles.cardTitle}>明日班次</Text>
            </View>
            {tomorrowShifts.length === 0 ? (
              <Text style={styles.empty}>明天沒有班次</Text>
            ) : (
              tomorrowShifts.map((s) => renderShift(s, tomorrow))
            )}
          </Card>
        </View>
      </ScrollView>

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.greyBg },
  scroll: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  dateBig: { fontSize: 28, fontWeight: "800", color: colors.text },
  dateSub: { fontSize: 14, color: colors.teal, marginTop: 6 },
  gear: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  otCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  otIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(17,146,143,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  otHours: { fontSize: 28, fontWeight: "800", color: colors.text },
  otLabel: { fontSize: 13, color: colors.teal, marginTop: 2 },
  periodChip: {
    backgroundColor: colors.greyBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  periodChipText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  handNote: { fontSize: 10, color: colors.muted, marginTop: 6 },
  twoCol: { gap: 12 },
  halfCard: { padding: 16, marginBottom: 4 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  empty: { fontSize: 13, color: colors.muted },
  shiftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.greyBg,
    marginBottom: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  shiftName: { fontSize: 14, fontWeight: "600", color: colors.text },
  shiftTime: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
