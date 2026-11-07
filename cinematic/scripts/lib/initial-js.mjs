/* The landing's initial JS: every script the home page loads before it can
   hydrate (module scripts and modulepreload links), gzip -9, in bytes.
   STUDY-quality-bar 7.4: 100 KB gzip or less, 1000-based (the "99 KB today"
   of the study is 99,231 B). check-seo.mjs fails a build over it, with the
   switches on or off, so a feature switch can never ship over budget. */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

export const INITIAL_JS_BUDGET = 100_000;

export function initialJs(dist, html = readFileSync(join(dist, 'index.html'), 'utf8')) {
  const files = new Set();
  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
    const module = /^<script\b/.test(tag) && /\btype="module"/.test(tag);
    const preload = /^<link\b/.test(tag) && /\brel="modulepreload"/.test(tag);
    const ref = /\b(?:src|href)="\/?(assets\/[^"]+\.js)"/.exec(tag)?.[1];
    if ((module || preload) && ref) files.add(ref);
  }
  let bytes = 0;
  const missing = [];
  for (const f of files) {
    const path = join(dist, f);
    if (!existsSync(path)) missing.push(f);
    else bytes += gzipSync(readFileSync(path), { level: 9 }).length;
  }
  return { bytes, files: [...files], missing };
}
