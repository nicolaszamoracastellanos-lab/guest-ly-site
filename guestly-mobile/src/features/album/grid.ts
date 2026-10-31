// Pure helpers of the album: the grid's columns and tile size, the album
// answer the app reads, the request bodies it sends, and the upload queue's
// state changes. No React Native imports: scripts/tests/album.test.ts runs
// them on real portal answers (scripts/tests/fixtures/album-*.json).
//
// The contract is the portal's (hh/d-album-thankyou, src/lib/mobile/album.ts),
// checked end to end by the portal's scripts/test-mobile-album.mjs:
//   GET  /couple/album | /guest/album -> { album: { enabled, moderation,
//        share_with_guests, upload, see_all, link }, photos: [{ id, status,
//        width, height, caption, mine, from?, created_at, small, large }] }
//   POST the same path with { action: "upload_url" | "complete" | "moderate" | "settings", ... }

export type AlbumStatus = "pending" | "approved" | "hidden";

export type AlbumPhoto = {
  id: string;
  url_480: string;
  url_1200: string;
  width: number | null;
  height: number | null;
  mine: boolean;
  status: AlbumStatus;
  caption: string | null;
  guest_name: string | null;
  created_at: string | null;
};

/** 3 columns on a phone, 5 on a wide window (the Duo open, a tablet). */
export function gridColumns(width: number): number {
  if (width >= 900) return 6;
  if (width >= 600) return 5;
  return 3;
}

/** Square tiles that fill the row exactly with `gap` between them. */
export function tileSize(width: number, columns: number, gap: number, padding: number): number {
  const inner = Math.max(0, width - padding * 2 - gap * (columns - 1));
  return Math.max(1, Math.floor(inner / Math.max(1, columns)));
}

function abs(base: string, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${base.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}

const STATUSES = new Set<AlbumStatus>(["pending", "approved", "hidden"]);

/** One server item to the app's shape; null when it has no id or no picture.
 *  Reads small/large (the portal's album answer); url_480/url_1200 kept as a
 *  fallback. The uploader's name is `from` (couple answers only). */
export function normalizePhoto(raw: unknown, base: string): AlbumPhoto | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const small = typeof r.url_480 === "string" ? r.url_480 : typeof r.small === "string" ? r.small : null;
  const large = typeof r.url_1200 === "string" ? r.url_1200 : typeof r.large === "string" ? r.large : small;
  if (!id || !small || !large) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  return {
    id,
    url_480: abs(base, small),
    url_1200: abs(base, large),
    width: num(r.width),
    height: num(r.height),
    mine: r.mine === true,
    status: STATUSES.has(r.status as AlbumStatus) ? (r.status as AlbumStatus) : "approved",
    caption: typeof r.caption === "string" && r.caption ? r.caption : null,
    guest_name: typeof r.from === "string" && r.from ? r.from : typeof r.guest_name === "string" && r.guest_name ? r.guest_name : null,
    created_at: typeof r.created_at === "string" ? r.created_at : null,
  };
}

export function normalizePhotos(items: unknown, base: string): AlbumPhoto[] {
  return Array.isArray(items) ? items.map((i) => normalizePhoto(i, base)).filter((p): p is AlbumPhoto => !!p) : [];
}

// ---------------------------------------------------------------- album answer

export type AlbumModeration = "auto" | "review";
/** The album's switches as the couple sets them. */
export type AlbumSettings = { enabled: boolean; moderation: AlbumModeration; share_with_guests: boolean };
/** The switches plus what this caller may do: upload, see everyone's photos, the guests' link. */
export type AlbumInfo = AlbumSettings & { upload: boolean; see_all: boolean; link: string | null };
export type AlbumAnswer = { album: AlbumInfo; photos: AlbumPhoto[] };

/** The album object of a GET answer; missing fields read as closed and private. */
export function normalizeAlbumInfo(raw: unknown): AlbumInfo {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const enabled = r.enabled === true;
  return {
    enabled,
    moderation: r.moderation === "review" ? "review" : "auto",
    share_with_guests: r.share_with_guests !== false,
    upload: r.upload === true,
    see_all: r.see_all === true,
    link: typeof r.link === "string" && /^https?:\/\//i.test(r.link) ? r.link : null,
  };
}

/** One GET /couple/album or /guest/album answer to the app's shape. */
export function normalizeAlbumAnswer(raw: unknown, base: string): AlbumAnswer {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return { album: normalizeAlbumInfo(r.album), photos: normalizePhotos(r.photos, base) };
}

/** The couple's tabs read one list: the photos in one status, newest first as served. */
export function photosIn(photos: AlbumPhoto[], status: AlbumStatus): AlbumPhoto[] {
  return photos.filter((p) => p.status === status);
}

export function statusCounts(photos: AlbumPhoto[]): Record<AlbumStatus, number> {
  const out: Record<AlbumStatus, number> = { pending: 0, approved: 0, hidden: 0 };
  for (const p of photos) out[p.status] += 1;
  return out;
}

/** The POST bodies, one route per surface (/couple/album, /guest/album). */
export const albumBody = {
  uploadUrl: (bytes: number, lang?: "en" | "es") => ({ action: "upload_url" as const, content_type: "image/jpeg", bytes, ...(lang ? { lang } : {}) }),
  complete: (id: string) => ({ action: "complete" as const, id }),
  moderate: (ids: string[], status: AlbumStatus) => ({ action: "moderate" as const, ids, status }),
  settings: (album: Partial<AlbumSettings>) => ({ action: "settings" as const, album }),
};

/** The upload_url answer; null when it is not one. */
export function readUploadStart(raw: unknown): { id: string; upload_url: string; method: "PUT" } | null {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (typeof r.id !== "string" || typeof r.upload_url !== "string" || !/^https?:\/\//i.test(r.upload_url)) return null;
  return { id: r.id, upload_url: r.upload_url, method: "PUT" };
}

// ---------------------------------------------------------------- upload queue

export type UploadState = "queued" | "uploading" | "failed" | "done";
export type UploadEntry = {
  /** Our id, stable across restarts. */
  client_id: string;
  /** The resized copy kept in the app's documents until it is sent. */
  uri: string;
  bytes: number;
  state: UploadState;
  /** 0..1 while uploading. */
  progress: number;
  /** A code for the failure line (too_large, not_image, offline, failed). */
  error: string | null;
  attempts: number;
  created_at: number;
};

/** Long side of the picked photo after the resize (never enlarged). */
export const UPLOAD_MAX_SIDE = 2400;
export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/** The resize step: which side to set, or null when it is already small enough. */
export function resizeFor(width: number | null | undefined, height: number | null | undefined, max = UPLOAD_MAX_SIDE): { width: number } | { height: number } | null {
  const w = width ?? 0;
  const h = height ?? 0;
  if (w && h && Math.max(w, h) <= max) return null;
  return w && h && h > w ? { height: max } : { width: max };
}

/** A refusal the server will repeat: do not retry it on its own. */
export function isFinalError(code: string | null): boolean {
  return code === "too_large" || code === "not_image" || code === "forbidden" || code === "closed";
}

/** The next entry to send: the oldest queued one, or a failed one that can be
 *  retried, at most 5 attempts. */
export function nextToSend(q: UploadEntry[]): UploadEntry | null {
  const ready = q.filter((e) => e.state === "queued" || (e.state === "failed" && e.error === "offline" && e.attempts < 5));
  return ready.sort((a, b) => a.created_at - b.created_at)[0] ?? null;
}

export function patchEntry(q: UploadEntry[], id: string, patch: Partial<UploadEntry>): UploadEntry[] {
  return q.map((e) => (e.client_id === id ? { ...e, ...patch } : e));
}

/** The progress line: done of total for this batch (finished entries count). */
export function queueSummary(q: UploadEntry[]): { total: number; done: number; failed: number; active: boolean } {
  const total = q.length;
  const done = q.filter((e) => e.state === "done").length;
  const failed = q.filter((e) => e.state === "failed").length;
  return { total, done, failed, active: q.some((e) => e.state === "queued" || e.state === "uploading") };
}
