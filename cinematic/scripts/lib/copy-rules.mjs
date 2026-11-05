/* House copy rules for generated text that people and AI engines read
   (llms.txt and friends): STUDY-quality-bar section 3, items 14 to 21, plus
   the brand spelling and the Zola sync claim. Used by scripts/llms.mjs
   (fails the build), scripts/lint-copy.mjs (lints the generated files in
   dist/ and the published copies at the repo root) and
   scripts/check-copy-claims.mjs (claimProblems over every page string and
   the JSON-LD). No dependencies, so CI can run it without npm install. */

/* Roadmap promises (quality bar item 18), with the Spanish variants the
   page once used ("muy pronto", "llegan pronto", "plan de ruta"). */
const COMING_SOON = /\bcoming soon\b|pr[oó]ximamente|\bmuy pronto\b|\bllegan? pronto\b|\bon the roadmap\b|\bplan de ruta\b/iu;
/* Guest-ly imports a Zola file; it never syncs with Zola (features.json F24
   avoid line, F63 off). Catches the phrasings the exact blocked terms miss:
   "We sync with it" next to "Keep Zola", "sincroniza desde Zola",
   "Nos sincronizamos con él". Within one string or line. */
const ZOLA_SYNC = /\bsync(s|ed|ing)?\b.*\bZola\b|\bZola\b.*\bsync(s|ed|ing)?\b|sincroniz\p{L}*.*\bZola\b|\bZola\b.*sincroniz/iu;

/* The Founding Couples offer is gone for good (Nicolas, Nov 5 2026): its
   name, its code and its discount never come back in copy, JSON-LD or llms. */
const RETIRED_OFFER = /\bFOUNDING ?30\b|\bfounding (couples?|spots?|offer|price)\b|\bparejas? fundadoras?\b|\blugar(es)? fundador(es)?\b|\b30 ?% (off|de descuento)\b/iu;

const RULES = [
  { name: 'em dash', re: /[—―]/u },
  { name: 'en dash', re: /–/u },
  {
    name: 'emoji',
    re: /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2B00}-\u{2BFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]|\u{FE0F}/u,
  },
  { name: 'exclamation mark', re: /[!¡]/u },
  {
    name: 'buzzword',
    re: /\b(seamless(ly)?|effortless(ly)?|supercharge[sd]?|unlock(s|ed|ing)?|elevate[sd]?|magic(al)?|powerful|revolutioni[sz]e[sd]?|game-changer|delve)\b|sin esfuerzo|\bpotente\b|\bm[aá]gic[oa]s?\b|\bincre[ií]ble\b|\brevolucionar\b/iu,
  },
  { name: 'successfully', re: /\bsuccessfully\b|\bexitosamente\b|con [eé]xito/iu },
  { name: 'coming soon', re: COMING_SOON },
  { name: 'Zola sync claim', re: ZOLA_SYNC },
  { name: 'retired Founding Couples offer', re: RETIRED_OFFER },
  /* "Guest-ly" always with the hyphen; addresses (guest-ly.com) already have it. */
  { name: 'brand without the hyphen', re: /\bguest ?ly\b/iu },
];

/* Problems in one text, as "rule: line N: excerpt" strings. blockedTerms are
   matched whole-word and case-insensitive. */
export function copyProblems(text, { blockedTerms = [] } = {}) {
  const out = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const { name, re } of RULES) {
      if (re.test(line)) out.push(`${name}: line ${i + 1}: ${line.trim().slice(0, 100)}`);
    }
    for (const term of blockedTerms) {
      if (termRe(term).test(line)) out.push(`blocked term "${term}": line ${i + 1}: ${line.trim().slice(0, 100)}`);
    }
  });
  if (text.charCodeAt(0) === 0xfeff) out.push('byte order mark at the start of the file');
  return out;
}

/* Product claims only, for the page copy (src/copy.ts), where the demo
   chats legitimately hold an exclamation or a glyph: a blocked term of any
   feature, a roadmap promise, a Zola sync claim. */
export function claimProblems(text, { blockedTerms = [] } = {}) {
  const out = [];
  if (COMING_SOON.test(text)) out.push('roadmap promise');
  if (ZOLA_SYNC.test(text)) out.push('Zola sync claim (it is a file import)');
  if (RETIRED_OFFER.test(text)) out.push('retired Founding Couples offer');
  for (const term of blockedTerms) if (termRe(term).test(text)) out.push(`blocked term "${term}"`);
  return out;
}

function termRe(term) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'iu');
}
