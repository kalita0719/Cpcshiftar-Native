import ManualTypewriterView from "@/src/components/ManualTypewriterView";
import ScheduleHubTabs, { type ScheduleHubMode } from "@/src/components/ScheduleHubTabs";
import SmartSchedulePanel from "@/src/components/SmartSchedulePanel";
import ScreenLayout from "@/src/components/ScreenLayout";
import TemplateSettingsModal from "@/src/components/TemplateSettingsModal";
import { colors } from "@/src/components/theme";
import { formatYMD } from "@/src/logic/dates";
import React, { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function ScheduleHubScreen() {
  const [mode, setMode] = useState<ScheduleHubMode>("quick");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [typewriterDate, setTypewriterDate] = useState(() => formatYMD(new Date()));
  const quickScrollRef = useRef<ScrollView>(null);

  const switchToManual = () => {
    setTypewriterDate(formatYMD(new Date()));
    setMode("manual");
  };

  const handleModeChange = (next: ScheduleHubMode) => {
    if (next === "manual") switchToManual();
    else setMode("quick");
  };

  return (
    <ScreenLayout>
      <View style={styles.head}>
        <Text style={styles.h1}>排班中心</Text>
        <Pressable onPress={() => setSettingsOpen(true)} style={styles.settingsBtn} hitSlop={8}>
          <Text style={styles.settingsBtnText}>班次設定</Text>
        </Pressable>
      </View>

      <ScheduleHubTabs mode={mode} onModeChange={handleModeChange}>
        {mode === "quick" ? (
          <ScrollView
            ref={quickScrollRef}
            contentContainerStyle={styles.cardPad}
            keyboardShouldPersistTaps="handled"
          >
            <SmartSchedulePanel
              anchorYmd={formatYMD(new Date())}
              embedded
              hideEmbedTitle
              hostScrollRef={quickScrollRef}
            />
          </ScrollView>
        ) : (
          <ManualTypewriterView
            embedded
            selectedYmd={typewriterDate}
            onChangeSelectedYmd={setTypewriterDate}
          />
        )}
      </ScheduleHubTabs>

      <TemplateSettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  h1: { fontSize: 20, fontWeight: "800", color: colors.text },
  settingsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.greyBg,
  },
  settingsBtnText: { fontSize: 13, fontWeight: "700", color: colors.text },
  cardPad: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
});
