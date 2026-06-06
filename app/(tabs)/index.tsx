import { Card } from "@/src/components/Card";
import SettingsModal from "@/src/components/SettingsModal";
import { colors } from "@/src/components/theme";
import { addDays, formatYMD } from "@/src/logic/dates";
import { computeDifferentialOvertime } from "@/src/logic/differentialHours";
import { recordedOvertimeHours } from "@/src/logic/holidayOvertime";
import { hourlyRateFromBaseSalary } from "@/src/logic/overtimePay";
import { getDisplayShiftTimes, getScheduleChangeLabels } from "@/src/logic/shiftAllowance";
import { getPeriod } from "@/src/logic/shiftLogic";
import { useAppData } from "@/src/state/AppDataContext";
import { Calendar, Clock, Settings2 } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import ScreenLayout from "@/src/components/ScreenLayout";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const DAY_ZH = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export default function HomeScreen() {
  const { overtime, shifts, settings } = useAppData();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const startDay = Math.min(28, Math.max(1, parseInt(settings.startDay, 10) || 1));
  const period = useMemo(() => getPeriod(startDay, 0), [startDay]);
  const today = formatYMD(new Date());
  const effectiveTo = today < period.to ? today : period.to;

  const overtimeData = useMemo(
    () => overtime.filter((o) => o.date >= period.from && o.date <= effectiveTo),
    [overtime, period.from, effectiveTo],
  );

  const periodOtData = useMemo(
    () => overtime.filter((o) => o.date >= period.from && o.date <= period.to),
    [overtime, period.from, period.to],
  );

  const baseSalary = parseFloat(settings.baseSalary) || 0;
  const hourlyRate = hourlyRateFromBaseSalary(baseSalary);
  const differentialEnabled = settings.differentialHoursEnabled;

  const shiftByDate = useMemo(() => new Map(shifts.map((s) => [s.date, s])), [shifts]);

  const calendarToDate = useMemo(
    () =>
      overtimeData.reduce((s, r) => s + recordedOvertimeHours(r, shiftByDate.get(r.date)), 0),
    [overtimeData, shiftByDate],
  );

  const calendarPeriod = useMemo(
    () =>
      periodOtData.reduce((s, r) => s + recordedOvertimeHours(r, shiftByDate.get(r.date)), 0),
    [periodOtData, shiftByDate],
  );

  const differentialToDate = useMemo(
    () =>
      computeDifferentialOvertime(
        shifts,
        period.from,
        effectiveTo,
        differentialEnabled,
        hourlyRate,
      ),
    [shifts, period.from, effectiveTo, differentialEnabled, hourlyRate],
  );

  const differentialPeriod = useMemo(
    () =>
      computeDifferentialOvertime(shifts, period.from, period.to, differentialEnabled, hourlyRate),
    [shifts, period.from, period.to, differentialEnabled, hourlyRate],
  );

  const otToDate = calendarToDate + differentialToDate.totalHours;
  const otPeriod = calendarPeriod + differentialPeriod.totalHours;

  const tomorrow = formatYMD(addDays(new Date(), 1));
  const nearOtMap = useMemo(() => {
    const m = new Map<string, (typeof overtime)[0]>();
    for (const o of overtime) {
      if (o.date === today || o.date === tomorrow) m.set(o.date, o);
    }
    return m;
  }, [overtime, today, tomorrow]);

  const todayShifts = useMemo(() => {
    const shift = shiftByDate.get(today);
    return shift ? [shift] : [];
  }, [shiftByDate, today]);

  const tomorrowShifts = useMemo(() => {
    const shift = shiftByDate.get(tomorrow);
    return shift ? [shift] : [];
  }, [shiftByDate, tomorrow]);

  const handoverEnabled = settings.handoverEnabled;

  const todayScheduleLabels = useMemo(() => {
    const shift = shiftByDate.get(today);
    if (!shift) return "";
    return getScheduleChangeLabels(shift, nearOtMap.get(today), handoverEnabled);
  }, [shiftByDate, today, nearOtMap, handoverEnabled]);

  const tomorrowScheduleLabels = useMemo(() => {
    const shift = shiftByDate.get(tomorrow);
    if (!shift) return "";
    return getScheduleChangeLabels(shift, nearOtMap.get(tomorrow), handoverEnabled);
  }, [shiftByDate, tomorrow, nearOtMap, handoverEnabled]);

  const renderShift = (shift: (typeof shifts)[0]) => {
    const ot = nearOtMap.get(shift.date);
    const { startTime: dispStart, endTime: dispEnd, changed } = getDisplayShiftTimes(
      shift,
      ot,
      handoverEnabled,
    );
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
    <ScreenLayout>
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
            <Settings2 size={13} color={colors.teal} />
            <Text style={styles.gearText}>設定</Text>
          </Pressable>
        </View>

        <Card style={styles.otCard}>
          <Text style={styles.periodTop}>薪資計算週期 {period.label}</Text>
          <View style={styles.otTwoCol}>
            <View style={styles.otStat}>
              <Text style={styles.otStatLabel}>累計加班時數</Text>
              <Text style={styles.otHours}>{otToDate}h</Text>
              <Text style={styles.otStatSub}>至今日</Text>
              {differentialToDate.totalHours > 0 ? (
                <Text style={styles.otDiffNote}>含差額工時 {differentialToDate.totalHours}h</Text>
              ) : null}
            </View>
            <View style={styles.otDivider} />
            <View style={styles.otStat}>
              <Text style={styles.otStatLabel}>預計加班時數</Text>
              <Text style={styles.otHours}>{otPeriod}h</Text>
              <Text style={styles.otStatSub}>全期統計</Text>
              {differentialPeriod.totalHours > 0 ? (
                <Text style={styles.otDiffNote}>含差額工時 {differentialPeriod.totalHours}h</Text>
              ) : null}
            </View>
          </View>
        </Card>

        <View style={styles.twoCol}>
          <Card style={styles.halfCard}>
            <View style={styles.cardTitleRow}>
              <Calendar size={16} color={colors.teal} />
              <Text style={styles.cardTitle}>今日班次</Text>
              {todayScheduleLabels ? (
                <Text style={styles.scheduleChangeNote}>{todayScheduleLabels}</Text>
              ) : null}
            </View>
            {todayShifts.length === 0 ? (
              <Text style={styles.empty}>今天沒有班次</Text>
            ) : (
              todayShifts.map((s) => renderShift(s))
            )}
          </Card>

          <Card style={styles.halfCard}>
            <View style={styles.cardTitleRow}>
              <Clock size={16} color={colors.teal} />
              <Text style={styles.cardTitle}>明日班次</Text>
              {tomorrowScheduleLabels ? (
                <Text style={styles.scheduleChangeNote}>{tomorrowScheduleLabels}</Text>
              ) : null}
            </View>
            {tomorrowShifts.length === 0 ? (
              <Text style={styles.empty}>明天沒有班次</Text>
            ) : (
              tomorrowShifts.map((s) => renderShift(s))
            )}
          </Card>
        </View>
      </ScrollView>

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  dateBig: { fontSize: 28, fontWeight: "800", color: colors.text },
  dateSub: { fontSize: 14, color: colors.teal, marginTop: 6 },
  gear: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 7,
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.teal,
    backgroundColor: colors.card,
  },
  gearText: {
    fontSize: 12,
    lineHeight: 12,
    fontWeight: "700",
    color: colors.teal,
    includeFontPadding: false,
  },
  otCard: {
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  periodTop: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.teal,
    textAlign: "center",
  },
  otTwoCol: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  otStat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  otDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  otStatLabel: { fontSize: 12, color: colors.muted, textAlign: "center" },
  otHours: { fontSize: 28, fontWeight: "800", color: colors.text, marginTop: 2 },
  otStatSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  otDiffNote: { fontSize: 11, color: colors.muted, marginTop: 4, textAlign: "center" },
  twoCol: { gap: 12 },
  halfCard: { padding: 16, marginBottom: 4 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  scheduleChangeNote: { fontSize: 11, fontWeight: "600", color: colors.orange },
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
