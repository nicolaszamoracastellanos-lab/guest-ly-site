// react-query with AsyncStorage persistence for the home payloads, so the
// app opens instantly on what it saved last and shows the offline banner
// instead of a spinner. (SecureStore caps values at 2 KB on iOS, so the
// cache lives in AsyncStorage; tokens stay in SecureStore.)

import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

const PERSIST_KEY = "gl.query.cache";
const PERSISTED = new Set(["guest-home", "couple-home", "planner-home", "guest-schedule", "guest-dayof", "couple-dayof"]);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 24 * 60 * 60 * 1000, retry: 1, refetchOnReconnect: true },
  },
});

focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (s) => handleFocus(s === "active"));
  return () => sub.remove();
});

export function useOnline(): boolean {
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}

export function markOffline(offline: boolean) {
  onlineManager.setOnline(!offline);
}

async function restore() {
  try {
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as { key: unknown[]; data: unknown; at: number }[];
    for (const e of entries) {
      if (Date.now() - e.at > 24 * 60 * 60 * 1000) continue;
      queryClient.setQueryData(e.key, e.data, { updatedAt: e.at });
    }
  } catch {
    // corrupt cache: ignore
  }
}

async function persist() {
  try {
    const entries = queryClient
      .getQueryCache()
      .getAll()
      .filter((q) => typeof q.queryKey[0] === "string" && PERSISTED.has(q.queryKey[0]) && q.state.data !== undefined)
      .map((q) => ({ key: q.queryKey, data: q.state.data, at: q.state.dataUpdatedAt }));
    await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(entries));
  } catch {
    // best effort
  }
}

export async function clearQueryCache() {
  queryClient.clear();
  await AsyncStorage.removeItem(PERSIST_KEY).catch(() => {});
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    restore().finally(() => setReady(true));
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") void persist();
    });
    return unsub;
  }, []);
  if (!ready) return null;
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
