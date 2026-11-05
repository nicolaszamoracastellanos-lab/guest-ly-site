/* #23 cookieless section analytics: the landing beacon (lazy chunk, 2 KB gzip
   or less, checked by scripts/test-beacon.mjs). main.tsx loads it after
   hydration, at idle, and only when SITE_BEACON_URL is set.

   Payload v1 is the one L7p ingests (L7P-LOG "Beacon payload v1"; the portal
   parser is src/lib/site-analytics/schema.ts). Keep the two in step.

   Privacy (decision D23): nothing is stored on the device. No cookie, no
   localStorage or sessionStorage, no IndexedDB. The page view id lives in
   memory. Nothing is sent to automated browsers or when the visitor asks
   for no tracking (Do Not Track, Global Privacy Control). Typed text is
   never read: only data-track ids, data attributes, numbers and the page
   language.

   Transport: fetch with keepalive, not navigator.sendBeacon. sendBeacon
   always sends credentials, and app.guest-ly.com is the same site as
   guest-ly.com, so it would carry a signed-in couple's portal cookie and
   accept any cookie in the answer. credentials 'omit' sends none and keeps
   none. A string body makes it text/plain (no preflight); no-cors keeps a
   missing endpoint quiet. */

import type { BeaconEvent } from './emit';

type Sink = { push(e: BeaconEvent): unknown };

export function start(url: string) {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const w = window as unknown as { __glt?: BeaconEvent[] | Sink; doNotTrack?: string };
  if (nav.webdriver || nav.globalPrivacyControl || nav.doNotTrack === '1' || w.doNotTrack === '1') {
    w.__glt = { push() {} };
    return;
  }
  const html = document.documentElement;
  const queue: BeaconEvent[] = [];
  const add = (e: BeaconEvent) => {
    e.lang ??= html.lang;
    queue.push(e);
  };

  const params = new URLSearchParams(location.search);
  const utm: Record<string, string> = {};
  for (const key of ['source', 'medium', 'campaign', 'content']) {
    const v = params.get('utm_' + key);
    if (v) utm[key] = v.slice(0, 60);
  }
  let ref = '';
  try {
    ref = new URL(document.referrer).hostname;
  } catch {
    /* no referrer */
  }
  const width = innerWidth;
  const batch = {
    v: 1,
    view: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36),
    path: location.pathname,
    device: width < 768 ? 'phone' : width < 1100 ? 'tablet' : 'desktop',
    ref: ref || undefined,
    utm: Object.keys(utm).length ? utm : undefined,
  };

  const flush = () => {
    while (queue.length) {
      const body = JSON.stringify({ ...batch, lang: html.lang, theme: html.dataset.theme, events: queue.splice(0, 25) });
      try {
        fetch(url, { method: 'POST', body, keepalive: true, mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer' }).catch(() => {});
      } catch {
        /* never let analytics break the page */
      }
    }
  };

  add({ k: 'view' });
  const early = w.__glt;
  w.__glt = { push: add };
  if (Array.isArray(early)) early.forEach(add);

  /* Sections: seen once the visible part covers half the section or half
     the viewport, so a section taller than two screens still counts. */
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRect.height * 2 >= Math.min(e.boundingClientRect.height, innerHeight)) {
          io.unobserve(e.target);
          const el = e.target as HTMLElement;
          add({ k: 'section', s: el.dataset.sec || el.id });
        }
      }
    },
    { threshold: Array.from({ length: 41 }, (_, i) => i / 40) },
  );
  document.querySelectorAll('main section[id],[data-sec]').forEach((el) => io.observe(el));

  /* Scroll depth: one passive listener, one frame at most, and only
     scrollY and innerHeight read; the page height is cached. */
  let height = 0;
  let depth = 0;
  let frame = 0;
  const measure = () => {
    frame = 0;
    const seen = ((scrollY + innerHeight + 2) / height) * 100;
    for (const b of [25, 50, 75, 100]) {
      if (b > depth && seen >= b) {
        depth = b;
        add({ k: 'depth', n: b });
      }
    }
  };
  const resize = () => {
    height = html.scrollHeight;
    measure();
  };
  new ResizeObserver(resize).observe(document.body);
  resize();
  addEventListener('scroll', () => (frame ||= requestAnimationFrame(measure)), { passive: true });

  /* Clicks, each named without adding bytes to the page: a button by its
     data-track id (the order buttons), a toggle or tab by the id of what it
     opens (aria-controls), a link by where it goes (path and anchor on this
     site, host and path elsewhere, "mailto" for mail; never the query, which
     can carry a typed name). */
  document.addEventListener(
    'click',
    (ev) => {
      const t = (ev.target as Element).closest?.<HTMLElement>('[data-track],a[href],[aria-controls]');
      if (!t) return;
      const a = t as HTMLAnchorElement;
      const away = a.host && a.host !== location.host;
      const area = t.closest<HTMLElement>('[data-area],[data-sec],section[id]');
      const e: BeaconEvent = {
        k: 'click',
        s: area ? area.dataset.area || area.dataset.sec || area.id : '',
        id: (
          t.dataset.track ||
          t.getAttribute('aria-controls') ||
          (a.protocol === 'mailto:' ? 'mailto' : away ? a.host + a.pathname : a.pathname + a.hash)
        ).slice(0, 60),
        el: t.getAttribute('role') === 'tab' ? 'tab' : t.classList.contains('btn') ? 'cta' : t.tagName === 'A' ? 'link' : 'button',
      };
      if (away) e.host = a.hostname;
      add(e);
    },
    { capture: true, passive: true },
  );

  /* Leaving: once per hide, never on unload (it breaks the back cache). */
  let hidden = false;
  const hide = () => {
    if (!hidden) {
      hidden = true;
      add({ k: 'leave', n: Math.round(performance.now()), d: depth });
    }
    flush();
  };
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? hide() : (hidden = false)));
  addEventListener('pagehide', hide);
  setInterval(flush, 5000);
}
