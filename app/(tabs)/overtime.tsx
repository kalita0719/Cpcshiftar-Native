import { Card } from "@/src/components/Card";
import { colors } from "@/src/components/theme";
import { isRestDayShift } from "@/src/logic/differentialHours";
import { computeDifferentialOvertime } from "@/src/logic/differentialHours";
import {
  buildHolidayAllowanceShift,
  hasHolidayWork,
  holidayHandoverHours,
  isAllowanceEligibleWithHoliday,
  recordedOvertimeHours,
} from "@/src/logic/holidayOvertime";
import { computeNationalHolidayPay } from "@/src/logic/nationalHolidayPay";
import { buildPeriodAllowanceBreakdown } from "@/src/logic/shiftAllowance";
import { formatYMD } from "@/src/logic/dates";
import {
  bracketOvertimePay,
  hourlyRateFromBaseSalary,
  overtimeRate133Pay,
} from "@/src/logic/overtimePay";
import { brackets, getPeriod, handoverHoursFromLeaveCase, leaveCase, shortDate } from "@/src/logic/shiftLogic";
import { useAppData } from "@/src/state/AppDataContext";
import { Banknote, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import ScreenLayout from "@/src/components/ScreenLayout";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function fm(n: number) {
  return n > 0 ? `$${Math.round(n).toLocaleString()}` : "-";
}

function fh(n: number) {
  return n > 0 ? `${n}h` : "-";
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
  const [showDifferentialDetail, setShowDifferentialDetail] = useState(false);
  const [showAllowanceDetail, setShowAllowanceDetail] = useState(false);
  const [showNationalHolidayDetail, setShowNationalHolidayDetail] = useState(false);
  const [showRegularOvertimeDetail, setShowRegularOvertimeDetail] = useState(false);

  const startDay = Math.min(28, Math.max(1, parseInt(settings.startDay, 10) || 1));
  const period = useMemo(() => getPeriod(startDay, offset), [startDay, offset]);
  const todayYmd = formatYMD(new Date());
  const effectiveTo = offset === 0 && todayYmd < period.to ? todayYmd : period.to;

  const baseSalary = parseFloat(settings.baseSalary) || 0;
  const hourlyRate = hourlyRateFromBaseSalary(baseSalary);
  const midPerShift = parseFloat(settings.midAllowance) || 0;
  const nightPerShift = parseFloat(settings.nightAllowance) || 0;
  const handover = settings.handoverEnabled;
  const differentialEnabled = settings.differentialHoursEnabled;
  const nationalHolidayEnabled = settings.nationalHolidayOvertimeEnabled;

  const overtimeData = useMemo(
    () => overtime.filter((o) => o.date >= period.from && o.date <= effectiveTo),
    [overtime, period.from, effectiveTo],
  );

  const periodShifts = useMemo(
    () => shifts.filter((s) => s.date >= period.from && s.date <= effectiveTo),
    [shifts, period.from, effectiveTo],
  );

  const overtimeByDate = useMemo(() => {
    const m = new Map<string, (typeof overtime)[0]>();
    for (const o of overtimeData) m.set(o.date, o);
    return m;
  }, [overtimeData]);

  const allowanceBreakdown = useMemo(() => {
    const shiftsWithLeave = periodShifts.flatMap((s) => {
      const ot = overtimeByDate.get(s.date);
      if (!isAllowanceEligibleWithHoliday(s, ot)) return [];
      if (isRestDayShift(s) && hasHolidayWork(ot)) {
        return [buildHolidayAllowanceShift(s, ot!, handover)];
      }
      return [
        {
          ...s,
          leaveStart: ot?.leaveStart ?? null,
          leaveEnd: ot?.leaveEnd ?? null,
          overtime: ot
            ? {
                earlyHours: ot.earlyHours,
                lateHours: ot.lateHours,
                earlyClassHours: ot.earlyClassHours,
                lateClassHours: ot.lateClassHours,
              }
            : null,
          handoverEnabled: handover,
        },
      ];
    });
    return buildPeriodAllowanceBreakdown(shiftsWithLeave, { midPerShift, nightPerShift });
  }, [periodShifts, overtimeByDate, midPerShift, nightPerShift, handover]);

  const calendarRows = useMemo(() => {
    return overtimeData
      .map((ot) => {
        const shift = periodShifts.find((s) => s.date === ot.date);
        const earlyHours = ot.earlyHours ?? 0;
        const lateHours = ot.lateHours ?? 0;
        const total = recordedOvertimeHours(ot, shift);
        const { b133, b166, b266 } = brackets(total);
        const isHolidayWork = !!(shift && isRestDayShift(shift) && hasHolidayWork(ot));
        return {
          date: ot.date,
          earlyHours,
          lateHours,
          total,
          b133,
          b166,
          b266,
          isDifferential: false as const,
          isHolidayWork,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [overtimeData, hourlyRate, periodShifts]);

  const differential = useMemo(
    () =>
      computeDifferentialOvertime(shifts, period.from, effectiveTo, differentialEnabled, hourlyRate),
    [shifts, period.from, effectiveTo, differentialEnabled, hourlyRate],
  );

  const nationalHoliday = useMemo(
    () =>
      nationalHolidayEnabled
        ? computeNationalHolidayPay(periodShifts, overtimeByDate, hourlyRate)
        : { rows: [], totalHours: 0, totalPay: 0 },
    [periodShifts, overtimeByDate, hourlyRate, nationalHolidayEnabled],
  );

  const regularOvertime = useMemo(() => {
    const rows = calendarRows;
    const b133 = rows.reduce((s, r) => s + r.b133, 0);
    const b166 = rows.reduce((s, r) => s + r.b166, 0);
    const b266 = rows.reduce((s, r) => s + r.b266, 0);
    return {
      rows,
      totalHours: rows.reduce((s, r) => s + r.total, 0),
      totalPay: bracketOvertimePay(hourlyRate, { b133, b166, b266 }),
      b133,
      b166,
      b266,
    };
  }, [calendarRows, hourlyRate]);

  const handoverRows = useMemo(() => {
    if (!handover) return [];
    const out: { date: string; hours: number }[] = [];
    for (const shift of [...periodShifts].sort((a, b) => a.date.localeCompare(b.date))) {
      const ot = overtimeByDate.get(shift.date);
      if (isRestDayShift(shift)) {
        const hours = holidayHandoverHours(shift, ot, handover);
        if (hours > 0) out.push({ date: shift.date, hours });
        continue;
      }
      if (shift.name === "休假") continue;
      const hasLeave = !!(ot?.leaveStart && ot?.leaveEnd);
      const lc = hasLeave ? leaveCase(shift.startTime, shift.endTime, ot!.leaveStart!, ot!.leaveEnd!) : 12;
      const hours = handoverHoursFromLeaveCase(lc);
      out.push({ date: shift.date, hours });
    }
    return out;
  }, [handover, periodShifts, overtimeByDate]);

  const handoverTotalH = handoverRows.reduce((s, r) => s + r.hours, 0);
  const handoverPay = overtimeRate133Pay(hourlyRate, handoverTotalH);

  const allowancePay = allowanceBreakdown.totalPay;
  const grandTotal =
    regularOvertime.totalPay +
    differential.totalPay +
    (handover ? handoverPay : 0) +
    nationalHoliday.totalPay +
    allowancePay;
  const hasAllowanceRows = allowanceBreakdown.rows.length > 0;
  const overtimeDetailHours =
    regularOvertime.totalHours +
    differential.totalHours +
    nationalHoliday.totalHours +
    (handover ? handoverTotalH : 0);
  const overtimeDetailPay =
    regularOvertime.totalPay +
    differential.totalPay +
    nationalHoliday.totalPay +
    (handover ? handoverPay : 0);

  const hasOvertimeDetail =
    regularOvertime.totalHours > 0 ||
    (handover && handoverTotalH > 0) ||
    differential.totalHours > 0 ||
    nationalHoliday.totalHours > 0;
  const hasData = hasOvertimeDetail || hasAllowanceRows;

  return (
    <ScreenLayout>
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

        {hasOvertimeDetail && (
          <Card style={[styles.summary, { marginBottom: 12 }]}>
            <View style={styles.summaryHead}>
              <Banknote size={18} color={colors.teal} />
              <Text style={styles.summaryTitle}>加班費明細</Text>
            </View>
            {regularOvertime.totalHours > 0 && (
              <View>
                <SummaryLine
                  label={`一般加班費 ${regularOvertime.totalHours}h`}
                  amountText={baseSalary > 0 ? fm(regularOvertime.totalPay) : "請設定底薪"}
                  showDetail={showRegularOvertimeDetail}
                  onToggleDetail={() => setShowRegularOvertimeDetail((v) => !v)}
                />
                {showRegularOvertimeDetail && (
                  <View style={styles.otBracketTable}>
                    <View style={styles.otBracketTableHead}>
                      <Text style={[styles.otBracketTh, { flex: 1.1 }]}>日期</Text>
                      <Text style={[styles.otBracketTh, styles.otBracketThRight]}>總時數</Text>
                      <Text style={[styles.otBracketTh, styles.otBracketThRight]}>
                        <Text style={{ color: "#ea580c" }}>1.33</Text>
                      </Text>
                      <Text style={[styles.otBracketTh, styles.otBracketThRight]}>
                        <Text style={{ color: "#d97706" }}>1.66</Text>
                      </Text>
                      <Text style={[styles.otBracketTh, styles.otBracketThRight]}>
                        <Text style={{ color: "#dc2626" }}>2.66</Text>
                      </Text>
                    </View>
                    {regularOvertime.rows.map((r) => (
                      <View key={r.date} style={styles.otBracketTableRow}>
                        <Text style={[styles.otBracketTd, { flex: 1.1 }]}>
                          {shortDate(r.date)}
                          {r.isHolidayWork ? (
                            <Text style={styles.otBracketTag}> 休假</Text>
                          ) : null}
                        </Text>
                        <Text style={[styles.otBracketTd, styles.otBracketTdRight, styles.otBracketTdBold]}>
                          {fh(r.total)}
                        </Text>
                        <Text style={[styles.otBracketTd, styles.otBracketTdRight, { color: "#ea580c" }]}>
                          {fh(r.b133)}
                        </Text>
                        <Text style={[styles.otBracketTd, styles.otBracketTdRight, { color: "#d97706" }]}>
                          {fh(r.b166)}
                        </Text>
                        <Text style={[styles.otBracketTd, styles.otBracketTdRight, { color: "#dc2626" }]}>
                          {fh(r.b266)}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.otBracketTableFoot}>
                      <Text style={[styles.otBracketTf, { flex: 1.1 }]}>合計</Text>
                      <Text style={[styles.otBracketTf, styles.otBracketTdRight]}>
                        {regularOvertime.totalHours}h
                      </Text>
                      <Text style={[styles.otBracketTf, styles.otBracketTdRight, { color: "#ea580c" }]}>
                        {regularOvertime.b133 > 0 ? `${regularOvertime.b133}h` : "-"}
                      </Text>
                      <Text style={[styles.otBracketTf, styles.otBracketTdRight, { color: "#d97706" }]}>
                        {regularOvertime.b166 > 0 ? `${regularOvertime.b166}h` : "-"}
                      </Text>
                      <Text style={[styles.otBracketTf, styles.otBracketTdRight, { color: "#dc2626" }]}>
                        {regularOvertime.b266 > 0 ? `${regularOvertime.b266}h` : "-"}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
            {differential.totalHours > 0 && (
              <View style={{ marginTop: 4 }}>
                <SummaryLine
                  label={`差額工時 ${differential.totalHours}h`}
                  amountText={baseSalary > 0 ? fm(differential.totalPay) : "請設定底薪"}
                  showDetail={showDifferentialDetail}
                  onToggleDetail={() => setShowDifferentialDetail((v) => !v)}
                />
                {showDifferentialDetail && (
                  <View style={styles.detailList}>
                    {differential.rows.map((r) => (
                      <View key={r.date} style={styles.detailRow}>
                        <Text style={styles.detailDate}>
                          {shortDate(r.date)}（休{r.restDaysInWeek}日）
                        </Text>
                        <Text style={styles.detailH}>{r.hours}h</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
            {nationalHoliday.totalHours > 0 && (
              <View style={{ marginTop: 4 }}>
                <SummaryLine
                  label={`國定假日 ${nationalHoliday.totalHours}h`}
                  amountText={baseSalary > 0 ? fm(nationalHoliday.totalPay) : "請設定底薪"}
                  showDetail={showNationalHolidayDetail}
                  onToggleDetail={() => setShowNationalHolidayDetail((v) => !v)}
                />
                {showNationalHolidayDetail && (
                  <View style={styles.detailList}>
                    {nationalHoliday.rows.map((r) => (
                      <View key={`${r.date}-${r.kind}`} style={styles.detailRow}>
                        <Text style={styles.detailDate}>
                          {shortDate(r.date)} {r.holidayName}
                          {r.kind === "award" ? " 獎工" : ""}
                          {r.kind === "national" && r.isRestDay
                            ? "（休假日 8h）"
                            : `（${r.hours}h）`}
                        </Text>
                        <Text style={styles.detailAmount}>{baseSalary > 0 ? fm(r.pay) : "—"}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
            {handover && handoverTotalH > 0 && (
              <View style={{ marginTop: 4 }}>
                <SummaryLine
                  label={`交接班 ${formatHandoverH(handoverTotalH)}`}
                  amountText={baseSalary > 0 ? fm(handoverPay) : "請設定底薪"}
                  showDetail={showHandoverDetail}
                  onToggleDetail={() => setShowHandoverDetail((v) => !v)}
                />
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
            <View style={styles.otDetailTotal}>
              <View style={styles.otDetailTotalRow}>
                <Text style={styles.otDetailTotalLabel}>總加班時數</Text>
                <Text style={styles.otDetailTotalHours}>{overtimeDetailHours}h</Text>
              </View>
              <View style={styles.otDetailTotalRow}>
                <Text style={styles.otDetailTotalLabel}>加班費合計</Text>
                <Text style={styles.lineAmountLg}>
                  {baseSalary > 0 ? fm(overtimeDetailPay) : "請設定底薪"}
                </Text>
              </View>
            </View>
            {baseSalary > 0 && (
              <Text style={[styles.footNote, { marginTop: 8 }]}>
                底薪 {baseSalary.toLocaleString()}
              </Text>
            )}
          </Card>
        )}

        {hasAllowanceRows && (
          <Card style={[styles.summary, { marginBottom: 12 }]}>
            <View style={styles.summaryHead}>
              <Banknote size={18} color="#7c3aed" />
              <Text style={styles.summaryTitle}>中班／夜班津貼</Text>
            </View>
            <SummaryLine
              label="本期津貼合計"
              amountText={midPerShift > 0 || nightPerShift > 0 ? fm(allowancePay) : "請設定津貼金額"}
              showDetail={showAllowanceDetail}
              onToggleDetail={() => setShowAllowanceDetail((v) => !v)}
            />
            {showAllowanceDetail && (
              <View style={styles.allowanceTable}>
                <View style={styles.allowanceTableHead}>
                  <Text style={[styles.allowanceTh, { flex: 1.15 }]}>日期</Text>
                  <Text style={[styles.allowanceTh, styles.allowanceThMid]}>中班津貼</Text>
                  <Text style={[styles.allowanceTh, styles.allowanceThMid]}>夜班津貼</Text>
                </View>
                {allowanceBreakdown.rows.map((row) => (
                  <View key={row.date} style={styles.allowanceTableRow}>
                    <Text style={[styles.allowanceTd, { flex: 1.15 }]}>{shortDate(row.date)}</Text>
                    <Text style={[styles.allowanceTd, styles.allowanceTdMid]}>
                      {row.midAmount > 0 ? fm(row.midAmount) : "—"}
                    </Text>
                    <Text style={[styles.allowanceTd, styles.allowanceTdMid]}>
                      {row.nightAmount > 0 ? fm(row.nightAmount) : "—"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        {hasData && (
          <Card style={styles.summary}>
            <View style={[styles.grandRow, styles.grandRowStandalone]}>
              <Text style={styles.grandLabel}>本期合計</Text>
              <Text style={[styles.grandAmt, !baseSalary && { color: colors.muted }]}>
                {baseSalary > 0 ? fm(grandTotal) : "請設定底薪"}
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

function SummaryLine({
  label,
  amountText,
  showDetail,
  onToggleDetail,
}: {
  label: string;
  amountText: string;
  showDetail: boolean;
  onToggleDetail: () => void;
}) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineMuted} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.lineRight}>
        <Text style={styles.lineAmount} numberOfLines={1}>
          {amountText}
        </Text>
        <Pressable onPress={onToggleDetail} style={styles.detailBtn}>
          <Text style={styles.detailBtnText}>明細</Text>
          {showDetail ? (
            <ChevronUp size={12} color={colors.teal} />
          ) : (
            <ChevronDown size={12} color={colors.teal} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 16 },
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
  summary: { padding: 16 },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  summaryTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  line: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    flexWrap: "nowrap",
  },
  lineMuted: { flex: 1, flexShrink: 1, fontSize: 13, color: colors.muted, marginRight: 8 },
  lineRight: { flexDirection: "row", alignItems: "center", flexShrink: 0, gap: 6 },
  lineAmount: { fontSize: 13, fontWeight: "700", color: colors.businessBlue, flexShrink: 0 },
  lineAmountLg: { fontSize: 18, fontWeight: "800", color: colors.businessBlue },
  detailAmount: { fontSize: 10, fontWeight: "600", color: colors.businessBlue },
  detailBtn: {
    flexDirection: "row",
    flexShrink: 0,
    alignItems: "center",
    gap: 1,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  detailBtnText: { fontSize: 10, fontWeight: "600", color: colors.teal },
  detailList: {
    borderLeftWidth: 1.5,
    borderLeftColor: "#99f6e4",
    paddingLeft: 6,
    marginLeft: -8,
    marginTop: 3,
    gap: 3,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailDate: { fontSize: 10, color: colors.muted },
  detailH: { fontSize: 10, fontWeight: "600", color: colors.teal },
  otBracketTable: {
    borderLeftWidth: 1.5,
    borderLeftColor: "#fed7aa",
    marginLeft: -8,
    marginTop: 4,
    overflow: "hidden",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  otBracketTableHead: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  otBracketTh: { fontSize: 8, fontWeight: "700", color: colors.muted },
  otBracketThRight: { flex: 0.72, textAlign: "right" },
  otBracketTableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  otBracketTableFoot: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  otBracketTd: { fontSize: 9, color: colors.text },
  otBracketTdRight: { flex: 0.72, textAlign: "right" },
  otBracketTdBold: { fontWeight: "700" },
  otBracketTf: { fontSize: 9, fontWeight: "800", color: colors.text },
  otBracketTag: { fontSize: 7, fontWeight: "600", color: "#7c3aed" },
  allowanceTable: {
    borderLeftWidth: 1.5,
    borderLeftColor: "#ddd6fe",
    marginLeft: -8,
    marginTop: 4,
    overflow: "hidden",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  allowanceTableHead: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  allowanceTh: { fontSize: 9, fontWeight: "700", color: colors.muted },
  allowanceThMid: { flex: 1, textAlign: "center" },
  allowanceTableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  allowanceTd: { fontSize: 10, color: colors.text },
  allowanceTdMid: { flex: 1, textAlign: "center", fontWeight: "600" },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  grandRowStandalone: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  grandLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  grandAmt: { fontSize: 22, fontWeight: "800", color: colors.businessBlue },
  footNote: { fontSize: 10, color: colors.muted, marginTop: 8 },
  otDetailTotal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  otDetailTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  otDetailTotalLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  otDetailTotalHours: { fontSize: 16, fontWeight: "800", color: colors.teal },
});
