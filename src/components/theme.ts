import { Platform, type ViewStyle } from "react-native";

/** 行事曆「幾號」數字：略小、偏窄，挪出格內空間給節日兩字標籤 */
export const fontCalendarDateCondensed = Platform.select({
  ios: "AvenirNextCondensed-Bold",
  android: "sans-serif-condensed",
  default: undefined,
});

export const colors = {
  teal: "#11928F",
  tealDark: "#0d7a78",
  orange: "#F29D11",
  purple: "#6B66E8",
  pink: "#E85299",
  greyBg: "#F0F2F5",
  green: "#00C853",
  greenSoft: "#E8F8EE",
  border: "#E2E8F0",
  text: "#0f172a",
  muted: "#64748b",
  card: "#ffffff",
  destructive: "#ef4444",
};

export function cardShadow(elevation = 4): ViewStyle {
  if (Platform.OS === "android") {
    return { elevation };
  }
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  };
}
