import type { ReactNode } from 'react';
import { useState } from 'react';

/* Stylized CSS mock-UI vignettes for the platform tour: pure HTML/CSS built
   from a small shared primitive family, no images. Each vignette exposes ONE
   two-state micro-interaction driven by the pane's microCta/microDone copy. */

export function MockWindowBar({ label }: { label: string }) {
  return (
    <div className="mock__bar">
      <span className="mock__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="mock__address">{label}</span>
    </div>
  );
}

function MockStat({ v, l }: { v: string; l: string }) {
  return (
    <span className="mock__stat">
      <b>{v}</b>
      {l}
    </span>
  );
}

function MockRow({ children, chip, dim }: { children: ReactNode; chip?: string; dim?: boolean }) {
  return (
    <div className={dim ? 'mock__row mock__row--dim' : 'mock__row'}>
      <span className="mock__row-main">{children}</span>
      {chip && <span className="mock__chip">{chip}</span>}
    </div>
  );
}

export function MicroButton({
  cta,
  done,
  onFlip,
  flipped,
}: {
  cta: string;
  done: string;
  onFlip: () => void;
  flipped: boolean;
}) {
  return (
    <div className="mock__micro">
      {flipped ? (
        <p className="mock__micro-done" role="status">
          <span aria-hidden="true">✓</span>
          {done}
        </p>
      ) : (
        <button type="button" className="btn btn--gold-line mock__micro-btn" aria-pressed={flipped} onClick={onFlip}>
          {cta}
        </button>
      )}
    </div>
  );
}

/* One mock vignette per platform pane id. `flipped` is the micro state. */
export function MockScreen({ id, flipped }: { id: string; flipped: boolean }) {
  switch (id) {
    case 'dashboard':
      return (
        <div className="mock">
          <div className="mock__statrow">
            <MockStat v="132" l="questions" />
            <MockStat v="87%" l="answered" />
            <MockStat v="4" l="topics rising" />
          </div>
          <div className="mock__bars" aria-hidden="true">
            {[82, 64, 51, 38, 22].map((w, i) => (
              <div key={i} className="mock__barline">
                <i style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
          <MockRow chip={flipped ? '✓' : 'gap'} dim={flipped}>
            Is there parking at the venue?
          </MockRow>
        </div>
      );
    case 'guests':
      return (
        <div className={flipped ? 'mock mock--drawer' : 'mock'}>
          <MockRow chip="✓✓">Ana Torres · party of 2</MockRow>
          <MockRow chip="✓">Marco Rossi · party of 3</MockRow>
          <MockRow chip="…">Sofia Vidal · party of 1</MockRow>
          <MockRow chip="✓✓">Luis Ortega · party of 4</MockRow>
          {flipped && (
            <div className="mock__drawer">
              <b>Ana Torres</b>
              <span>Party: Luis · RSVP: both events</span>
              <span>History: 3 questions answered</span>
            </div>
          )}
        </div>
      );
    case 'broadcasts':
      return (
        <div className="mock">
          <div className="mock__chips-row">
            <span className={flipped ? 'mock__chip mock__chip--on' : 'mock__chip'}>no reply yet</span>
            <span className="mock__chip">has phone</span>
            <span className="mock__chip">EN + ES</span>
          </div>
          <div className="mock__composer">
            <span>Friendly reminder: RSVP closes May 12…</span>
          </div>
          <MockStat v={flipped ? '37' : '142'} l="recipients" />
        </div>
      );
    case 'seating':
      return (
        <div className="mock mock--seating">
          <div className="mock__floor" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`mock__table mock__table--${i}`}>
                {[...Array(6)].map((_, d) => (
                  <i key={d} className={flipped ? 'mock__seat is-filled' : 'mock__seat'} style={{ transitionDelay: `${(i * 6 + d) * 30}ms` }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    case 'budget':
      return (
        <div className="mock">
          <MockRow chip="paid">Venue deposit · 12,000.00</MockRow>
          <MockRow chip="due Sep">Catering, per plate · 89.50</MockRow>
          <MockRow chip="reimb.">Florals, arch · 1,450.00</MockRow>
          {flipped ? (
            <div className="mock__drawer">
              <b>Import review</b>
              <span>109 items found · total 285,545.06</span>
              <span>Nothing is written until you approve</span>
            </div>
          ) : (
            <MockStat v="285,545.06" l="grand total" />
          )}
        </div>
      );
    case 'brain':
      return (
        <div className="mock">
          <div className="mock__composer mock__composer--tall">
            <span>Shuttle: leaves Hotel Grand at 3:15 PM, free for guests…</span>
          </div>
          <div className="mock__chips-row">
            <span className="mock__chip">v11</span>
            <span className={flipped ? 'mock__chip mock__chip--on' : 'mock__chip'}>{flipped ? 'v12 · live' : 'v12 · draft'}</span>
          </div>
        </div>
      );
    case 'planner':
      return (
        <div className="mock">
          {flipped ? (
            <div className="mock__drawer">
              <b>Change request · 3 edits</b>
              <span>Rosa Delgado: table 7 → 4</span>
              <span>Diego Morales: vegetarian</span>
              <span>Awaiting the couple’s approval</span>
            </div>
          ) : (
            <>
              <MockRow chip="edit">Rosa Delgado · table 7 → 4</MockRow>
              <MockRow chip="edit">Diego Morales · vegetarian</MockRow>
              <MockRow dim>Phones and emails hidden</MockRow>
            </>
          )}
        </div>
      );
    case 'checkin':
      return (
        <div className="mock mock--checkin">
          <div className="mock__scan" aria-hidden="true">
            <i className="mock__scanline" />
          </div>
          <MockStat v={flipped ? '87' : '86'} l="checked in" />
        </div>
      );
    default:
      return null;
  }
}

/* Convenience wrapper: vignette + its micro interaction state. */
export function MockPane({ id, cta, done }: { id: string; cta: string; done: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <>
      <MockScreen id={id} flipped={flipped} />
      <MicroButton cta={cta} done={done} flipped={flipped} onFlip={() => setFlipped(true)} />
    </>
  );
}
