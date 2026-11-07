/* The open phone menu on short screens (review round 2 of the Reviews tab,
   Nov 7): with seven links it ran under the logo row and pushed the order
   button off screen at iPhone Safari heights. Used by check-nav-fit.mjs and
   test-reviews.mjs.

   MENU_VIEWS: iPhone 13/14/15 Safari with its bars (390x664), iPhone SE
   (375x667, and 375x548 with its bars), small Android (360x640).
   menuProblems(page): the menu must already be open. Every link and button
   starts at or below the bar's bottom; the last one (the order button) ends
   inside the screen, or the menu scrolls and, scrolled to its end, shows it
   whole. Returns a list of problems (empty when it fits). */

export const MENU_VIEWS = [
  [390, 664],
  [375, 667],
  [360, 640],
  [375, 548],
];

export async function menuProblems(page) {
  const r = await page.evaluate(async () => {
    const m = document.querySelector('.nav__menu');
    const bar = document.querySelector('.nav__inner').getBoundingClientRect().bottom;
    const items = [...m.querySelectorAll('a, button')].filter((e) => e.getClientRects().length);
    m.scrollTop = 0;
    const first = items[0].getBoundingClientRect().top;
    const last = items.at(-1).getBoundingClientRect().bottom;
    const scrolls = m.scrollHeight > m.clientHeight + 1 && getComputedStyle(m).overflowY === 'auto';
    m.scrollTop = m.scrollHeight;
    await new Promise((r) => requestAnimationFrame(r));
    const lastScrolled = items.at(-1).getBoundingClientRect().bottom;
    m.scrollTop = 0;
    return { bar, first, last, scrolls, lastScrolled, ih: innerHeight, label: items[0].textContent, cta: items.at(-1).textContent };
  });
  const out = [];
  if (r.first < r.bar - 0.5) out.push(`"${r.label}" starts at ${Math.round(r.first)}px, under the bar (ends ${Math.round(r.bar)}px)`);
  if (r.last > r.ih + 0.5) {
    if (!r.scrolls) out.push(`"${r.cta}" ends at ${Math.round(r.last)}px of ${r.ih} and the menu does not scroll`);
    else if (r.lastScrolled > r.ih + 0.5) out.push(`"${r.cta}" ends at ${Math.round(r.lastScrolled)}px of ${r.ih} even scrolled to the end`);
  }
  return out;
}
