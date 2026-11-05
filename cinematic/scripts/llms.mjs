/* #48: the AI facts files of guest-ly.com, generated at build time.
   Writes dist/llms.txt (EN), dist/es/llms.txt (ES) and dist/llms-full.txt
   (EN, with each feature's approved "say" lines) from the portal's
   docs/product/features.json, the one record of what Guest-ly can do. They
   describe features.json as of the last landing build: a portal release
   that changes a feature's status or marketing reaches these files only
   with the next landing deploy (STUDY-platform-ops ship checklist: the
   landing deploys after the release commit is on the deploy checkout).
   Within that, the build enforces:
   - a feature prints only when its status is "live", its marketing is "ok"
     and its rollout is for everyone; never building, hold, never, off;
   - "avoid" text never prints; a line holding a number the feature marks
     citable: false is dropped (if that is the name or the one-liner, the
     feature is left out and the build log says so);
   - prices and guest caps come from src/pricing.ts, the same source as the
     plan cards, and the build fails if they differ from features.json
     `derived` (the portal's billing-plans.ts);
   - the build fails on an em or en dash, emoji, exclamation, buzzword, the
     brand without its hyphen, or any feature's blocked term in the output.

   features.json is found from env GL_PORTAL_DIR, else the portal checkouts
   nested next to cinematic/ in this repo (guestly-portal-deploy, which is
   main, then guestly-portal), else the build stops and says what to set.
   A nested checkout (the deploy path) must hold features.json exactly as
   its origin/main has it: no uncommitted edit, no local-only commit. The
   build stops otherwise (portalCheckoutProblems). GL_PORTAL_DIR (lane and
   test builds on a feature branch) skips that check.

   Usage: node scripts/llms.mjs [outDir]   (default: cinematic/dist) */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copy } from '../src/copy.ts';
import {
  COORDINATOR_MONTHLY,
  COORDINATOR_ONCE,
  CURRENCY,
  MAINTENANCE_MONTHLY,
  MONTHS_INCLUDED,
  PLANS,
  guestsLabel,
} from '../src/pricing.ts';
import { APP_URL, IOS_APP_URL, LEGAL_ENTITY, SITE_URL } from '../src/site-facts.ts';
import { copyProblems } from './lib/copy-rules.mjs';
import { CINEMATIC, REPO_ROOT } from './lib/paths.mjs';

export const SLOGAN = { en: 'More wedding, less stress.', es: 'Más boda, menos estrés.' };
export const OUTPUTS = ['llms.txt', 'llms-full.txt', 'es/llms.txt'];
const SCHEMA = 'guestly-product-facts/1';
const FACTS_PATH = join('docs', 'product', 'features.json');
/* Nested portal checkouts next to cinematic/, in the order they are tried.
   guestly-portal-deploy is main (what production runs); guestly-portal is
   an older checkout that may not hold docs/product at all. */
export const PORTAL_FOLDERS = ['guestly-portal-deploy', 'guestly-portal'];

/* ---------- where features.json comes from ---------- */

export function findFeaturesJson({ env = process.env, repoRoot = REPO_ROOT } = {}) {
  if (env.GL_PORTAL_DIR) {
    const portalDir = resolve(env.GL_PORTAL_DIR);
    const file = join(portalDir, FACTS_PATH);
    if (existsSync(file)) return { file, portalDir };
    throw new Error(
      `GL_PORTAL_DIR is set to ${portalDir}, but ${file} does not exist. ` +
        'Point GL_PORTAL_DIR at a portal checkout (the folder that holds docs/product/features.json), ' +
        'or unset it to use the portal checkout next to cinematic/.',
    );
  }
  const tried = PORTAL_FOLDERS.map((name) => join(repoRoot, name, FACTS_PATH));
  const found = tried.findIndex((file) => existsSync(file));
  if (found >= 0) return { file: tried[found], portalDir: join(repoRoot, PORTAL_FOLDERS[found]) };
  throw new Error(
    "llms.txt is generated from the portal's docs/product/features.json, and none was found, so the build stops here. " +
      'Set GL_PORTAL_DIR to a portal checkout, for example: GL_PORTAL_DIR=/path/to/guestly-portal-deploy npm run build. ' +
      `Tried: ${tried.join(', ')}`,
  );
}

/* The deploy reads the nested checkout's working tree, which nothing fetches
   or cleans. Its features.json must equal origin/main's (as last fetched):
   no uncommitted edit and no commit that is not on origin/main. Returns
   problems as strings; empty means fine. */
export function portalCheckoutProblems(portalDir) {
  const git = (...args) => execFileSync('git', ['-C', portalDir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('rev-parse', '--is-inside-work-tree');
  } catch {
    return [`${portalDir} is not a git checkout, so the facts cannot be tied to the portal's main`];
  }
  const problems = [];
  if (git('status', '--porcelain', '--', FACTS_PATH))
    problems.push(`${join(portalDir, FACTS_PATH)} has uncommitted edits; commit or discard them before a landing build`);
  try {
    git('rev-parse', '--verify', '--quiet', 'origin/main');
  } catch {
    return [...problems, `${portalDir} has no origin/main; fetch it before a landing build`];
  }
  try {
    git('diff', '--quiet', 'origin/main', 'HEAD', '--', FACTS_PATH);
  } catch {
    problems.push(`${portalDir} HEAD has a features.json that origin/main does not; fast-forward or push that checkout first`);
  }
  return problems;
}

/* ---------- which features may be printed ---------- */

export function isPrintable(f) {
  return f.status === 'live' && f.marketing === 'ok' && !(f.rollout && f.rollout.mode);
}

/* Values the feature does not allow to be cited ("35" languages, etc.). */
function hiddenNumbers(f) {
  return (f.numbers ?? []).filter((n) => !n.citable).map((n) => String(n.value).trim()).filter(Boolean);
}
function citesHidden(text, hidden) {
  return hidden.some((v) => {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\d.,])${esc}(?![\\d])`).test(text);
  });
}

/* The printable features with the text each file may use, plus a note per
   feature or line left out. */
export function selectFeatures(facts) {
  const features = [];
  const skipped = [];
  for (const f of facts.features) {
    if (!isPrintable(f)) continue;
    const hidden = hiddenNumbers(f);
    const core = [f.name?.en, f.name?.es, f.oneliner?.en, f.oneliner?.es];
    if (core.some((t) => typeof t !== 'string' || !t.trim())) {
      skipped.push(`${f.id}: left out, its name or one-liner is missing in EN or ES`);
      continue;
    }
    if (core.some((t) => citesHidden(t, hidden))) {
      skipped.push(`${f.id}: left out, its name or one-liner cites a number marked citable: false (${hidden.join(', ')})`);
      continue;
    }
    const say = [];
    for (const line of f.say ?? []) {
      if (citesHidden(line, hidden)) skipped.push(`${f.id}: say line dropped, it cites a number marked citable: false: ${line}`);
      else say.push(line);
    }
    features.push({ ...f, say });
  }
  features.sort((a, b) => idNum(a.id) - idNum(b.id));
  return { features, skipped };
}
const idNum = (id) => Number(String(id).replace(/\D/g, '')) || 0;

/* ---------- prices: the page's source checked against the portal's ---------- */

export function priceProblems(facts) {
  const out = [];
  const derived = facts.derived ?? {};
  const dPlans = derived.plans ?? [];
  for (const [id, plan] of Object.entries(PLANS)) {
    const d = dPlans.find((p) => p.id === id);
    if (!d) out.push(`plan ${id} is in src/pricing.ts but not in features.json derived.plans`);
    else if (d.price_usd !== plan.price)
      out.push(`${plan.name}: src/pricing.ts says USD ${plan.price}, features.json derived says USD ${d.price_usd}`);
  }
  for (const d of dPlans) if (!PLANS[d.id]) out.push(`plan ${d.id} is in features.json derived.plans but not in src/pricing.ts`);
  const addon = derived.coordinator_addon;
  if (!addon) out.push('features.json derived.coordinator_addon is missing');
  else {
    if (addon.once_usd !== COORDINATOR_ONCE)
      out.push(`AI Coordinator once: src/pricing.ts says USD ${COORDINATOR_ONCE}, features.json derived says USD ${addon.once_usd}`);
    if (addon.monthly_usd !== COORDINATOR_MONTHLY)
      out.push(`AI Coordinator monthly: src/pricing.ts says USD ${COORDINATOR_MONTHLY}, features.json derived says USD ${addon.monthly_usd}`);
  }
  if (CURRENCY !== 'USD') out.push(`src/pricing.ts currency is ${CURRENCY}; the files say USD`);
  return out;
}

/* ---------- words ---------- */

const T = {
  en: {
    summary: (app) =>
      `Guest-ly is a wedding platform for couples and wedding planners, on the web${app ? ' and on iPhone' : ''}. One payment per wedding, in US dollars.`,
    scope: (asOf) => `This file lists only what is live in Guest-ly today and approved for public description. Facts as of ${asOf}.`,
    other: `Spanish version: ${SITE_URL}/es/llms.txt`,
    toFull: `Full version, with more detail per feature: ${SITE_URL}/llms-full.txt`,
    toShort: `Short version: ${SITE_URL}/llms.txt`,
    who: 'Who it is for',
    whoLines: {
      couple: 'Couples planning their wedding.',
      planner: 'Wedding planners.',
      agency: 'Wedding planning agencies that work as a team.',
      guest: 'The guests of those weddings.',
    },
    plans: 'Plans and prices',
    plansIntro: `One payment per wedding, in US dollars (USD). Each plan includes ${MONTHS_INCLUDED} months live; after that, a fee of USD ${MAINTENANCE_MONTHLY} per month keeps the website, RSVP and concierge running, only if the couple wants it.`,
    plan: (name, price, guests, coord) => `- ${name}: USD ${price}. ${guests}.${coord ? ' The AI Coordinator is included.' : ''}`,
    addon: (names) => `- AI Coordinator add-on for ${names}: USD ${COORDINATOR_ONCE} once, or USD ${COORDINATOR_MONTHLY} per month.`,
    order: `Plans and ordering: ${SITE_URL}/#pricing`,
    does: 'What it does',
    groups: { couple: 'For couples', planner: 'For planners', agency: 'For agencies', guest: 'For guests' },
    doesFor: (g) => `What it does ${g.toLowerCase()}`,
    where: 'Where',
    planNote: 'Plans',
    everyPlan: 'every plan',
    addonName: 'the AI Coordinator add-on',
    planWord: (n) => (n > 1 ? 'plans' : 'plan'),
    or: 'or',
    and: 'and',
    surfaces: {
      site: 'the wedding website',
      'web-guest': 'guest pages on the web',
      'web-couple': 'the couple portal on the web',
      'web-planner': 'the planner portal on the web',
      ios: 'the iPhone app',
      whatsapp: 'WhatsApp',
      email: 'email',
    },
    platforms: 'Platforms',
    web: `- Web: ${APP_URL}, in a browser on a phone or a computer.`,
    ios: `- iPhone app: ${IOS_APP_URL}`,
    languages: 'Languages',
    langLines: [
      '- Couples and planners use Guest-ly in English or Spanish.',
      `- ${SITE_URL} reads in English and Spanish at the same address; the language is chosen on the page.`,
    ],
    company: 'Company',
    entity: `- Guest-ly is operated by ${LEGAL_ENTITY}.`,
    contact: (email) => `- Contact: ${email}`,
    links: 'Links',
    linkList: (app) => [
      `- [Home](${SITE_URL}/)`,
      `- [Plans and prices](${SITE_URL}/#pricing)`,
      `- [Privacy](${SITE_URL}/privacy/)`,
      `- [Terms](${SITE_URL}/terms/)`,
      `- [Refunds](${SITE_URL}/refunds/)`,
      `- [Sign in for couples and planners](${APP_URL})`,
      ...(app ? [`- [iPhone app on the App Store](${IOS_APP_URL})`] : []),
    ],
  },
  es: {
    summary: (app) =>
      `Guest-ly es una plataforma de bodas para parejas y wedding planners, en la web${app ? ' y en iPhone' : ''}. Un solo pago por boda, en dólares estadounidenses.`,
    scope: (asOf) => `Este archivo enumera solo lo que está disponible hoy en Guest-ly y aprobado para describirse en público. Datos al ${asOf}.`,
    other: `Versión en inglés: ${SITE_URL}/llms.txt`,
    toFull: `Versión completa en inglés, con más detalle de cada función: ${SITE_URL}/llms-full.txt`,
    toShort: '',
    who: 'Para quién es',
    whoLines: {
      couple: 'Parejas que organizan su boda.',
      planner: 'Wedding planners.',
      agency: 'Agencias de wedding planners que trabajan en equipo.',
      guest: 'Los invitados de esas bodas.',
    },
    plans: 'Planes y precios',
    plansIntro: `Un solo pago por boda, en dólares estadounidenses (USD). Cada plan incluye ${MONTHS_INCLUDED} meses activos; después, una cuota de USD ${MAINTENANCE_MONTHLY} al mes mantiene activos el sitio, la confirmación y el asistente, solo si la pareja lo quiere.`,
    plan: (name, price, guests, coord) => `- ${name}: USD ${price}. ${guests}.${coord ? ' Incluye el Coordinador IA.' : ''}`,
    addon: (names) => `- Complemento Coordinador IA para ${names}: USD ${COORDINATOR_ONCE} una vez, o USD ${COORDINATOR_MONTHLY} al mes.`,
    order: `Planes y pedido: ${SITE_URL}/#pricing`,
    does: 'Qué hace',
    groups: { couple: 'Para parejas', planner: 'Para planners', agency: 'Para agencias', guest: 'Para invitados' },
    doesFor: (g) => `Qué hace ${g.toLowerCase()}`,
    where: 'Dónde',
    planNote: 'Planes',
    everyPlan: 'todos los planes',
    addonName: 'el complemento Coordinador IA',
    planWord: (n) => (n > 1 ? 'planes' : 'plan'),
    or: 'o',
    and: 'y',
    surfaces: {
      site: 'el sitio de la boda',
      'web-guest': 'las páginas para invitados en la web',
      'web-couple': 'el portal de la pareja en la web',
      'web-planner': 'el portal del planner en la web',
      ios: 'la app para iPhone',
      whatsapp: 'WhatsApp',
      email: 'el correo',
    },
    platforms: 'Plataformas',
    web: `- Web: ${APP_URL}, en el navegador de un teléfono o una computadora.`,
    ios: `- App para iPhone: ${IOS_APP_URL}`,
    languages: 'Idiomas',
    langLines: [
      '- Parejas y planners usan Guest-ly en español o en inglés.',
      `- ${SITE_URL} se lee en español y en inglés en la misma dirección; el idioma se elige en la página.`,
    ],
    company: 'Empresa',
    entity: `- Guest-ly es operado por ${LEGAL_ENTITY}.`,
    contact: (email) => `- Contacto: ${email}`,
    links: 'Enlaces',
    linkList: (app) => [
      `- [Inicio](${SITE_URL}/)`,
      `- [Planes y precios](${SITE_URL}/#pricing)`,
      `- [Privacidad](${SITE_URL}/privacy/)`,
      `- [Términos](${SITE_URL}/terms/)`,
      `- [Reembolsos](${SITE_URL}/refunds/)`,
      `- [Acceso para parejas y planners](${APP_URL})`,
      ...(app ? [`- [App para iPhone en la App Store](${IOS_APP_URL})`] : []),
    ],
  },
};

const GROUPS = ['couple', 'planner', 'agency', 'guest'];

function list(words, t) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} ${t.or} ${words[words.length - 1]}`;
}

/* "Grande plan or the AI Coordinator add-on"; null when on every plan. */
function planNote(plans, t) {
  if (!plans?.length || plans.includes('all')) return null;
  const named = plans.filter((p) => PLANS[p]).map((p) => PLANS[p].name);
  const parts = [];
  if (named.length) parts.push(`${list(named, t)} ${t.planWord(named.length)}`);
  if (plans.includes('addon')) parts.push(t.addonName);
  return parts.length ? list(parts, t) : null;
}

/* ---------- the files ---------- */

export function buildLlms(facts, { contactEmail = copy.en.footer.contact.email } = {}) {
  if (facts?.schema !== SCHEMA) throw new LlmsError([`features.json schema is ${facts?.schema}, expected ${SCHEMA}`]);
  const problems = priceProblems(facts);
  const { features, skipped } = selectFeatures(facts);
  if (features.some((f) => !isPrintable(f))) problems.push('a feature that is not live and marketing "ok" was selected');
  if (problems.length) throw new LlmsError(problems);

  const derived = facts.derived ?? {};
  const appLive = Boolean(derived.app?.live_version);
  const asOf = String(facts.generated_at ?? '').slice(0, 10) || 'unknown';
  /* The add-on line prints while something sold on the add-on is live. */
  const addonLive = facts.features.some((f) => f.status === 'live' && (f.plans ?? []).includes('addon'));
  const coordIncluded = (id) => Boolean((derived.plans ?? []).find((p) => p.id === id)?.coordinator_included);

  const files = {};
  for (const [file, lang, full] of [
    ['llms.txt', 'en', false],
    ['llms-full.txt', 'en', true],
    ['es/llms.txt', 'es', false],
  ]) {
    const t = T[lang];
    const L = [];
    const h2 = (s) => L.push('', `## ${s}`, '');
    L.push('# Guest-ly', '', `> ${t.summary(appLive)}`, '', t.scope(asOf), t.other, full ? t.toShort : t.toFull);

    const present = GROUPS.filter((g) => features.some((f) => f.audience?.[0] === g));
    h2(t.who);
    for (const g of present) L.push(`- ${t.whoLines[g]}`);

    h2(t.plans);
    L.push(t.plansIntro, '');
    for (const [id, plan] of Object.entries(PLANS)) L.push(t.plan(plan.name, plan.price, guestsLabel(id, lang), coordIncluded(id)));
    const addonFor = Object.keys(PLANS).filter((id) => !coordIncluded(id)).map((id) => PLANS[id].name);
    if (addonLive && addonFor.length) L.push(t.addon(list(addonFor, { ...t, or: t.and })));
    L.push('', t.order);

    if (!full) h2(t.does);
    for (const g of present) {
      const inGroup = features.filter((f) => f.audience?.[0] === g);
      if (full) {
        h2(t.doesFor(t.groups[g]));
        inGroup.forEach((f, i) => {
          if (i) L.push('');
          L.push(`### ${f.name[lang]}`, '', f.oneliner[lang], '');
          if (f.say.length) L.push(...f.say.map((s) => `- ${s}`), '');
          const where = (f.surface ?? []).map((s) => t.surfaces[s]).filter(Boolean);
          if (where.length) L.push(`${t.where}: ${where.join(', ')}.`, '');
          L.push(`${t.planNote}: ${planNote(f.plans, t) ?? t.everyPlan}.`);
        });
      } else {
        L.push(`### ${t.groups[g]}`, '');
        for (const f of inGroup) {
          const note = planNote(f.plans, t);
          L.push(`- ${f.name[lang]}: ${f.oneliner[lang]}${note ? ` (${note}.)` : ''}`);
        }
        L.push('');
      }
    }
    if (!full) L.pop();

    h2(t.platforms);
    L.push(t.web);
    if (appLive) L.push(t.ios);
    h2(t.languages);
    L.push(...t.langLines);
    h2(t.company);
    L.push(t.entity, t.contact(contactEmail));
    h2(t.links);
    L.push(...t.linkList(appLive));
    L.push('', SLOGAN[lang], '');
    files[file] = L.filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n');
  }

  /* Every feature's blocked terms, whatever its status: words for what
     Guest-ly does not do. */
  const blockedTerms = [...new Set(facts.features.flatMap((f) => f.blocked_terms ?? []))];
  const copyIssues = [];
  for (const [file, text] of Object.entries(files)) {
    for (const p of copyProblems(text, { blockedTerms })) copyIssues.push(`${file}: ${p}`);
  }
  if (copyIssues.length) throw new LlmsError(copyIssues);
  return { files, features, skipped };
}

export class LlmsError extends Error {
  constructor(problems) {
    super(`llms: ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    this.problems = problems;
  }
}

/* The portal says which App Store address it links; ours must match. */
export function storeUrlProblems(portalDir) {
  const routes = join(portalDir, 'src', 'lib', 'routes.ts');
  if (!existsSync(routes)) return [];
  const m = readFileSync(routes, 'utf8').match(/DEFAULT_IOS_STORE_URL\s*=\s*["'`]([^"'`]+)["'`]/);
  if (m && m[1] !== IOS_APP_URL)
    return [`src/site-facts.ts IOS_APP_URL is ${IOS_APP_URL}, the portal's DEFAULT_IOS_STORE_URL is ${m[1]}`];
  return [];
}

export function writeLlms(outDir, files) {
  for (const [name, text] of Object.entries(files)) {
    const target = join(outDir, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, 'utf8');
  }
}

/* ---------- CLI ---------- */

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = resolve(process.argv[2] || join(CINEMATIC, 'dist'));
  try {
    const { file, portalDir } = findFeaturesJson();
    if (!process.env.GL_PORTAL_DIR) {
      const checkout = portalCheckoutProblems(portalDir);
      if (checkout.length) throw new LlmsError(checkout);
    }
    const facts = JSON.parse(readFileSync(file, 'utf8'));
    const storeIssues = storeUrlProblems(portalDir);
    if (storeIssues.length) throw new LlmsError(storeIssues);
    const { files, features, skipped } = buildLlms(facts);
    writeLlms(outDir, files);
    console.log(`llms: read ${file} (facts ${facts.commit ?? '?'} of ${String(facts.generated_at ?? '').slice(0, 10)})`);
    for (const s of skipped) console.log(`llms: ${s}`);
    console.log(
      `llms: wrote ${Object.keys(files).join(', ')} in ${outDir} (${features.length} live features of ${facts.features.length})`,
    );
  } catch (e) {
    console.error(e instanceof LlmsError ? e.message : `llms: ${e.message}`);
    process.exit(1);
  }
}
