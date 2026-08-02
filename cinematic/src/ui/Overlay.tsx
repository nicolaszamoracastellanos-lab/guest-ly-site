import { useCallback, useEffect, useMemo, useState } from 'react';
import { LanguageProvider, useLang } from './LanguageContext';
import { ThemeEffects } from '../theme/ThemeContext';
import { WizardContext } from './WizardContext';
import type { PlanId, WizardApi } from './WizardContext';
import { Nav } from './Nav';
import { Hero } from './Hero';
import { FinalCta } from './Sections';
import { Scenarios } from './Scenarios';
import { Pillars } from './Pillars';
import { Channels } from './Channels';
import { PlatformTabs } from './PlatformTabs';
import { CoordinatorSpotlight } from './CoordinatorSpotlight';
import { HowStepper } from './HowStepper';
import { Compare } from './Compare';
import { Pricing } from './Pricing';
import { Founding } from './Founding';
import { Faq } from './Faq';
import { Footer } from './Footer';
import { Wizard } from './Wizard';
import './overlay.css';

interface WizardRequest {
  id: number;
  plan: PlanId;
}

/* Keyboard users jump straight past the fixed nav. */
function SkipLink() {
  const { t } = useLang();
  return (
    <a className="skip-link" href="#main">
      {t.nav.skip}
    </a>
  );
}

export function Overlay() {
  const [wizard, setWizard] = useState<WizardRequest | null>(null);

  const openWizard = useCallback((plan: PlanId = 'signature') => {
    setWizard((prev) => ({ id: (prev?.id ?? 0) + 1, plan }));
  }, []);
  const closeWizard = useCallback(() => setWizard(null), []);
  const wizardApi = useMemo<WizardApi>(() => ({ open: openWizard }), [openWizard]);

  /* Scroll reveals: one IntersectionObserver toggling `is-visible`.
     Content is visible by default; `.reveal` only hides once `body.js-ready`
     exists, so a missing observer/JS failure never blanks the page. */
  useEffect(() => {
    document.body.classList.add('js-ready');
    const els = Array.from(document.querySelectorAll<HTMLElement>('.overlay-page .reveal'));
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <LanguageProvider>
      <WizardContext.Provider value={wizardApi}>
        <ThemeEffects />
        <SkipLink />
        <div className="overlay-page">
          <Nav />
          {/* Wave 5.1 order: hero + marquee, scenarios, pillars, channels,
              platform tour, coordinator spotlight, how stepper, compare,
              pricing, founding, faq, final CTA. */}
          <main id="main">
            <Hero />
            <Scenarios />
            <Pillars />
            <Channels />
            <PlatformTabs />
            <CoordinatorSpotlight />
            <HowStepper />
            <Compare />
            <Pricing />
            <Founding />
            <Faq />
            <FinalCta />
          </main>
          <Footer />
          {wizard && <Wizard key={wizard.id} initialPlan={wizard.plan} onClose={closeWizard} />}
        </div>
      </WizardContext.Provider>
    </LanguageProvider>
  );
}
