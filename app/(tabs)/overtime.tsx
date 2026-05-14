import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banknote, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock } from "lucide-react-native";
import { brackets, getPeriod, handoverHoursFromLeaveCase, leaveCase, shortDate } from "@/src/logic/shiftLogic";
import { Card } from "@/src/components/Card";
import { colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";

function fh(n: number) {
  return n > 0 ? `${n}h` : "-";
}
function fm(n: number) {
  return n > 0 ? `$${Math.round(n).toLocaleString()}` : "-";
}

/** 交接班時數顯示（避免浮點尾差）。 */
function formatHandoverH(h: number) {
  const n = Math.round(h * 100) / 100;
  return `${n}h`;
}

export default function OvertimeScreen() {
  const { shifts, overtime, settings } = useAppData();
  const [offset, setOffset] = useState(0);
  const [showHandoverDetail, setShowHandoverDetail] = useState(false);

  const startDay = Math.min(28, Math.max(1, parseInt(settings.startDay, 10) || 1));
  const period = useMemo(() => getPeriod(startDay, offset), [startDay, offset]);

  const baseSalary = parseFloat(settings.baseSalary) || 0;
  const hourlyRate = baseSalary / 240;
  const midPerShift = parseFloat(settings.midAllowance) || 0;
  const nitePerShift = parseFloat(settings.nightAllowance) || 0;
  const handover = settings.handoverEnabled;

  const overtimeData = useMemo(
    () => overtime.filter((o) => o.date >= period.from && o.date <= period.to),
    [overtime, period.from, period.to],
  );

  const periodShifts = useMemo(
    () => shifts.filter((s) => s.date >= period.from && s.date <= period.to),
    [shifts, period.from, period.to],
  );

  const workShiftDates = useMemo(
    () => new Set(periodShifts.filter((s) => s.name !== "休假").map((s) => s.date)),
    [periodShifts],
  );
  const midCount = periodShifts.filter((s) => s.name === "中班").length;
  const nightCount = periodShifts.filter((s) => s.name === "晚班").length;

  const overtimeByDate = useMemo(() => {
    const m = new Map<string, (typeof overtime)[0]>();
    for (const o of overtimeData) m.set(o.date, o);
    return m;
  }, [overtimeData]);

  const rows = useMemo(() => {
    return overtimeData
      .map((ot) => {
        const earlyHours = ot.earlyHours ?? 0;
        const lateHours = ot.lateHours ?? 0;
        const total = earlyHours + lateHours;
        const { b133, b166, b200 } = brackets(total);
        const pay = hourlyRate * (b133 * 1.33 + b166 * 1.66 + b200 * 2.0);
        return { date: ot.date, earlyHours, lateHours, total, b133, b166, b200, pay };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [overtimeData, hourlyRate]);

  const handoverRows = useMemo(() => {
    if (!handover) return [];
    const sortedDates = Array.from(workShiftDates).sort();
    const out: { date: string; hours: number }[] = [];
    for (const d of sortedDates) {
      const shift = periodShifts.find((s) => s.date === d && s.name !== "休假");
      if (!shift) continue;
      const ot = overtimeByDate.get(d);
      const hasLeave = !!(ot?.leaveStart && ot?.leaveEnd);
      const lc = hasLeave ? leaveCase(shift.startTime, shift.endTime, ot!.leaveStart!, ot!.leaveEnd!) : 12;
      const hours = handoverHoursFromLeaveCase(lc);
      out.push({ date: d, hours });
    }
    return out;
  }, [handover, workShiftDates, periodShifts, overtimeByDate]);

  const handoverTotalH = handoverRows.reduce((s, r) => s + r.hours, 0);
  const handoverPay = handoverTotalH * hourlyRate * 1.33;

  const totals = useMemo(
    () => ({
      total: rows.reduce((s, r) => s + r.total, 0),
      b133: rows.reduce((s, r) => s + r.b133, 0),
      b166: rows.reduce((s, r) => s + r.b166, 0),
      b200: rows.reduce((s, r) => s + r.b200, 0),
      pay: rows.reduce((s, r) => s + r.pay, 0),
    }),
    [rows],
  );

  const midPay = midCount * midPerShift;
  const nightPay = nightCount * nitePerShift;
  const grandTotal = totals.pay + (handover ? handoverPay : 0) + midPay + nightPay;
  const hasData =
    rows.length > 0 || (handover && handoverTotalH > 0) || midPay > 0 || nightPay > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.h1}>加班費計算</Text>

        <Card style={styles.navCard}>
          <Pressable onPress={() => setOffset((o) => o - 1)} style={styles.navBtn}>
            <ChevronLeft size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.periodLabel}>{period.label}</Text>
            <Text style={styles.periodRange}>
              {period.from} ～ {period.to}
            </Text>
          </View>
          <Pressable
            onPress={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset >= 0}
            style={[styles.navBtn, offset >= 0 && { opacity: 0.35 }]}
          >
            <ChevronRight size={22} color={colors.text} />
          </Pressable>
        </Card>

        {rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Clock size={40} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>本期無加班記錄</Text>
            <Text style={styles.emptySub}>至行事曆頁面記錄加班時數</Text>
          </View>
        ) : (
          <Card style={{ padding: 0, overflow: "hidden", marginBottom: 12 }}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 1.2 }]}>日期</Text>
              <Text style={[styles.th, styles.thRight]}>總時數</Text>
              <Text style={[styles.th, styles.thRight]}>
                <Text style={{ color: "#ea580c" }}>1.33</Text>加班
              </Text>
              <Text style={[styles.th, styles.thRight]}>
                <Text style={{ color: "#d97706" }}>1.66</Text>加班
              </Text>
              <Text style={[styles.th, styles.thRight]}>
                <Text style={{ color: "#dc2626" }}>2.0</Text>加班
              </Text>
            </View>
            {rows.map((row) => (
              <View key={row.date} style={styles.tableRow}>
                <Text style={[styles.td, { flex: 1.2 }]}>{shortDate(row.date)}</Text>
                <Text style={[styles.td, styles.tdRight, styles.tdBold]}>{fh(row.total)}</Text>
                <Text style={[styles.td, styles.tdRight, { color: "#ea580c" }]}>{fh(row.b133)}</Text>
                <Text style={[styles.td, styles.tdRight, { color: "#d97706" }]}>{fh(row.b166)}</Text>
                <Text style={[styles.td, styles.tdRight, { color: "#dc2626" }]}>{fh(row.b200)}</Text>
              </View>
            ))}
            <View style={styles.tableFoot}>
              <Text style={[styles.tf, { flex: 1.2 }]}>合計</Text>
              <Text style={[styles.tf, styles.tdRight]}>{totals.total}h</Text>
              <Text style={[styles.tf, styles.tdRight, { color: "#ea580c" }]}>
                {totals.b133 > 0 ? `${totals.b133}h` : "-"}
              </Text>
              <Text style={[styles.tf, styles.tdRight, { color: "#d97706" }]}>
                {totals.b166 > 0 ? `${totals.b166}h` : "-"}
              </Text>
              <Text style={[styles.tf, styles.tdRight, { color: "#dc2626" }]}>
                {totals.b200 > 0 ? `${totals.b200}h` : "-"}
              </Text>
            </View>
          </Card>
        )}

        {hasData && (
          <Card style={styles.summary}>
            <View style={styles.summaryHead}>
              <Banknote size={18} color={colors.teal} />
              <Text style={styles.summaryTitle}>費用明細</Text>
            </View>
            {totals.b133 > 0 && (
              <View style={styles.line}>
                <Text style={styles.lineMuted}>1.33× 加班 {totals.b133}h</Text>
                <Text style={styles.lineOrange}>{baseSalary > 0 ? fm(hourlyRate * totals.b133 * 1.33) : "請設定底薪"}</Text>
              </View>
            )}
            {totals.b166 > 0 && (
              <View style={styles.line}>
                <Text style={styles.lineMuted}>1.66× 加班 {totals.b166}h</Text>
                <Text style={styles.lineAmber}>{baseSalary > 0 ? fm(hourlyRate * totals.b166 * 1.66) : "—"}</Text>
              </View>
            )}
            {totals.b200 > 0 && (
              <View style={styles.line}>
                <Text style={styles.lineMuted}>2.0× 加班 {totals.b200}h</Text>
                <Text style={styles.lineRed}>{baseSalary > 0 ? fm(hourlyRate * totals.b200 * 2.0) : "—"}</Text>
              </View>
            )}
            {handover && handoverTotalH > 0 && (
              <View style={{ marginTop: 4 }}>
                <View style={styles.line}>
                  <View style={styles.handRow}>
                    <Text style={styles.lineMuted}>
                      交接班 {formatHandoverH(handoverTotalH)} × 1.33
                    </Text>
                    <Pressable
                      onPress={() => setShowHandoverDetail((v) => !v)}
                      style={styles.detailBtn}
                    >
                      <Text style={styles.detailBtnText}>明細</Text>
                      {showHandoverDetail ? (
                        <ChevronUp size={14} color={colors.teal} />
                      ) : (
                        <ChevronDown size={14} color={colors.teal} />
                      )}
                    </Pressable>
                  </View>
                  <Text style={styles.lineTeal}>
                    {baseSalary > 0 ? fm(handoverPay) : "請設定底薪"}
                  </Text>
                </View>
                {showHandoverDetail && (
                  <View style={styles.detailList}>
                    {handoverRows.map((r) => (
                      <View key={r.date} style={styles.detailRow}>
                        <Text style={styles.detailDate}>{shortDate(r.date)}</Text>
                        <Text style={styles.detailH}>{formatHandoverH(r.hours)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
            {midCount > 0 && midPerShift > 0 && (
              <View style={styles.line}>
                <Text style={styles.lineMuted}>中班津貼 {midCount} 次 × ${midPerShift.toLocaleString()}</Text>
                <Text style={styles.lineViolet}>{fm(midPay)}</Text>
              </View>
            )}
            {nightCount > 0 && nitePerShift > 0 && (
              <View style={styles.line}>
                <Text style={styles.lineMuted}>晚班津貼 {nightCount} 次 × ${nitePerShift.toLocaleString()}</Text>
                <Text style={styles.lineIndigo}>{fm(nightPay)}</Text>
              </View>
            )}
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>本期合計</Text>
              <Text style={[styles.grandAmt, !baseSalary && { color: colors.muted }]}>
                {baseSalary > 0 ? fm(grandTotal) : "請設定底薪"}
              </Text>
            </View>
            {baseSalary > 0 && (
              <Text style={styles.footNote}>
                加班費計算：底薪 {baseSalary.toLocaleString()} ÷ 240 × 時數 × 加權係數
              </Text>
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.greyBg },
  pad: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 12 },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  navBtn: { padding: 10, borderRadius: 10 },
  periodLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  periodRange: { fontSize: 11, color: colors.muted, marginTop: 2 },
  emptyBox: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.muted, marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.muted, marginTop: 6 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  th: { fontSize: 10, fontWeight: "700", color: colors.muted },
  thRight: { flex: 0.75, textAlign: "right" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  td: { fontSize: 12, color: colors.text },
  tdRight: { flex: 0.75, textAlign: "right" },
  tdBold: { fontWeight: "700" },
  tableFoot: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  tf: { fontSize: 11, fontWeight: "800", color: colors.text },
  summary: { padding: 16 },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  summaryTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  line: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  lineMuted: { fontSize: 13, color: colors.muted, flex: 1, marginRight: 8 },
  lineOrange: { fontSize: 13, fontWeight: "700", color: "#ea580c" },
  lineAmber: { fontSize: 13, fontWeight: "700", color: "#d97706" },
  lineRed: { fontSize: 13, fontWeight: "700", color: "#dc2626" },
  lineTeal: { fontSize: 13, fontWeight: "700", color: colors.teal },
  lineViolet: { fontSize: 13, fontWeight: "700", color: "#7c3aed" },
  lineIndigo: { fontSize: 13, fontWeight: "700", color: "#4f46e5" },
  handRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", flex: 1, gap: 6 },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  detailBtnText: { fontSize: 11, fontWeight: "600", color: colors.teal },
  detailList: {
    borderLeftWidth: 2,
    borderLeftColor: "#99f6e4",
    paddingLeft: 10,
    marginLeft: 4,
    marginTop: 4,
    gap: 6,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailDate: { fontSize: 11, color: colors.muted },
  detailH: { fontSize: 11, fontWeight: "600", color: colors.teal },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  grandLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  grandAmt: { fontSize: 22, fontWeight: "800", color: colors.teal },
  footNote: { fontSize: 10, color: colors.muted, marginTop: 8 },
});
