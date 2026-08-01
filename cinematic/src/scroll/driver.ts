/* GSAP scroll driver, loaded on demand. Its only job is writing normalized
   scroll progress into the store the WebGL world reads, so it ships in a
   deferred chunk alongside the three.js experience: when the capability
   gate skips WebGL, GSAP never loads at all. */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setProgress } from './progress';

gsap.registerPlugin(ScrollTrigger);

export function startScrollDriver(): () => void {
  const trigger = ScrollTrigger.create({
    trigger: document.documentElement,
    start: 0,
    end: () => document.documentElement.scrollHeight - window.innerHeight,
    scrub: 0.8,
    onUpdate: (self) => setProgress(self.progress),
  });
  return () => trigger.kill();
}
