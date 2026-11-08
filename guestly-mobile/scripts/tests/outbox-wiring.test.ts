// Run: node --experimental-strip-types scripts/tests/outbox-wiring.test.ts
// Who drains the outbox (#30, review round 3). outbox.test.ts runs replay()
// and settle() directly, so it cannot see a missing trigger: this file pins
// the wiring in the source. A planner's Mark done goes through the same
// outbox as the door, so the root layout drains for every signed-in couple
// or planner (launch, foreground, reconnect, and once a minute while status
// taps wait); a held tap (online, status route dark) says so without blaming
// the connection; a tap held past 12 hours is named once.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/ts-resolve.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.join(here, "../..", p), "utf8");
const { DAYOF_COPY } = await import("../../src/features/dayof/copy.ts");

let n = 0;
const t = (name: string, fn: () => void) => {
  try {
    fn();
    n++;
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
};

const layout = src("src/app/_layout.tsx");
const queue = src("src/lib/queue.ts");
const live = src("src/features/dayof/LiveDay.tsx");
const sync = src("src/features/dayof/PackSync.tsx");

/** The body of the effect that calls drainQueue in the root layout. */
function drainEffect(): string {
  const i = layout.indexOf("drainQueue()");
  assert.ok(i > 0, "the root layout drains the outbox");
  const start = layout.lastIndexOf("useEffect(", i);
  const end = layout.indexOf("}, [", i);
  return layout.slice(layout.lastIndexOf("\n", layout.lastIndexOf("const ", start)), layout.indexOf("\n", end));
}

t("the root drain runs for every signed-in user surface, planner included", () => {
  const body = drainEffect();
  const gate = /const (\w+) = (state\.status === "user"[^;]*);/.exec(body);
  assert.ok(gate, "the drain is gated on a user session");
  assert.ok(!/surface/.test(gate![2]), `not on one surface: ${gate![2]}`);
  assert.ok(new RegExp(`if \\(!${gate![1]}\\) return;`).test(body));
});

t("the root drain runs at launch, on foreground, on reconnect and on a one-minute check", () => {
  const body = drainEffect();
  assert.ok(/const drain = \(\) => void drainQueue\(\)/.test(body));
  assert.ok(/\n\s+drain\(\);/.test(body), "at once");
  assert.ok(/AppState\.addEventListener\("change"[\s\S]*?"active"\) drain\(\)/.test(body), "on foreground");
  assert.ok(/onlineManager\.subscribe\(\(online\) => \{\s*if \(online\) drain\(\)/.test(body), "on reconnect");
  assert.ok(/setInterval\([\s\S]*?timedDrainNeeded\([\s\S]*?if \(due\) drain\(\)[\s\S]*?60_000\)/.test(body), "while status taps wait");
  assert.ok(/clearInterval\(timer\)/.test(body) && /app\.remove\(\)/.test(body) && /net\(\)/.test(body), "cleaned up on sign out");
});

t("only the root layout and the door start a drain; PackSync only listens", () => {
  assert.ok(!/drainQueue\(/.test(sync), "PackSync never drains on its own (the root does)");
  assert.ok(/subscribeDrain\(/.test(sync));
});

t("a held tap is its own result, queued, and LiveDay does not blame the connection", () => {
  assert.ok(/kind: c === "held" \? "held" : "queued"/.test(queue));
  assert.ok(/r\.kind === "held" \? c\.markedDoneHeld/.test(live));
  assert.ok(/\(r\.kind === "queued" \|\| r\.kind === "held"\) && \(await cancelQueued/.test(live), "Undo takes a held tap back too");
  for (const lang of ["en", "es"] as const) {
    const c = DAYOF_COPY[lang];
    assert.ok(c.markedDoneHeld.includes("{title}"));
    assert.ok(!/connection|conexión/.test(c.markedDoneHeld), `${lang}: held is not a connection problem`);
    assert.ok(/connection|conexión/.test(c.markedDoneQueued), `${lang}: offline still says so`);
  }
});

t("taps held past the limit are named once by OutboxNotices, singular and plural", () => {
  assert.ok(/settle\(eligible, outcomes, Date\.now\(\)\)/.test(queue), "the drain gives settle a clock");
  assert.ok(/r\.expired\.length === 1 \? c\.expired : c\.expiredMany/.test(sync));
  for (const lang of ["en", "es"] as const) {
    const c = DAYOF_COPY[lang];
    assert.ok(c.expired.includes("{names}") && c.expiredMany.includes("{names}"));
  }
});

t("copy rules on the new strings", () => {
  for (const lang of ["en", "es"] as const) {
    const c = DAYOF_COPY[lang];
    for (const s of [c.markedDoneHeld, c.expired, c.expiredMany]) {
      assert.ok(!/[–—!]/.test(s), `${lang}: ${s}`);
      for (const sentence of s.split(/\.\s/)) assert.ok(sentence.split(/\s+/).length < 20, `${lang}: short sentences: ${sentence}`);
    }
  }
});

console.log(`outbox-wiring: ${n} checks passed`);
