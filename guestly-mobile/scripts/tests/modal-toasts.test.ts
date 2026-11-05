// Run: node --experimental-strip-types scripts/tests/modal-toasts.test.ts
// Error toasts must be seen (K17, review round 1). Two static rules on src/:
//  1. A route the Stack presents as a native modal covers the root ToastHost,
//     so the screen it renders mounts its own host (`<Screen modal>`) as soon
//     as it shows a toast. Every modal route is listed below with the file
//     that renders its Screen; a new modal route fails here until it is added.
//  2. A toast that reports a failure carries the warning mark: toastError, or
//     toast(..., { icon: "warning" }). A plain toast() shows the success check.

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const src = path.join(root, "src");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Comments blanked (line and block), strings kept: enough for these rules. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

// Route (folder of the _layout + screen name) to the file that renders its Screen.
const MODAL_ROUTES: Record<string, string> = {
  "src/app/assistant": "src/features/assistant/AssistantView.tsx",
  "src/app/web": "src/app/web.tsx",
  "src/app/home-setup": "src/features/couple/HomeQuiz.tsx",
  "src/app/couple/(tools)/requests/[id]": "src/app/couple/(tools)/requests/[id].tsx",
  "src/app/couple/(guests)/rsvps/record": "src/features/guests/RecordRsvp.tsx",
  "src/app/couple/(guests)/guests/[id]": "src/features/guests/GuestDetail.tsx",
  "src/app/couple/(guests)/guests/new": "src/app/couple/(guests)/guests/new.tsx",
  "src/app/couple/(guests)/guests/record": "src/features/guests/RecordRsvp.tsx",
};

const files = walk(src);

// Rule 1.
const found: string[] = [];
for (const f of files.filter((f) => path.basename(f) === "_layout.tsx")) {
  const s = code(readFileSync(f, "utf8"));
  for (const m of s.matchAll(/<Stack\.Screen\s+name="([^"]+)"\s+options=\{\{[^}]*presentation:\s*"modal"/g)) {
    found.push(path.relative(root, path.join(path.dirname(f), m[1])).split(path.sep).join("/"));
  }
}
assert.deepEqual([...found].sort(), Object.keys(MODAL_ROUTES).sort(), "every presentation \"modal\" route is listed in MODAL_ROUTES");

const toasts = (s: string) => /\btoast(Error)?\(/.test(s);
const screenModal = (s: string) => /<Screen\b(?:(?!<Screen\b)[\s\S]){0,800}?\bmodal\b/.test(s);
for (const [route, file] of Object.entries(MODAL_ROUTES)) {
  const s = code(read(file));
  if (toasts(s)) assert.ok(screenModal(s), `${route}: ${file} shows a toast, so its Screen needs the modal prop`);
}
assert.ok(screenModal(code(read("src/features/couple/HomeQuiz.tsx"))), "Home setup has its own toast host");
// The modal host takes the dock's rest line (no `base`): with base={insets.bottom}
// the toast sat on the guest card's docked buttons (simulator, review round 1).
assert.match(code(read("src/ui/index.tsx")), /\{modal \? <ToastHost modal \/> : null\}/, "Screen's modal host has no base override");

// Rule 2.
function calls(s: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\b${name}\\(`, "g");
  for (let m = re.exec(s); m; m = re.exec(s)) {
    let depth = 0;
    let i = m.index + name.length;
    for (; i < s.length; i++) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")" && --depth === 0) break;
    }
    out.push(s.slice(m.index, i + 1));
  }
  return out;
}
const bad: string[] = [];
for (const f of files) {
  if (f.endsWith(path.join("ui", "Toast.tsx"))) continue;
  const s = code(readFileSync(f, "utf8"));
  for (const call of calls(s, "toast")) {
    const first = call.slice("toast(".length).split(/,\s*\{/)[0];
    const failure = /\.(\w*(?:Failed|Error)|error|failed)\b/.test(first);
    if (failure && !/icon:\s*"warning"/.test(call)) bad.push(`${path.relative(root, f)}: ${call.replace(/\s+/g, " ").slice(0, 120)}`);
  }
}
assert.deepEqual(bad, [], `failure toasts without the warning mark (use toastError):\n${bad.join("\n")}`);

// The rule itself: a fixture of each kind.
const fixture = code(`toast(c.saveFailed); toast(c.saved); toast(copy.common.error, { icon: "warning" }); toast(errorText(err, lang, c.errors.pickFailed));`);
const flagged = calls(fixture, "toast").filter((c) => /\.(\w*(?:Failed|Error)|error|failed)\b/.test(c.slice(6).split(/,\s*\{/)[0]) && !/icon:\s*"warning"/.test(c));
assert.equal(flagged.length, 2, flagged.join(" | "));

console.log(`modal-toasts: ${found.length} modal routes, failure toasts all carry the warning mark`);
