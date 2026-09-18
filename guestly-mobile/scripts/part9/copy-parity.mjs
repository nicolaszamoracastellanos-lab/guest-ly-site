// Feature copy parity: for every src/features/*/copy.ts the English and the
// Spanish dictionaries must have the same key shape. tsc enforces it only
// where es is typed against en, and "as Record<string, string>" casts switch
// even that off, so this script compares the real objects.
//
//   node scripts/part9/copy-parity.mjs       exit 1 on any difference
//
// Uses the typescript package that is already a devDependency. No new deps.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { ROOT } from "./lib.mjs";

const require = createRequire(path.join(ROOT, "package.json"));
const ts = require("typescript");

function load(file) {
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  const stub = new Proxy(function () {}, { get: () => stub, apply: () => stub });
  vm.runInNewContext(js, { module, exports: module.exports, require: () => stub, console });
  return module.exports;
}

function findPair(exp) {
  for (const v of Object.values(exp)) if (v && typeof v === "object" && v.en && v.es) return v;
  if (exp.en && exp.es) return exp;
  return null;
}

function diff(a, b, at, out) {
  const ta = Array.isArray(a) ? "array" : typeof a;
  const tb = Array.isArray(b) ? "array" : typeof b;
  if (ta !== tb) return void out.push(`${at}: en is ${ta}, es is ${tb}`);
  if (ta === "array") {
    if (a.length !== b.length) out.push(`${at}: en has ${a.length} entries, es has ${b.length}`);
    a.forEach((x, i) => i < b.length && diff(x, b[i], `${at}[${i}]`, out));
  } else if (ta === "object" && a && b) {
    for (const k of Object.keys(a)) if (!(k in b)) out.push(`${at}.${k}: missing in es`);
    for (const k of Object.keys(b)) if (!(k in a)) out.push(`${at}.${k}: missing in en`);
    for (const k of Object.keys(a)) if (k in b) diff(a[k], b[k], `${at}.${k}`, out);
  } else if (ta === "string" && a.trim() && !b.trim()) out.push(`${at}: es is empty`);
}

const dir = path.join(ROOT, "src", "features");
const problems = [];
let checked = 0;
for (const f of fs.readdirSync(dir).sort()) {
  const file = path.join(dir, f, "copy.ts");
  if (!fs.existsSync(file)) continue;
  let pair = null;
  try {
    pair = findPair(load(file));
  } catch (err) {
    problems.push(`${f}/copy.ts: could not be evaluated (${String(err.message).slice(0, 80)})`);
    continue;
  }
  if (!pair) {
    problems.push(`${f}/copy.ts: no export with en and es found`);
    continue;
  }
  checked += 1;
  const out = [];
  diff(pair.en, pair.es, f, out);
  problems.push(...out);
}
console.log(`feature copy parity: ${checked} files checked, ${problems.length} problems`);
for (const p of problems) console.log(` - ${p}`);
process.exit(problems.length ? 1 : 0);
