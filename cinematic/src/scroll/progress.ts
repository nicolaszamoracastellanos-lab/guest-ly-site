/* Global scroll progress store.
   GSAP ScrollTrigger writes here (0..1 across the whole page); R3F reads it
   every frame via getProgress(). A plain mutable module avoids React
   re-renders on scroll — the canvas is the only consumer that needs 60fps. */

const state = { progress: 0, velocity: 0 };

let last = 0;

export function setProgress(p: number) {
  state.velocity = p - last;
  last = p;
  state.progress = p;
}

export function getProgress() {
  return state.progress;
}

export function getVelocity() {
  return state.velocity;
}

