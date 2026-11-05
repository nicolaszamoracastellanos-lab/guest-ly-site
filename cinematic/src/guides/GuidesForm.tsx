import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLang } from '../ui/LanguageContext';
import { BrandText } from '../ui/BrandText';
import { emit } from '../analytics/emit';
import { isEmail, newKey } from '../booking/core';
import { requestGuide } from './client';
import type { GuideField } from './core';
import { CONSENT_VERSION, guidesCopy } from './copy';

/* #50 the guides form (lazy chunk, mounted by GuidesSection when the section
   comes near): pick a place, leave an email, tick tips only if wanted, and
   the guide arrives by email from app.guest-ly.com. No request before the
   press; the answer is the same for every accepted address (a repeat within
   the day included). */

const DESTINATIONS = import.meta.env.VITE_GUIDE_DESTINATIONS;

function zone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

export default function GuidesForm() {
  const { t, lang } = useLang();
  const c = guidesCopy[lang];
  const uid = useId();
  const [place, setPlace] = useState('');
  const [email, setEmail] = useState('');
  const [tips, setTips] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<GuideField | 'form' | 'network' | 'closed', boolean>>>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<{ place: string; email: string } | null>(null);
  const key = useRef<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const firstPlaceRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  const placeName = (id: string) => DESTINATIONS.find((d) => d.id === id)?.name[lang] ?? id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const bad: Partial<Record<GuideField, boolean>> = {};
    if (!place) bad.destination = true;
    if (!isEmail(email)) bad.email = true;
    if (bad.destination || bad.email) {
      setErrors(bad);
      (bad.destination ? firstPlaceRef.current : emailRef.current)?.focus();
      return;
    }
    setErrors({});
    setPending(true);
    key.current ??= newKey();
    const res = await requestGuide({
      destination: place,
      email: email.trim(),
      lang,
      visitorTz: zone(),
      consent: tips,
      consentVersion: CONSENT_VERSION,
      ...(tips ? { consentText: c.consent } : {}),
      idempotencyKey: key.current,
      fax_number: honeypot.current?.value ?? '',
    });
    setPending(false);
    if (res.kind === 'error') {
      /* Unknown outcome: the next press reuses the key. */
      setErrors({ network: true });
      return;
    }
    key.current = null;
    if (res.kind === 'sent') {
      emit({ k: 'guide', id: place });
      setSent({ place, email: email.trim() });
      requestAnimationFrame(() => doneRef.current?.focus());
    } else if (res.kind === 'invalid') {
      if (res.field) {
        setErrors({ [res.field]: true });
        (res.field === 'destination' ? firstPlaceRef.current : emailRef.current)?.focus();
      } else setErrors({ form: true });
    } else setErrors({ closed: true });
  };

  const again = () => {
    setSent(null);
    setPlace('');
    setTips(false);
    requestAnimationFrame(() => firstPlaceRef.current?.focus());
  };

  const errId = (f: string) => `${uid}-${f}-err`;

  return (
    <>
        {sent ? (
          <div className="glass guides-done" role="status">
            <h3 className="card-title" ref={doneRef} tabIndex={-1}>
              {c.doneTitle}
            </h3>
            <p className="card-body">{c.doneBody.replace('{place}', placeName(sent.place)).replace('{email}', sent.email)}</p>
            <button type="button" className="guides__again" onClick={again}>
              {c.another}
            </button>
          </div>
        ) : (
          <form className="guides" onSubmit={submit} noValidate aria-busy={pending || undefined}>
            <fieldset className="guides__places" aria-describedby={errors.destination ? errId('destination') : undefined}>
              <legend className="guides__legend">{c.destLegend}</legend>
              <div className="guides__grid">
                {DESTINATIONS.map((d, i) => (
                  <label key={d.id} className={place === d.id ? 'guides-place on' : 'guides-place'}>
                    <input
                      ref={i === 0 ? firstPlaceRef : undefined}
                      type="radio"
                      name={`${uid}-place`}
                      value={d.id}
                      checked={place === d.id}
                      onChange={() => {
                        setPlace(d.id);
                        if (errors.destination) setErrors((x) => ({ ...x, destination: false }));
                      }}
                    />
                    <span className="guides-place__name">{d.name[lang]}</span>
                    <span className="guides-place__country">{d.country[lang]}</span>
                  </label>
                ))}
              </div>
              {errors.destination ? (
                <p className="guides__error" id={errId('destination')}>
                  {c.errors.destination}
                </p>
              ) : null}
            </fieldset>

            <div className="glass guides__side">
              <label className="field">
                <span>{c.email}</span>
                <input
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((x) => ({ ...x, email: false }));
                  }}
                  aria-invalid={errors.email || undefined}
                  aria-describedby={errors.email ? errId('email') : undefined}
                />
                {errors.email ? (
                  <em className="guides__error" aria-hidden="true" id={errId('email')}>
                    {c.errors.email}
                  </em>
                ) : null}
              </label>
              <label className="guides__consent">
                <input type="checkbox" checked={tips} onChange={(e) => setTips(e.target.checked)} />
                <span>
                  <BrandText text={c.consent} />
                </span>
              </label>
              <p className="guides__note">
                {c.consentNote} <a href="/privacy">{c.privacyLink}</a>
              </p>
              <label className="guides__hp" aria-hidden="true">
                Fax
                <input ref={honeypot} name="fax_number" tabIndex={-1} autoComplete="off" defaultValue="" />
              </label>
              {errors.network || errors.form || errors.closed ? (
                <p className="guides__error guides__error--form" role="alert">
                  {errors.closed ? c.closed.replace('{email}', t.faq.human.email) : errors.network ? c.errors.network : c.errors.form}
                </p>
              ) : null}
              <button type="submit" className="btn btn--gold-line btn--lg guides__submit" disabled={pending} data-track="guide-submit">
                {pending ? c.sending : c.submit}
              </button>
            </div>
          </form>
        )}
    </>
  );
}
