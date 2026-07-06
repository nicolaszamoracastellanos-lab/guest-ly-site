import { useState } from 'react';
import { useLang } from './LanguageContext';
import { SectionHeader } from './Sections';

export function Faq() {
  const { t } = useLang();
  const f = t.faq;
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="section">
      <div className="container">
        <SectionHeader no={f.no} kicker={f.kicker} title={f.title} />
        <div className="faq-layout">
          <div className="glass faq-human reveal">
            <h3 className="card-title card-title--sm">{f.human.title}</h3>
            <p className="card-body">{f.human.body}</p>
            <a className="faq-human__mail" href={`mailto:${f.human.email}`}>
              {f.human.email}
            </a>
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
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                  >
                    <span>{item.q}</span>
                    <span className="faq-plus" aria-hidden="true">
                      +
                    </span>
                  </button>
                  <div className="faq-a">
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
