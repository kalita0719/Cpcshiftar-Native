import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { CircleHelp, Settings2, X } from "lucide-react-native";
import { cardShadow, colors } from "@/src/components/theme";
import { useAppData } from "@/src/state/AppDataContext";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type HelpKey = "handover" | "differential" | "nationalHoliday";

const TOGGLE_HELP: Record<HelpKey, { title: string; body: string }> = {
  handover: {
    title: "啟用交接班",
    body: "每班提早 15 分鐘上班、延後 15 分鐘下班 (+0.5h)，不與當日加班合併累進計算",
  },
  differential: {
    title: "啟用差額工時",
    body: "每週日～週六計算休假日次數（班別為休假）；少於 2 日者，該週週六給予 8 小時差額工時，依一般加班費計算並列入統計",
  },
  nationalHoliday: {
    title: "啟用國定假日加班",
    body: "開啟後，加班費頁面才會計算國定假日額外加班費與獎工",
  },
};

function SettingToggleRow({
  title,
  helpKey,
  value,
  onChange,
  onShowHelp,
  stacked,
}: {
  title: string;
  helpKey: HelpKey;
  value: boolean;
  onChange: (v: boolean) => void;
  onShowHelp: (key: HelpKey) => void;
  stacked?: boolean;
}) {
  return (
    <View style={[styles.toggleBlock, stacked && styles.toggleBlockStacked]}>
      <View style={styles.toggleTitleRow}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Pressable
          onPress={() => onShowHelp(helpKey)}
          hitSlop={8}
          style={styles.helpBtn}
          accessibilityLabel={`${title}說明`}
          accessibilityRole="button"
        >
          <CircleHelp size={18} color={colors.teal} />
        </Pressable>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.teal }} />
    </View>
  );
}

function HelpPopover({
  visible,
  title,
  body,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.helpOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.helpCard, cardShadow(12)]}>
          <View style={styles.helpHead}>
            <Text style={styles.helpTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="關閉說明">
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={styles.helpBody}>{body}</Text>
          <Pressable onPress={onClose} style={styles.helpOk}>
            <Text style={styles.helpOkText}>知道了</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function SettingsModal({ visible, onClose }: Props) {
  const { settings, updateSettings } = useAppData();
  const [salary, setSalary] = useState(settings.baseSalary);
  const [startDay, setStartDay] = useState(settings.startDay);
  const [handover, setHandover] = useState(settings.handoverEnabled);
  const [differentialHours, setDifferentialHours] = useState(settings.differentialHoursEnabled);
  const [nationalHolidayOvertime, setNationalHolidayOvertime] = useState(
    settings.nationalHolidayOvertimeEnabled,
  );
  const [mid, setMid] = useState(settings.midAllowance);
  const [night, setNight] = useState(settings.nightAllowance);
  const [helpKey, setHelpKey] = useState<HelpKey | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSalary(settings.baseSalary);
    setStartDay(settings.startDay);
    setHandover(settings.handoverEnabled);
    setDifferentialHours(settings.differentialHoursEnabled);
    setNationalHolidayOvertime(settings.nationalHolidayOvertimeEnabled);
    setMid(settings.midAllowance);
    setNight(settings.nightAllowance);
    setHelpKey(null);
  }, [visible, settings]);

  const helpContent = helpKey ? TOGGLE_HELP[helpKey] : null;

  const commit = () => {
    const n = Math.min(28, Math.max(1, parseInt(startDay, 10) || 1));
    updateSettings({
      baseSalary: salary,
      startDay: String(n),
      handoverEnabled: handover,
      differentialHoursEnabled: differentialHours,
      nationalHolidayOvertimeEnabled: nationalHolidayOvertime,
      midAllowance: mid,
      nightAllowance: night,
    });
    onClose();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
          <View style={[styles.card, cardShadow(10)]}>
            <View style={styles.head}>
              <View style={styles.titleRow}>
                <Settings2 size={20} color={colors.teal} />
                <Text style={styles.title}>設定</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={22} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>底薪</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={salary}
                    onChangeText={setSalary}
                    style={styles.input}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>薪資計算起始日</Text>
                  <View style={styles.dayRow}>
                    <TextInput
                      keyboardType="numeric"
                      value={startDay}
                      onChangeText={setStartDay}
                      style={[styles.input, { flex: 1 }]}
                    />
                    <Text style={styles.suffix}>號</Text>
                  </View>
                </View>
              </View>

              <SettingToggleRow
                title="啟用交接班"
                helpKey="handover"
                value={handover}
                onChange={setHandover}
                onShowHelp={setHelpKey}
              />
              <SettingToggleRow
                title="啟用差額工時"
                helpKey="differential"
                value={differentialHours}
                onChange={setDifferentialHours}
                onShowHelp={setHelpKey}
                stacked
              />
              <SettingToggleRow
                title="啟用國定假日加班"
                helpKey="nationalHoliday"
                value={nationalHolidayOvertime}
                onChange={setNationalHolidayOvertime}
                onShowHelp={setHelpKey}
                stacked
              />

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>中班津貼 (元 / 次)</Text>
                  <TextInput keyboardType="numeric" value={mid} onChangeText={setMid} style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>夜班津貼 (元 / 次)</Text>
                  <TextInput keyboardType="numeric" value={night} onChangeText={setNight} style={styles.input} />
                </View>
              </View>

              <Pressable onPress={commit} style={styles.save}>
                <Text style={styles.saveText}>完成</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {helpContent && (
        <HelpPopover
          visible={helpKey !== null}
          title={helpContent.title}
          body={helpContent.body}
          onClose={() => setHelpKey(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 48,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  label: { fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fafafa",
    color: colors.text,
  },
  row2: { flexDirection: "row", gap: 12, marginBottom: 14 },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  suffix: { fontSize: 14, color: colors.muted },
  toggleBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  toggleBlockStacked: {
    borderTopWidth: 0,
    marginTop: -14,
  },
  toggleTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  toggleTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  helpBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,146,143,0.1)",
  },
  save: {
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  helpOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  helpCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  helpTitle: { fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 },
  helpBody: { fontSize: 14, color: colors.muted, lineHeight: 22 },
  helpOk: {
    marginTop: 18,
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  helpOkText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
