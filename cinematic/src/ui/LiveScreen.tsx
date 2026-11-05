import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { LIVE_SCREENS } from '../live-screens.data.ts';
import { useLang } from './LanguageContext';
import { DESKTOP_MIN_WIDTH, resolveScreen } from './live-screens.ts';

/* How close the tour must come before its image is requested. The native
   loading="lazy" distance is up to ~3000px in Chromium, which would fetch
   the shot during the first load at 1440; this keeps the first load clean. */
const NEAR_MARGIN = '600px 0px';

/* #24 A real portal screen for a tour pane: the desktop shot from 880px up,
   the phone shot below, in the visitor's language. The box has its final
   aspect ratio from the manifest before anything loads (no layout shift);
   the <picture> mounts only after hydration once the box is within
   NEAR_MARGIN of the viewport, so the prerendered HTML holds the empty box
   and no image is requested on the first load. No iframe, no portal script.
   When the manifest has no shot for the pane, the placeholder (children)
   renders exactly as before. The facts list beside it stays the text
   alternative; alt names the screen. */
export function LiveScreen({ id, alt, children }: { id: string; alt: string; children: ReactNode }) {
  const { lang } = useLang();
  const shot = resolveScreen(LIVE_SCREENS, id, lang);
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const hasShot = shot !== null;

  useEffect(() => {
    const el = box.current;
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
      { rootMargin: NEAR_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, hasShot]);

  if (!shot) return <>{children}</>;
  const { desktop: d, phone: p } = shot;
  const ratios = { '--live-ar-desktop': `${d.width} / ${d.height}`, '--live-ar-phone': `${p.width} / ${p.height}` } as CSSProperties;
  return (
    <div className="live-screen" style={ratios} ref={box}>
      {near && (
        <picture>
          <source media={`(min-width: ${DESKTOP_MIN_WIDTH}px)`} srcSet={d.srcSet} sizes={d.sizes} width={d.width} height={d.height} />
          <img
            className="live-screen__img"
            src={p.src}
            srcSet={p.srcSet}
            sizes={p.sizes}
            width={p.width}
            height={p.height}
            alt={alt}
            loading="lazy"
            decoding="async"
          />
        </picture>
      )}
    </div>
  );
}
