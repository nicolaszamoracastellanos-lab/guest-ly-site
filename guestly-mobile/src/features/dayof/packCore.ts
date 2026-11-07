// The Day pack (#30, STUDY-app-offline Part D): the pure rules. No React, no
// React Native, no value imports, so scripts/tests/day-pack.test.ts runs them
// under plain node. The Now engine (./live.ts) is a verbatim copy of the
// portal file and is combined with this one by the hooks, never imported here.
//
// Contract (D1): GET /couple/dayof/pack, GET /planner/dayof/pack?slug= and
// GET /guest/pack answer the usual envelope {ok, data}. `data` is the pack
// itself or `{ pack }`; both are read. Every field is optional on the wire:
// a missing list reads empty, a missing reserved field reads null, so a pack
// from an older or newer portal never breaks a screen. ETag / If-None-Match
// with 304 when nothing changed.

// ---------------------------------------------------------------- types

export type PackMeta = {
  /** Hash of the content; also what the ETag carries. */
  version: string;
  /** Server instant the pack was built (ISO). */
  generated_at: string | null;
  /** The wedding's zone (IANA). */
  tz: string;
  wedding_date: string | null;
  /** Last service day the pack is useful for (YYYY-MM-DD): the day after the last block. */
  valid_until: string | null;
  /** Server clock when the answer was made (ISO), for the clock offset. */
  server_now: string | null;
  slug: string | null;
  couple_names: string | null;
  /** False when this person may not mark blocks done (D28 lock without them). Null: not sent, assume yes. */
  can_mark_status: boolean | null;
};

export type PackBlock = {
  id: string;
  day: string;
  starts_at: string;
  ends_at: string | null;
  title: string;
  detail: string;
  location: string;
  place_id: string | null;
  owner: string;
  vendor_id: string | null;
  status: string;
  updated_at: string | null;
  sort_order: number | null;
};

export type PackPlace = { id: string; name: string; address: string; lat: number | null; lng: number | null; time: string | null; note: string | null };
export type PackVendor = { id: string; name: string; category: string; contact: string | null; phone: string | null; whatsapp: string | null; arrival: string | null };
export type PackGuest = {
  id: string;
  name: string;
  members: string[];
  party_size: number;
  table: string | null;
  tags: string[];
  checked_in_at: string | null;
  rsvp_status: string | null;
  meal: string | null;
};
export type PackContact = { name: string; role: string; phone: string | null };
export type PackSeating = {
  tables: { id: string; name: string; number: number | null; seats: number | null }[];
  assignments: { guest_id: string; table_id: string; seat: number | null }[];
  floor_plan_url: string | null;
};

/** The couple and planner pack. */
export type DayPack = {
  meta: PackMeta;
  runsheet: PackBlock[];
  places: PackPlace[];
  vendors: PackVendor[];
  seating: PackSeating | null;
  /** Null when the person may not see the guest list (planner without `guests` view). */
  roster: PackGuest[] | null;
  /** #1 final count (reserved; shape owned by Lane 1). */
  counts: unknown;
  contacts: PackContact[];
  /** Fields reserved in D1 for later features (#39 ceremony, #40 slots, #45 card, #11 plan). Kept as sent. */
  reserved: Record<string, unknown>;
};

/** The guest pack: what a guest needs on the day without signal. */
export type GuestPack = {
  meta: PackMeta;
  /** Same item shape as GET /guest/schedule events. */
  schedule: Record<string, unknown>[];
  places: PackPlace[];
  dress_code: string | null;
  table: string | null;
  pass_qr: string | null;
  couple_names: string | null;
  reserved: Record<string, unknown>;
};

// ---------------------------------------------------------------- parsing

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : []);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseMeta(raw: unknown): PackMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const version = str(m.version);
  if (!version) return null;
  const wd = strOrNull(m.wedding_date);
  const vu = strOrNull(m.valid_until);
  return {
    version,
    generated_at: strOrNull(m.generated_at),
    tz: strOrNull(m.tz) ?? "America/La_Paz",
    wedding_date: wd && DAY_RE.test(wd.slice(0, 10)) ? wd.slice(0, 10) : null,
    valid_until: vu && DAY_RE.test(vu.slice(0, 10)) ? vu.slice(0, 10) : null,
    server_now: strOrNull(m.server_now),
    slug: strOrNull(m.slug),
    couple_names: strOrNull(m.couple_names),
    can_mark_status: typeof m.can_mark_status === "boolean" ? m.can_mark_status : null,
  };
}

/** The envelope's data is the pack or `{ pack }`. */
function unwrap(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.pack && typeof r.pack === "object") return r.pack as Record<string, unknown>;
  return r;
}

const PACK_KEYS = new Set(["meta", "runsheet", "places", "vendors", "seating", "roster", "counts", "contacts"]);

function parsePlaces(v: unknown): PackPlace[] {
  return list(v)
    .map((p) => ({ id: str(p.id), name: str(p.name), address: str(p.address), lat: numOrNull(p.lat), lng: numOrNull(p.lng), time: strOrNull(p.time), note: strOrNull(p.note) }))
    .filter((p) => p.id && p.name);
}

function parseGuest(g: Record<string, unknown>): PackGuest | null {
  const id = str(g.id);
  const name = str(g.name).trim();
  if (!id || !name) return null;
  const members = Array.isArray(g.members) ? g.members.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  const size = typeof g.party_size === "number" && g.party_size >= 1 ? Math.floor(g.party_size) : Math.max(1, members.length || 1);
  return {
    id,
    name,
    members,
    party_size: size,
    table: strOrNull(g.table) ?? (typeof g.table === "number" ? String(g.table) : null),
    tags: Array.isArray(g.tags) ? g.tags.filter((x): x is string => typeof x === "string") : [],
    checked_in_at: strOrNull(g.checked_in_at),
    rsvp_status: strOrNull(g.rsvp_status),
    meal: strOrNull(g.meal),
  };
}

/** A pack from the wire (or from storage), normalized. Null when it has no meta.version. */
export function parsePack(raw: unknown): DayPack | null {
  const p = unwrap(raw);
  if (!p) return null;
  const meta = parseMeta(p.meta);
  if (!meta) return null;
  const runsheet: PackBlock[] = list(p.runsheet)
    .map((b) => ({
      id: str(b.id),
      day: str(b.day).slice(0, 10),
      starts_at: str(b.starts_at),
      ends_at: strOrNull(b.ends_at),
      title: str(b.title),
      detail: str(b.detail),
      location: str(b.location),
      place_id: strOrNull(b.place_id),
      owner: str(b.owner),
      vendor_id: strOrNull(b.vendor_id),
      status: str(b.status) || "planned",
      updated_at: strOrNull(b.updated_at),
      sort_order: numOrNull(b.sort_order),
    }))
    .filter((b) => b.id && b.starts_at);
  const seatRaw = p.seating && typeof p.seating === "object" ? (p.seating as Record<string, unknown>) : null;
  const seating: PackSeating | null = seatRaw
    ? {
        tables: list(seatRaw.tables).map((t) => ({ id: str(t.id), name: str(t.name), number: numOrNull(t.number), seats: numOrNull(t.seats) })),
        assignments: list(seatRaw.assignments).map((a) => ({ guest_id: str(a.guest_id), table_id: str(a.table_id), seat: numOrNull(a.seat) })),
        floor_plan_url: strOrNull(seatRaw.floor_plan_url),
      }
    : null;
  const roster = Array.isArray(p.roster) ? list(p.roster).map(parseGuest).filter((g): g is PackGuest => g !== null) : null;
  const reserved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (!PACK_KEYS.has(k)) reserved[k] = v;
  return {
    meta,
    runsheet,
    places: parsePlaces(p.places),
    vendors: list(p.vendors)
      .map((v) => ({ id: str(v.id), name: str(v.name), category: str(v.category), contact: strOrNull(v.contact), phone: strOrNull(v.phone), whatsapp: strOrNull(v.whatsapp), arrival: strOrNull(v.arrival) }))
      .filter((v) => v.id && v.name),
    seating,
    roster,
    counts: p.counts ?? null,
    contacts: list(p.contacts).map((c) => ({ name: str(c.name), role: str(c.role), phone: strOrNull(c.phone) })).filter((c) => c.name),
    reserved,
  };
}

const GUEST_KEYS = new Set(["meta", "schedule", "places", "dress_code", "table", "pass_qr", "couple_names"]);

export function parseGuestPack(raw: unknown): GuestPack | null {
  const p = unwrap(raw);
  if (!p) return null;
  const meta = parseMeta(p.meta);
  if (!meta) return null;
  const reserved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (!GUEST_KEYS.has(k)) reserved[k] = v;
  return {
    meta,
    schedule: list(p.schedule).filter((e) => str(e.id) && str(e.title)),
    places: parsePlaces(p.places),
    dress_code: strOrNull(p.dress_code),
    table: strOrNull(p.table) ?? (typeof p.table === "number" ? String(p.table) : null),
    pass_qr: strOrNull(p.pass_qr),
    couple_names: strOrNull(p.couple_names) ?? meta.couple_names,
    reserved,
  };
}

// ---------------------------------------------------------------- size

/** UTF-8 byte length of a string (what the pack costs on the phone). */
export function utf8Bytes(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/** "182 KB", "1.2 MB" ("1,2 MB" in Spanish). Never "0 KB". */
export function formatSize(bytes: number, lang: "en" | "es"): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return `${lang === "es" ? mb.replace(".", ",") : mb} MB`;
}

// ---------------------------------------------------------------- calendar

function dayNumber(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return null;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD); null when either is malformed. */
export function daysBetween(from: string, to: string): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === null || b === null ? null : b - a;
}

function plusDays(day: string, n: number): string {
  const d = dayNumber(day);
  if (d === null) return day;
  const t = new Date((d + n) * 86_400_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** The last service day a pack is good for: valid_until, else the wedding day plus one. */
export function lastUsefulDay(meta: Pick<PackMeta, "valid_until" | "wedding_date">): string | null {
  return meta.valid_until ?? (meta.wedding_date ? plusDays(meta.wedding_date, 1) : null);
}

// ---------------------------------------------------------------- download rules (D2)

/** How close the wedding must be for the app to fetch its pack on its own. */
export const PACK_WINDOW_DAYS = 7;
/** At most this often while the app is in the foreground. */
export const PACK_REFRESH_MS = 15 * 60_000;

/**
 * True when the pack should be fetched now (D2). `today` is the service day in
 * the wedding's zone. Automatic fetches run only from 7 days before the
 * wedding to its last useful day, at most every 15 minutes (a 304 costs almost
 * nothing, but a foreground every minute must not become a request every
 * minute). `force` (pull to refresh, "Save for offline") always fetches.
 */
export function refreshDue(a: { today: string; weddingDate: string | null; lastUseful?: string | null; lastCheckedAt: number | null; now: number; force?: boolean }): boolean {
  if (a.force) return true;
  if (!inPackWindow(a.today, a.weddingDate, a.lastUseful ?? null)) return false;
  return a.lastCheckedAt === null || a.now - a.lastCheckedAt >= PACK_REFRESH_MS;
}

/** From 7 days before the wedding to its last useful day (the wedding day plus one when not known). */
export function inPackWindow(today: string, weddingDate: string | null, lastUseful: string | null): boolean {
  if (!weddingDate) return false;
  const until = daysBetween(today, weddingDate);
  if (until === null || until > PACK_WINDOW_DAYS) return false;
  const end = lastUseful ?? plusDays(weddingDate, 1);
  const after = daysBetween(end, today);
  return after !== null && after <= 0;
}

/** True when a saved pack is past its last useful day: it is deleted, never shown. */
export function packExpired(meta: Pick<PackMeta, "valid_until" | "wedding_date">, today: string): boolean {
  const end = lastUsefulDay(meta);
  if (!end) return false;
  const d = daysBetween(end, today);
  return d !== null && d > 0;
}

// ---------------------------------------------------------------- 404 answers

/**
 * What the phone remembers about 404 answers from one pack route since its
 * last good answer (a 200 or a 304): the first and the last. Stored on its own
 * key next to the pack, so a pack that was never saved still backs off.
 */
export type PackMiss = { firstAt: number; lastAt: number };

/** The miss record after one more 404 at `now`. */
export function nextMiss(miss: PackMiss | null, now: number): PackMiss {
  return { firstAt: miss?.firstAt ?? now, lastAt: now };
}

/**
 * The time the 15 minute rule counts from: the last good answer or the last
 * 404, whichever is later. A route that answers 404 (flag off for that
 * wedding, guests and a planner's other weddings) is then asked once per
 * 15 minutes, not on every one-minute check.
 */
export function lastCheckAt(savedCheckedAt: number | null, miss: PackMiss | null): number | null {
  if (savedCheckedAt === null) return miss ? miss.lastAt : null;
  return miss ? Math.max(savedCheckedAt, miss.lastAt) : savedCheckedAt;
}

/**
 * A 404 from a pack route is ambiguous: MW_DAY_PACK was switched off, or the
 * portal could not read its flags for a moment (it then answers 404 too).
 * True when the saved copy stays:
 * - on a day the pack covers (the wedding day), always: only expiry removes it;
 * - otherwise until the 404s have lasted 15 minutes (two answers at least
 *   15 minutes apart), so one blip never deletes it.
 */
export function keepOnMissing(a: { saved: { meta: PackMeta; runsheet?: { day: string }[] } | null; today: string; miss: PackMiss; now: number }): boolean {
  if (!a.saved) return false;
  if (isPackDay({ meta: a.saved.meta, runsheet: (a.saved.runsheet ?? []) as DayPack["runsheet"] }, a.today)) return true;
  return a.now - a.miss.firstAt < PACK_REFRESH_MS;
}

/** True on a day the pack covers: a day with blocks, the wedding day, or a day before valid_until. */
export function isPackDay(pack: Pick<DayPack, "meta" | "runsheet">, serviceDay: string): boolean {
  const { wedding_date, valid_until } = pack.meta;
  if (pack.runsheet.some((b) => b.day === serviceDay)) return true;
  if (!wedding_date) return false;
  const from = daysBetween(wedding_date, serviceDay);
  if (from === null || from < 0) return false;
  if (from === 0 || !valid_until) return from === 0;
  // valid_until is the day after the last block: the days before it count.
  const to = daysBetween(serviceDay, valid_until);
  return to !== null && to > 0;
}

/** The evening before the wedding day at 19:00, as a service day and minutes (D2 prompt). */
export function dayBeforePrompt(weddingDate: string | null): { day: string; minutes: number } | null {
  if (!weddingDate || dayNumber(weddingDate) === null) return null;
  return { day: plusDays(weddingDate, -1), minutes: 19 * 60 };
}

// ---------------------------------------------------------------- clock offset

/**
 * Server minus device clock, in ms, from one round trip: the server's
 * `server_now` (or the HTTP Date header) against the midpoint of the request.
 * Small offsets (under 2 s) read as 0 so a second of latency never shows.
 */
export function clockOffset(serverNow: string | null, sentAt: number, receivedAt: number): number {
  const s = serverNow ? Date.parse(serverNow) : NaN;
  if (!Number.isFinite(s)) return 0;
  const off = Math.round(s - (sentAt + receivedAt) / 2);
  return Math.abs(off) < 2000 ? 0 : off;
}

// ---------------------------------------------------------------- banner (D5)

export type PackBanner =
  | { kind: "none" }
  /** Offline with a pack: neutral, "Offline. Showing what was saved at 2:10 pm." */
  | { kind: "offline"; savedAt: number }
  /** Online on the day, refresh failing for 30+ minutes: amber, "May be out of date." */
  | { kind: "stale"; savedAt: number }
  /** No pack for a wedding that is today, and we cannot fetch: red. */
  | { kind: "missing" };

export const STALE_AFTER_MS = 30 * 60_000;

export function packBanner(a: { online: boolean; savedAt: number | null; now: number; packDay: boolean; refreshFailed?: boolean }): PackBanner {
  if (a.savedAt === null) return a.packDay && (!a.online || a.refreshFailed) ? { kind: "missing" } : { kind: "none" };
  if (!a.online) return { kind: "offline", savedAt: a.savedAt };
  if (a.packDay && a.now - a.savedAt > STALE_AFTER_MS) return { kind: "stale", savedAt: a.savedAt };
  return { kind: "none" };
}

// ---------------------------------------------------------------- what changed

const BLOCK_FIELDS: (keyof PackBlock)[] = ["day", "starts_at", "ends_at", "title", "location", "owner", "status", "detail"];

/** How many timeline blocks were added, removed or changed between two packs ("Updated. 2 timeline changes."). */
export function timelineChanges(before: readonly PackBlock[], after: readonly PackBlock[]): number {
  const old = new Map(before.map((b) => [b.id, b]));
  let n = 0;
  const seen = new Set<string>();
  for (const b of after) {
    seen.add(b.id);
    const o = old.get(b.id);
    if (!o || BLOCK_FIELDS.some((f) => o[f] !== b[f])) n++;
  }
  for (const id of old.keys()) if (!seen.has(id)) n++;
  return n;
}

// ---------------------------------------------------------------- pending status (outbox overlay)

export type PendingStatus = { block_id: string; status: string };

/** Blocks with this phone's unsent status taps applied (the last tap per block wins), and the ids still waiting. */
export function withPendingStatus<B extends { id: string; status: string }>(blocks: readonly B[], pending: readonly PendingStatus[]): { blocks: B[]; waiting: Set<string> } {
  const last = new Map<string, string>();
  for (const p of pending) last.set(p.block_id, p.status);
  const waiting = new Set<string>();
  const out = blocks.map((b) => {
    const s = last.get(b.id);
    if (s === undefined) return b;
    waiting.add(b.id);
    return s === b.status ? b : { ...b, status: s };
  });
  return { blocks: out, waiting };
}

// ---------------------------------------------------------------- door search (D3)

const FOLD: Record<string, string> = {
  á: "a", à: "a", ä: "a", â: "a", ã: "a", å: "a", é: "e", è: "e", ë: "e", ê: "e", í: "i", ì: "i", ï: "i", î: "i",
  ó: "o", ò: "o", ö: "o", ô: "o", õ: "o", ø: "o", ú: "u", ù: "u", ü: "u", û: "u", ñ: "n", ç: "c", ý: "y", ÿ: "y",
  ß: "ss", æ: "ae", œ: "oe", ł: "l", ś: "s", š: "s", ž: "z", ź: "z", ż: "z", č: "c", ć: "c", ř: "r", ě: "e", ą: "a", ę: "e", ń: "n",
};

/** Lower case without accents: "Sofía" and "SOFIA" both read "sofia". Works without String.normalize. */
export function fold(s: string): string {
  const lower = s.toLowerCase();
  let out = "";
  for (const ch of lower) {
    const f = FOLD[ch];
    if (f !== undefined) out += f;
    else {
      const code = ch.charCodeAt(0);
      // Combining marks (a name typed as "e" plus an accent).
      if (code >= 0x300 && code <= 0x36f) continue;
      out += ch;
    }
  }
  return out;
}

const SPLIT = /[\s,.'’&()/-]+/;

export type RosterIndex = { guests: PackGuest[]; words: string[][]; names: string[]; byId: Map<string, PackGuest> };

/** Built once per pack: folded words of each party's name and members. */
export function rosterIndex(roster: readonly PackGuest[]): RosterIndex {
  const guests = roster.slice();
  const names = guests.map((g) => fold(g.name));
  const words = guests.map((g, i) => {
    const w = new Set<string>();
    for (const part of names[i].split(SPLIT)) if (part) w.add(part);
    for (const m of g.members) for (const part of fold(m).split(SPLIT)) if (part) w.add(part);
    return [...w];
  });
  return { guests, words, names, byId: new Map(guests.map((g) => [g.id, g])) };
}

/** The minimum the door types before a search runs. */
export const MIN_SEARCH = 2;

/**
 * Parties whose name or members match every typed word as a word start,
 * accent and case insensitive. Name starts first, then by name. At most
 * `limit`. Under two letters: nothing (the screen shows its hint, not "no results").
 */
export function searchRoster(index: RosterIndex, query: string, limit = 20): PackGuest[] {
  const terms = fold(query).split(SPLIT).filter(Boolean);
  if (terms.join("").length < MIN_SEARCH) return [];
  const hits: { g: PackGuest; rank: number; name: string }[] = [];
  for (let i = 0; i < index.guests.length; i++) {
    const words = index.words[i];
    if (!terms.every((t) => words.some((w) => w.startsWith(t)))) continue;
    hits.push({ g: index.guests[i], rank: index.names[i].startsWith(terms[0]) ? 0 : 1, name: index.names[i] });
  }
  hits.sort((a, b) => a.rank - b.rank || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return hits.slice(0, limit).map((h) => h.g);
}

// ---------------------------------------------------------------- door counts (D4.7)

/**
 * "142 in, 3 waiting to sync": parties the server counts plus this phone's
 * queued check-ins for parties the pack does not already show as in. A
 * queued party is never added twice (two scans of one pass, or a party the
 * server already has).
 */
export function doorCounts(a: { serverIn: number | null; total: number | null; roster: readonly PackGuest[] | null; queuedGuestIds: readonly string[] }): { in: number; total: number | null; waiting: number } {
  const inPack = new Set((a.roster ?? []).filter((g) => g.checked_in_at).map((g) => g.id));
  const waitingIds = new Set(a.queuedGuestIds.filter((id) => !inPack.has(id)));
  const base = a.serverIn ?? inPack.size;
  return { in: base, total: a.total ?? (a.roster ? a.roster.length : null), waiting: waitingIds.size };
}
