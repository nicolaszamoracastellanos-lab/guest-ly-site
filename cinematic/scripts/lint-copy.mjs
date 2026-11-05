/* Copy conformance gate (Part 10): fails the build when an em dash or an
   emoji codepoint appears in copy.ts, and when an em dash appears anywhere
   in src/. Permitted symbols stay permitted: the diamond (U+2726), the
   checkmark (U+2713), the cross (U+2715) and ordinary typographic marks.
   Also lints the generated AI facts files (#48: llms.txt, llms-full.txt,
   es/llms.txt) in dist/ and their published copies at the repo root, when
   present, with the house rules in scripts/lib/copy-rules.mjs (dashes,
   emoji, exclamation, buzzwords, brand spelling).
   Usage: node scripts/lint-copy.mjs [--dist <dir>] */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyProblems } from './lib/copy-rules.mjs';

const cinematicDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(cinematicDir, 'src');
const distArg = process.argv.indexOf('--dist');
const distDir = distArg > 0 ? resolve(process.argv[distArg + 1]) : join(cinematicDir, 'dist');
const GENERATED = ['llms.txt', 'llms-full.txt', join('es', 'llms.txt')];

const EM_DASH = /[—―]/u;
/* Emoji: pictographs, symbols-and-pictographs planes, regional indicators,
   variation selector; the dingbat block only outside the permitted trio. */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}](?<!✦|✓|✕)/u;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

let failed = false;

for (const file of walk(srcDir)) {
  if (!/\.(ts|tsx|css)$/.test(file)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  const isCopy = file.endsWith('copy.ts');
  lines.forEach((line, i) => {
    if (EM_DASH.test(line)) {
      console.error(`EM DASH  ${file}:${i + 1}  ${line.trim().slice(0, 80)}`);
      failed = true;
    }
    if (isCopy && EMOJI.test(line)) {
      console.error(`EMOJI    ${file}:${i + 1}  ${line.trim().slice(0, 80)}`);
      failed = true;
    }
  });
}

/* Generated text files, in the build output and as published at the root. */
let generated = 0;
for (const dir of [distDir, join(cinematicDir, '..')]) {
  for (const name of GENERATED) {
    const file = join(dir, name);
    if (!existsSync(file)) continue;
    generated++;
    for (const p of copyProblems(readFileSync(file, 'utf8'))) {
      console.error(`COPY     ${file}  ${p}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('\ncopy lint FAILED');
  process.exit(1);
}
console.log(`copy lint clean: no em dashes in src, no emojis in copy.ts, ${generated} generated text file(s) clean`);
