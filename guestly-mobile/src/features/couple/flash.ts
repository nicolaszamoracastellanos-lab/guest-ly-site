// One-shot notes handed from a screen to the one under it, for results that
// would otherwise be a toast hidden under a native modal (the guest card is a
// modal: a toast fired while it is on top does not show). The screen below
// reads its note when it gets focus, shows it a few seconds, then drops it.

import { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { useFocusEffect } from "expo-router";

const notes = new Map<string, string>();

export const flash = {
  set(key: string, text: string) {
    notes.set(key, text);
  },
  take(key: string): string | null {
    const v = notes.get(key) ?? null;
    notes.delete(key);
    return v;
  },
};

/** The note left for `key`, shown for `ms` after this screen gets focus. */
export function useFlash(key: string, ms = 4000): [string | null, (text: string) => void] {
  const [text, setText] = useState<string | null>(null);
  const show = useCallback((t: string) => {
    setText(t);
    if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(t);
  }, []);
  useFocusEffect(
    useCallback(() => {
      const t = flash.take(key);
      if (t) show(t);
    }, [key, show]),
  );
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(() => setText(null), ms);
    return () => clearTimeout(id);
  }, [text, ms]);
  return [text, show];
}
