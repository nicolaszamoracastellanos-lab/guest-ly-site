// Tap target measurement for pass A8. Reads the accessibility hierarchy of
// the CURRENT screen through Maestro and lists every CANDIDATE control that
// is under 44 pt in either axis. The app must be in the foreground.
//
//   node scripts/part9/tap-targets.mjs --device S [--name C02-guests] [--min 44]
//
// Bounds are in points. iOS reports only what is on screen, so scroll and run
// again for long screens. hitSlop is invisible to the hierarchy: before
// filing a defect, check the component for hitSlop in code (plan A8).
// Output: a table on the console and .part9/tap-targets/<name>.json.

import path from "node:path";
import { spawnSync } from "node:child_process";
import { PART9, ROOT, parseArgs, udidOf, writeJson } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const udid = udidOf(args.device ?? "");
const min = Number(args.min ?? 44);
if (!udid) {
  console.error("usage: tap-targets.mjs --device <S|M|L|T|P|udid> [--name label] [--min 44]");
  process.exit(2);
}

const home = process.env.HOME ?? "";
const javaHome = "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home";
const r = spawnSync("maestro", ["--device", udid, "hierarchy"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, JAVA_HOME: javaHome, PATH: `${javaHome}/bin:${home}/.maestro/bin:${process.env.PATH}`, MAESTRO_CLI_NO_ANALYTICS: "1" },
});
const raw = r.stdout ?? "";
const start = raw.indexOf("{");
if (start < 0) {
  console.error("maestro hierarchy returned no JSON");
  process.exit(1);
}
const tree = JSON.parse(raw.slice(start));

// iOS gives no role or "clickable" flag through Maestro, only labels, ids and
// bounds. What separates a control from plain text in a React Native tree:
// plain text shows up TWICE with identical bounds (the paragraph and its inner
// text node), while a Pressable with a label is a single accessibility element.
// So: every labelled element that occurs once is a candidate control. Images
// with a label (the wordmark) are false positives; that is why the rule is
// "candidates, then check the code".
const all = [];
function walk(node) {
  const a = node.attributes ?? {};
  const m = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(a.bounds ?? "");
  const id = a["resource-id"] ?? "";
  const text = String(a.text || a.accessibilityText || "").trim();
  if (m && (id || text)) all.push({ id, text: text.slice(0, 48), x: Number(m[1]), y: Number(m[2]), w: Number(m[3]) - Number(m[1]), h: Number(m[4]) - Number(m[2]) });
  for (const c of node.children ?? []) walk(c);
}
walk(tree);

const key = (f) => `${f.text}|${f.x},${f.y},${f.w},${f.h}`;
const counts = new Map();
for (const f of all) counts.set(key(f), (counts.get(key(f)) ?? 0) + 1);
const ours = all
  .filter((f) => f.id || counts.get(key(f)) === 1)
  .filter((f) => f.w > 0 && f.h > 0 && (f.w < min || f.h < min))
  // System chrome and scroll indicators are not ours.
  .filter((f) => f.y > 24 && !/scroll bar|bars, signal|battery|Carrier|Wi-Fi/i.test(f.text))
  .filter((f, i, arr) => arr.findIndex((g) => key(g) === key(f)) === i);
const name = String(args.name ?? "screen");
writeJson(path.join(PART9, "tap-targets", `${name}.json`), { device: udid, min, measured_at: new Date().toISOString(), under_min: ours });
console.log(`${ours.length} elements under ${min} pt on ${name}`);
for (const f of ours) console.log(`  ${String(f.w).padStart(3)} x ${String(f.h).padEnd(3)}  ${f.id || "-"}  ${JSON.stringify(f.text)}`);
