// JS side of the WatchConnectivity bridge (modules/guestly-watch). Everything
// is optional and silent: no native module (Android, web, Expo Go, a build that
// predates the watch) reads as "no watch".

import { Platform } from "react-native";
import native, { type WatchActionEvent, type WatchLinkState } from "../../../modules/guestly-watch/src/GuestlyWatchModule";
import type { WatchSnapshot } from "./types";

const NO_LINK: WatchLinkState = { paired: false, installed: false, reachable: false };

export const watchBridge = {
  /** True on an iPhone build that carries the module. */
  available(): boolean {
    if (Platform.OS !== "ios" || !native) return false;
    try {
      return native.isSupported();
    } catch {
      return false;
    }
  },
  link(): WatchLinkState {
    if (!this.available()) return NO_LINK;
    try {
      return native!.getState();
    } catch {
      return NO_LINK;
    }
  },
  /** Latest wins; never throws. */
  send(snapshot: WatchSnapshot) {
    if (!this.available()) return;
    try {
      native!.setSnapshot(JSON.stringify(snapshot));
    } catch {
      // A watch that cannot be reached must never break the app.
    }
  },
  /** Answers one action exactly once. */
  reply(id: string, body: { ok: boolean; data?: object; error?: string }) {
    if (!this.available()) return;
    try {
      native!.reply(id, JSON.stringify(body));
    } catch {
      // The watch times out by itself.
    }
  },
  /** Subscribes to actions from the watch (also those queued before JS started). */
  onAction(cb: (e: WatchActionEvent) => void): () => void {
    if (!this.available()) return () => {};
    const sub = native!.addListener("onAction", cb);
    return () => sub.remove();
  },
};
