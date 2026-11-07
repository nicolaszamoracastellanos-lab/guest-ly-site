/* The history entry's note for ./state.ts (lazy chunk, loaded with the
   section): whether the section is what the visitor is reading, so a reload
   or Back to this entry knows if #reviews in the address still asks. Kept
   up to date after the section goes in and whenever scrolling stops. Only
   history.state: no cookie, no storage. */

/* The section's top counts as read from the bar down to this line (its
   scroll-margin-top is 80 px, .section in overlay.css). */
const READ_LINE = 120;

export function noteWhere(key: string) {
  let timer = 0;
  const note = () => {
    const r = document.getElementById('reviews')?.getBoundingClientRect();
    const at = !!r && r.top <= READ_LINE && r.bottom > READ_LINE;
    const st: unknown = history.state;
    const base = st && typeof st === 'object' ? (st as Record<string, unknown>) : {};
    if ((base[key] === true) === at) return;
    history.replaceState({ ...base, [key]: at }, '');
  };
  addEventListener(
    'scroll',
    () => {
      clearTimeout(timer);
      timer = window.setTimeout(note, 150);
    },
    { passive: true },
  );
  requestAnimationFrame(note);
}
