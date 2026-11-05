#!/usr/bin/env node
// The app craft gate (Master Wave L8, K17, Nov 5 2026). Pure node, no dependencies.
// The app's twin of the portal's scripts/craft-gate.mjs (STUDY-quality-bar 10.4 item 6).
//
// It walks src/ and counts the patterns that make a screen read as generated
// rather than built:
//
//   glyph            a Unicode glyph drawn as an icon (stars, check marks, arrows,
//                    dingbats, emoji). Use <Icon> from src/ui/Icon.tsx.
//   raw-hex          a hex colour in code outside src/ui/tokens.ts and src/widgets/
//                    (the widgets run in SwiftUI and cannot import the tokens).
//   spinner-screen   a spinner (<ActivityIndicator> or the kit's <Loading>) as the
//                    whole body of a screen. Show a Skeleton of the final layout.
//   pressable-a11y   a <Pressable> with neither accessibilityRole nor
//                    accessibilityLabel (nor accessible={false}, nor a {...spread}).
//   literal-in-t     a hard-coded string inside <T>: text comes from the EN/ES copy.
//   alert-error      a native Alert.alert that is not a choice. Native alerts stay
//                    only for a choice with a Cancel button (a destructive confirm
//                    Apple expects, a permission with Open Settings); an error or a
//                    notice goes to a toast (toastError / toast) or an inline error.
//   font-size        a fontSize under 11.
//   ivory25-text     colors.ivory25 used as a text colour (about 2:1 on night; the
//                    floor for text on night is ivory40).
//
// Ratchet: scripts/craft-gate.config.json holds a ceiling per pattern per file for
// what existed on Nov 5 2026. A file that is not listed has ceiling 0, so every new
// file is gated from its first line. A count over its ceiling fails; a ceiling over
// its count also fails until it is lowered (`--ratchet` lowers them), so a fixed
// file cannot slide back. Raising a ceiling is a hand edit with a reason in the
// commit, never --ratchet.
//
//   node scripts/craft-gate.mjs             gate src/ (exit 1 on a breach or a stale ceiling)
//   node scripts/craft-gate.mjs --verbose   list every hit
//   node scripts/craft-gate.mjs --json      machine-readable result
//   node scripts/craft-gate.mjs --ratchet   lower every ceiling to its count (never raises)
//
// scripts/tests/craft-gate.test.ts feeds fixtures to every pattern and runs the gate
// (it is part of `npm test`).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), "..");
const CONFIG_PATH = path.join(ROOT, "scripts", "craft-gate.config.json");

export const PATTERNS = ["glyph", "raw-hex", "spinner-screen", "pressable-a11y", "literal-in-t", "alert-error", "font-size", "ivory25-text"];

/* ---- source preparation ----------------------------------------------------------- */

/**
 * Blank out comments (code is kept, string contents are kept, every newline stays
 * where it was so line numbers hold). A small state machine: strings in ' " and `,
 * template holes ${ } nested inside backticks, line and block comments, and JSX
 * comments {/* *\/} (whose braces stay, harmless).
 */
export function stripComments(src) {
  const out = [];
  // Stack of contexts: "code" or "tpl" (inside a template literal). Code inside a
  // ${ } hole tracks its own brace depth so the closing } returns to the template.
  const stack = [{ kind: "code", depth: 0 }];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const top = stack[stack.length - 1];
    const c = src[i];
    const d = src[i + 1];
    if (top.kind === "tpl") {
      if (c === "\\") { out.push(c, d ?? ""); i += 2; continue; }
      if (c === "`") { out.push(c); stack.pop(); i++; continue; }
      if (c === "$" && d === "{") { out.push("${"); stack.push({ kind: "code", depth: 0 }); i += 2; continue; }
      out.push(c); i++; continue;
    }
    // code
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") { out.push(" "); i++; }
      continue;
    }
    if (c === "/" && d === "*") {
      out.push("  "); i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { out.push(src[i] === "\n" ? "\n" : " "); i++; }
      if (i < n) { out.push("  "); i += 2; }
      continue;
    }
    if (c === '"' || c === "'") {
      out.push(c); i++;
      while (i < n && src[i] !== c && src[i] !== "\n") {
        if (src[i] === "\\") { out.push(src[i], src[i + 1] ?? ""); i += 2; continue; }
        out.push(src[i]); i++;
      }
      if (i < n) { out.push(src[i]); i++; }
      continue;
    }
    if (c === "`") { out.push(c); stack.push({ kind: "tpl" }); i++; continue; }
    if (c === "{") { top.depth++; out.push(c); i++; continue; }
    if (c === "}") {
      if (top.depth === 0 && stack.length > 1) { stack.pop(); out.push(c); i++; continue; }
      top.depth--; out.push(c); i++; continue;
    }
    out.push(c); i++;
  }
  return out.join("");
}

const lineOf = (text, index) => {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
};
const snippet = (text, index) => {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? undefined : end).trim().slice(0, 140);
};

/**
 * The end of a JSX opening tag that starts at `start` (the "<"): the index of its
 * closing ">" (braces, strings and arrows inside attributes skipped), and whether
 * it self-closes. Null when the text is not a tag (a generic, a comparison).
 */
export function openingTag(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") { depth++; continue; }
    if (c === "}") { depth--; continue; }
    if (depth > 0) continue;
    if (c === ">") return { end: i, selfClosing: text[i - 1] === "/", attrs: text.slice(start, i + 1) };
    if (c === ";") return null;
  }
  return null;
}

/** The argument text of a call whose "(" is at `open`: up to the matching ")". */
function callArgs(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return text.slice(open + 1, i); }
  }
  return text.slice(open + 1);
}

/* ---- patterns ---------------------------------------------------------------------- */

// Glyphs drawn as icons: arrows, technical symbols, geometric shapes, dingbats and the
// emoji planes (the portal gate's set). Typographic marks (the middle dot, curly
// quotes, the ellipsis) are not in it.
const GLYPH = /[←-⯿✀-➿\u{1f300}-\u{1faff}]/u;
const GLYPH_ESCAPE = /\\u(?:2(?:19[0-9a-f]|1[a-f][0-9a-f]|[2-9ab][0-9a-f]{2})|\{1f[3-9a][0-9a-f]{2}\})/i;
const HEX = /["'`]#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})["'`]/;

const RAW_HEX_EXEMPT = ["src/ui/tokens.ts", "src/widgets/"];

function perLine(code, re, keep = () => true) {
  const hits = [];
  code.split("\n").forEach((line, i) => {
    if (re.test(line) && keep(line)) hits.push({ line: i + 1, text: line.trim().slice(0, 140) });
  });
  return hits;
}

/** Every pattern's hits in one file. `file` is relative to the app root (src/...). */
export function scanText(raw, file) {
  const code = stripComments(raw);
  const tsx = file.endsWith(".tsx");
  const hits = Object.fromEntries(PATTERNS.map((p) => [p, []]));
  const push = (p, index) => hits[p].push({ line: lineOf(code, index), text: snippet(code, index) });

  hits.glyph = perLine(code, GLYPH).concat(perLine(code, GLYPH_ESCAPE));

  if (!RAW_HEX_EXEMPT.some((p) => file === p || (p.endsWith("/") && file.startsWith(p)))) {
    hits["raw-hex"] = perLine(code, HEX);
  }

  hits["font-size"] = [];
  for (const m of code.matchAll(/fontSize\s*[:=]\s*\{?\s*(\d+(?:\.\d+)?)/g)) {
    if (Number(m[1]) < 11) push("font-size", m.index);
  }

  // colors.ivory25 as a text colour: a `color:` style key, or the color prop of <T>.
  for (const m of code.matchAll(/(?<![A-Za-z])color\s*:\s*[^,}\n]*colors\.ivory25\b/g)) push("ivory25-text", m.index);

  for (const m of code.matchAll(/\bAlert\.alert\s*\(/g)) {
    const args = callArgs(code, m.index + m[0].length - 1);
    if (!/style\s*:\s*["']cancel["']/.test(args)) push("alert-error", m.index);
  }

  if (tsx) {
    // JSX tags: walk every "<Name" once (not a generic such as useState<T>).
    for (const m of code.matchAll(/(?<![\w$.])<(Pressable|T|Screen)(?=[\s>/])/g)) {
      const tag = openingTag(code, m.index);
      if (!tag) continue;
      const name = m[1];
      if (name === "Pressable") {
        if (!/\baccessibilityRole\s*=|\baccessibilityLabel\s*=|\baccessible\s*=\s*\{\s*false\s*\}|\{\s*\.\.\.|\brole\s*=|\baria-label\s*=/.test(tag.attrs)) push("pressable-a11y", m.index);
      } else if (name === "T") {
        if (/\bcolor\s*=\s*\{[^}]*colors\.ivory25\b/.test(tag.attrs)) push("ivory25-text", m.index);
        if (tag.selfClosing) continue;
        const after = code.slice(tag.end + 1);
        const stop = after.search(/[<{]/);
        // An HTML entity (&amp; between two names) is a mark, not copy.
        const text = (stop === -1 ? after : after.slice(0, stop)).replace(/&[a-z]+;|&#\d+;/gi, "");
        if (/\p{L}/u.test(text)) { push("literal-in-t", m.index); continue; }
        if (stop !== -1 && after[stop] === "{") {
          const inner = after.slice(stop + 1).trimStart();
          const lit = inner.match(/^(["'])((?:\\.|(?!\1).)*)\1\s*\}/);
          if (lit && /\p{L}/u.test(lit[2])) { push("literal-in-t", m.index); continue; }
          const tpl = inner.match(/^`((?:\\.|[^`])*)`\s*\}/);
          if (tpl && /\p{L}{2}/u.test(tpl[1].replace(/\$\{[^}]*\}/g, ""))) push("literal-in-t", m.index);
        }
      } else if (name === "Screen" && !tag.selfClosing) {
        // The whole body is one spinner: <Screen ...> <Loading .../> </Screen>.
        const body = code.slice(tag.end + 1);
        if (/^\s*<(?:Loading|ActivityIndicator)\b[^<>]*\/>\s*<\/Screen>/.test(body)) push("spinner-screen", m.index);
      }
    }
    // A component that returns only a spinner.
    for (const m of code.matchAll(/\breturn\s*\(?\s*<(?:Loading|ActivityIndicator)\b[^<>]*\/>\s*\)?\s*;/g)) {
      if (!/function Loading\b/.test(code.slice(Math.max(0, m.index - 400), m.index))) push("spinner-screen", m.index);
    }
  }
  return hits;
}

/* ---- walk and gate ------------------------------------------------------------------ */

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

export function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

/** Count every pattern in every file under src/. */
export function measure(root = ROOT) {
  const counts = {}; // pattern -> file -> hits[]
  for (const p of PATTERNS) counts[p] = {};
  for (const abs of walk(path.join(root, "src"))) {
    const file = path.relative(root, abs).split(path.sep).join("/");
    const hits = scanText(fs.readFileSync(abs, "utf8"), file);
    for (const p of PATTERNS) if (hits[p].length) counts[p][file] = hits[p];
  }
  return counts;
}

/** Compare counts with the ceilings: breaches (over) and stale ceilings (under). */
export function judge(counts, config) {
  const over = [];
  const stale = [];
  for (const p of PATTERNS) {
    const ceilings = config.ceilings?.[p] ?? {};
    for (const [file, hits] of Object.entries(counts[p])) {
      const max = ceilings[file] ?? 0;
      if (hits.length > max) over.push({ pattern: p, file, count: hits.length, ceiling: max, hits });
    }
    for (const [file, max] of Object.entries(ceilings)) {
      const now = counts[p][file]?.length ?? 0;
      if (now < max) stale.push({ pattern: p, file, count: now, ceiling: max });
    }
  }
  return { over, stale };
}

function main(argv) {
  const verbose = argv.includes("--verbose");
  const json = argv.includes("--json");
  const ratchet = argv.includes("--ratchet");
  const config = loadConfig();
  const counts = measure();

  if (ratchet) {
    let lowered = 0;
    for (const p of PATTERNS) {
      const ceilings = config.ceilings[p] ?? {};
      for (const [file, max] of Object.entries(ceilings)) {
        const now = counts[p][file]?.length ?? 0;
        if (now < max) {
          lowered++;
          if (now === 0) delete ceilings[file];
          else ceilings[file] = now;
        }
      }
      config.ceilings[p] = Object.fromEntries(Object.entries(ceilings).sort(([a], [b]) => a.localeCompare(b)));
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
    console.log(`craft-gate: ${lowered} ceiling(s) lowered.`);
    return 0;
  }

  const { over, stale } = judge(counts, config);
  const totals = Object.fromEntries(PATTERNS.map((p) => [p, Object.values(counts[p]).reduce((s, h) => s + h.length, 0)]));
  if (json) {
    console.log(JSON.stringify({ totals, over, stale }, null, 2));
  } else {
    console.log("craft-gate (app): totals in src/ (ceilings in scripts/craft-gate.config.json)");
    for (const p of PATTERNS) console.log(`  ${p.padEnd(16)} ${String(totals[p]).padStart(4)}`);
    if (verbose) {
      for (const p of PATTERNS) for (const [file, hits] of Object.entries(counts[p])) for (const h of hits) console.log(`  [${p}] ${file}:${h.line}  ${h.text}`);
    }
    for (const o of over) {
      console.error(`FAIL ${o.pattern}: ${o.file} has ${o.count}, ceiling ${o.ceiling}`);
      for (const h of o.hits) console.error(`     ${o.file}:${h.line}  ${h.text}`);
    }
    for (const s of stale) console.error(`FAIL stale ceiling ${s.pattern}: ${s.file} is down to ${s.count} (ceiling ${s.ceiling}); run node scripts/craft-gate.mjs --ratchet`);
    if (!over.length && !stale.length) console.log("craft-gate (app): OK");
  }
  return over.length || stale.length ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exit(main(process.argv.slice(2)));
}
