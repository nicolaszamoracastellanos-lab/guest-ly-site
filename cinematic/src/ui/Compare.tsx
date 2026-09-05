import { useState } from 'react';
import { useLang } from './LanguageContext';
import { useHashParam } from './useHashParam';

/* № 07: the competitor comparison, back by request but collapsed by default.
   Phones get a pinned two-column card (Guest-ly locked left, one selectable
   competitor right); desktop gets the classic table in its own scroll
   container. One data source, two presentations. */

function Mark({ value, includedSr, notIncludedSr }: { value: string; includedSr: string; notIncludedSr: string }) {
  if (value === 'yes')
    return (
      <span className="tick" role="img" aria-label={includedSr}>
        ✓
      </span>
    );
  if (value === 'no')
    return (
      <span className="cross" role="img" aria-label={notIncludedSr}>
        ✕
      </span>
    );
  return <span className="compare__text">{value}</span>;
}

export function Compare() {
  const { t } = useLang();
  const c = t.compare;
  const deepLink = useHashParam('compare');
  const [open, setOpen] = useState(false);
  const opened = open || deepLink !== null;
  const guestly = c.columns[0];
  const rivals = c.columns.slice(1);
  const [rivalId, setRivalId] = useState(rivals[0].id);
  const rival = rivals.find((r) => r.id === rivalId) ?? rivals[0];

  return (
    <section id="compare" className="section section--tight">
      <div className="container">
        <div className="reveal">
          <div className={opened ? 'glass compare is-open' : 'glass compare'}>
            <button
              type="button"
              className="pillar__toggle"
              aria-expanded={opened}
              aria-controls="compare-body"
              onClick={() => setOpen(!opened)}
            >
              <span className="pillar__head">
                <span className="compare__eyebrow">
                  <span className="sec-no">{c.no}</span>
                  <span className="sec-rule" aria-hidden="true" />
                  <span className="sec-kicker">{c.toggle}</span>
                </span>
                <span className="compare__hint-line">{c.hint}</span>
                <span className="compare__sub">{c.sub}</span>
              </span>
              <span className="pillar__meta">
                <span className="pillar__plus" aria-hidden="true">
                  +
                </span>
              </span>
            </button>

            <div className="pillar__body" id="compare-body" inert={!opened}>
              <div className="pillar__inner">
                {/* Phone: pinned Guest-ly column vs one selectable rival. */}
                <div className="compare__mobile">
                  <div className="compare__chips" role="tablist" aria-label={c.toggle}>
                    {rivals.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        role="tab"
                        aria-selected={rivalId === r.id}
                        className={rivalId === r.id ? 'compare-chip on' : 'compare-chip'}
                        onClick={() => setRivalId(r.id)}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                  <div className="compare__card">
                    <div className="compare__col compare__col--us">
                      <span className="compare__name">{guestly.name}</span>
                      <span className="compare__colsub">{guestly.sub}</span>
                    </div>
                    <div className="compare__col">
                      <span className="compare__name">{rival.name}</span>
                      <span className="compare__colsub">{rival.sub}</span>
                    </div>
                    {c.rows.map((row, ri) => (
                      <div key={row} className="compare__pair">
                        <span className="compare__rowlabel">{row}</span>
                        <span className="compare__cell compare__cell--us">
                          <Mark value={guestly.marks[ri]} includedSr={c.includedSr} notIncludedSr={c.notIncludedSr} />
                        </span>
                        <span className="compare__cell">
                          <Mark value={rival.marks[ri]} includedSr={c.includedSr} notIncludedSr={c.notIncludedSr} />
                        </span>
                      </div>
                    ))}
                    <div className="compare__pair compare__pair--price">
                      <span className="compare__rowlabel">{c.priceLabel}</span>
                      <span className="compare__cell compare__cell--us">{guestly.price}</span>
                      <span className="compare__cell">{rival.price}</span>
                    </div>
                  </div>
                </div>

                {/* Desktop: the classic table, scrolling in its own box. */}
                <div className="compare__desktop">
                  <div className="compare__scroll">
                    <table className="compare__table">
                      <thead>
                        <tr>
                          <th scope="col">
                            <span className="visually-hidden">{c.sub}</span>
                          </th>
                          {c.columns.map((col) => (
                            <th scope="col" key={col.id} className={col.highlight ? 'is-us' : undefined}>
                              <span className="compare__name">{col.name}</span>
                              <span className="compare__colsub">{col.sub}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {c.rows.map((row, ri) => (
                          <tr key={row}>
                            <th scope="row">{row}</th>
                            {c.columns.map((col) => (
                              <td key={col.id} className={col.highlight ? 'is-us' : undefined}>
                                <Mark value={col.marks[ri]} includedSr={c.includedSr} notIncludedSr={c.notIncludedSr} />
                              </td>
                            ))}
                          </tr>
                        ))}
                        <tr className="compare__price-row">
                          <th scope="row">{c.priceLabel}</th>
                          {c.columns.map((col) => (
                            <td key={col.id} className={col.highlight ? 'is-us' : undefined}>
                              {col.price}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="compare__footnote">{c.footnote}</p>
                <p className="zola-line">
                  <span className="zola-line__mark" aria-hidden="true">
                    ✦
                  </span>
                  {c.zolaLine}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
