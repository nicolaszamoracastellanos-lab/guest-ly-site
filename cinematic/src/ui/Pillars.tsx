import { useState } from 'react';
import { useLang } from './LanguageContext';
import { SectionHeader } from './Sections';

/* The Three Pillars: three glass cards, one line each; the expanders carry
   the summary claims, with deep links into the richer wave 5.1 sections
   (scenarios, channels, platform tour, coordinator). */
export function Pillars() {
  const { t } = useLang();
  const p = t.pillars;
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <section id="pillars" className="section">
      <div className="container">
        <SectionHeader no={p.no} kicker={p.kicker} title={p.title} />
        <div className="pillar-grid">
          {p.items.map((item) => {
            const isOpen = !!open[item.id];
            /* The reveal class lives on a static wrapper: React rewrites the
               inner card's className on toggle, which would wipe the
               observer-added is-visible and fade the card out for good. */
            return (
              <div key={item.id} className="reveal">
                <div className={isOpen ? 'glass pillar is-open' : 'glass pillar'}>
                  <button
                    type="button"
                    className="pillar__toggle"
                    aria-expanded={isOpen}
                    aria-controls={`pillar-${item.id}`}
                    onClick={() => setOpen((v) => ({ ...v, [item.id]: !v[item.id] }))}
                  >
                    <span className="pillar__head">
                      <span className="pillar__title">{item.title}</span>
                      <span className="pillar__line">{item.line}</span>
                    </span>
                    <span className="pillar__meta">
                      <span className="pillar__hint">{p.expand}</span>
                      <span className="pillar__plus" aria-hidden="true">
                        +
                      </span>
                    </span>
                  </button>
                  <div className="pillar__body" id={`pillar-${item.id}`} inert={!isOpen}>
                    <div className="pillar__inner">
                      <ul className="pillar__list">
                        {item.details.map((d) => (
                          <li key={d.h}>
                            <strong>{`${d.h}.`}</strong>
                            {` ${d.b}`}
                            {d.link ? (
                              <a className="pillar__link" href={d.link.href}>
                                {`${d.link.label} →`}
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
