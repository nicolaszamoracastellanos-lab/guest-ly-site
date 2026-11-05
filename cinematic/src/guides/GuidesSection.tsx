import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { useLang } from '../ui/LanguageContext';
import { SectionHeader } from '../ui/Sections';
import { guidesHeadCopy } from './head-copy';
import './guides.css';

/* #50 destination guides (only while GUIDES_ENABLED), between the origin
   story and the FAQ, where the #23 section list expects "guides". The header
   is in the prerendered page; the form is a lazy chunk mounted after
   hydration once the section is within NEAR of the viewport (the LiveScreen
   pattern), so it costs the first load nothing. Its box keeps the form's
   height before it arrives, so nothing below moves. */

const NEAR = '800px 0px';
/* A chunk that fails to load leaves the box empty instead of breaking the page. */
const GuidesForm = /* @__PURE__ */ lazy(
  (): Promise<{ default: ComponentType }> => import('./GuidesForm').catch(() => ({ default: () => null })),
);

export function GuidesSection() {
  const { lang } = useLang();
  const h = guidesHeadCopy[lang];
  const slot = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

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

  return (
    <section id="guides" className="section">
      <div className="container">
        <SectionHeader no={h.no} kicker={h.kicker} title={h.title} intro={h.intro} />
        <div className="guides-slot" ref={slot}>
          {near ? (
            <Suspense fallback={null}>
              <GuidesForm />
            </Suspense>
          ) : null}
        </div>
      </div>
    </section>
  );
}
