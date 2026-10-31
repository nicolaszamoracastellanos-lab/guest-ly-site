// The outer-display welcome (CameraCaptureAccessory). Renders nothing visible:
// it hosts the SwiftUI scene accessory. Optional: any build without the native
// view (Android, web, Expo Go, iOS before 27.1) renders null.
import React from "react";
import { Platform, type ViewProps } from "react-native";
import { requireNativeView } from "expo";

export type WelcomeState = "idle" | "found" | "checked" | "notFound";
export type WelcomeProps = ViewProps & {
  enabled: boolean;
  state: WelcomeState;
  couple: string;
  name: string;
  table: string;
  seats: number;
  lang: "en" | "es";
  onAvailabilityChange?: (e: { nativeEvent: { available: boolean } }) => void;
};

let Native: React.ComponentType<WelcomeProps> | null = null;
if (Platform.OS === "ios") {
  try {
    Native = requireNativeView<WelcomeProps>("GuestlyDuo", "WelcomeAccessoryView");
  } catch {
    Native = null;
  }
}

export function WelcomeAccessory(props: WelcomeProps) {
  if (!Native) return null;
  return <Native {...props} style={{ width: 1, height: 1, position: "absolute", opacity: 0 }} />;
}
