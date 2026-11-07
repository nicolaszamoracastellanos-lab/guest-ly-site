import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { useLang } from '../ui/LanguageContext';
import { SectionHeader } from '../ui/Sections';
import { guideParam } from './link';
import type { GuidesFormProps } from './GuidesForm';
import { guidesHeadCopy } from './head-copy';
import './guides.css';

/* #50 destination guides (only while GUIDES_ENABLED), between the origin
   story and the FAQ, where the #23 section list expects "guides". The header
   is in the prerendered page; the form is a lazy chunk mounted after
   hydration once the section is within NEAR of the viewport (the LiveScreen
   pattern), so it costs the first load nothing. Its box keeps the form's
   height before it arrives, so nothing below moves. The form reads the
   catalogue on app.guest-ly.com; when guides are closed, unavailable or
   limited there, the whole section goes away (normally still 800px below
   the viewport then, so nothing in view moves).
   ?guide=<code> (the expired guide link's "Request a new link") scrolls here
   and opens that guide; ?guide=all scrolls here. The query is then dropped,
   like ?book=demo. */

const NEAR = '800px 0px';
/* A chunk that fails to load leaves the box empty instead of breaking the page. */
const GuidesForm = /* @__PURE__ */ lazy(
  (): Promise<{ default: ComponentType<GuidesFormProps> }> => import('./GuidesForm').catch(() => ({ default: () => null })),
);

export function GuidesSection() {
  const { lang } = useLang();
  const h = guidesHeadCopy[lang];
  const slot = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [initial, setInitial] = useState<string | null>(null);
  const hide = useCallback(() => setHidden(true), []);

  useEffect(() => {
    const want = guideParam(window.location.search);
    if (!want) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('guide');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    setInitial(want);
    setNear(true);
    requestAnimationFrame(() => document.getElementById('guides')?.scrollIntoView({ block: 'start' }));
  }, []);

  useEffect(() => {
    const el = slot.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: NEAR },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  if (hidden) return null;

  return (
    <section id="guides" className="section">
      <div className="container">
        <SectionHeader no={h.no} kicker={h.kicker} title={h.title} intro={h.intro} />
        <div className="guides-slot" ref={slot}>
          {near ? (
            <Suspense fallback={null}>
              <GuidesForm initial={initial} onHidden={hide} />
            </Suspense>
          ) : null}
        </div>
      </div>
    </section>
  );
}
