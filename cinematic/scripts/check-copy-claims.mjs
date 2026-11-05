/* Claim guard for the page and its structured data (review round 1, Nov 5).
   Runs inside `npm run build` after prerender. Fails the build when:
   - any EN or ES string in src/copy.ts holds a blocked term of any feature
     in the portal's features.json (all statuses), a roadmap promise
     ("coming soon", "muy pronto", "on the roadmap") or a Zola sync claim
     (Guest-ly imports a Zola file; F24, F63);
   - a button label is generic ("Get started", "Continue", "Empezar") or
     carries a glyph arrow (quality bar items 1 and 19);
   - a string in either JSON-LD block of dist/index.html breaks any house
     copy rule (scripts/lib/copy-rules.mjs) or holds a blocked term: search
     and AI engines read those blocks as our own words.
   features.json is found the way scripts/llms.mjs finds it (GL_PORTAL_DIR,
   else the nested portal checkout).
   Usage: node scripts/check-copy-claims.mjs [distDir]   (default: cinematic/dist) */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claimProblems, copyProblems } from './lib/copy-rules.mjs';
import { CINEMATIC } from './lib/paths.mjs';

/* Keys whose string is a label on a button or a call-to-action link. */
const BUTTON_KEYS = new Set(['cta', 'primary', 'secondary', 'next', 'back', 'confirm', 'payCta', 'whatsapp', 'backHome', 'startOrder', 'microCta']);
const GENERIC = /^(get started|start|continue|continuar|empezar|submit|enviar|ok|click here|learn more|next|siguiente)$/i;
const ARROW = /[→←↗↘➔➜➝➞]/u;
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
      if (BUTTON_KEYS.has(key)) {
        if (GENERIC.test(s.trim())) out.push(`${path}: generic button label (use Verb + Noun): ${excerpt(s)}`);
        if (ARROW.test(s)) out.push(`${path}: glyph arrow in a button label: ${excerpt(s)}`);
      }
    }
  }
  ld.forEach((block, i) => {
    for (const [path, , s] of strings(block, `json-ld[${i}]`, '')) {
      for (const p of copyProblems(s, { blockedTerms })) out.push(`${path}: ${p.replace(/: line 1:.*$/, '')}: ${excerpt(s)}`);
    }
  });
  return out;
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
  if (ld.length !== 2) problems.push(`expected 2 JSON-LD blocks in dist/index.html, found ${ld.length}`);
  if (problems.length) {
    for (const p of problems) console.error(`check-copy-claims: ${p}`);
    console.error(`\ncheck-copy-claims FAILED: ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log(
    `check-copy-claims clean: EN and ES copy and ${ld.length} JSON-LD blocks, ${blockedTerms.length} blocked terms, no roadmap promise, no Zola sync claim, no generic or arrowed button`,
  );
}
