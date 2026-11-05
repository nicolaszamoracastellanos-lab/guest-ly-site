/* #48 test: the AI facts files say only what features.json allows.
   - A fixture with every status and marketing value prints only live + ok.
   - The real features.json (GL_PORTAL_DIR, else the portal next to
     cinematic/) prints only live + ok, none of its building features, and
     its plan lines equal src/pricing.ts and the visible caps.
   - One live + ok feature set to "hold" in a scratch copy disappears from
     all three files on rebuild (the CLI, end to end).
   - The generator fails on an em dash, en dash, exclamation, blocked term,
     price drift and a wrong schema; a non-citable number line is dropped.
   - Where features.json comes from, and the two failure messages.
   - lint-copy passes on the generated files and fails on a planted dash.
   - Staged like the deploy: stage-site.sh exits 0 and a static server
     answers 200, text/plain; charset=utf-8, with the bytes of dist and the
     accents intact. Needs a built dist/ (npm run build first).
   Usage: node scripts/test-llms.mjs */

import { spawnSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copy } from '../src/copy.ts';
import { PLANS, guestsLabel } from '../src/pricing.ts';
import { CINEMATIC, REPO_ROOT } from './lib/paths.mjs';
import { LlmsError, OUTPUTS, SLOGAN, buildLlms, findFeaturesJson, isPrintable, storeUrlProblems } from './llms.mjs';

const errors = [];
const check = (ok, msg) => {
  if (!ok) errors.push(msg);
};
const tmp = mkdtempSync(join(tmpdir(), 'gl-llms-'));
const all = (files) => Object.values(files).join('\n');

/* ---------- fixture ---------- */

const feature = (id, status, marketing, extra = {}) => ({
  id,
  slug: `f-${id}`,
  name: { en: `Name ${id}`, es: `Nombre ${id}` },
  oneliner: { en: `Does thing ${id}.`, es: `Hace cosa ${id}.` },
  surface: ['web-couple'],
  audience: ['couple'],
  status,
  plans: ['all'],
  changes: [],
  rollout: { flag: '', mode: '', note: '' },
  marketing,
  say: [`Say ${id}.`],
  avoid: [`Avoid text ${id}.`],
  blocked_terms: [],
  numbers: [],
  ...extra,
});
const fixture = () => ({
  schema: 'guestly-product-facts/1',
  generated_at: '2026-11-05T00:00:00Z',
  derived: {
    plans: Object.entries(PLANS).map(([id, p]) => ({ id, name: p.name, price_usd: p.price, coordinator_included: id === 'grande' })),
    coordinator_addon: { once_usd: 79, monthly_usd: 19 },
    app: { live_version: '1.2.0' },
  },
  features: [
    feature('F1', 'live', 'ok'),
    feature('F2', 'live', 'hold'),
    feature('F3', 'building', 'hold'),
    feature('F4', 'building', 'ok'),
    feature('F5', 'planned', 'never'),
    feature('F6', 'off', 'never', { blocked_terms: ['two-way sync'] }),
    feature('F7', 'live', 'never'),
    feature('F8', 'live', 'ok', { rollout: { flag: '', mode: 'allowlist', note: 'one planner' } }),
    feature('F9', 'live', 'ok', {
      audience: ['planner'],
      plans: ['grande', 'addon'],
      oneliner: { en: 'Answers in 30+ languages.', es: 'Responde en 30+ idiomas.' },
      say: ['Reads 35 languages on the site.', 'Understands 30+ languages.'],
      numbers: [
        { value: '35', what: 'site languages', citable: false },
        { value: '30+', what: 'languages', citable: true },
      ],
    }),
    feature('F10', 'live', 'ok', {
      audience: ['guest'],
      oneliner: { en: 'Pages in 35 languages.', es: 'Páginas en 35 idiomas.' },
      numbers: [{ value: '35', what: 'site languages', citable: false }],
    }),
    feature('F11', 'beta', 'ok'),
  ],
});

{
  const { files, features, skipped } = buildLlms(fixture());
  check(JSON.stringify(Object.keys(files)) === JSON.stringify(OUTPUTS), `outputs are ${Object.keys(files)}`);
  check(JSON.stringify(features.map((f) => f.id)) === '["F1","F9"]', `fixture selects ${features.map((f) => f.id)}, want F1 and F9`);
  const text = all(files);
  for (const id of ['F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F10', 'F11'])
    check(!text.includes(`Name ${id}`) && !text.includes(`Nombre ${id}`) && !text.includes(`thing ${id}.`), `fixture ${id} printed`);
  check(!/Avoid text/.test(text), 'avoid text printed');
  check(files['llms.txt'].includes('- Name F1: Does thing F1.'), 'llms.txt lacks the F1 line');
  check(files['es/llms.txt'].includes('- Nombre F1: Hace cosa F1.'), 'es/llms.txt lacks the F1 line');
  check(!files['llms.txt'].includes('Say F1.') && files['llms-full.txt'].includes('- Say F1.'), 'say lines belong to llms-full.txt only');
  check(!text.includes('35'), 'a number marked citable: false was printed');
  check(files['llms-full.txt'].includes('- Understands 30+ languages.'), 'a citable say line was dropped');
  check(skipped.some((s) => s.startsWith('F10: left out')), 'F10 (non-citable number in its one-liner) not reported');
  check(skipped.some((s) => s.startsWith('F9: say line dropped')), 'F9 non-citable say line not reported');
  check(files['llms.txt'].includes('(Grande plan or the AI Coordinator add-on.)'), 'plan note for grande + addon missing (EN)');
  check(files['es/llms.txt'].includes('(Grande plan o el complemento Coordinador IA.)'), 'plan note for grande + addon missing (ES)');
  check(files['llms.txt'].includes('### For planners') && !files['llms.txt'].includes('### For agencies'), 'groups: planners printed, agencies (empty) not');
  check(!files['llms.txt'].includes('### For guests'), 'the guest group printed with only a left-out feature');
  /* Slogan closes every file; prices and caps are the page's. */
  for (const [name, text1] of Object.entries(files)) {
    const lang = name.startsWith('es/') ? 'es' : 'en';
    check(text1.trimEnd().endsWith(`\n\n${SLOGAN[lang]}`), `${name} does not close with the slogan`);
    check(text1.startsWith('# Guest-ly\n\n> '), `${name} does not open with the title and summary`);
    check(!/\n\n\n/.test(text1), `${name} has a double blank line`);
    for (const [id, p] of Object.entries(PLANS))
      check(text1.includes(`- ${p.name}: USD ${p.price}. ${guestsLabel(id, lang)}.`), `${name}: no plan line for ${p.name}`);
    check(text1.includes(copy.en.footer.contact.email), `${name}: no contact address`);
  }
  check(files['llms.txt'].includes('500+ guests') && files['es/llms.txt'].includes('Hasta 160 invitados'), 'caps differ from the cards');
  check(!/\b60 guests/.test(text), 'the old 60-guest cap is back');
  check(files['llms.txt'].includes('USD 79 once, or USD 19 per month'), 'add-on prices missing');
}

/* The add-on and app lines follow the data. */
{
  const f = fixture();
  f.features = f.features.filter((x) => !(x.plans ?? []).includes('addon'));
  f.derived.app = { live_version: '' };
  const { files } = buildLlms(f);
  check(!files['llms.txt'].includes('add-on for'), 'add-on line printed with nothing live on the add-on');
  check(!all(files).includes('apps.apple.com') && !files['llms.txt'].includes('on iPhone'), 'App Store link printed with no live app version');
}

/* ---------- failures ---------- */

const mustFail = (label, mutate, want) => {
  const f = fixture();
  mutate(f);
  try {
    buildLlms(f);
    errors.push(`${label}: built without an error`);
  } catch (e) {
    if (!(e instanceof LlmsError)) errors.push(`${label}: threw ${e.message}`);
    else if (!e.problems.some((p) => p.includes(want))) errors.push(`${label}: problems ${JSON.stringify(e.problems)} lack "${want}"`);
  }
};
mustFail('em dash', (f) => (f.features[0].oneliner.en = 'Does a thing — well.'), 'em dash');
mustFail('en dash', (f) => (f.features[0].oneliner.es = 'Hace 1–2 cosas.'), 'en dash');
mustFail('exclamation', (f) => (f.features[0].say = ['So easy!']), 'exclamation');
mustFail('buzzword', (f) => (f.features[0].oneliner.en = 'A seamless guest list.'), 'buzzword');
mustFail('blocked term of an off feature', (f) => (f.features[0].say = ['Two-way sync with every app.']), 'blocked term "two-way sync"');
mustFail('brand without hyphen', (f) => (f.features[0].oneliner.en = 'Guestly does it.'), 'brand');
mustFail('price drift', (f) => (f.derived.plans[1].price_usd = 449), 'Signature: src/pricing.ts says USD 399');
mustFail('add-on drift', (f) => (f.derived.coordinator_addon.monthly_usd = 29), 'AI Coordinator monthly');
mustFail('missing plan', (f) => f.derived.plans.pop(), 'not in features.json derived.plans');
mustFail('schema', (f) => (f.schema = 'something/2'), 'schema');

/* ---------- where features.json comes from ---------- */

{
  const root = join(tmp, 'repo');
  const put = (dir) => {
    mkdirSync(join(root, dir, 'docs', 'product'), { recursive: true });
    writeFileSync(join(root, dir, 'docs', 'product', 'features.json'), '{}');
  };
  try {
    findFeaturesJson({ env: {}, repoRoot: root });
    errors.push('resolver: no portal and no env, but no error');
  } catch (e) {
    check(/GL_PORTAL_DIR/.test(e.message) && e.message.includes(join(root, 'guestly-portal-deploy')), `resolver message: ${e.message}`);
  }
  put('guestly-portal');
  check(findFeaturesJson({ env: {}, repoRoot: root }).portalDir === join(root, 'guestly-portal'), 'resolver: guestly-portal not used');
  put('guestly-portal-deploy');
  check(findFeaturesJson({ env: {}, repoRoot: root }).portalDir === join(root, 'guestly-portal-deploy'), 'resolver: guestly-portal-deploy not preferred');
  check(findFeaturesJson({ env: { GL_PORTAL_DIR: join(root, 'guestly-portal') }, repoRoot: root }).portalDir === join(root, 'guestly-portal'), 'resolver: GL_PORTAL_DIR not first');
  try {
    findFeaturesJson({ env: { GL_PORTAL_DIR: join(root, 'nope') }, repoRoot: root });
    errors.push('resolver: a wrong GL_PORTAL_DIR fell through silently');
  } catch (e) {
    check(e.message.includes('GL_PORTAL_DIR is set to'), `resolver message for a wrong GL_PORTAL_DIR: ${e.message}`);
  }
  /* The CLI stops the build with that message. */
  const cli = spawnSync(process.execPath, [join(CINEMATIC, 'scripts', 'llms.mjs'), join(tmp, 'out-none')], {
    env: { ...process.env, GL_PORTAL_DIR: join(root, 'nope') },
    encoding: 'utf8',
  });
  check(cli.status === 1 && /GL_PORTAL_DIR is set to/.test(cli.stderr), `CLI with a wrong GL_PORTAL_DIR: exit ${cli.status}, ${cli.stderr}`);
  check(!existsSync(join(tmp, 'out-none', 'llms.txt')), 'CLI wrote files after failing');
  /* App Store address agrees with the portal's. */
  mkdirSync(join(root, 'guestly-portal', 'src', 'lib'), { recursive: true });
  writeFileSync(join(root, 'guestly-portal', 'src', 'lib', 'routes.ts'), 'export const DEFAULT_IOS_STORE_URL = "https://apps.apple.com/app/id1";\n');
  check(storeUrlProblems(join(root, 'guestly-portal')).length === 1, 'store URL drift not caught');
}

/* ---------- the real features.json ---------- */

let real;
try {
  real = findFeaturesJson();
} catch (e) {
  errors.push(`real features.json: ${e.message}`);
}
if (real) {
  const facts = JSON.parse(readFileSync(real.file, 'utf8'));
  check(storeUrlProblems(real.portalDir).length === 0, `store URL: ${storeUrlProblems(real.portalDir)}`);
  const { files, features } = buildLlms(facts);
  const text = all(files);
  check(features.length > 0 && features.every(isPrintable), 'real: a selected feature is not live + ok');
  const notOk = facts.features.filter((f) => !isPrintable(f));
  const okNames = new Set(features.flatMap((f) => [f.name.en, f.name.es]));
  for (const f of notOk) {
    for (const n of [f.name.en, f.name.es]) {
      if (okNames.has(n)) continue;
      check(!text.includes(`- ${n}:`) && !text.includes(`### ${n}\n`), `real: ${f.id} (${f.status}/${f.marketing}) printed as "${n}"`);
    }
    check(!(f.oneliner?.en && text.includes(f.oneliner.en)), `real: one-liner of ${f.id} (${f.status}/${f.marketing}) printed`);
  }
  for (const f of facts.features) for (const a of f.avoid ?? []) check(!text.includes(a), `real: avoid text of ${f.id} printed`);
  const building = facts.features.filter((f) => f.status === 'building');
  console.log(`real: ${real.file}: ${features.length} printed, ${building.length} building and ${notOk.length - building.length} other non-printable left out`);

  /* Scratch copy: one live + ok feature to "hold", rebuilt by the CLI. */
  const victim = features.find((f) => f.say.length > 0) ?? features[0];
  const scratch = join(tmp, 'portal');
  mkdirSync(join(scratch, 'docs', 'product'), { recursive: true });
  const held = structuredClone(facts);
  held.features.find((f) => f.id === victim.id).marketing = 'hold';
  writeFileSync(join(scratch, 'docs', 'product', 'features.json'), JSON.stringify(held));
  const outBefore = join(tmp, 'out-before');
  const outAfter = join(tmp, 'out-after');
  const run = (dir, out) =>
    spawnSync(process.execPath, [join(CINEMATIC, 'scripts', 'llms.mjs'), out], { env: { ...process.env, GL_PORTAL_DIR: dir }, encoding: 'utf8' });
  const before = run(real.portalDir, outBefore);
  const after = run(scratch, outAfter);
  check(before.status === 0 && after.status === 0, `CLI runs: ${before.stderr}${after.stderr}`);
  for (const name of OUTPUTS) {
    const b = readFileSync(join(outBefore, name), 'utf8');
    const a = readFileSync(join(outAfter, name), 'utf8');
    const lang = name.startsWith('es/') ? 'es' : 'en';
    check(b.includes(victim.oneliner[lang]), `${name}: ${victim.id} missing before the hold`);
    check(!a.includes(victim.oneliner[lang]) && !a.includes(`${victim.name[lang]}:`) && !a.includes(`### ${victim.name[lang]}\n`), `${name}: ${victim.id} still printed after "hold"`);
    for (const s of victim.say) check(!a.includes(s), `${name}: a say line of held ${victim.id} still printed`);
  }
  console.log(`hold: ${victim.id} (${victim.name.en}) left all three files on rebuild`);

  /* lint-copy on the generated files, then with a planted em dash. */
  const lint = (dir) => spawnSync(process.execPath, [join(CINEMATIC, 'scripts', 'lint-copy.mjs'), '--dist', dir], { encoding: 'utf8' });
  const clean = lint(outBefore);
  check(clean.status === 0 && /3 generated text file/.test(clean.stdout), `lint-copy on the generated files: ${clean.stdout}${clean.stderr}`);
  writeFileSync(join(outAfter, 'es', 'llms.txt'), readFileSync(join(outAfter, 'es', 'llms.txt'), 'utf8') + 'Planted — dash\n');
  check(lint(outAfter).status === 1, 'lint-copy passed a planted em dash in es/llms.txt');
}

/* ---------- staged like the deploy, served ---------- */

const dist = join(CINEMATIC, 'dist');
if (!OUTPUTS.every((n) => existsSync(join(dist, n)))) {
  errors.push('staged: dist/ has no llms files; run npm run build first');
} else {
  /* A throwaway repo root: the stage script and its inputs, plus the build
     copied in the way ~/deploy/guestly-landing.sh does (rsync of dist/). */
  const root = join(tmp, 'site-root');
  mkdirSync(join(root, 'scripts'), { recursive: true });
  cpSync(join(REPO_ROOT, 'scripts', 'stage-site.sh'), join(root, 'scripts', 'stage-site.sh'));
  cpSync(join(CINEMATIC, 'public'), join(root, 'cinematic', 'public'), { recursive: true });
  cpSync(join(CINEMATIC, 'scripts', 'prerender.mjs'), join(root, 'cinematic', 'scripts', 'prerender.mjs'));
  for (const p of ['CNAME', 'logos']) cpSync(join(REPO_ROOT, p), join(root, p), { recursive: true });
  cpSync(dist, root, { recursive: true });
  const stage = (out) => spawnSync('bash', [join(root, 'scripts', 'stage-site.sh'), out], { encoding: 'utf8' });
  const site = join(tmp, 'site');
  const staged = stage(site);
  check(staged.status === 0, `stage-site.sh: exit ${staged.status} ${staged.stderr}`);

  if (staged.status === 0) {
    const port = 50400 + Math.floor(Math.random() * 80);
    const server = spawn(process.execPath, [join(CINEMATIC, 'node_modules', 'serve', 'build', 'main.js'), '-l', `tcp://127.0.0.1:${port}`, '--no-clipboard', site], { stdio: 'ignore' });
    try {
      let up = false;
      for (let i = 0; i < 50 && !up; i++) {
        up = await fetch(`http://127.0.0.1:${port}/`).then(() => true, () => false);
        if (!up) await new Promise((r) => setTimeout(r, 100));
      }
      check(up, 'static server did not start');
      for (const name of OUTPUTS) {
        const res = await fetch(`http://127.0.0.1:${port}/${name}`);
        const body = Buffer.from(await res.arrayBuffer());
        check(res.status === 200, `/${name}: HTTP ${res.status}`);
        check(/^text\/plain;\s*charset=utf-8$/i.test(res.headers.get('content-type') ?? ''), `/${name}: content-type ${res.headers.get('content-type')}`);
        check(!res.headers.get('set-cookie'), `/${name}: Set-Cookie`);
        check(body.equals(readFileSync(join(dist, name))), `/${name}: served bytes differ from dist`);
        check(!(body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf), `/${name}: starts with a byte order mark`);
        const text = new TextDecoder('utf-8', { fatal: true }).decode(body);
        const lang = name.startsWith('es/') ? 'es' : 'en';
        check(text.trimEnd().endsWith(SLOGAN[lang]), `/${name}: slogan not last`);
        if (lang === 'es') check(/Más boda, menos estrés\.\n?$/.test(text) && text.includes('Términos'), '/es/llms.txt: accents did not survive');
      }
    } finally {
      server.kill();
    }
  }

  /* Guards: a partial set and anything else in es/ stop the stage. */
  rmSync(join(root, 'es', 'llms.txt'));
  check(stage(join(tmp, 'site-2')).status === 1, 'stage-site.sh staged llms.txt without es/llms.txt');
  writeFileSync(join(root, 'es', 'llms.txt'), 'x');
  writeFileSync(join(root, 'es', 'index.html'), '<p>page</p>');
  const extra = stage(join(tmp, 'site-3'));
  check(extra.status === 1 && /es\/ may hold only llms\.txt/.test(extra.stderr), 'stage-site.sh published a page in es/');
}

rmSync(tmp, { recursive: true, force: true });
if (errors.length) {
  for (const e of errors) console.error(`test-llms: ${e}`);
  process.exit(1);
}
console.log('test-llms clean: only live + ok features, prices and caps from pricing.ts, failures on drift and banned copy, staged files served as text/plain utf-8');
