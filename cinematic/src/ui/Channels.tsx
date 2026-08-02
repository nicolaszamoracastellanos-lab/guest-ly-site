import { useState } from 'react';
import { useLang } from './LanguageContext';
import { SectionHeader } from './Sections';
import { useHashParam } from './useHashParam';

/* № 03 "One brain. Every channel.": channel switcher with honest Live /
   Coming soon states, the languages strip (canonical claim + per-language
   sample bubbles), and the international guest guide expander. */
export function Channels() {
  const { t } = useLang();
  const c = t.channels;
  useHashParam('channels');
  const [active, setActive] = useState('whatsapp');
  const [langChip, setLangChip] = useState('en');
  const [guideOpen, setGuideOpen] = useState(false);

  const sample = c.languages.chips.find((chip) => chip.id === langChip) ?? c.languages.chips[0];

  return (
    <section id="channels" className="section">
      <div className="container">
        <SectionHeader no={c.no} kicker={c.kicker} title={c.title} intro={c.intro} />

        <div className="chan reveal">
          <div className="chan__chips" role="tablist" aria-label={c.kicker}>
            {c.cards.map((card) => (
              <button
                key={card.id}
                type="button"
                role="tab"
                aria-selected={active === card.id}
                className={active === card.id ? 'chan-chip on' : 'chan-chip'}
                onClick={() => setActive(card.id)}
              >
                {card.name}
                {card.status === 'live' ? (
                  <span className="chan-chip__live" aria-label={c.liveLabel}>
                    <span className="badge__dot" aria-hidden="true" />
                    {c.liveLabel}
                  </span>
                ) : (
                  <span className="chan-chip__soon">{c.soonLabel}</span>
                )}
              </button>
            ))}
          </div>

          {c.cards.map((card) => (
            <div key={card.id} hidden={active !== card.id} inert={active !== card.id} className="chan__pane">
              <div className={card.status === 'soon' ? 'glass chan__stage chan__stage--soon' : 'glass chan__stage'}>
                {card.script.length > 0 ? (
                  <div className={card.id === 'whatsapp' ? 'chan__chat chan__chat--wa' : 'chan__chat'}>
                    {card.script.map((line, i) => (
                      <p key={i} className={line.from === 'guest' ? 'bubble bubble--guest' : 'bubble bubble--ai'}>
                        {line.text}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="chan__soon-note">{card.caption}</p>
                )}
              </div>
              <div className="chan__side">
                {card.script.length > 0 && <p className="chan__caption">{card.caption}</p>}
                {card.fact && (
                  <p className="wow-chip">
                    <span aria-hidden="true">✦</span>
                    {card.fact}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="glass lang-strip reveal">
          <p className="lang-strip__headline">{c.languages.headline}</p>
          <div className="lang-strip__chips">
            {c.languages.chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                aria-pressed={langChip === chip.id}
                className={langChip === chip.id ? 'lang-chip on' : 'lang-chip'}
                onClick={() => setLangChip(chip.id)}
              >
                {chip.label}
                {chip.starred && (
                  <span className="lang-chip__star" aria-hidden="true">
                    ✦
                  </span>
                )}
              </button>
            ))}
            <span className="lang-chip lang-chip--more" aria-hidden="true">
              {c.languages.moreLabel}
            </span>
          </div>
          <div className="lang-strip__sample" aria-live="polite">
            <p className="bubble bubble--guest">{sample.q}</p>
            <p className="bubble bubble--ai">{sample.a}</p>
          </div>
          <p className="lang-strip__footnote">{c.languages.footnote}</p>
        </div>

        <div className="reveal">
          <div className={guideOpen ? 'glass intl is-open' : 'glass intl'}>
            <button
              type="button"
              className="pillar__toggle"
              aria-expanded={guideOpen}
              aria-controls="intl-guide"
              onClick={() => setGuideOpen((v) => !v)}
            >
              <span className="pillar__head">
                <span className="pillar__title intl__title">{c.intlGuide.title}</span>
              </span>
              <span className="pillar__meta">
                <span className="pillar__hint">{c.intlGuide.hint}</span>
                <span className="pillar__plus" aria-hidden="true">
                  +
                </span>
              </span>
            </button>
            <div className="pillar__body" id="intl-guide" inert={!guideOpen}>
              <div className="pillar__inner">
                <div className="intl__grid">
                  {c.intlGuide.items.map((item) => (
                    <div key={item.title} className="intl__item">
                      <span className="intl__h">{item.title}</span>
                      <span className="intl__b">{item.body}</span>
                    </div>
                  ))}
                </div>
                <p className="intl__closing">
                  {c.intlGuide.closing}
                  <a href={c.intlGuide.scenarioLink.href}>{c.intlGuide.scenarioLink.label}</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
