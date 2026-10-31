// The iOS 18 Contact Access button for a typed name: shares one more matching
// person with Guest-ly without opening the whole picker. Renders nothing on
// builds without expo-contacts, on iOS before 18 and on Android.

import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { contactAccessButton } from "./contacts";
import { colors } from "@/ui/tokens";

let resolved: ReturnType<typeof contactAccessButton> | undefined;

export function ContactAccessInline({ query, style }: { query: string; style?: StyleProp<ViewStyle> }) {
  if (resolved === undefined) resolved = contactAccessButton();
  if (!resolved) return null;
  return React.createElement(resolved, { query, caption: "phone", backgroundColor: colors.navy, textColor: colors.ivory, tintColor: colors.gold, style });
}
