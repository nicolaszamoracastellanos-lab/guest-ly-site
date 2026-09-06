// Offline queue for door check-ins. Each entry carries a client_event_id so
// the portal ignores replays. Persists across restarts; drains whenever the
// app is foregrounded or a check-in succeeds online.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { post, ApiFailure } from "@/lib/api";

const KEY = "gl.checkin.queue";

export type QueuedCheckin = {
  client_event_id: string;
  guest_id: string;
  seats: number;
  scanned_at: string;
  name: string;
};

export type CheckinResult = {
  already: boolean;
  replayed: boolean;
  checked_in_at: string;
  guest: {
    id: string;
    name: string;
    party_size: number;
    members: string[];
    table: string | null;
    checked_in_at: string | null;
  } | null;
};

export function newEventId(): string {
  return Crypto.randomUUID();
}

export async function readQueue(): Promise<QueuedCheckin[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedCheckin[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedCheckin[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function enqueue(item: QueuedCheckin) {
  const q = await readQueue();
  if (!q.some((i) => i.client_event_id === item.client_event_id)) q.push(item);
  await writeQueue(q);
}

/** Sends one check-in; when offline, queues it and returns null. */
export async function checkIn(item: QueuedCheckin): Promise<CheckinResult | null> {
  try {
    return await post<CheckinResult>("/couple/checkin", item);
  } catch (err) {
    if (err instanceof ApiFailure && (err.code === "offline" || err.status === 0)) {
      await enqueue(item);
      return null;
    }
    throw err;
  }
}

/** Replays the queue in order. Stops at the first offline failure. */
export async function drainQueue(): Promise<{ sent: number; remaining: number }> {
  const q = await readQueue();
  let sent = 0;
  const remaining: QueuedCheckin[] = [];
  for (const item of q) {
    if (remaining.length) {
      remaining.push(item);
      continue;
    }
    try {
      await post<CheckinResult>("/couple/checkin", item);
      sent += 1;
    } catch (err) {
      if (err instanceof ApiFailure && (err.code === "offline" || err.status === 0)) remaining.push(item);
      // Any other error (guest gone, forbidden): drop the entry, the door
      // already showed the outcome and a retry cannot fix it.
    }
  }
  await writeQueue(remaining);
  return { sent, remaining: remaining.length };
}
