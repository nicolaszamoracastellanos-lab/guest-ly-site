// The Day pack store (#30, STUDY-app-offline D1 and D2). One JSON record per
// person and wedding in AsyncStorage (JS only: no new native module, so the
// app stays updatable over the air on the 1.4.0 runtime). The pack is a read
// copy; the server is the source of truth (D4.1).
//
// Keys: "gl.scoped.daypack.v1:{owner}:{slug}". The "gl.scoped." prefix is
// removed by resetUserScopedState (lib/scope) on sign out, a new guest
// identity and a session that ended, so the next person never sees it (D4.8).
// A wedding switch keeps the files (a planner keeps every wedding of the week)
// and only empties the memory copy.
//
// Size: 500 parties are about 150 KB, well under AsyncStorage's per-row limit
// on Android (2 MB) and nothing for iOS (one file in Application Support).
//
// A pack is never read as stale data past its last useful day: expired
// records are deleted on read. Unlike the query cache (24 hours), a pack
// saved three days before the wedding is still there on the day (K24).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiFailure, get, isMissingEndpoint } from "@/lib/api";
import { registerScopedReset } from "@/lib/scope";
import { clockOffset, packExpired, parseGuestPack, parsePack, rosterIndex, timelineChanges, utf8Bytes, type DayPack, type GuestPack, type RosterIndex } from "./packCore";
import { serviceDayOf, wallClockAt } from "./live";

export type PackKind = "couple" | "planner" | "guest";

/** What is stored per wedding. */
type Record_ = {
  v: 1;
  kind: PackKind;
  slug: string;
  /** Device time the pack content last changed on this phone (a 200). */
  savedAt: number;
  /** Device time the server last confirmed it (a 200 or a 304). */
  checkedAt: number;
  etag: string | null;
  bytes: number;
  /** Server minus device clock, ms. */
  offsetMs: number;
  /** The pack as the server sent it. */
  raw: unknown;
};

export type PackEntry<P> = {
  key: string;
  kind: PackKind;
  slug: string;
  pack: P;
  savedAt: number;
  checkedAt: number;
  bytes: number;
  offsetMs: number;
  /** The door's local search index (couple and planner packs with a roster). */
  index: RosterIndex | null;
};

export type PackStatus = {
  /** A fetch is running. */
  loading: boolean;
  /** The last fetch failed (offline, timeout, 5xx). */
  failed: boolean;
  /** The portal answered 404: no route yet, or MW_DAY_PACK is off for this wedding. Hide everything. */
  missing: boolean;
  /** Storage was read (an absent pack is then really absent). */
  ready: boolean;
};

const PREFIX = "gl.scoped.daypack.v1:";
export function packKey(owner: string, slug: string): string {
  return `${PREFIX}${owner}:${slug}`;
}

export function packPath(kind: PackKind, slug: string): string {
  if (kind === "guest") return "/guest/pack";
  if (kind === "planner") return `/planner/dayof/pack?slug=${encodeURIComponent(slug)}`;
  return "/couple/dayof/pack";
}

// ---------------------------------------------------------------- memory

const entries = new Map<string, PackEntry<DayPack | GuestPack>>();
const statuses = new Map<string, PackStatus>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // a listener never breaks the store
    }
  });
}

export function subscribePacks(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function packsVersion(): number {
  return version;
}

const IDLE: PackStatus = { loading: false, failed: false, missing: false, ready: false };
export function packStatus(key: string): PackStatus {
  return statuses.get(key) ?? IDLE;
}
function setStatus(key: string, patch: Partial<PackStatus>) {
  statuses.set(key, { ...packStatus(key), ...patch });
  emit();
}

export function cachedPack<P extends DayPack | GuestPack>(key: string): PackEntry<P> | null {
  return (entries.get(key) as PackEntry<P> | undefined) ?? null;
}

// A wedding switch, a sign out, a 401: the memory copy goes (the disk copy is
// removed by the scoped reset's prefix on sign out, kept on a switch).
registerScopedReset(() => {
  entries.clear();
  statuses.clear();
  emit();
});

function todayIn(tz: string, now: number): string {
  const c = wallClockAt(now, tz);
  return serviceDayOf(c.day, c.minutes);
}

function toEntry(key: string, rec: Record_): PackEntry<DayPack | GuestPack> | null {
  const pack = rec.kind === "guest" ? parseGuestPack(rec.raw) : parsePack(rec.raw);
  if (!pack) return null;
  const roster = "roster" in pack ? pack.roster : null;
  return {
    key,
    kind: rec.kind,
    slug: rec.slug,
    pack,
    savedAt: rec.savedAt,
    checkedAt: rec.checkedAt,
    bytes: rec.bytes,
    offsetMs: rec.offsetMs,
    index: roster ? rosterIndex(roster) : null,
  };
}

async function readRecord(key: string): Promise<Record_ | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const rec = JSON.parse(raw) as Record_;
    return rec && rec.v === 1 ? rec : null;
  } catch {
    return null;
  }
}

/**
 * The saved pack for this person and wedding: from memory, else from storage.
 * An expired pack is deleted and reads as none. Never touches the network, so
 * it works offline and with an expired session (D3, "reads keep working").
 */
export async function loadPack(owner: string, kind: PackKind, slug: string): Promise<PackEntry<DayPack | GuestPack> | null> {
  const key = packKey(owner, slug);
  const mem = entries.get(key);
  if (mem) return mem;
  const rec = await readRecord(key);
  let entry = rec ? toEntry(key, rec) : null;
  if (entry && packExpired(entry.pack.meta, todayIn(entry.pack.meta.tz, Date.now() + entry.offsetMs))) {
    await AsyncStorage.removeItem(key).catch(() => {});
    entry = null;
  }
  if (entry && !entries.has(key)) entries.set(key, entry);
  if (!packStatus(key).ready || entry) setStatus(key, { ready: true });
  return entries.get(key) ?? null;
}

/** Deletes one saved pack (the feature was switched off for this wedding). */
async function dropPack(key: string) {
  entries.delete(key);
  await AsyncStorage.removeItem(key).catch(() => {});
}

export type FetchResult =
  | { kind: "saved"; changes: number | null; entry: PackEntry<DayPack | GuestPack> }
  | { kind: "unchanged" }
  | { kind: "missing" }
  | { kind: "failed"; error: unknown };

const inflight = new Map<string, Promise<FetchResult>>();

/**
 * Asks the portal for the pack with If-None-Match. 304: only the "checked"
 * time moves. 200: the record is replaced in one write (a reader sees the old
 * pack or the new one, never half). 404 (no route yet, or the flag is off):
 * the saved pack is deleted and the store says `missing`, so every screen
 * hides the offline parts. One fetch per pack at a time.
 */
export function fetchPack(owner: string, kind: PackKind, slug: string): Promise<FetchResult> {
  const key = packKey(owner, slug);
  const running = inflight.get(key);
  if (running) return running;
  const run = (async (): Promise<FetchResult> => {
    setStatus(key, { loading: true });
    const before = (await loadPack(owner, kind, slug)) as PackEntry<DayPack | GuestPack> | null;
    const rec = await readRecord(key);
    let etag: string | null = null;
    let dateHeader: string | null = null;
    const sentAt = Date.now();
    try {
      const data = await get<unknown>(packPath(kind, slug), {
        headers: rec?.etag ? { "If-None-Match": rec.etag } : undefined,
        onResponse: (res) => {
          etag = res.headers.get("etag");
          dateHeader = res.headers.get("date");
        },
      });
      const receivedAt = Date.now();
      const parsed = kind === "guest" ? parseGuestPack(data) : parsePack(data);
      if (!parsed) {
        setStatus(key, { loading: false, failed: true });
        return { kind: "failed", error: new Error("bad_pack") };
      }
      const text = JSON.stringify(data);
      const serverNow = parsed.meta.server_now ?? (dateHeader ? new Date(dateHeader).toISOString() : null);
      const next: Record_ = {
        v: 1,
        kind,
        slug,
        savedAt: receivedAt,
        checkedAt: receivedAt,
        // The server's ETag, else the content version in the same quoted form.
        etag: etag ?? `"${parsed.meta.version}"`,
        bytes: utf8Bytes(text),
        offsetMs: clockOffset(serverNow, sentAt, receivedAt),
        raw: data,
      };
      await AsyncStorage.setItem(key, JSON.stringify(next));
      const entry = toEntry(key, next);
      if (entry) entries.set(key, entry);
      const changes = before && entry && "runsheet" in before.pack && "runsheet" in entry.pack && before.pack.meta.version !== entry.pack.meta.version ? timelineChanges(before.pack.runsheet, entry.pack.runsheet) : null;
      setStatus(key, { loading: false, failed: false, missing: false, ready: true });
      return entry ? { kind: "saved", changes, entry } : { kind: "failed", error: new Error("bad_pack") };
    } catch (err) {
      if (err instanceof ApiFailure && err.status === 304 && rec) {
        const receivedAt = Date.now();
        const touched: Record_ = { ...rec, checkedAt: receivedAt, offsetMs: dateHeader ? clockOffset(new Date(dateHeader as string).toISOString(), sentAt, receivedAt) || rec.offsetMs : rec.offsetMs };
        await AsyncStorage.setItem(key, JSON.stringify(touched)).catch(() => {});
        const mem = entries.get(key);
        if (mem) entries.set(key, { ...mem, checkedAt: receivedAt, offsetMs: touched.offsetMs });
        setStatus(key, { loading: false, failed: false, missing: false, ready: true });
        return { kind: "unchanged" };
      }
      if (isMissingEndpoint(err)) {
        await dropPack(key);
        setStatus(key, { loading: false, failed: false, missing: true, ready: true });
        return { kind: "missing" };
      }
      setStatus(key, { loading: false, failed: true, ready: true });
      return { kind: "failed", error: err };
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}

/** The last time this pack was checked against the server (for the 15 minute rule), from storage. */
export async function lastChecked(owner: string, slug: string): Promise<number | null> {
  const mem = entries.get(packKey(owner, slug));
  if (mem) return mem.checkedAt;
  const rec = await readRecord(packKey(owner, slug));
  return rec ? rec.checkedAt : null;
}

/**
 * A status change the server already took (online tap): the saved copy shows
 * it at once instead of waiting for the next pack fetch. Memory and storage.
 */
export async function patchBlockStatus(owner: string, slug: string, blockId: string, status: string): Promise<void> {
  const key = packKey(owner, slug);
  const rec = await readRecord(key);
  if (!rec || rec.kind === "guest" || !rec.raw || typeof rec.raw !== "object") return;
  const root = rec.raw as Record<string, unknown>;
  const body = (root.pack && typeof root.pack === "object" ? root.pack : root) as Record<string, unknown>;
  if (!Array.isArray(body.runsheet)) return;
  body.runsheet = (body.runsheet as Record<string, unknown>[]).map((b) => (b && b.id === blockId ? { ...b, status } : b));
  await AsyncStorage.setItem(key, JSON.stringify(rec)).catch(() => {});
  const entry = toEntry(key, rec);
  if (entry) entries.set(key, { ...entry });
  emit();
}
