import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLang } from '../ui/LanguageContext';
import { BrandText } from '../ui/BrandText';
import { emit } from '../analytics/emit';
import { isEmail } from '../booking/core';
import { getCatalogue, requestGuide } from './client';
import type { Catalogue, GuideField } from './core';
import { guidesCopy } from './copy';

/* #50 the guides form (lazy chunk, mounted by GuidesSection when the section
   comes near). It reads the catalogue from app.guest-ly.com first: the cards,
   the tips sentence and its version all come from there (no guide data in
   the landing, D24), and anything but "open" hides the section, or, when
   the section is already in view (or a ?guide= link brought the person
   here), says so in place with the contact address. Then: pick a
   place, leave an email, tick tips only if wanted, and the guide arrives by
   email. No request before the press; the answer is the same for every
   accepted address (a repeat within the day included). Contract: L7P-LOG
   "Guides API for the landing (v1, fixed Nov 5)". */

type Open = Extract<Catalogue, { kind: 'open' }>;
export type GuidesFormProps = {
  /* From ?guide=<code> or ?guide=all: preselect that guide. */
  initial: string | null;
  /* The catalogue is not open. true: the section went away (it was still
     below the viewport). false: it stays, and the form shows the calm
     "not available, write to us" line in its place. */
  onHidden: () => boolean;
};

function zone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

export default function GuidesForm({ initial, onHidden }: GuidesFormProps) {
  const { t, lang } = useLang();
  const c = guidesCopy[lang];
  const uid = useId();
  const [cat, setCat] = useState<Open | null>(null);
  const [place, setPlace] = useState('');
  const [email, setEmail] = useState('');
  const [tips, setTips] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<GuideField | 'form' | 'network' | 'retry', boolean>>>({});
  const [pending, setPending] = useState(false);
  const [closed, setClosed] = useState(false);
  const [sent, setSent] = useState<{ place: string; email: string } | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const firstPlaceRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const closedRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const props = useRef({ initial, onHidden });
  const focusEmail = useRef(false);

  /* One catalogue read per mount. */
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void getCatalogue().then((r) => {
      if (r.kind !== 'open') {
        if (!props.current.onHidden()) setClosed(true);
        return;
      }
      setCat(r);
      const want = props.current.initial;
      if (want && r.guides.some((g) => g.code === want)) {
        setPlace(want);
        focusEmail.current = true;
      }
    });
  }, []);

  /* ?guide=<code>: the guide is picked, so the email is next. In the same
     commit as the form, so nothing can take focus in between. */
  useLayoutEffect(() => {
    if (!cat || !focusEmail.current) return;
    focusEmail.current = false;
    emailRef.current?.focus();
  }, [cat]);

  if (closed) {
    return (
      /* Its own node (key): React would otherwise reuse the skeleton's div and
         the box would start without its padding for a frame. */
      <div key="closed" className="glass guides-done" role="status" ref={closedRef} tabIndex={-1}>
        <p className="card-body">{c.closed.replace('{email}', t.faq.human.email)}</p>
      </div>
    );
  }

  if (!cat) {
    /* Skeleton in the form's shape while the catalogue loads. */
    return (
      <div className="guides-skeleton" aria-hidden="true">
        <div className="guides__grid">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="guides-ghost" />
          ))}
        </div>
        <div className="glass guides__side guides-ghost--side" />
      </div>
    );
  }

  const placeName = (code: string) => cat.guides.find((g) => g.code === code)?.name[lang] ?? code;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const bad: Partial<Record<GuideField, boolean>> = {};
    if (!place) bad.code = true;
    if (!isEmail(email)) bad.email = true;
    if (bad.code || bad.email) {
      setErrors(bad);
      (bad.code ? firstPlaceRef.current : emailRef.current)?.focus();
      return;
    }
    setErrors({});
    setPending(true);
    const res = await requestGuide({
      email: email.trim(),
      code: place,
      lang,
      visitorTz: zone(),
      tips,
      consentVersion: cat.consent.version,
      fax_number: honeypot.current?.value ?? '',
    });
    setPending(false);
    if (res.kind === 'sent') {
      emit({ k: 'guide', id: place });
      setSent({ place, email: email.trim() });
      requestAnimationFrame(() => doneRef.current?.focus());
    } else if (res.kind === 'invalid') {
      if (res.field) {
        setErrors({ [res.field]: true });
        (res.field === 'code' ? firstPlaceRef.current : emailRef.current)?.focus();
      } else setErrors({ form: true });
    } else if (res.kind === 'closed') {
      /* The form (and the focused button) goes away: focus moves to the line. */
      setClosed(true);
      requestAnimationFrame(() => closedRef.current?.focus());
    } else {
      /* 503 or no answer: the input stays and the next press sends again. */
      setErrors(res.kind === 'retry' ? { retry: true } : { network: true });
    }
  };

  const again = () => {
    setSent(null);
    setPlace('');
    setTips(false);
    requestAnimationFrame(() => firstPlaceRef.current?.focus());
  };

  const errId = (f: string) => `${uid}-${f}-err`;
  const formError = errors.retry ? c.errors.retry : errors.network ? c.errors.network : errors.form ? c.errors.form : null;

  return sent ? (
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
      <fieldset className="guides__places" aria-describedby={errors.code ? errId('code') : undefined}>
        <legend className="guides__legend">{c.destLegend}</legend>
        <div className="guides__grid">
          {cat.guides.map((g, i) => (
            <label key={g.code} className={place === g.code ? 'guides-place on' : 'guides-place'}>
              <input
                ref={i === 0 ? firstPlaceRef : undefined}
                type="radio"
                name={`${uid}-place`}
                value={g.code}
                checked={place === g.code}
                onChange={() => {
                  setPlace(g.code);
                  if (errors.code) setErrors((x) => ({ ...x, code: false }));
                }}
              />
              <span className="guides-place__name">{g.name[lang]}</span>
              <span className="guides-place__country">{g.place[lang]}</span>
            </label>
          ))}
        </div>
        {errors.code ? (
          <p className="guides__error" id={errId('code')}>
            {c.errors.code}
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
        {/* The catalogue's sentence word for word (the server records its version). */}
        <label className="guides__consent">
          <input type="checkbox" checked={tips} onChange={(e) => setTips(e.target.checked)} />
          <span>
            <BrandText text={cat.consent.text[lang]} />
          </span>
        </label>
        <p className="guides__note">
          {c.consentNote} <a href="/privacy">{c.privacyLink}</a>
        </p>
        <label className="guides__hp" aria-hidden="true">
          Fax
          <input ref={honeypot} name="fax_number" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
        {formError ? (
          <p className="guides__error guides__error--form" role="alert">
            {formError}
          </p>
        ) : null}
        {/* Never disabled (a focused button that turns disabled drops focus to
            the page); a press while one is pending is ignored. */}
        <button type="submit" className="btn btn--gold-line btn--lg guides__submit" aria-disabled={pending || undefined} data-track="guide-submit">
          {pending ? c.sending : c.submit}
        </button>
      </div>
    </form>
  );
}
