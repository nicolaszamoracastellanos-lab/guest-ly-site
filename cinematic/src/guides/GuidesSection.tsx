import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { useLang } from '../ui/LanguageContext';
import { SectionHeader } from '../ui/Sections';
import { guideParam } from './link';
import type { GuidesFormProps } from './GuidesForm';
import { guidesHeadCopy } from './head-copy';
import { guidesRemoved } from './shown';
import './guides.css';

/* #50 destination guides (only while GUIDES_ENABLED), between the origin
   story and the FAQ, where the #23 section list expects "guides". The header
   is in the prerendered page; the form is a lazy chunk mounted after
   hydration once the section is within NEAR of the viewport (the LiveScreen
   pattern), so it costs the first load nothing. Its box is reserved before
   it arrives; once something is in it, the form sets the box to that
   thing's height with nothing on screen moving (./fit.ts, in the form's
   chunk): below the viewport it just
   changes, above it (a visitor who landed on #faq) the page scrolls with it,
   and a part that would leave a hole on screen is held only until it is out
   of view. The form reads the catalogue on app.guest-ly.com; when guides are
   closed, unavailable or limited there, the whole section goes away while it
   is still below the viewport and the FAQ takes back № 10. Once it is in
   view, or a ?guide= link brought the person here, it stays and the form
   says guides are not available, with the address.
   ?guide=<code> (the expired guide link's "Request a new link") opens that
   guide and ?guide=all the section: the page scrolls there once the
   catalogue has answered, so the cards or the line are already in place
   (LINK_WAIT at most; a visitor who scrolls first keeps their place). The
   query is then dropped, like ?book=demo. */

const NEAR = '800px 0px';
const LINK_WAIT = 1000;
/* A chunk that fails to load leaves the box empty instead of breaking the page. */
const GuidesForm = /* @__PURE__ */ lazy(
  (): Promise<{ default: ComponentType<GuidesFormProps> }> => import('./GuidesForm').catch(() => ({ default: () => null })),
);

export function GuidesSection() {
  const { lang } = useLang();
  const h = guidesHeadCopy[lang];
  const slot = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const linked = useRef(false);
  /* A ?guide= link still waiting to scroll to the section. */
  const toSection = useRef(false);
  const [near, setNear] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [initial, setInitial] = useState<string | null>(null);

  const goToSection = useCallback(() => {
    if (!toSection.current) return;
    toSection.current = false;
    section.current?.scrollIntoView({ block: 'start' });
  }, []);

  const hide = useCallback(() => {
    const el = section.current;
    if (linked.current || !el || el.getBoundingClientRect().top <= window.innerHeight) return false;
    setHidden(true);
    guidesRemoved();
    return true;
  }, []);

  /* The catalogue answered, its cards (or the line) are in the page and the
     box fits them (still off screen for a ?guide= link): scroll here two
     frames later, so the change and the scroll are never in one frame
     (Chrome would count the box change as a shift on the new screen).
     after: the form's next step there (the email for ?guide=<code>). */
  const settled = useCallback((after?: () => void) => {
    if (!toSection.current) {
      after?.();
      return;
    }
    toSection.current = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        section.current?.scrollIntoView({ block: 'start' });
        after?.();
      }),
    );
  }, []);

  useEffect(() => {
    const want = guideParam(window.location.search);
    if (!want) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('guide');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    linked.current = true;
    toSection.current = true;
    setInitial(want);
    setNear(true);
    const stop = () => {
      toSection.current = false;
    };
    const timer = window.setTimeout(goToSection, LINK_WAIT);
    const kinds = ['wheel', 'touchstart', 'keydown'] as const;
    kinds.forEach((k) => window.addEventListener(k, stop, { once: true, passive: true }));
    return () => {
      window.clearTimeout(timer);
      kinds.forEach((k) => window.removeEventListener(k, stop));
    };
  }, [goToSection]);

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
    <section id="guides" className="section" ref={section}>
      <div className="container">
        <SectionHeader no={h.no} kicker={h.kicker} title={h.title} intro={h.intro} />
        <div className="guides-slot" ref={slot}>
          <div ref={box}>
            {near ? (
              <Suspense fallback={null}>
                <GuidesForm initial={initial} onHidden={hide} onSettled={settled} slot={slot} box={box} />
              </Suspense>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
