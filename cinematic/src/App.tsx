import { lazy, Suspense, useEffect, useState } from 'react';
import { Overlay } from './ui/Overlay';
import { LegalPage } from './ui/LegalPage';
import type { LegalKind } from './ui/LegalPage';
import { webglAllowed } from './three/capabilities';

/* The three.js world ships as its own chunk, loaded after first paint so
   text and CTAs render from the small initial bundle. The static themed
   gradient shows until the chunk arrives, and permanently when the
   capability gate says no (Part 7.1). */
const Experience = lazy(() => import('./three/Experience').then((m) => ({ default: m.Experience })));

function StaticStage() {
  return <div className="static-stage" aria-hidden="true" />;
}

const LEGAL_ROUTES: Record<string, LegalKind> = {
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/refunds': 'refunds',
};

function legalRoute(): LegalKind | null {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return LEGAL_ROUTES[path] ?? null;
}

export default function App() {
  const legal = legalRoute();
  const [gl, setGl] = useState(false);

  /* Gate + defer: decide after mount so the first paint is pure DOM. */
  useEffect(() => {
    if (!legal && webglAllowed()) setGl(true);
  }, [legal]);

  /* The scroll driver only exists to feed the WebGL world, so it loads
     with it and never runs when the gate keeps the canvas off. */
  useEffect(() => {
    if (legal || !gl) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void import('./scroll/driver').then((m) => {
      if (!cancelled) cleanup = m.startScrollDriver();
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [legal, gl]);

  if (legal) return <LegalPage kind={legal} />;

  return (
    <>
      {gl ? (
        <Suspense fallback={<StaticStage />}>
          <Experience />
        </Suspense>
      ) : (
        <StaticStage />
      )}
      <div className="overlay-root">
        <Overlay />
      </div>
    </>
  );
}
