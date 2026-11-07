// Offline outbox: door check-ins and (#30) runsheet block status taps. Each
// entry carries a client_event_id so the portal ignores replays; a check-in
// keeps the scanned_at of the scan, a status tap its tapped_at, so a late
// sync never stamps server time on what happened earlier. Persists across restarts; drains whenever the
// app is foregrounded or a check-in succeeds online.
//
// Every read-modify-write of the stored queue runs behind one promise chain,
// and a drain removes only the ids it settled, so an enqueue during a drain
// is never overwritten; two drains never run at once (review P0-5). A drain removes only the entries it actually
// delivered. An entry is dropped only when the server answered with a final
// refusal (4xx other than 401, 408 and 429); offline, timeouts, 5xx, rate
// limits and an expired session all keep it for the next drain.
//
// Persistence (HH Oct 30 2026, checked): AsyncStorage 2.2 writes to the app's
// Application Support directory on iOS and to SQLite on Android, so the queue
// survives a crash, a force quit and a reboot; the root layout drains it for
// every signed-in couple or planner at launch, on foreground, when the network
// returns and, while status taps wait, once a minute in the foreground
// (timedDrainDue). No MMKV or SQLite
// module is needed for a list this small.
//
// Conflicts: every entry carries a client_event_id, so a replay is a no-op on
// the portal. A party already checked in at another door answers
// `already: true`; the drain now reports those names and the names the
// server refused for good, and listeners (the door chip) hear every change.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { post, ApiFailure, getCredential } from "@/lib/api";
import { classifyFailure, replay, settle, timedDrainDue, type Failure } from "@/lib/queueMath";

/** What a drain did. `already` and `refused` are guest names, for the door;
 *  `locked`, `gone` and `expired` are block titles whose status taps were
 *  dropped (`expired`: held past HELD_TTL_MS while the route stayed dark). */
export type DrainResult = { sent: number; remaining: number; already: string[]; refused: string[]; locked: string[]; gone: string[]; expired: string[] };

// Everyone who wants to hear how a drain ended (the day-of notices), whoever
// started it (the root layout on launch, foreground and reconnect, or a screen).
type DrainListener = (r: DrainResult) => void;
const drainListeners = new Set<DrainListener>();
export function subscribeDrain(fn: DrainListener): () => void {
  drainListeners.add(fn);
  return () => {
    drainListeners.delete(fn);
  };
}

// ---------------------------------------------------------------- listeners

type Listener = (pendingForOpenWedding: number) => void;
const listeners = new Set<Listener>();
/** Called with the open wedding's pending count after every change. */
export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function announce(items: OutboxItem[]) {
  if (!listeners.size) return;
  const n = items.filter((i) => isCheckin(i) && isForOpenWedding(i)).length;
  listeners.forEach((fn) => {
    try {
      fn(n);
    } catch {
      // A listener's failure never breaks the queue.
    }
  });
}

export const QUEUE_KEY = "gl.checkin.queue";

export type QueuedCheckin = {
  /** Absent on entries stored before #30. */
  kind?: "checkin";
  client_event_id: string;
  guest_id: string;
  seats: number;
  scanned_at: string;
  name: string;
  /** Which door route to post to; the couple's when absent (older queued items). */
  path?: string;
  /** The wedding (slug) the pass was scanned for. Sent only while that wedding is the open one. */
  tenant?: string;
};

/** A runsheet status tap made on the day (#30, D4.4). */
export type QueuedBlockStatus = {
  kind: "block_status";
  client_event_id: string;
  block_id: string;
  status: "planned" | "confirmed" | "done";
  /** When the person tapped (device clock corrected by the pack's server offset). */
  tapped_at: string;
  /** The block's updated_at as this phone last saw it. */
  base_updated_at: string | null;
  /** The block title, to name it if the server drops the tap. */
  name: string;
  /** /couple/runsheet/{id}/status or /planner/runsheet/{id}/status. */
  path: string;
  tenant?: string;
};

export type OutboxItem = QueuedCheckin | QueuedBlockStatus;

export function isCheckin(i: OutboxItem): i is QueuedCheckin {
  return i.kind !== "block_status";
}
export function isBlockStatus(i: OutboxItem): i is QueuedBlockStatus {
  return i.kind === "block_status";
}

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
export type Sender = (item: OutboxItem) => Promise<unknown>;
let send: Sender = (item) => {
  if (isBlockStatus(item)) {
    const { path, client_event_id, status, tapped_at, base_updated_at } = item;
    return post(path, { status, client_event_id, tapped_at, base_updated_at });
  }
  const { path, tenant, kind, ...body } = item;
  void tenant;
  void kind;
  return post<CheckinResult>(path ?? "/couple/checkin", body);
};

/** The wedding the open session works on (a planner can hold several). */
function openTenant(): string | undefined {
  const c = getCredential();
  return c.kind === "user" && c.tenantSlug ? c.tenantSlug : undefined;
}
/** True when the entry belongs to the wedding that is open now (entries from before the stamp count as open). */
export function isForOpenWedding(item: OutboxItem): boolean {
  const open = openTenant();
  return !item.tenant || !open || item.tenant === open;
}
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

async function read(): Promise<OutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

async function write(items: OutboxItem[]) {
  if (items.length) await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  else await AsyncStorage.removeItem(QUEUE_KEY);
  announce(items);
}

export function readQueue(): Promise<OutboxItem[]> {
  return serial(read);
}

export function enqueue(item: OutboxItem): Promise<void> {
  return serial(async () => {
    const q = await read();
    if (!q.some((i) => i.client_event_id === item.client_event_id)) q.push(item);
    await write(q);
  });
}

/** Empties the queue (sign out: another account must never send these). */
export function clearQueue(): Promise<void> {
  return serial(async () => {
    await AsyncStorage.removeItem(QUEUE_KEY);
    announce([]);
  });
}

/** Removes one entry that has not been sent yet. True when it was still
 *  waiting (an Undo then needs no request at all). */
export function cancelQueued(clientEventId: string): Promise<boolean> {
  return serial(async () => {
    const q = await read();
    const left = q.filter((i) => i.client_event_id !== clientEventId);
    if (left.length === q.length) return false;
    await write(left);
    return true;
  });
}

function failureOf(err: unknown): Failure | null {
  return err instanceof ApiFailure ? { status: err.status, code: err.code, reason: err.reason, message_en: err.messages.en } : null;
}

/** True when the entry should stay queued after this failure. */
export function retryable(err: unknown): boolean {
  return classifyFailure("checkin", failureOf(err)) === "retry";
}

/** How a status tap ended: sent, queued for later (`queued`: no connection;
 *  `held`: online, but the status route is dark), or dropped for good. */
export type StatusTapResult = { kind: "sent" } | { kind: "queued" } | { kind: "held" } | { kind: "locked" } | { kind: "gone" };

/** Sends one status tap; when it cannot reach the server, queues it. A
 *  locked timeline or a deleted block is final (never queued); any other
 *  final refusal throws for the screen to say what failed. */
export async function sendBlockStatus(raw: QueuedBlockStatus): Promise<StatusTapResult> {
  const item = { ...raw, tenant: raw.tenant ?? openTenant() };
  try {
    await send(item);
    return { kind: "sent" };
  } catch (err) {
    const c = classifyFailure("block_status", failureOf(err));
    // Held: the status route is dark for a moment (MW_DAY_PACK off or a
    // failed flag read). The tap waits in the outbox like an offline one.
    if (c === "retry" || c === "held") {
      await enqueue(item);
      return { kind: c === "held" ? "held" : "queued" };
    }
    if (c === "locked" || c === "gone") return { kind: c };
    throw err;
  }
}

/** Sends one check-in; when it cannot reach the server, queues it and
 *  returns null. */
export async function checkIn(raw: QueuedCheckin): Promise<CheckinResult | null> {
  const item = { ...raw, tenant: raw.tenant ?? openTenant() };
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

let draining: Promise<DrainResult> | null = null;

/** True while a drain is sending (the chip says "Sending"). */
export function isDraining(): boolean {
  return draining !== null;
}

/** True when the one-minute foreground check should drain (status taps wait). */
export async function timedDrainNeeded(online: boolean, active: boolean): Promise<boolean> {
  if (!online || !active || draining) return false;
  return timedDrainDue((await readQueue()).filter(isForOpenWedding), online, active);
}

/** Replays the queue in order. Stops at the first failure that can be
 *  retried; drops only entries the server refused for good. One drain at a
 *  time: a second caller gets the running one. The storage lock is held only
 *  for the short read and the final write, never across the network, so a
 *  check-in queued at the door while a drain runs is saved at once. */
export function drainQueue(): Promise<DrainResult> {
  if (draining) return draining;
  draining = (async () => {
    const snapshot = await readQueue();
    // Another wedding's entry waits for its wedding: sent now it would hit the
    // wrong tenant, be refused as "guest not found" and be dropped for good.
    const open = openTenant();
    const eligible = snapshot.filter((item) => !(item.tenant && open && item.tenant !== open));
    // Offline, timeout, 5xx: the replay stops and keeps the order for next
    // time. Guest removed, timeline locked, block deleted: a retry cannot fix it.
    const outcomes = await replay(eligible, send, failureOf);
    const { done, sent, already, refused, locked, gone, expired } = settle(eligible, outcomes, Date.now());
    // Re-read under the lock and remove only what this drain settled, so
    // anything enqueued meanwhile survives.
    const remaining = await serial(async () => {
      const now = await read();
      const left = now.filter((i) => !done.has(i.client_event_id));
      if (done.size) await write(left);
      return left.filter((i) => isCheckin(i) && isForOpenWedding(i)).length;
    });
    const result = { sent, remaining, already, refused, locked, gone, expired };
    drainListeners.forEach((fn) => {
      try {
        fn(result);
      } catch {
        // a listener never breaks the outbox
      }
    });
    return result;
  })().finally(() => {
    draining = null;
    // And that it ended, with the count left.
    void readQueue().then(announce);
  });
  // Listeners learn a drain started (the chip turns to "Sending").
  void readQueue().then(announce);
  return draining;
}
