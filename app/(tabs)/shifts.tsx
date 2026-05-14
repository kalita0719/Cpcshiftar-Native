import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Settings } from "lucide-react-native";
import { formatYMD } from "@/src/logic/dates";
import ManualTypewriterView from "@/src/components/ManualTypewriterView";
import SmartSchedulePanel from "@/src/components/SmartSchedulePanel";
import TemplateSettingsModal from "@/src/components/TemplateSettingsModal";
import { colors } from "@/src/components/theme";

type Mode = "hub" | "manual";

export default function ScheduleHubScreen() {
  const [mode, setMode] = useState<Mode>("hub");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [typewriterDate, setTypewriterDate] = useState(() => formatYMD(new Date()));

  if (mode === "manual") {
    return (
      <ManualTypewriterView
        selectedYmd={typewriterDate}
        onChangeSelectedYmd={setTypewriterDate}
        onDone={() => setMode("hub")}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.head}>
        <Text style={styles.h1}>⚙️ 排班中心</Text>
        <Pressable onPress={() => setSettingsOpen(true)} style={styles.gearHit} hitSlop={12}>
          <Settings size={26} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <SmartSchedulePanel anchorYmd={formatYMD(new Date())} embedded />
        <Pressable
          style={styles.manualBtn}
          onPress={() => {
            setTypewriterDate(formatYMD(new Date()));
            setMode("manual");
          }}
        >
          <Text style={styles.manualBtnText}>✏️ 調整換班（手動編輯）</Text>
        </Pressable>
      </ScrollView>

      <TemplateSettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.greyBg },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  h1: { fontSize: 20, fontWeight: "800", color: colors.text },
  gearHit: { padding: 6, borderRadius: 8 },
  pad: { padding: 16, paddingBottom: 48 },
  manualBtn: {
    marginTop: 16,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.teal,
    backgroundColor: colors.card,
  },
  manualBtnText: { fontSize: 15, fontWeight: "800", color: colors.teal },
});
