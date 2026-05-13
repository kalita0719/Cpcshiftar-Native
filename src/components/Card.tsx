import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { cardShadow, colors } from "@/src/components/theme";

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, cardShadow(4), style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
