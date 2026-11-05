/* Build the landing into a temporary folder (never cinematic/dist) with test
   switches, prerender it like the real build, and serve it on a local port.
   Used by scripts/test-booking.mjs and scripts/booking-screens.mjs. */

import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { CINEMATIC } from './paths.mjs';

export function buildSite(outDir, env, { prerender = true } = {}) {
  const run = (args, extra) =>
    execFileSync(args[0], args.slice(1), { cwd: CINEMATIC, env: { ...process.env, ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  run(['npx', 'vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error']);
  if (prerender) run(['node', 'scripts/prerender.mjs'], { GL_DIST: outDir });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

export function serveDir(dir, port = 0) {
  const server = createServer((req, res) => {
    let file = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    try {
      if (statSync(file, { throwIfNoEntry: false })?.isDirectory()) file = join(file, 'index.html');
      if (!existsSync(file) && !extname(file)) file = join(dir, 'index.html');
      const body = readFileSync(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r({ server, url: `http://localhost:${server.address().port}` })));
}
