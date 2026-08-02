/* Theme store. Plain module (like scroll/progress.ts) so both React and the
   R3F world can read it without coupling. The inline bootstrap script in
   index.html resolves the ladder before first paint; this module owns every
   change after that.

   Resolution ladder, in order:
   1. stored user choice in localStorage('gl-theme')
   2. prefers-color-scheme (light -> day, otherwise night)
   3. night */

export type Theme = 'night' | 'day';

const STORAGE_KEY = 'gl-theme';
const THEME_COLOR: Record<Theme, string> = { night: '#0d1117', day: '#faf6f0' };

const listeners = new Set<(theme: Theme) => void>();

function storedChoice(): Theme | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'day' || v === 'night' ? v : null;
  } catch {
    return null;
  }
}

export function resolveTheme(): Theme {
  const stored = storedChoice();
  if (stored) return stored;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'day';
  }
  return 'night';
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'day' ? 'day' : 'night';
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme]);
  listeners.forEach((listener) => listener(theme));
}

/* Adds a short-lived class that turns on the 0.5s background/color
   transition (see index.css). Skipped under prefers-reduced-motion. */
let switchTimer = 0;
function animateSwitch() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  root.classList.add('theme-switching');
  window.clearTimeout(switchTimer);
  switchTimer = window.setTimeout(() => root.classList.remove('theme-switching'), 650);
}

/* Explicit user choice: stored, so the OS stops driving the theme. */
export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode: the choice just does not persist */
  }
  if (theme !== getTheme()) {
    animateSwitch();
    apply(theme);
  }
}

/* Live-follow: while the user has not made an explicit choice, follow the
   OS when it flips. Returns an unsubscribe. */
export function followSystemTheme(): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia('(prefers-color-scheme: light)');
  const onChange = (event: MediaQueryListEvent) => {
    if (storedChoice()) return;
    const next: Theme = event.matches ? 'day' : 'night';
    if (next !== getTheme()) {
      animateSwitch();
      apply(next);
    }
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function subscribeTheme(listener: (theme: Theme) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
