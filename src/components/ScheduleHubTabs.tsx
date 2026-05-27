import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export type ScheduleHubMode = "quick" | "manual";

const TAB_ACTIVE_TEXT: Record<ScheduleHubMode, string> = {
  quick: "#0D9488",
  manual: "#475569",
};

type Props = {
  mode: ScheduleHubMode;
  onModeChange: (mode: ScheduleHubMode) => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** 讓 active tab 底部與白卡片重疊，避免 RN 子 View 接縫出現細線 */
const TAB_BODY_OVERLAP = 2;

export default function ScheduleHubTabs({ mode, onModeChange, children, style }: Props) {
  const isQuick = mode === "quick";

  return (
    <View style={[styles.shell, style]}>
      <View style={styles.union}>
        <View style={styles.tabRow}>
          <Pressable
            onPress={() => onModeChange("quick")}
            style={[
              styles.tab,
              styles.tabWide,
              isQuick ? styles.tabActive : styles.tabInactive,
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: isQuick ? TAB_ACTIVE_TEXT.quick : styles.tabLabelInactive.color },
              ]}
            >
              快速排班
            </Text>
            {isQuick ? <View style={styles.tabBridge} pointerEvents="none" /> : null}
          </Pressable>
          <Pressable
            onPress={() => onModeChange("manual")}
            style={[
              styles.tab,
              styles.tabNarrow,
              !isQuick ? styles.tabActive : styles.tabInactive,
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: !isQuick ? TAB_ACTIVE_TEXT.manual : styles.tabLabelInactive.color },
              ]}
            >
              手動排班
            </Text>
            {!isQuick ? <View style={styles.tabBridge} pointerEvents="none" /> : null}
          </Pressable>
        </View>

        <View
          style={[
            styles.card,
            isQuick ? styles.cardQuickActive : styles.cardManualActive,
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const TAB_RADIUS = {
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
} as const;

const cardShadow = Platform.select({
  android: { elevation: 6 },
  default: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
});

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
  },
  union: {
    flex: 1,
    minHeight: 0,
  },
  tabRow: {
    flexDirection: "row",
    gap: 6,
    zIndex: 2,
  },
  tab: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    overflow: "visible",
    ...TAB_RADIUS,
  },
  tabWide: { flex: 3 },
  tabNarrow: { flex: 2 },
  tabActive: {
    backgroundColor: "#fff",
    zIndex: 2,
  },
  tabInactive: {
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  tabBridge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -TAB_BODY_OVERLAP,
    height: TAB_BODY_OVERLAP + 1,
    backgroundColor: "#fff",
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  tabLabelInactive: {
    color: "#94A3B8",
  },
  card: {
    flex: 1,
    minHeight: 0,
    marginTop: -TAB_BODY_OVERLAP,
    backgroundColor: "#fff",
    overflow: "hidden",
    zIndex: 1,
    ...cardShadow,
  },
  cardQuickActive: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  cardManualActive: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
});
