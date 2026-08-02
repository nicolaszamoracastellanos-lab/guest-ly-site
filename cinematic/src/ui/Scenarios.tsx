import { useState } from 'react';
import { useLang } from './LanguageContext';
import { SectionHeader } from './Sections';
import { ScenarioPlayer } from './ScenarioPlayer';
import { useHashParam } from './useHashParam';

/* № 01 "See it happen": four playable scenario cards. Collapsed poster rows
   that expand in place and start playback; multiple may be open. Deep links
   like #scenarios=marco preselect and open a card. */
export function Scenarios() {
  const { t } = useLang();
  const s = t.scenarios;
  const deepLink = useHashParam('scenarios');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const isOpen = (id: string) => open[id] ?? deepLink === id;

  return (
    <section id="scenarios" className="section">
      <div className="container">
        <SectionHeader no={s.no} kicker={s.kicker} title={s.title} intro={s.intro} />
        <div className="scn-grid">
          {s.items.map((scenario) => {
            const opened = isOpen(scenario.id);
            return (
              <div key={scenario.id} className="reveal">
                <div className={opened ? 'glass scn-card is-open' : 'glass scn-card'}>
                  <button
                    type="button"
                    className="scn-card__head"
                    aria-expanded={opened}
                    aria-controls={`scn-${scenario.id}`}
                    onClick={() => setOpen((v) => ({ ...v, [scenario.id]: !isOpen(scenario.id) }))}
                  >
                    <span className="scn-card__labels">
                      <span className="scn-card__time">{scenario.timeLabel}</span>
                      <span className="scn-card__title">{scenario.label}</span>
                    </span>
                    <span className="pillar__plus" aria-hidden="true">
                      +
                    </span>
                  </button>
                  <div className="scn-card__body" id={`scn-${scenario.id}`} inert={!opened}>
                    <div className="scn-card__inner">
                      {/* Static transcript stays in the DOM for crawlers and
                          screen readers; the live player mounts on open. */}
                      <div hidden={opened} className="scn-transcript">
                        {scenario.steps.map((step, i) =>
                          step.text ? <p key={i}>{step.text}</p> : null,
                        )}
                        <p>{scenario.endNote}</p>
                      </div>
                      {opened && <ScenarioPlayer scenario={scenario} autoPlay />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="scn-disclaimer reveal">{s.disclaimer}</p>
      </div>
    </section>
  );
}
