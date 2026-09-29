// react-query with AsyncStorage persistence for the home payloads, so the
// app opens instantly on what it saved last and shows the offline banner
// instead of a spinner. (SecureStore caps values at 2 KB on iOS, so the
// cache lives in AsyncStorage; tokens stay in SecureStore.)
//
// Online state comes from NetInfo, checked against the portal itself: the
// app is "offline" when the phone has no network OR the API does not answer,
// so the banners, the paused writes and refetch-on-reconnect all follow what
// actually matters (review P1-12). Focus comes from AppState.
//
// The persisted cache is tagged with the scope it belongs to (who is signed
// in, which wedding). A cache written for one person is never shown to the
// next (review P0-2): the session binds the scope as soon as it knows it.

import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { AppState, Platform } from "react-native";
import { API_BASE } from "@/lib/api";

const PERSIST_KEY = "gl.query.cache";
const PERSISTED = new Set(["guest-home", "couple-home", "planner-home", "guest-schedule", "guest-dayof", "couple-dayof"]);
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: MAX_AGE_MS, retry: 1, refetchOnReconnect: true },
  },
});

focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (s) => handleFocus(s === "active"));
  return () => sub.remove();
});

// Reachability is checked against the portal, not a third-party host. Any
// HTTP answer below 500 means the API is there (the route may 404 on an
// older deploy; that still proves the host answers).
//
// reachabilityShouldRun must stay true: when it returns false NetInfo
// reports "unreachable" and never checks again until the network changes, so
// an app launched behind the Face ID prompt (inactive) stayed "offline" for
// good. iOS suspends the JS thread in the background anyway, and coming back
// to the foreground re-checks at once (below).
if (Platform.OS !== "web") {
  NetInfo.configure({
    reachabilityUrl: `${API_BASE}/api/mobile/v1/health`,
    reachabilityMethod: "HEAD",
    reachabilityTest: async (response) => response.status > 0 && response.status < 500,
    reachabilityLongTimeout: 60_000,
    reachabilityShortTimeout: 5_000,
    reachabilityRequestTimeout: 10_000,
    reachabilityShouldRun: () => true,
    useNativeReachability: false,
  });
  AppState.addEventListener("change", (s) => {
    if (s === "active") void NetInfo.refresh().catch(() => {});
  });
}

/** Unknown reachability counts as online: never block the app on a guess. */
export function isOnlineState(s: Pick<NetInfoState, "isConnected" | "isInternetReachable">): boolean {
  return s.isConnected !== false && s.isInternetReachable !== false;
}

onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(isOnlineState(s))));

export function useOnline(): boolean {
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}

export function markOffline(offline: boolean) {
  onlineManager.setOnline(!offline);
}

// ---------------------------------------------------------------- persistence

type Persisted = { scope: string | null; entries: { key: unknown[]; data: unknown; at: number }[] };

/** Scope of what is in memory now (null until the session knows it). */
let scope: string | null = null;
/** Scope the restored disk cache was written under. */
let restoredScope: string | null = null;

async function restore() {
  try {
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Persisted | Persisted["entries"];
    // Builds before the scope tag stored a bare array: unknown owner, dropped.
    if (Array.isArray(parsed) || !parsed.scope) {
      await AsyncStorage.removeItem(PERSIST_KEY).catch(() => {});
      return;
    }
    restoredScope = parsed.scope;
    for (const e of parsed.entries) {
      if (Date.now() - e.at > MAX_AGE_MS) continue;
      queryClient.setQueryData(e.key, e.data, { updatedAt: e.at });
    }
  } catch {
    // corrupt cache: ignore
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

async function persistNow() {
  persistTimer = null;
  if (!scope) return;
  try {
    const entries = queryClient
      .getQueryCache()
      .getAll()
      .filter((q) => typeof q.queryKey[0] === "string" && PERSISTED.has(q.queryKey[0]) && q.state.data !== undefined)
      .map((q) => ({ key: q.queryKey as unknown[], data: q.state.data, at: q.state.dataUpdatedAt }));
    const blob: Persisted = { scope, entries };
    await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(blob));
  } catch {
    // best effort
  }
}

/** Debounced: a burst of successes (home plus its polls) is one write. */
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => void persistNow(), 1_000);
}

/**
 * Tells the cache who it belongs to ("user:{id}:{slug}" or
 * "guest:{slug}:{guestId}"). When the restored disk cache was written for
 * anyone else it is dropped before a screen can read it.
 */
export function bindCacheScope(next: string) {
  if (restoredScope !== null && restoredScope !== next) {
    queryClient.clear();
    void AsyncStorage.removeItem(PERSIST_KEY).catch(() => {});
  }
  restoredScope = null;
  scope = next;
}

/**
 * Empties the cache for a new person or wedding. Screens that are still
 * mounted lose their old rows at once and refetch with whatever credential
 * the session holds now; the disk copy is deleted.
 */
export async function clearQueryCache() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  scope = null;
  restoredScope = null;
  await queryClient.cancelQueries();
  queryClient.removeQueries({ type: "inactive" });
  // Active queries: reset (no stale rows on screen) and refetch in the
  // background. Not awaited: a slow refetch must not hold up a sign out.
  void queryClient.resetQueries({ type: "active" }).catch(() => {});
  await AsyncStorage.removeItem(PERSIST_KEY).catch(() => {});
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void restore().finally(() => setReady(true));
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      const head = event.query.queryKey[0];
      if (typeof head === "string" && PERSISTED.has(head)) schedulePersist();
    });
    return unsub;
  }, []);
  if (!ready) return null;
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
