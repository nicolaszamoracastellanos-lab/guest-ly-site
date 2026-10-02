// Short notices with an optional Undo (v1.2, plan d "Avisos cortos con
// Deshacer"; audit S7, S8). They replace the blocking "Done" alerts:
//
//   import { toast } from "@/ui";
//   toast(c.guestRemoved, { undo: () => restore(guest) });   // "Guest removed. Undo"
//   toast(c.saved);                                          // no undo, 4 s
//
// One at a time: a new toast replaces the one on screen. It sits above the
// floating tab bar, above a docked action or a chat composer when the screen
// has one, and right above the keyboard (and its toolbar) while the keyboard
// is open, riding it frame by frame. 4 s without Undo, 5 s with it, longer
// while VoiceOver or TalkBack is on so there is time to reach Undo.
//
// The root layout mounts one ToastHost. A Sheet is a native modal that covers
// the root, so every open Sheet mounts its own host; the newest host shows the
// toast and the others stay quiet.

import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "expo-router";
import { useCopy } from "@/i18n";
import { Icon, type IconName } from "./Icon";
import { T } from "./Text";
import { colors, fonts, HIT_TARGET, MAX_CONTENT_WIDTH } from "./tokens";
import { useBottomClearance, useTabBarTop } from "./chrome";

export type ToastOptions = {
  /** Shows "Undo" / "Deshacer"; tapping it runs this and closes the toast. */
  undo?: () => void;
  /** Another word for the action (it still runs `undo`). */
  undoLabel?: string;
  /** Leading icon. Default "check"; pass "info" or "warning" for other news. */
  icon?: IconName;
  /** How long it stays, in ms. Default 4000, 5000 with Undo (clamped 3000 to 8000). */
  ms?: number;
};

type ToastItem = { id: number; message: string } & ToastOptions;

// ------------------------------------------------------------------ store

let current: ToastItem | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getCurrent = () => current;

/** Show a toast. Returns a function that closes it early. */
export function toast(message: string, options: ToastOptions = {}): () => void {
  const id = ++seq;
  current = { id, message, ...options };
  emit();
  // VoiceOver and TalkBack read it without moving focus away from the work.
  AccessibilityInfo.announceForAccessibilityWithOptions?.(message, { queue: true });
  return () => dismissToast(id);
}

/** Close the toast on screen (or only toast `id`, if it is still showing). */
export function dismissToast(id?: number) {
  if (!current || (id !== undefined && current.id !== id)) return;
  current = null;
  emit();
}

// ------------------------------------------------------------------ lifts

/** What sits at the bottom of the focused screen, so toasts clear it: `rest`
 *  above the tab bar (or the home indicator) while the keyboard is closed,
 *  `open` above the keyboard while it is open (a docked action plus the form
 *  toolbar, or a chat composer). */
export type DockLift = { rest: number; open: number };

const lifts = new Map<string, DockLift>();
const liftListeners = new Set<() => void>();
let liftSnapshot: DockLift = { rest: 0, open: 0 };
function recomputeLift() {
  let rest = 0;
  let open = 0;
  lifts.forEach((l) => {
    rest = Math.max(rest, l.rest);
    open = Math.max(open, l.open);
  });
  if (rest !== liftSnapshot.rest || open !== liftSnapshot.open) {
    liftSnapshot = { rest, open };
    liftListeners.forEach((l) => l());
  }
}
const subscribeLift = (l: () => void) => {
  liftListeners.add(l);
  return () => {
    liftListeners.delete(l);
  };
};
const getLift = () => liftSnapshot;

/** Register the height of something docked at the bottom of a screen while
 *  that screen is focused. DockedAction, ChatComposer and form Screens call
 *  it; a screen with its own fixed bottom bar can too. */
export function useDockLift(lift: DockLift | null) {
  const id = useId();
  const focused = useIsFocused();
  const rest = lift?.rest ?? 0;
  const open = lift?.open ?? 0;
  const active = !!lift && focused;
  useEffect(() => {
    if (!active) return;
    lifts.set(id, { rest, open });
    recomputeLift();
    return () => {
      lifts.delete(id);
      recomputeLift();
    };
  }, [id, active, rest, open]);
}

// ------------------------------------------------------------------ hosts

// Sheet hosts win over the root host whatever the mount order (the root host
// remounts when the lock lifts, possibly while a sheet is open).
const hosts: { id: string; sheet: boolean }[] = [];
const hostListeners = new Set<() => void>();
const subscribeHosts = (l: () => void) => {
  hostListeners.add(l);
  return () => {
    hostListeners.delete(l);
  };
};
const topHost = () => {
  for (let i = hosts.length - 1; i >= 0; i--) if (hosts[i].sheet) return hosts[i].id;
  return hosts[hosts.length - 1]?.id ?? null;
};

/** Where toasts appear. The root layout mounts one; Sheet mounts its own.
 *  `base` and `lift` override the defaults (the tab bar or home indicator,
 *  and whatever the focused screen docked at its bottom). */
export function ToastHost({ base, lift }: { base?: number; lift?: DockLift }) {
  const id = useId();
  // A host given its own lift is a Sheet's.
  const sheet = !!lift;
  useEffect(() => {
    hosts.push({ id, sheet });
    hostListeners.forEach((l) => l());
    return () => {
      const i = hosts.findIndex((h) => h.id === id);
      if (i >= 0) hosts.splice(i, 1);
      hostListeners.forEach((l) => l());
    };
  }, [id, sheet]);
  const top = useSyncExternalStore(subscribeHosts, topHost, topHost);
  const item = useSyncExternalStore(subscribe, getCurrent, getCurrent);
  const registered = useSyncExternalStore(subscribeLift, getLift, getLift);
  const insets = useSafeAreaInsets();
  const { tabBar } = useBottomClearance();
  const tabTop = useTabBarTop();
  const c = useCopy().common;

  // Timer: one per toast, owned by the host that shows it.
  const [readerOn, setReaderOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => alive && setReaderOn(on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setReaderOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  const showing = top === id ? item : null;
  const latest = useRef(showing);
  useEffect(() => {
    latest.current = showing;
  });
  useEffect(() => {
    if (!showing) return;
    const wanted = showing.ms ?? (showing.undo ? 5000 : 4000);
    const ms = readerOn ? Math.max(wanted, 10000) : Math.min(Math.max(wanted, 3000), 8000);
    const t = setTimeout(() => dismissToast(showing.id), ms);
    return () => clearTimeout(t);
  }, [showing, readerOn]);

  const restBase = base ?? (tabBar ? tabTop : insets.bottom);
  const l = lift ?? registered;
  const closed = -(restBase + l.rest + 12);
  const opened = -(l.open + 12);

  return (
    <KeyboardStickyView pointerEvents="box-none" style={styles.host} offset={{ closed, opened }}>
      {showing ? (
        <Animated.View key={showing.id} entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(160)} style={styles.toast} accessibilityLiveRegion="polite">
          <Icon name={showing.icon ?? "check"} size={20} color={colors.goldLight} />
          <T v="meta13" color={colors.ivory} style={styles.text}>
            {showing.message}
          </T>
          {showing.undo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showing.undoLabel ?? c.undo}
              onPress={() => {
                const run = latest.current?.undo;
                dismissToast(showing.id);
                run?.();
              }}
              style={({ pressed }) => [styles.undo, pressed && { opacity: 0.6 }]}
            >
              <T v="meta13" color={colors.goldLight} style={{ fontFamily: fonts.bodyMedium }}>
                {showing.undoLabel ?? c.undo}
              </T>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 12, right: 12, bottom: 0, alignItems: "center" },
  toast: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 16,
    backgroundColor: colors.toast,
    borderWidth: 1,
    borderColor: "rgba(247,243,236,0.16)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  text: { flex: 1, minWidth: 0, paddingRight: 8 },
  undo: { minHeight: HIT_TARGET, minWidth: HIT_TARGET, paddingHorizontal: 12, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
