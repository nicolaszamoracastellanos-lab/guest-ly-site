/* House copy rules for generated text that people and AI engines read
   (llms.txt and friends): STUDY-quality-bar section 3, items 14 to 21, plus
   the brand spelling. Used by scripts/llms.mjs (fails the build) and
   scripts/lint-copy.mjs (lints the generated files in dist/ and the
   published copies at the repo root). No dependencies, so CI can run it
   without npm install. */

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
  { name: 'coming soon', re: /\bcoming soon\b|pr[oó]ximamente/iu },
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

function termRe(term) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'iu');
}
