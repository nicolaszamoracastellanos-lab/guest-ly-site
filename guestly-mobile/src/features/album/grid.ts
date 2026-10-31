// Pure helpers of the album: the grid's columns and tile size, the photo
// shape the app reads (tolerant of the D2 web field names), and the upload
// queue's state changes. No React Native imports: scripts/tests/album.test.ts.

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
 *  Reads url_480/url_1200 (mobile contract) or small/large (the web album). */
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
    guest_name: typeof r.guest_name === "string" && r.guest_name ? r.guest_name : null,
    created_at: typeof r.created_at === "string" ? r.created_at : null,
  };
}

export function normalizePhotos(items: unknown, base: string): AlbumPhoto[] {
  return Array.isArray(items) ? items.map((i) => normalizePhoto(i, base)).filter((p): p is AlbumPhoto => !!p) : [];
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
