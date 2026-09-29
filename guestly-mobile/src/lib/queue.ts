// Offline queue for door check-ins. Each entry carries a client_event_id so
// the portal ignores replays. Persists across restarts; drains whenever the
// app is foregrounded or a check-in succeeds online.
//
// Every read-modify-write of the stored queue runs behind one promise chain,
// and a drain removes only the ids it settled, so an enqueue during a drain
// is never overwritten; two drains never run at once (review P0-5). A drain removes only the entries it actually
// delivered. An entry is dropped only when the server answered with a final
// refusal (4xx other than 401, 408 and 429); offline, timeouts, 5xx, rate
// limits and an expired session all keep it for the next drain.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { post, ApiFailure } from "@/lib/api";

export const QUEUE_KEY = "gl.checkin.queue";

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

/** The one call the queue makes; replaceable in tests. */
export type Sender = (item: QueuedCheckin) => Promise<unknown>;
let send: Sender = (item) => post<CheckinResult>("/couple/checkin", item);
export function setQueueSender(s: Sender) {
  send = s;
}

export function newEventId(): string {
  return Crypto.randomUUID();
}

// ---------------------------------------------------------------- mutex

let chain: Promise<unknown> = Promise.resolve();
/** Runs `fn` after every earlier queue operation has finished. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function read(): Promise<QueuedCheckin[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as QueuedCheckin[]) : [];
  } catch {
    return [];
  }
}

async function write(items: QueuedCheckin[]) {
  if (items.length) await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  else await AsyncStorage.removeItem(QUEUE_KEY);
}

export function readQueue(): Promise<QueuedCheckin[]> {
  return serial(read);
}

export function enqueue(item: QueuedCheckin): Promise<void> {
  return serial(async () => {
    const q = await read();
    if (!q.some((i) => i.client_event_id === item.client_event_id)) q.push(item);
    await write(q);
  });
}

/** Empties the queue (sign out: another account must never send these). */
export function clearQueue(): Promise<void> {
  return serial(() => AsyncStorage.removeItem(QUEUE_KEY));
}

/** True when the entry should stay queued after this failure. */
export function retryable(err: unknown): boolean {
  if (!(err instanceof ApiFailure)) return true;
  const s = err.status;
  return s === 0 || s === 401 || s === 408 || s === 429 || s >= 500 || err.code === "offline" || err.code === "timeout";
}

/** Sends one check-in; when it cannot reach the server, queues it and
 *  returns null. */
export async function checkIn(item: QueuedCheckin): Promise<CheckinResult | null> {
  try {
    return (await send(item)) as CheckinResult;
  } catch (err) {
    if (retryable(err)) {
      await enqueue(item);
      return null;
    }
    throw err;
  }
}

let draining: Promise<{ sent: number; remaining: number }> | null = null;

/** Replays the queue in order. Stops at the first failure that can be
 *  retried; drops only entries the server refused for good. One drain at a
 *  time: a second caller gets the running one. The storage lock is held only
 *  for the short read and the final write, never across the network, so a
 *  check-in queued at the door while a drain runs is saved at once. */
export function drainQueue(): Promise<{ sent: number; remaining: number }> {
  if (draining) return draining;
  draining = (async () => {
    const snapshot = await readQueue();
    const done = new Set<string>();
    let sent = 0;
    for (const item of snapshot) {
      try {
        await send(item);
        sent += 1;
        done.add(item.client_event_id);
      } catch (err) {
        if (retryable(err)) break;
        // Guest removed, forbidden, bad payload: a retry cannot fix it.
        done.add(item.client_event_id);
      }
    }
    // Re-read under the lock and remove only what this drain settled, so
    // anything enqueued meanwhile survives.
    const remaining = await serial(async () => {
      const now = await read();
      const left = now.filter((i) => !done.has(i.client_event_id));
      if (done.size) await write(left);
      return left.length;
    });
    return { sent, remaining };
  })().finally(() => {
    draining = null;
  });
  return draining;
}
