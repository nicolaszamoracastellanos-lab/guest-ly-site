import { useState } from 'react';
import { useLang } from './LanguageContext';
import { SectionHeader } from './Sections';
import { BookCta, BookGate } from '../booking/BookingContext';
import { useGuidesShown } from '../guides/state';

export function Faq() {
  const { t } = useLang();
  const f = t.faq;
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const guidesShown = useGuidesShown();

  return (
    <section id="faq" className="section">
      <div className="container">
        {/* The guides section (#50) takes № 10 while it is on the page. */}
        <SectionHeader no={import.meta.env.VITE_GUIDES_ENABLED && guidesShown ? f.noAfterGuides : f.no} kicker={f.kicker} title={f.title} />
        <div className="faq-layout">
          <div className="glass faq-human reveal">
            <h3 className="card-title card-title--sm">{f.human.title}</h3>
            <p className="card-body">{f.human.body}</p>
            <a className="faq-human__mail" href={`mailto:${f.human.email}`}>
              {f.human.email}
            </a>
            {import.meta.env.VITE_BOOKING_ENABLED && (
              <BookGate>
                <div className="faq-human__book">
                  <BookCta id="faq" />
                </div>
              </BookGate>
            )}
          </div>

          <div className="faq-list reveal">
            {f.items.map((item, i) => {
              const isOpen = openIdx === i;
              return (
                <div key={i} className={isOpen ? 'faq-item is-open' : 'faq-item'}>
                  <button
                    type="button"
                    className="faq-q"
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                  >
                    <span>{item.q}</span>
                    <span className="faq-plus" aria-hidden="true">
                      +
                    </span>
                  </button>
                  {/* inert while collapsed: keyboard and AT users never land
                      inside a visually hidden answer. */}
                  <div className="faq-a" id={`faq-a-${i}`} inert={!isOpen}>
                    <div className="faq-a__inner">
                      <p>{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
