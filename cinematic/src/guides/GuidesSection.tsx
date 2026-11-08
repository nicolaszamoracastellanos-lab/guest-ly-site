import { useRef } from 'react';
import { useLang } from '../ui/LanguageContext';
import { guidesHeadCopy } from './head-copy';
import GuidesForm from './GuidesForm';
import type { Open } from './GuidesForm';
import './guides.css';

/* #50 destination guides (only while GUIDES_ENABLED), between the origin
   story and the FAQ. Nothing of it is prerendered: ./state.ts reads the
   catalogue once after hydration, at idle, and adds this section only for an
   "open" answer with at least one guide, so a closed, unavailable, limited or
   unreachable API leaves the page exactly as it is without the switch. The
   catalogue is already in hand when the section goes in, so nothing is
   reserved and nothing waits. The shared header, without its scroll reveal:
   this section arrives after the page's reveal observer has started. */
export function GuidesSection({ data, initial, onSettled }: { data: Open; initial: string | null; onSettled: (after?: () => void) => void }) {
  const { lang } = useLang();
  const h = guidesHeadCopy[lang];
  const slot = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);

  return (
    <section id="guides" className="section">
      <div className="container">
        <header className="sec-head">
          <p className="sec-eyebrow">
            <span className="sec-no">{h.no}</span>
            <span className="sec-rule" aria-hidden="true" />
            <span className="sec-kicker">{h.kicker}</span>
          </p>
          <h2 className="sec-title">
            {h.title.split('\n').map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </h2>
          <p className="sec-intro">{h.intro}</p>
        </header>
        <div className="guides-slot" ref={slot}>
          <div ref={box}>
            <GuidesForm catalogue={data} initial={initial} onSettled={onSettled} slot={slot} box={box} />
          </div>
        </div>
      </div>
    </section>
  );
}
