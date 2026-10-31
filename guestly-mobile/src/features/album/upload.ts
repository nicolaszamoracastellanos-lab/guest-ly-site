// The guest's photo upload queue. A guest at the party with bad signal must
// not lose photos, so every picked photo is resized (2400 px long side, never
// enlarged), copied into the app's documents and written to a persisted queue
// before anything goes over the network. The queue then sends one photo at a
// time through the signed URL flow (POST upload-url, PUT the file with
// progress, POST done), keeps an entry on an offline failure (retried on the
// next drain) and marks a refusal the server will repeat (too large, not a
// photo) as final. Modeled on lib/queue (one promise chain for every
// read-modify-write, one drain at a time).

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Directory, File, Paths } from "expo-file-system";
import { post, ApiFailure } from "@/lib/api";
import { nextToSend, patchEntry, resizeFor, UPLOAD_MAX_BYTES, type UploadEntry } from "./grid";

let scope = "none";
let queue: UploadEntry[] = [];
let loaded = false;
let chain: Promise<unknown> = Promise.resolve();
let draining = false;
const listeners = new Set<() => void>();

const key = () => `gl.album.queue.${scope}`;
const emit = () => listeners.forEach((l) => l());

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function persist() {
  await AsyncStorage.setItem(key(), JSON.stringify(queue.filter((e) => e.state !== "done"))).catch(() => {});
}

async function update(fn: (q: UploadEntry[]) => UploadEntry[]) {
  await serial(async () => {
    queue = fn(queue);
    emit();
    await persist();
  });
}

/** Points the queue at the open guest (one queue per wedding and guest). */
export async function openAlbumQueue(nextScope: string): Promise<void> {
  if (loaded && nextScope === scope) return;
  await serial(async () => {
    scope = nextScope;
    try {
      const raw = await AsyncStorage.getItem(key());
      const parsed = raw ? (JSON.parse(raw) as UploadEntry[]) : [];
      // An upload cut by a restart starts again from the top.
      queue = Array.isArray(parsed) ? parsed.map((e) => (e.state === "uploading" ? { ...e, state: "queued" as const, progress: 0 } : e)) : [];
    } catch {
      queue = [];
    }
    loaded = true;
    emit();
  });
}

export function subscribeAlbumQueue(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getAlbumQueue(): UploadEntry[] {
  return queue;
}

function folder(): Directory {
  const d = new Directory(Paths.document, "album-queue");
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

export type PickResult = "added" | "cancelled" | "no_permission";

/** Opens the photo library (several at once), resizes each pick and queues it. */
export async function pickPhotos(): Promise<PickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return "no_permission";
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 20, quality: 0.85, base64: false, exif: false });
  if (res.canceled || !res.assets.length) return "cancelled";
  const dir = folder();
  const added: UploadEntry[] = [];
  for (const a of res.assets) {
    try {
      const ctx = ImageManipulator.manipulate(a.uri);
      const step = resizeFor(a.width, a.height);
      if (step) ctx.resize(step);
      const ref = await ctx.renderAsync();
      // Re-encoding drops the camera's EXIF (location included); the server strips it again.
      const out = await ref.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      const id = Crypto.randomUUID();
      const src = new File(out.uri);
      const kept = new File(dir, `${id}.jpg`);
      src.move(kept);
      added.push({ client_id: id, uri: kept.uri, bytes: kept.size ?? 0, state: "queued", progress: 0, error: null, attempts: 0, created_at: Date.now() });
    } catch {
      // An unreadable pick is skipped; the others still go.
    }
  }
  if (added.length) await update((q) => [...q, ...added]);
  void drainAlbumQueue();
  return "added";
}

function codeOf(err: unknown): string {
  if (err instanceof ApiFailure) {
    if (err.status === 0) return "offline";
    if (err.status === 413 || err.code === "too_large" || err.reason === "too_large") return "too_large";
    if (err.status === 415 || err.code === "not_image" || err.reason === "not_image") return "not_image";
    if (err.status === 403) return "forbidden";
    return "failed";
  }
  return "offline";
}

async function sendOne(e: UploadEntry): Promise<void> {
  await update((q) => patchEntry(q, e.client_id, { state: "uploading", progress: 0, error: null, attempts: e.attempts + 1 }));
  try {
    const file = new File(e.uri);
    if (!file.exists) throw new ApiFailure(400, { code: "not_image", message_en: "", message_es: "" });
    const bytes = file.size ?? e.bytes;
    if (bytes > UPLOAD_MAX_BYTES) throw new ApiFailure(413, { code: "too_large", message_en: "", message_es: "" });
    const start = await post<{ id: string; upload_url: string; headers?: Record<string, string> }>("/guest/album/upload-url", { content_type: "image/jpeg", bytes, client_id: e.client_id });
    let last = 0;
    const put = await file.upload(start.upload_url, {
      httpMethod: "PUT",
      headers: { "Content-Type": "image/jpeg", ...(start.headers ?? {}) },
      mimeType: "image/jpeg",
      sessionType: "foreground",
      onProgress: ({ bytesSent, totalBytes }) => {
        const p = totalBytes > 0 ? bytesSent / totalBytes : 0;
        // A redraw per 5 percent is enough for the ring.
        if (p - last >= 0.05 || p >= 1) {
          last = p;
          queue = patchEntry(queue, e.client_id, { progress: Math.min(0.98, p) });
          emit();
        }
      },
    });
    if (put.status < 200 || put.status >= 300) throw new ApiFailure(put.status, null);
    await post(`/guest/album/${encodeURIComponent(start.id)}/done`, {});
    try {
      file.delete();
    } catch {
      // the copy is in the app's own folder; a leftover is harmless
    }
    await update((q) => patchEntry(q, e.client_id, { state: "done", progress: 1 }));
  } catch (err) {
    await update((q) => patchEntry(q, e.client_id, { state: "failed", progress: 0, error: codeOf(err) }));
  }
}

/** Sends what is waiting, one photo at a time. Returns how many went. */
export async function drainAlbumQueue(onSent?: () => void): Promise<number> {
  if (draining || !loaded) return 0;
  draining = true;
  let sent = 0;
  try {
    for (let next = nextToSend(queue); next; next = nextToSend(queue)) {
      const before = next.attempts;
      await sendOne(next);
      const now = queue.find((x) => x.client_id === next!.client_id);
      if (now?.state === "done") {
        sent += 1;
        onSent?.();
      } else if (now?.error === "offline" && now.attempts > before) break; // no signal: stop, keep the rest
    }
  } finally {
    draining = false;
  }
  return sent;
}

/** Retry one failed photo now (the row's Try again). */
export async function retryUpload(id: string, onSent?: () => void) {
  await update((q) => patchEntry(q, id, { state: "queued", error: null, attempts: 0 }));
  await drainAlbumQueue(onSent);
}

/** Drop a photo from the list (a final refusal, or the guest changed their mind). */
export async function removeUpload(id: string) {
  const e = queue.find((x) => x.client_id === id);
  if (e) {
    try {
      const f = new File(e.uri);
      if (f.exists) f.delete();
    } catch {
      // nothing to clean
    }
  }
  await update((q) => q.filter((x) => x.client_id !== id));
}

/** Forget finished entries once the album shows them. */
export async function clearDone() {
  await update((q) => q.filter((x) => x.state !== "done"));
}
