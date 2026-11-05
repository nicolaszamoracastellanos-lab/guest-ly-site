// Optimistic runsheet writes under a faulty network (quality bar 5.2 and 5.3):
// the real runDelete and runLockToggle from src/features/runsheet/core.ts run
// against a fake list and a fake server that can refuse, hang or answer like
// an older portal. Every path ends with the screen equal to the server's truth,
// and Undo never re-creates a block under a new id.
// Run: node --no-warnings --experimental-strip-types scripts/tests/runsheet-rollback.test.ts

import assert from "node:assert/strict";
import { runDelete, runLockToggle, type DeleteEffects, type RunsheetLock } from "../../src/features/runsheet/core.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** A fake screen + server for one block id "b1". */
function world(opts: { knows: boolean; deleteFails?: boolean; restoreFails?: boolean; restorable?: boolean }) {
  const st = {
    shown: true,
    serverRows: new Set(["b1"]),
    sent: [] as string[],
    failures: [] as string[],
    learned: null as boolean | null,
    toast: null as null | { undo: () => void; onLeave?: () => void; open: boolean },
  };
  const fx: DeleteEffects = {
    hide: () => {
      st.shown = false;
    },
    show: () => {
      st.shown = true;
    },
    send: async () => {
      st.sent.push("DELETE");
      await tick();
      if (opts.deleteFails) throw Object.assign(new Error("offline"), { status: 0 });
      st.serverRows.delete("b1");
      return { deleted: true, ...(opts.restorable === undefined ? {} : { restorable: opts.restorable }) };
    },
    restore: async () => {
      st.sent.push("RESTORE");
      await tick();
      if (opts.restoreFails) throw Object.assign(new Error("500"), { status: 500 });
      st.serverRows.add("b1"); // the same id comes back
      return { restored: true };
    },
    toast: (undo, onLeave) => {
      st.toast = { undo, onLeave, open: true };
      return () => {
        if (st.toast) st.toast.open = false;
      };
    },
    failed: (what) => {
      st.failures.push(what);
    },
    settled: () => {},
    knowsRestore: () => opts.knows,
    learnRestore: (v) => {
      st.learned = v;
    },
  };
  const pressUndo = () => {
    const t = st.toast!;
    t.open = false;
    t.undo();
  };
  const leave = () => {
    const t = st.toast!;
    t.open = false;
    t.onLeave?.();
  };
  return { st, fx, pressUndo, leave };
}

await test("restoring portal: commit now, the row leaves at once, the server deletes", async () => {
  const w = world({ knows: true, restorable: true });
  const done = runDelete(w.fx);
  assert.equal(w.st.shown, false, "optimistic: gone before the answer");
  assert.equal(await done, "deleted");
  assert.deepEqual(w.st.sent, ["DELETE"]);
  assert.equal(w.st.serverRows.has("b1"), false);
  assert.equal(w.st.learned, true);
});

await test("restoring portal, network fault on DELETE: the row comes back and the failure is named", async () => {
  const w = world({ knows: true, deleteFails: true });
  const outcome = await runDelete(w.fx);
  assert.equal(outcome, "rolled_back");
  assert.equal(w.st.shown, true, "rollback shows the row again");
  assert.equal(w.st.serverRows.has("b1"), true, "screen equals server");
  assert.deepEqual(w.st.failures, ["delete"]);
  assert.equal(w.st.toast?.open, false, "the Undo toast is closed");
});

await test("restoring portal, Undo: the same id is restored (never re-created)", async () => {
  const w = world({ knows: true, restorable: true });
  const done = runDelete(w.fx);
  w.pressUndo();
  assert.equal(await done, "restored");
  assert.deepEqual(w.st.sent, ["DELETE", "RESTORE"]);
  assert.equal(w.st.shown, true);
  assert.equal(w.st.serverRows.has("b1"), true);
});

await test("restoring portal, Undo then the restore fails: the row leaves again and it says so", async () => {
  const w = world({ knows: true, restorable: true, restoreFails: true });
  const done = runDelete(w.fx);
  w.pressUndo();
  assert.equal(await done, "deleted");
  assert.equal(w.st.shown, false, "screen equals server: deleted");
  assert.equal(w.st.serverRows.has("b1"), false);
  assert.deepEqual(w.st.failures, ["restore"]);
});

await test("restoring portal, Undo pressed and the DELETE then refused: the row is back, no false failure", async () => {
  const w = world({ knows: true, deleteFails: true });
  const done = runDelete(w.fx);
  w.pressUndo();
  assert.equal(await done, "undone");
  assert.equal(w.st.shown, true);
  assert.deepEqual(w.st.failures, []);
  assert.ok(!w.st.sent.includes("RESTORE"));
});

await test("portal said restorable: false: Undo says it could not restore and sends nothing more", async () => {
  const w = world({ knows: true, restorable: false });
  const done = runDelete(w.fx);
  w.pressUndo();
  assert.equal(await done, "deleted");
  assert.deepEqual(w.st.sent, ["DELETE"], "no re-create, no restore");
  assert.deepEqual(w.st.failures, ["restore"]);
  assert.equal(w.st.shown, false);
});

await test("older portal (not known to restore): nothing is sent until the toast leaves", async () => {
  const w = world({ knows: false });
  const done = runDelete(w.fx);
  assert.equal(w.st.shown, false, "optimistic hide");
  await tick();
  assert.deepEqual(w.st.sent, [], "deferred: no DELETE while Undo is offered");
  w.leave();
  assert.equal(await done, "deleted");
  assert.deepEqual(w.st.sent, ["DELETE"]);
  assert.equal(w.st.serverRows.has("b1"), false);
  assert.equal(w.st.learned, false, "an answer without restorable teaches nothing");
});

await test("older portal, Undo: the row is back and the server never heard of it", async () => {
  const w = world({ knows: false });
  const done = runDelete(w.fx);
  w.pressUndo();
  assert.equal(await done, "undone");
  assert.deepEqual(w.st.sent, []);
  assert.equal(w.st.shown, true);
  assert.equal(w.st.serverRows.has("b1"), true);
});

await test("older portal, network fault on the deferred DELETE: rollback and the failure is named", async () => {
  const w = world({ knows: false, deleteFails: true });
  const done = runDelete(w.fx);
  w.leave();
  assert.equal(await done, "rolled_back");
  assert.equal(w.st.shown, true);
  assert.equal(w.st.serverRows.has("b1"), true);
  assert.deepEqual(w.st.failures, ["delete"]);
});

await test("older portal: Undo after the toast left changes nothing (one decision only)", async () => {
  const w = world({ knows: false });
  const done = runDelete(w.fx);
  w.leave();
  w.st.toast!.undo(); // a late tap
  assert.equal(await done, "deleted");
  assert.deepEqual(w.st.sent, ["DELETE"]);
});

await test("a deferred DELETE that answers restorable teaches the app the portal restores", async () => {
  const w = world({ knows: false, restorable: true });
  const done = runDelete(w.fx);
  w.leave();
  await done;
  assert.equal(w.st.learned, true);
});

// ------------------------------------------------------------------ lock

const LOCK: RunsheetLock = { locked: false, at: null, by_name: null, note: null, can_mark: false, can_request: false, can_resolve: true };

await test("lock: the new state shows first, then the server's lock replaces it", async () => {
  const applied: RunsheetLock[] = [];
  const server = { ...LOCK, locked: true, at: "2026-11-05T15:20:00Z", by_name: "Ana" };
  const res = await runLockToggle(LOCK, true, {
    apply: (l) => applied.push(l),
    send: async () => {
      assert.equal(applied.at(-1)?.locked, true, "optimistic before the answer");
      await tick();
      return { lock: server };
    },
  });
  assert.equal(res.ok, true);
  assert.deepEqual(applied.at(-1), server);
});

await test("lock: a network fault puts the previous lock back", async () => {
  const applied: RunsheetLock[] = [];
  const res = await runLockToggle(LOCK, true, {
    apply: (l) => applied.push(l),
    send: async () => {
      await tick();
      throw Object.assign(new Error("timeout"), { status: 0, code: "timeout" });
    },
  });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.draft, false);
  assert.deepEqual(applied.at(-1), LOCK, "rollback to exactly the previous lock");
});

await test("lock: a draft refusal rolls back and asks for Release and lock", async () => {
  const applied: RunsheetLock[] = [];
  const res = await runLockToggle(LOCK, true, {
    apply: (l) => applied.push(l),
    send: async () => {
      throw Object.assign(new Error("draft"), { status: 409, code: "bad_request", reason: "draft" });
    },
  });
  assert.equal(res.ok === false && res.draft, true);
  assert.deepEqual(applied.at(-1), LOCK);
});

await test("unlock: a 500 puts the lock back as it was (locked, with its stamp)", async () => {
  const locked = { ...LOCK, locked: true, at: "2026-11-05T15:20:00Z" };
  const applied: RunsheetLock[] = [];
  const res = await runLockToggle(locked, false, {
    apply: (l) => applied.push(l),
    send: async () => {
      throw Object.assign(new Error("500"), { status: 500 });
    },
  });
  assert.equal(res.ok, false);
  assert.equal(applied[0].locked, false, "optimistic unlock first");
  assert.deepEqual(applied.at(-1), locked);
});

console.log(`runsheet-rollback: ${passed} checks passed`);
