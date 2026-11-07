/* Claim guard for the page and its structured data (review round 1, Nov 5).
   Runs inside `npm run build` after prerender. Fails the build when:
   - any EN or ES string in src/copy.ts holds a blocked term of any feature
     in the portal's features.json (all statuses), a roadmap promise
     ("coming soon", "muy pronto", "on the roadmap") or a Zola sync claim
     (Guest-ly imports a Zola file; F24, F63);
   - a button label is generic ("Get started", "Continue", "Empezar") or
     a button or link label carries a glyph arrow (quality bar items 1 and
     19); arrows are also caught where the TSX appends them at render time
     (any glyph arrow in a .tsx file under src, outside the portal mocks) and in the
     text of every <a> and <button> of the prerendered pages;
   - a string in either JSON-LD block of dist/index.html breaks any house
     copy rule (scripts/lib/copy-rules.mjs) or holds a blocked term: search
     and AI engines read those blocks as our own words.
   features.json is found the way scripts/llms.mjs finds it (GL_PORTAL_DIR,
   else the nested portal checkout).
   Usage: node scripts/check-copy-claims.mjs [distDir]   (default: cinematic/dist) */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claimProblems, copyProblems } from './lib/copy-rules.mjs';
import { CINEMATIC } from './lib/paths.mjs';

/* Keys whose string is a label on a button or a call-to-action link. */
const BUTTON_KEYS = new Set([
  'cta', 'primary', 'secondary', 'next', 'back', 'confirm', 'payCta', 'whatsapp', 'backHome', 'startOrder', 'microCta',
  /* #22 booking dialog and #50 guides form */
  'submit', 'retry', 'another', 'addToCalendar', 'manage', 'backToSite', 'changeTime', 'changeZone', 'nextOpen',
]);
const GENERIC = /^(get started|start|continue|continuar|empezar|submit|enviar|ok|click here|learn more|next|siguiente)$/i;
const ARROW = /[→←↗↘➔➜➝➞]/u;
/* Link labels: an arrow is checked here too (a link is a call to action). */
const isLinkKey = (k) => k === 'label' || /Link$/.test(k);
/* The portal mocks show a change as data ("table 7 → 4"), inside a span,
   never on a control. Every other TSX file may hold no glyph arrow. */
const TSX_ARROW_OK = new Set(['src/ui/MockScreens.tsx']);
/* Not words a person reads: identifiers and addresses. */
const SKIP_KEYS = new Set(['id', 'href', 'email', '@context', '@type', 'url', 'priceCurrency']);

function* strings(node, path, key) {
  if (typeof node === 'string') yield [path, key, node];
  else if (Array.isArray(node)) for (const [i, v] of node.entries()) yield* strings(v, `${path}[${i}]`, key);
  else if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node)) if (!SKIP_KEYS.has(k)) yield* strings(v, `${path}.${k}`, k);
}

/* Problems in the copy object (both languages) and the parsed JSON-LD
   blocks, as "where: problem: excerpt" strings. */
export function copyClaimProblems({ copy, ld = [], blockedTerms = [] }) {
  const out = [];
  const excerpt = (s) => JSON.stringify(s.length > 90 ? `${s.slice(0, 90)}...` : s);
  for (const loc of Object.keys(copy)) {
    for (const [path, key, s] of strings(copy[loc], loc, '')) {
      for (const p of claimProblems(s, { blockedTerms })) out.push(`${path}: ${p}: ${excerpt(s)}`);
      if (BUTTON_KEYS.has(key) && GENERIC.test(s.trim())) out.push(`${path}: generic button label (use Verb + Noun): ${excerpt(s)}`);
      if ((BUTTON_KEYS.has(key) || isLinkKey(key)) && ARROW.test(s)) out.push(`${path}: glyph arrow in a button or link label: ${excerpt(s)}`);
    }
  }
  ld.forEach((block, i) => {
    for (const [path, , s] of strings(block, `json-ld[${i}]`, '')) {
      for (const p of copyProblems(s, { blockedTerms })) out.push(`${path}: ${p.replace(/: line 1:.*$/, '')}: ${excerpt(s)}`);
    }
  });
  return out;
}

/* The #22, #50 and Reviews dictionaries (src/booking, src/guides, src/reviews, src/privacy-extra.ts)
   are our own chrome with no demo chat in them, so every house rule applies
   (dashes, emoji, exclamation, buzzwords, brand spelling), plus the claim and
   button checks. dicts: { name: { en, es } }. */
export function featureCopyProblems(dicts, { blockedTerms = [] } = {}) {
  const out = [];
  const excerpt = (s) => JSON.stringify(s.length > 90 ? `${s.slice(0, 90)}...` : s);
  for (const [name, byLang] of Object.entries(dicts)) {
    for (const loc of ['en', 'es']) {
      if (!byLang[loc]) {
        out.push(`${name}: no ${loc} copy`);
        continue;
      }
      for (const [path, key, s] of strings(byLang[loc], `${name}.${loc}`, '')) {
        for (const p of copyProblems(s, { blockedTerms })) out.push(`${path}: ${p.replace(/: line 1:.*$/, '')}: ${excerpt(s)}`);
        if (BUTTON_KEYS.has(key) && GENERIC.test(s.trim())) out.push(`${path}: generic button label (use Verb + Noun): ${excerpt(s)}`);
        if ((BUTTON_KEYS.has(key) || isLinkKey(key)) && ARROW.test(s)) out.push(`${path}: glyph arrow in a button or link label: ${excerpt(s)}`);
      }
    }
  }
  return out;
}

export async function featureDicts() {
  const { bookingCopy } = await import('../src/booking/copy.ts');
  const { bookCtaCopy } = await import('../src/booking/cta-copy.ts');
  const { guidesCopy } = await import('../src/guides/copy.ts');
  const { guidesHeadCopy } = await import('../src/guides/head-copy.ts');
  const { bookingPrivacyCopy, guidesPrivacyCopy } = await import('../src/privacy-extra.ts');
  const { reviewsCopy } = await import('../src/reviews/copy.ts');
  const { reviewsNavCopy } = await import('../src/reviews/head-copy.ts');
  return { bookingCopy, bookCtaCopy, guidesCopy, guidesHeadCopy, bookingPrivacyCopy, guidesPrivacyCopy, reviewsCopy, reviewsNavCopy };
}

/* Glyph arrows the TSX writes itself, e.g. {`${label} →`}. files: [relPath, text]. */
export function tsxArrowProblems(files) {
  const out = [];
  for (const [rel, text] of files) {
    if (TSX_ARROW_OK.has(rel)) continue;
    text.split('\n').forEach((line, i) => {
      if (ARROW.test(line)) out.push(`${rel}:${i + 1}: glyph arrow in the markup (drop it or use an aria-hidden SVG): ${line.trim().slice(0, 90)}`);
    });
  }
  return out;
}

/* Glyph arrows in the text of any link or button of a built page. */
export function htmlControlArrowProblems(html, where) {
  const out = [];
  for (const m of html.matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const text = m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (ARROW.test(text)) out.push(`${where}: glyph arrow in a <${m[1]}>: ${JSON.stringify(text.slice(0, 90))}`);
  }
  return out;
}

function tsxFiles(dir, root = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return tsxFiles(p, root);
    return e.name.endsWith('.tsx') ? [[relative(root, p).split('\\').join('/'), readFileSync(p, 'utf8')]] : [];
  });
}

export function ldBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

/* ---------- CLI ---------- */

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] || join(CINEMATIC, 'dist'));
  const { copy } = await import('../src/copy.ts');
  const { findFeaturesJson } = await import('./llms.mjs');
  let facts;
  try {
    facts = JSON.parse(readFileSync(findFeaturesJson().file, 'utf8'));
  } catch (e) {
    console.error(`check-copy-claims: ${e.message}`);
    process.exit(1);
  }
  const blockedTerms = [...new Set(facts.features.flatMap((f) => f.blocked_terms ?? []))];
  const index = join(dist, 'index.html');
  if (!existsSync(index)) {
    console.error(`check-copy-claims: ${index} missing; run the build first`);
    process.exit(1);
  }
  const ld = ldBlocks(readFileSync(index, 'utf8'));
  const problems = copyClaimProblems({ copy, ld, blockedTerms });
  const dicts = await featureDicts();
  problems.push(...featureCopyProblems(dicts, { blockedTerms }));
  if (ld.length !== 2) problems.push(`expected 2 JSON-LD blocks in dist/index.html, found ${ld.length}`);
  const pages = ['index.html', 'privacy/index.html', 'terms/index.html', 'refunds/index.html'].filter((f) => existsSync(join(dist, f)));
  for (const f of pages) problems.push(...htmlControlArrowProblems(readFileSync(join(dist, f), 'utf8'), `dist/${f}`));
  problems.push(...tsxArrowProblems(tsxFiles(join(CINEMATIC, 'src'), CINEMATIC)));
  if (problems.length) {
    for (const p of problems) console.error(`check-copy-claims: ${p}`);
    console.error(`\ncheck-copy-claims FAILED: ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log(
    `check-copy-claims clean: EN and ES copy and ${ld.length} JSON-LD blocks, ${blockedTerms.length} blocked terms, no roadmap promise, no Zola sync claim, no generic button, no glyph arrow on a button or link (copy, TSX, ${pages.length} built pages); ${Object.keys(dicts).length} dictionaries (booking, guides, reviews) under every house rule`,
  );
}
