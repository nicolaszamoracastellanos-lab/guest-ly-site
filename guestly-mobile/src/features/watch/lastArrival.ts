// The last guest checked in on this phone, shared by the check-in screen and
// the watch (its door page says "Last in: name · Table 4"). A tiny store so
// neither side owns the other's state.

import { useSyncExternalStore } from "react";

export type LastArrival = { name: string; table: string | null };

let current: LastArrival | null = null;
const listeners = new Set<() => void>();

export function setLastArrival(a: LastArrival | null) {
  if (current?.name === a?.name && current?.table === a?.table) return;
  current = a;
  listeners.forEach((l) => l());
}

export const getLastArrival = (): LastArrival | null => current;

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function useLastArrival(): LastArrival | null {
  return useSyncExternalStore(subscribe, getLastArrival, getLastArrival);
}
