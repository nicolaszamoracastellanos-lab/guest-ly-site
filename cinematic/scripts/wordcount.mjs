/* First-paint visible word count (Part 3 gate: under 600 EN words).
   Counts words in text nodes whose rendered box is visible (collapsed
   pillar/FAQ panels have zero-height inner boxes and do not count).
   Reported both with and without the decorative aria-hidden marquee. */

import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://localhost:5199';

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const counts = await page.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let total = 0;
  let marquee = 0;
  const seen = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent.trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.height < 2 || rect.width < 2) continue;
    /* Off-canvas elements (e.g. the skip link parked above the viewport). */
    if (rect.bottom <= 0 || rect.right <= 0) continue;
    /* Skip collapsed disclosure panels (0fr grid rows clip them). */
    if (el.closest('[inert]')) continue;
    /* The marquee track holds two copies of the list purely so the CSS
       animation can loop; count the content once. */
    const list = el.closest('.marquee__list');
    if (list && list.previousElementSibling) continue;
    const words = text.split(/\s+/).length;
    const inMarquee = !!el.closest('.marquee');
    if (inMarquee) marquee += words;
    total += words;
    seen.push(`${words}\t${text.slice(0, 60)}`);
  }
  return { total, marquee, sample: seen };
});

console.log(`total visible words: ${counts.total}`);
console.log(`marquee (decorative, aria-hidden): ${counts.marquee}`);
console.log(`without marquee: ${counts.total - counts.marquee}`);
if (process.argv.includes('--verbose')) console.log(counts.sample.join('\n'));

await browser.close();
process.exit(counts.total < 600 ? 0 : 1);
