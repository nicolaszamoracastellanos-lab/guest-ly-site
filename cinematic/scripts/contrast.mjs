/* WCAG contrast verification for the semantic theme tokens (Part 2 VERIFY).
   Resolves the real computed values in the browser, alpha-composites
   translucent tokens over their actual backdrops, and computes contrast
   ratios. Exits 1 if any text pair is below AA (4.5:1). */

import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://localhost:5199';

function parseColor(str) {
  /* rgb(a)() with 0-255 channels, or color(srgb ...) with 0-1 channels. */
  let m = str.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  m = str.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/);
  if (m) return { r: +m[1] * 255, g: +m[2] * 255, b: +m[3] * 255, a: m[4] === undefined ? 1 : +m[4] };
  throw new Error(`unparseable color: ${str}`);
}

function over(fg, bg) {
  const a = fg.a + bg.a * (1 - fg.a);
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
    a,
  };
}

function luminance({ r, g, b }) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const browser = await chromium.launch();
let failed = false;

for (const theme of ['night', 'day']) {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('gl-theme', t);
    } catch {}
  }, theme);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const tokens = await page.evaluate(() => {
    /* One fresh probe per token: reusing a single element returned stale
       computed values between same-frame reads in headless Chromium. */
    const read = (name) => {
      const probe = document.createElement('div');
      probe.style.color = `var(${name})`;
      document.body.appendChild(probe);
      const css = getComputedStyle(probe).color;
      probe.remove();
      return css;
    };
    const names = [
      '--bg', '--surface', '--text', '--text-muted', '--text-faint',
      '--accent', '--accent-text', '--accent-text-strong', '--accent-ink',
      '--glass-bg',
    ];
    const out = {};
    for (const n of names) out[n] = read(n);
    return out;
  });

  const c = Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, parseColor(v)]));
  const bg = c['--bg'];
  const glass = over(c['--glass-bg'], bg);

  /* Text pairs that must clear AA 4.5:1 on their real backdrops. */
  const pairs = [
    ['text on bg', c['--text'], bg],
    ['text on glass', c['--text'], glass],
    ['text-muted on bg', over(c['--text-muted'], bg), bg],
    ['text-muted on glass', over(c['--text-muted'], glass), glass],
    ['text-faint on bg', over(c['--text-faint'], bg), bg],
    ['text-faint on glass', over(c['--text-faint'], glass), glass],
    ['accent-text on bg', c['--accent-text'], bg],
    ['accent-text on glass', c['--accent-text'], glass],
    ['accent-text on surface', c['--accent-text'], c['--surface']],
    ['accent-text-strong on bg', c['--accent-text-strong'], bg],
    ['accent-text-strong on glass', c['--accent-text-strong'], glass],
    ['accent-ink on accent', c['--accent-ink'], c['--accent']],
  ];

  console.log(`\n[${theme}]`);
  for (const [label, fg, backdrop] of pairs) {
    const r = ratio(fg, backdrop);
    const ok = r >= 4.5;
    if (!ok) failed = true;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2)}:1  ${label}`);
  }
  await ctx.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
