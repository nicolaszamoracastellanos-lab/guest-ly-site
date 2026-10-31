// Run: node --experimental-strip-types scripts/tests/album.test.ts
import assert from "node:assert/strict";
import { gridColumns, tileSize, normalizePhoto, normalizePhotos, resizeFor, nextToSend, patchEntry, queueSummary, isFinalError, type UploadEntry } from "../../src/features/album/grid.ts";
import { normalizeItems, progress, sortItems } from "../../src/features/thankyou/logic.ts";

// Grid: 3 on a phone, 5 on the Duo open, 6 on a wide tablet; tiles fill the row.
assert.equal(gridColumns(390), 3);
assert.equal(gridColumns(700), 5);
assert.equal(gridColumns(1000), 6);
const s = tileSize(390, 3, 3, 16);
assert.equal(s, Math.floor((390 - 32 - 6) / 3));
assert.ok(s * 3 + 6 <= 390 - 32);

// Photos: the mobile contract and the web album's field names, relative URLs made absolute.
const base = "https://app.guest-ly.com";
assert.deepEqual(normalizePhoto({ id: "p1", url_480: "https://cdn/x480.jpg", url_1200: "https://cdn/x1200.jpg", width: 800, height: 600, mine: true, status: "pending", guest_name: "Ana" }, base), {
  id: "p1", url_480: "https://cdn/x480.jpg", url_1200: "https://cdn/x1200.jpg", width: 800, height: 600, mine: true, status: "pending", caption: null, guest_name: "Ana", created_at: null,
});
const web = normalizePhoto({ id: "p2", small: "/api/album/s/photo/p2?s=480", large: "/api/album/s/photo/p2?s=1200", status: "weird" }, base);
assert.equal(web?.url_480, "https://app.guest-ly.com/api/album/s/photo/p2?s=480");
assert.equal(web?.status, "approved");
assert.equal(normalizePhoto({ id: "p3" }, base), null);
assert.equal(normalizePhotos("nope", base).length, 0);

// Resize: by the long side, never enlarged.
assert.deepEqual(resizeFor(4032, 3024), { width: 2400 });
assert.deepEqual(resizeFor(3024, 4032), { height: 2400 });
assert.equal(resizeFor(1200, 900), null);
assert.deepEqual(resizeFor(null, null), { width: 2400 });

// Queue: oldest queued first; offline failures retried, final refusals not.
const e = (id: string, state: UploadEntry["state"], t: number, error: string | null = null, attempts = 0): UploadEntry => ({ client_id: id, uri: `file:///${id}.jpg`, bytes: 1, state, progress: 0, error, attempts, created_at: t });
const q = [e("c", "queued", 3), e("a", "failed", 1, "too_large"), e("b", "failed", 2, "offline", 1), e("d", "done", 0)];
assert.equal(nextToSend(q)?.client_id, "b");
assert.equal(nextToSend([e("x", "failed", 1, "offline", 5)]), null);
assert.equal(isFinalError("too_large"), true);
assert.equal(isFinalError("offline"), false);
assert.equal(patchEntry(q, "c", { state: "uploading" })[0].state, "uploading");
assert.deepEqual(queueSummary(q), { total: 4, done: 1, failed: 2, active: true });

// Thank-you list.
const items = normalizeItems([
  { guest_id: "g1", party_names: "Zoe", table: 4, attended: true, draft: "Gracias", done: false },
  { guest_id: "g2", party_names: "Ana y Luis", table: null, attended: true, draft: "", done: true },
  { party_names: "no id" },
]);
assert.equal(items.length, 2);
assert.equal(items[0].table, "4");
assert.equal(items[1].draft, null);
assert.deepEqual(progress(items), { done: 1, total: 2 });
assert.deepEqual(sortItems(items, "all").map((i) => i.guest_id), ["g1", "g2"]);
assert.deepEqual(sortItems(items, "left").map((i) => i.guest_id), ["g1"]);

console.log("album and thank-you: ok");
