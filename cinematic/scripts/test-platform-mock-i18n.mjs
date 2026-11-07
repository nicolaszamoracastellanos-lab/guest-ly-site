/* The platform tour's vignettes (ui/MockScreens.tsx) are written in English and
   translated through platform-mock.es.ts, a dictionary keyed by the exact
   English string, which the Spanish page loads on demand. This renders the
   real component for every pane in both micro states, EN and ES, and fails
   when an ES pane still shows a string identical to its EN twin (outside
   names, numbers and glyphs), when a string carries an English-only word,
   or when the dictionary holds a key nothing renders (a typo that would leave
   English on screen). It also proves the check bites by planting a missing
   entry and English values.
   Pure: no network, no browser, no build. Usage: node scripts/test-platform-mock-i18n.mjs */

import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { copy } from '../src/copy.ts';
import MOCK_ES from '../src/platform-mock.es.ts';
import { CINEMATIC } from './lib/paths.mjs';

const server = await createServer({
  root: CINEMATIC,
  configFile: false,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true, hmr: false, ws: false },
  esbuild: { jsx: 'automatic' },
});
const errors = [];
try {
  const { MockScreen } = await server.ssrLoadModule('/src/ui/MockScreens.tsx');

  const texts = (html) =>
    html
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map((s) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim())
      .filter(Boolean);

  const NAMES = new Set(['Ana Torres']);
  /* Neutral strings: no letters (numbers, glyphs), the version tag, the language chip and sample guest names. */
  const NEUTRAL = (s) => !/\p{L}/u.test(s) || /^v\d+$/.test(s) || s === 'EN + ES' || NAMES.has(s);
  /* English words that never belong on an ES screen. */
  const EN_WORDS = /\b(the|of|and|is|there|at|for|until|you|you're|approve|paid|due|reply|phone|phones|emails|hidden|checked|party|history|nothing|written|venue|catering|florals|items|found|edit|edits|request|change|couple|awaiting|shuttle|leaves|free|guests|friendly|reminder|closes|recipients|questions|answered|rising|topics|gap|draft|live|import|review)\b/i;

  const ids = copy.en.platform.items.map((i) => i.id);
  const render = (tr, id, flipped) => texts(renderToStaticMarkup(createElement(MockScreen, { id, flipped, tr })));
  const identity = (x) => x;
  const trOf = (dict) => (x) => dict[x] ?? x;

  function problems(dict) {
    const out = [];
    const used = new Set();
    for (const id of ids) {
      for (const flipped of [false, true]) {
        const where = `${id}${flipped ? ' (after the tap)' : ''}`;
        const en = new Set(render((x) => (used.add(x), x), id, flipped));
        for (const s of render(trOf(dict), id, flipped)) {
          if (NEUTRAL(s)) continue;
          if (en.has(s)) out.push(`${where}: ES shows the EN string ${JSON.stringify(s)}`);
          else if (EN_WORDS.test(s)) out.push(`${where}: ES string has an English word: ${JSON.stringify(s)}`);
        }
      }
    }
    for (const k of Object.keys(dict)) if (!used.has(k)) out.push(`dictionary key nothing renders: ${JSON.stringify(k)}`);
    return out;
  }

  /* The seating vignette is drawn, it holds no text; every other pane renders text. */
  for (const id of ids.filter((i) => i !== 'seating')) {
    if (!render(identity, id, false).length) errors.push(`pane ${id} renders nothing`);
  }

  const today = problems(MOCK_ES);
  if (today.length) errors.push(`ES platform panes are not fully Spanish:\n  ${today.join('\n  ')}`);

  /* The check bites. */
  const plant = (label, edit, want) => {
    const m = { ...MOCK_ES };
    edit(m);
    const got = problems(m);
    if (!got.some((p) => p.includes(want))) errors.push(`${label}: expected a problem containing "${want}", got ${JSON.stringify(got)}`);
  };
  plant('a string with no entry', (m) => delete m['paid'], 'budget: ES shows the EN string "paid"');
  plant('a sample row with no entry', (m) => delete m['Is there parking at the venue?'], 'dashboard: ES shows');
  plant('English value inside an ES entry', (m) => (m['checked in'] = 'checked in'), 'checkin');
  plant('a drawer line with no entry after the tap', (m) => delete m['History: 3 questions answered'], 'guests (after the tap)');
  plant('a typo key', (m) => (m['grand totl'] = 'x'), 'dictionary key nothing renders');
} finally {
  await server.close();
}

if (errors.length) {
  console.error(`test-platform-mock-i18n FAILED:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('test-platform-mock-i18n ok: 8 panes x 2 states, EN and ES; every ES string is Spanish or neutral; 5 planted gaps caught');
