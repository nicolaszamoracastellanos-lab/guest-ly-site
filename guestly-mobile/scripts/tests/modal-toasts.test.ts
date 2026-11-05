// Run: node --experimental-strip-types scripts/tests/modal-toasts.test.ts
// Error toasts must be seen (K17, review round 1). Two static rules on src/:
//  1. A route the Stack presents as a native modal covers the root ToastHost,
//     so the screen it renders mounts its own host (`<Screen modal>`) as soon
//     as it shows a toast. Every modal route is listed below with the file
//     that renders its Screen; a new modal route fails here until it is added.
//  2. A toast that reports a failure carries the warning mark: toastError, or
//     toast(..., { icon: "warning" }). A plain toast() shows the success check.
//     A failure is known by its key name or by what the key says in the
//     dictionaries ("Could not ...", "No se pudo ...").
//  3. An error toast names what failed: failedText, never the API's sentence
//     alone (errorText, err.messages[lang]).

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
/** Every toast( or toastError( call, whole (balanced parentheses). */
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
/** The message: the call's first top-level argument. */
function firstArg(call: string): string {
  const open = call.indexOf("(");
  let depth = 0;
  let quote: string | null = null;
  for (let i = open + 1; i < call.length; i++) {
    const ch = call[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) {
      if (depth === 0) return call.slice(open + 1, i);
      depth--;
    } else if (ch === "," && depth === 0) return call.slice(open + 1, i);
  }
  return call.slice(open + 1);
}

// What a copy key says, from the typed dictionaries (src/i18n/en.ts and every
// feature copy.ts), so a failure is caught by its words, not only its name:
// `refusedToast` reads "Could not check in {names}." (review round 2).
const dictFiles = [path.join(src, "i18n", "en.ts"), ...files.filter((f) => path.basename(f) === "copy.ts")];
const said = new Map<string, string[]>();
for (const f of dictFiles) {
  for (const m of readFileSync(f, "utf8").matchAll(/^\s*(\w+):\s*"((?:[^"\\]|\\.)*)"/gm)) {
    said.set(m[1], [...(said.get(m[1]) ?? []), m[2]]);
  }
}
const FAILURE_NAME = /(fail|error|refus|denied|couldnot|notsaved)/i;
// Opening words only: "Reminders sent: 3. Failed: 1." is a result, not a failure.
const FAILURE_WORDS = /^(could not|couldn't|cannot|can't|nothing could|no se pud|no pudimos|\S+ failed\b|la \S+ falló\b)/i;
/** Why a toast message reads as a failure, or null. */
function failureIn(message: string, words: Map<string, string[]> = said): string | null {
  for (const m of message.matchAll(/\.(\w+)\b/g)) {
    if (FAILURE_NAME.test(m[1])) return `key ${m[1]}`;
    const hit = (words.get(m[1]) ?? []).find((v) => FAILURE_WORDS.test(v));
    if (hit) return `${m[1]} says "${hit}"`;
  }
  for (const m of message.matchAll(/"([^"]*)"/g)) if (FAILURE_WORDS.test(m[1])) return `"${m[1]}"`;
  return null;
}
/** The message text: inside fmt(...), only its template, not the values
 *  filled in (`failed: r.failed` is a count, not a failure). */
function messageOf(call: string): string {
  let m = firstArg(call).trim();
  while (/^fmt\(/.test(m)) m = firstArg(m).trim();
  return m;
}
const plainFailure = (call: string, words?: Map<string, string[]>) => (/icon:\s*"warning"/.test(call) ? null : failureIn(messageOf(call), words));

const bad: string[] = [];
for (const f of files) {
  if (f.endsWith(path.join("ui", "Toast.tsx"))) continue;
  const s = code(readFileSync(f, "utf8"));
  for (const call of calls(s, "toast")) {
    const why = plainFailure(call);
    if (why) bad.push(`${path.relative(root, f)}: ${call.replace(/\s+/g, " ").slice(0, 120)} (${why})`);
  }
}
assert.deepEqual(bad, [], `failure toasts without the warning mark (use toastError):\n${bad.join("\n")}`);

// The rule itself: a fixture of each kind, the door's refusal included.
const words = new Map([...said, ["fixtureDone", ["Guest added"]], ["fixtureNope", ["Could not save the guest."]]]);
const fixture = code(`toast(c.saveFailed); toast(c.saved); toast(copy.common.error, { icon: "warning" }); toast(errorText(err, lang, c.errors.pickFailed));
  toast(fmt(copy.checkin.refusedToast, { names: r.refused.join(", ") })); toast(fmt(copy.checkin.conflictToast, { names: r.already.join(", ") }), { icon: "info" });
  toast(c.fixtureNope); toast(c.fixtureDone); toast("Could not send."); toast(c.fixtureNope, { icon: "info" });`);
const flagged = calls(fixture, "toast").filter((c) => plainFailure(c, words));
assert.deepEqual(
  flagged.map((c) => c.slice(0, 40)),
  [
    "toast(c.saveFailed)",
    "toast(errorText(err, lang, c.errors.pick",
    "toast(fmt(copy.checkin.refusedToast, { n",
    "toast(c.fixtureNope)",
    'toast("Could not send.")',
    'toast(c.fixtureNope, { icon: "info" })',
  ],
);
assert.match(said.get("refusedToast")?.[0] ?? "", FAILURE_WORDS, "the door's refusal is read from en.ts");

// Rule 3. An error toast says what failed, then what to do (quality bar 4.5):
// failedText(<the screen's own sentence>, err, lang). The API's raw sentence
// alone (errorText, err.messages[lang]) names nothing, and offline it promises
// "We will retry", which no one-off write does. Files listed here are older
// than the rule (plain toast with the warning mark, not touched by Lane 8);
// their count may only go down, and a file at 0 leaves the list.
const RAW_ALLOWED: Record<string, number> = {
  "src/features/album/screens/CoupleAlbum.tsx": 2,
  "src/features/inbox/Conversation.tsx": 3,
  "src/features/settings/screens/General.tsx": 1,
  "src/features/settings/screens/Preferences.tsx": 1,
  "src/features/settings/screens/Profile.tsx": 2,
  "src/features/settings/team/TeamScreen.tsx": 3,
  "src/features/thankyou/screens/Note.tsx": 2,
};
const RAW = /\berrorText\(|\.messages\[/;
const raw: Record<string, number> = {};
const rawToastError: string[] = [];
for (const f of files) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  const s = code(readFileSync(f, "utf8"));
  for (const call of calls(s, "toastError")) if (RAW.test(call)) rawToastError.push(`${rel}: ${call.replace(/\s+/g, " ").slice(0, 120)}`);
  const n = calls(s, "toast").filter((c) => RAW.test(c)).length;
  if (n) raw[rel] = n;
}
assert.deepEqual(rawToastError, [], `toastError with the API's raw sentence (use failedText):\n${rawToastError.join("\n")}`);
assert.deepEqual(raw, RAW_ALLOWED, "raw-sentence toasts: none in new files, older files only go down (update RAW_ALLOWED when one is fixed)");
const rawFixture = code(`toastError(errorText(err, lang, x)); toastError((err instanceof ApiFailure && err.messages[lang]) || y); toastError(failedText(fail.saveGuest, err, lang));`);
assert.equal(calls(rawFixture, "toastError").filter((c) => RAW.test(c)).length, 2);

console.log(`modal-toasts: ${found.length} modal routes, failure toasts carry the warning mark, error toasts say what failed (${Object.values(raw).reduce((a, b) => a + b, 0)} older raw toasts held)`);
