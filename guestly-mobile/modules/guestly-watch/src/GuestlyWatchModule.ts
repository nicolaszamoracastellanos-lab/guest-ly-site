// Native binding. Optional on purpose: Android, web, Expo Go and any build made
// before this module existed have no "GuestlyWatch" module, and every one of
// them must read as "no watch".
import { NativeModule, requireOptionalNativeModule } from "expo";

export type WatchLinkState = { paired: boolean; installed: boolean; reachable: boolean };
export type WatchActionEvent = { id: string; type: string; payload: string };

type Events = { onAction: (event: WatchActionEvent) => void };

declare class GuestlyWatchNative extends NativeModule<Events> {
  isSupported(): boolean;
  getState(): WatchLinkState;
  setSnapshot(json: string): void;
  reply(id: string, json: string): void;
}

export default requireOptionalNativeModule<GuestlyWatchNative>("GuestlyWatch");
