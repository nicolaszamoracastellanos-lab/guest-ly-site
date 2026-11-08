import { lazy, Suspense, useEffect, useState } from 'react';
import { Overlay } from './ui/Overlay';
import { webglAllowed } from './three/capabilities';

/* The three.js world ships as its own chunk, loaded after first paint so
   text and CTAs render from the small initial bundle. The static themed
   gradient shows until the chunk arrives, and permanently when the
   capability gate says no (Part 7.1). */
const Experience = lazy(() => import('./three/Experience').then((m) => ({ default: m.Experience })));

function StaticStage() {
  return <div className="static-stage" aria-hidden="true" />;
}

export default function App() {
  const [gl, setGl] = useState(false);

  /* Gate + defer: decide after mount so the first paint is pure DOM. */
  useEffect(() => {
    if (webglAllowed()) setGl(true);
  }, []);

  /* The scroll driver only exists to feed the WebGL world, so it loads
     with it and never runs when the gate keeps the canvas off. */
  useEffect(() => {
    if (!gl) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void import('./scroll/driver').then((m) => {
      if (!cancelled) cleanup = m.startScrollDriver();
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [gl]);

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
