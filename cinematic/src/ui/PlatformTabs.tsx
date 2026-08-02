import { useEffect, useRef, useState } from 'react';
import { useLang } from './LanguageContext';
import { SectionHeader } from './Sections';
import { MockPane, MockWindowBar } from './MockScreens';
import { useHashParam } from './useHashParam';

/* № 04 "Inside the platform": the portal rebuilt in miniature. A proper
   tablist (arrow keys, aria-selected) over 8 MockScreen vignettes, each
   with real product facts and one micro-interaction. Deep links like
   #platform=seating preselect a pane. */
export function PlatformTabs() {
  const { t } = useLang();
  const p = t.platform;
  const deepLink = useHashParam('platform');
  const [active, setActive] = useState(p.items[0].id);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (deepLink && p.items.some((item) => item.id === deepLink)) setActive(deepLink);
  }, [deepLink, p.items]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = p.items.findIndex((item) => item.id === active);
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = p.items[(idx + delta + p.items.length) % p.items.length];
    setActive(next.id);
    tabsRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus();
  };

  return (
    <section id="platform" className="section">
      <div className="container">
        <SectionHeader no={p.no} kicker={p.kicker} title={p.title} intro={p.intro} />

        <div className="glass tour reveal">
          <MockWindowBar label={p.windowLabel} />
          <div className="tour__layout">
            <div className="tour__tabs" role="tablist" aria-label={p.kicker} ref={tabsRef} onKeyDown={onKeyDown}>
              {p.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  data-tab={item.id}
                  id={`tour-tab-${item.id}`}
                  aria-selected={active === item.id}
                  aria-controls={`tour-pane-${item.id}`}
                  tabIndex={active === item.id ? 0 : -1}
                  className={active === item.id ? 'tour-tab on' : 'tour-tab'}
                  onClick={() => setActive(item.id)}
                >
                  <span className="tour-tab__label">{item.menuLabel}</span>
                </button>
              ))}
            </div>

            {p.items.map((item) => (
              <div
                key={item.id}
                role="tabpanel"
                id={`tour-pane-${item.id}`}
                aria-labelledby={`tour-tab-${item.id}`}
                hidden={active !== item.id}
                inert={active !== item.id}
                className="tour__pane"
              >
                <div className="tour__mock">
                  {/* key remounts the micro state when re-entering a pane */}
                  {active === item.id && <MockPane key={item.id} id={item.id} cta={item.microCta} done={item.microDone} />}
                </div>
                <div className="tour__facts">
                  <h3 className="tour__title">{item.title}</h3>
                  <p className="tour__blurb">{item.blurb}</p>
                  <ul className="tour__list">
                    {item.facts.map((fact) => (
                      <li key={fact}>
                        <span className="tick" aria-hidden="true">
                          ✓
                        </span>
                        {fact}
                      </li>
                    ))}
                  </ul>
                  {item.wow && (
                    <p className="wow-chip">
                      <span aria-hidden="true">✦</span>
                      {item.wow}
                    </p>
                  )}
                  {item.link && (
                    <a className="tour__link" href={item.link.href}>
                      {item.link.label}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
