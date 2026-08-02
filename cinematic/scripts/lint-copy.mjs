/* Copy conformance gate (Part 10): fails the build when an em dash or an
   emoji codepoint appears in copy.ts, and when an em dash appears anywhere
   in src/. Permitted symbols stay permitted: the diamond (U+2726), the
   checkmark (U+2713), the cross (U+2715) and ordinary typographic marks. */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

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

if (failed) {
  console.error('\ncopy lint FAILED');
  process.exit(1);
}
console.log('copy lint clean: no em dashes in src, no emojis in copy.ts');
