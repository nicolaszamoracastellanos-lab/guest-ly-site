/* K23 guard: landing scripts resolve paths from the repo, never from a
   hard-coded home folder, and keep working from a folder with a space.
   1. No absolute home-folder or Desktop path in cinematic/scripts,
      cinematic/src, cinematic/vite.config.ts or scripts/ (repo root).
   2. scripts/lib/paths.mjs, copied under a folder with a space, resolves
      CINEMATIC and REPO_ROOT to real paths (no "%20").
   3. deskPath() maps both sides of the Nov 4 Desktop move, like desk_path
      in ~/deploy/lib.sh, against a throwaway HOME.
   Usage: node scripts/test-paths.mjs */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { CINEMATIC, REPO_ROOT } from './lib/paths.mjs';

const errors = [];
const HARD_PATH = /\/Users\/[A-Za-z0-9._-]+|~\/Desktop|\$HOME\/Desktop|\$\{HOME\}\/Desktop/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'shots') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(mjs|js|ts|tsx|sh)$/.test(name)) yield full;
  }
}

/* 1. No hard-coded home paths. */
const roots = [join(CINEMATIC, 'scripts'), join(CINEMATIC, 'src'), join(REPO_ROOT, 'scripts')];
const files = [...roots.flatMap((r) => [...walk(r)]), join(CINEMATIC, 'vite.config.ts')];
for (const file of files) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (HARD_PATH.test(line)) errors.push(`${relative(REPO_ROOT, file)}:${i + 1} hard-coded home path: ${line.trim()}`);
    });
}

/* 2 and 3 run in child processes with a fake HOME and a spaced folder. */
const sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'gl paths ')));
try {
  const spaced = join(sandbox, 'repo with space', 'cinematic', 'scripts', 'lib');
  mkdirSync(spaced, { recursive: true });
  cpSync(join(CINEMATIC, 'scripts', 'lib', 'paths.mjs'), join(spaced, 'paths.mjs'));

  const home = join(sandbox, 'home');
  mkdirSync(join(home, 'Desktop', 'Desktop - Unknown', 'guest-ly', 'guestly-portal'), { recursive: true });
  mkdirSync(join(home, 'Desktop', 'old-only'), { recursive: true });
  /* findPortal: a checkout with only package.json (stale node_modules link)
     is skipped; the next one, with playwright installed, is chosen. */
  const moved = join(home, 'Desktop', 'Desktop - Unknown', 'guest-ly');
  writeFileSync(join(moved, 'guestly-portal', 'package.json'), '{}');
  mkdirSync(join(moved, 'guestly-portal-deploy', 'node_modules', 'playwright'), { recursive: true });
  writeFileSync(join(moved, 'guestly-portal-deploy', 'package.json'), '{}');
  writeFileSync(join(moved, 'guestly-portal-deploy', 'node_modules', 'playwright', 'package.json'), '{}');

  const probe = `
    const m = await import(${JSON.stringify(join(spaced, 'paths.mjs'))});
    console.log(JSON.stringify({
      cinematic: m.CINEMATIC,
      root: m.REPO_ROOT,
      moved: m.deskPath(process.env.HOME + '/Desktop/guest-ly/guestly-portal'),
      back: m.deskPath(process.env.HOME + '/Desktop/Desktop - Unknown/old-only'),
      missing: m.deskPath(process.env.HOME + '/Desktop/nowhere'),
      portal: m.findPortal(),
      noPortal: m.findPortal(['guest-ly/guestly-portal']),
    }));`;
  const out = JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', probe], { env: { ...process.env, HOME: home, GL_PORTAL_DIR: '' }, encoding: 'utf8' }),
  );
  const expect = (label, got, want) => {
    if (got !== want) errors.push(`${label}: got ${got}, want ${want}`);
  };
  expect('CINEMATIC from a spaced folder', out.cinematic, join(sandbox, 'repo with space', 'cinematic'));
  expect('REPO_ROOT from a spaced folder', out.root, join(sandbox, 'repo with space'));
  expect('deskPath old Desktop path -> moved folder', out.moved, join(home, 'Desktop', 'Desktop - Unknown', 'guest-ly', 'guestly-portal'));
  expect('deskPath moved path -> old Desktop folder', out.back, join(home, 'Desktop', 'old-only'));
  expect('deskPath missing path stays as given', out.missing, join(home, 'Desktop', 'nowhere'));
  expect('findPortal skips a checkout without playwright', out.portal, join(moved, 'guestly-portal-deploy'));
  expect('findPortal returns null when no checkout has playwright', out.noPortal, null);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

if (errors.length) {
  for (const e of errors) console.error(`test-paths: ${e}`);
  process.exit(1);
}
console.log(`test-paths clean: ${files.length} files without home paths; paths.mjs works from a spaced folder; deskPath maps both sides of the move; findPortal requires playwright`);
