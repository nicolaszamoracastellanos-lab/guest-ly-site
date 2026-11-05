// React glue for the Day pack (#30): the saved pack of a wedding, the clock
// that drives Now and Next without the network, and the unsent status taps.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useOnline } from "@/lib/query";
import { featureOn, useSession } from "@/lib/session";
import { isBlockStatus, readQueue, subscribeQueue, type QueuedBlockStatus } from "@/lib/queue";
import { cachedPack, fetchPack, loadPack, packKey, packStatus, packsVersion, subscribePacks, type PackEntry, type PackKind, type PackStatus } from "./packStore";
import type { DayPack, GuestPack } from "./packCore";

/** The release flag every #30 surface waits for (Lane 1 registers it). */
export const DAY_PACK_FLAG = "MW_DAY_PACK";

/** Who the saved packs belong to: "user:{id}" (a couple or planner, every
 *  wedding of theirs) or "guest:{slug}:{guestId}". Null when signed out. */
export function usePackOwner(): string | null {
  const { state } = useSession();
  if (state.status === "user") return `user:${state.me.user.id}`;
  if (state.status === "guest") return `guest:${state.tenant.slug}:${state.guest.id}`;
  return null;
}

/** True when the open wedding has the Day pack switched on (couple and planner). */
export function useDayPackFlag(): boolean {
  const { state } = useSession();
  return state.status === "user" && featureOn(state.me, DAY_PACK_FLAG);
}

/**
 * The saved pack of one wedding (memory first, then storage), its status and
 * a refresh. `enabled` false: nothing is read and nothing is fetched.
 */
export function useDayPack<P extends DayPack | GuestPack>(kind: PackKind, slug: string | null | undefined, enabled = true): {
  entry: PackEntry<P> | null;
  status: PackStatus;
  refresh: () => Promise<void>;
} {
  const owner = usePackOwner();
  const key = owner && slug ? packKey(owner, slug) : null;
  useSyncExternalStore(subscribePacks, packsVersion, packsVersion);
  useEffect(() => {
    if (!enabled || !owner || !slug) return;
    void loadPack(owner, kind, slug);
  }, [enabled, owner, kind, slug]);
  const refresh = useCallback(async () => {
    if (!enabled || !owner || !slug) return;
    await fetchPack(owner, kind, slug);
  }, [enabled, owner, kind, slug]);
  const entry = enabled && key ? cachedPack<P>(key) : null;
  const status = key ? packStatus(key) : { loading: false, failed: false, missing: false, ready: false };
  return { entry, status, refresh };
}

/**
 * Wall-clock milliseconds corrected by the server offset, ticking every 30 s
 * (aligned so the minute changes on time) and again whenever the app comes
 * back to the foreground: intervals are not trusted across a sleep.
 */
export function useNow(offsetMs: number): number {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      setNow(Date.now() + offsetMs);
      const ms = 30_000 - (Date.now() % 30_000) + 50;
      timer = setTimeout(tick, ms);
    };
    tick();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setNow(Date.now() + offsetMs);
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [offsetMs]);
  return now;
}

/**
 * Online state that changes only after holding for 3 s (D5): a reachability
 * flap in a venue never flashes a banner.
 */
export function useSettledOnline(holdMs = 3000): boolean {
  const online = useOnline();
  const [settled, setSettled] = useState(online);
  useEffect(() => {
    if (online === settled) return;
    const t = setTimeout(() => setSettled(online), holdMs);
    return () => clearTimeout(t);
  }, [online, settled, holdMs]);
  return settled;
}

/** This phone's status taps still waiting in the outbox for one wedding. */
export function usePendingStatus(slug: string | null | undefined): QueuedBlockStatus[] {
  const [items, setItems] = useState<QueuedBlockStatus[]>([]);
  useEffect(() => {
    let alive = true;
    const read = () =>
      void readQueue().then((all) => {
        if (!alive) return;
        setItems(all.filter(isBlockStatus).filter((i) => !slug || !i.tenant || i.tenant === slug));
      });
    read();
    const off = subscribeQueue(read);
    return () => {
      alive = false;
      off();
    };
  }, [slug]);
  return items;
}

/** The guest ids this phone has queued at the door for one wedding. */
export function useQueuedGuestIds(slug: string | null | undefined): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    const read = () =>
      void readQueue().then((all) => {
        if (!alive) return;
        setIds(all.filter((i) => !isBlockStatus(i) && (!slug || !i.tenant || i.tenant === slug)).map((i) => (i as { guest_id: string }).guest_id));
      });
    read();
    const off = subscribeQueue(read);
    return () => {
      alive = false;
      off();
    };
  }, [slug]);
  return useMemo(() => ids, [ids]);
}
