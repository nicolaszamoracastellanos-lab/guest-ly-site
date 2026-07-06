import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Experience } from './three/Experience';
import { Overlay } from './ui/Overlay';
import { setProgress } from './scroll/progress';

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  useEffect(() => {
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
  }, []);

  return (
    <>
      <Experience />
      <div className="overlay-root">
        <Overlay />
      </div>
    </>
  );
}
