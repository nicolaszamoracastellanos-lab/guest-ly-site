import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Experience } from './three/Experience';
import { Overlay } from './ui/Overlay';
import { LegalPage } from './ui/LegalPage';
import type { LegalKind } from './ui/LegalPage';
import { setProgress } from './scroll/progress';

gsap.registerPlugin(ScrollTrigger);

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

  useEffect(() => {
    if (legal) return;
    /* Master scroll driver: one trigger spanning the whole document writes
       normalized progress into the store the WebGL world reads each frame. */
    const trigger = ScrollTrigger.create({
      trigger: document.documentElement,
      start: 0,
      end: () => document.documentElement.scrollHeight - window.innerHeight,
      scrub: 0.8,
      onUpdate: (self) => setProgress(self.progress),
    });
    return () => trigger.kill();
  }, [legal]);

  if (legal) return <LegalPage kind={legal} />;

  return (
    <>
      <Experience />
      <div className="overlay-root">
        <Overlay />
      </div>
    </>
  );
}
