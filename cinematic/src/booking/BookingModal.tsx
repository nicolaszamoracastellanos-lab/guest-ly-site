import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLang } from '../ui/LanguageContext';
import { WHATSAPP } from '../config';
import { emit } from '../analytics/emit';
import { SLOGAN } from '../site-facts';
import { BrandText } from '../ui/BrandText';
import { API_ORIGIN, firstSlots, getSlots, postBooking, visitorZone } from './client';
import type { Raw } from './client';
import {
  readBook,
  readSlots,
  dayLong,
  dayOf,
  dayParts,
  daysOf,
  draftProblems,
  LIMITS,
  newKey,
  timeLabel,
  whenLabel,
  zoneChoices,
  zoneOffset,
  zonePhrase,
} from './core';
import type { BookField, BookRequest, BookResult, Booked, Draft, OpenSlots, Role, SlotsResult } from './core';
import { bookingCopy } from './copy';
import './booking.css';

/* #22 demo booking dialog (lazy chunk). Three steps in one dialog: pick a
   time in the visitor's zone (the host's zone named), leave contact details,
   see the booked call with its calendar file and manage link. Keyboard:
   focus starts on the step title, Tab stays inside, Escape closes, focus
   returns to the button that opened it. Every API answer has a calm state:
   closed or missing = write to us (email and WhatsApp), taken = fresh times,
   field refused = the field's own message with the input kept, no answer =
   try again with the same key. */

type Load = { s: 'loading' } | { s: 'ready'; data: OpenSlots } | { s: 'closed' } | { s: 'error' };
type Step = 'times' | 'details' | 'done';

const EMPTY: Draft = { name: '', email: '', phone: '', weddingDate: '', notes: '' };
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="radio"]):not([tabindex="-1"]),select,textarea';

const slotsOf = (r: Raw): SlotsResult => (r ? readSlots(r.status, r.body) : { kind: 'error' });
const book = async (req: BookRequest): Promise<BookResult> => {
  const r = await postBooking(req);
  return r ? readBook(r.status, r.body, API_ORIGIN) : { kind: 'error' };
};

/* "Thu, Nov 19" / "jue 19 nov": short enough for one button line at 390. */
const shortDay = (day: string, lang: 'en' | 'es') => {
  const p = dayParts(day, lang);
  return lang === 'es' ? `${p.weekday} ${p.date}` : `${p.weekday}, ${p.date}`;
};

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

export default function BookingModal({ trigger, onClose }: { trigger: HTMLElement | null; onClose: () => void }) {
  const { t, lang } = useLang();
  const c = bookingCopy[lang];
  const uid = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const reqId = useRef(0);
  const key = useRef(newKey());
  const sentSlot = useRef(false);

  const [tz, setTz] = useState(visitorZone);
  const [load, setLoad] = useState<Load>({ s: 'loading' });
  const [step, setStep] = useState<Step>('times');
  const [day, setDay] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [pickError, setPickError] = useState(false);
  const [taken, setTaken] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [role, setRole] = useState<Role | ''>('');
  const [errors, setErrors] = useState<Partial<Record<BookField | 'form' | 'network', boolean>>>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<Booked | null>(null);

  const contactEmail = t.faq.human.email;

  /* Results of a slot read: the first day with a time is selected. */
  const apply = useCallback((r: SlotsResult, id: number) => {
    if (id !== reqId.current) return;
    if (r.kind === 'open') {
      setLoad({ s: 'ready', data: r });
      setDay(daysOf(r.slots, r.window.timeZone, r.window.from, r.window.days).find((d) => d.slots.length)?.day ?? null);
    } else setLoad({ s: r.kind });
  }, []);

  const read = useCallback(
    (zone: string, from?: string) => {
      const id = ++reqId.current;
      setLoad({ s: 'loading' });
      setStart(null);
      void getSlots(zone, from).then((r) => apply(slotsOf(r), id));
    },
    [apply],
  );

  /* Open: the prefetched list when there is one, focus on the title, the
     page behind locked, #23 counts the opening. */
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const id = ++reqId.current;
    void firstSlots(tz).then((r) => apply(slotsOf(r), id));
    emit({ k: 'booking', a: 'opened' });
  }, [apply, tz]);

  useEffect(() => {
    const before = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    document.documentElement.classList.add('wizard-locked');
    return () => {
      document.documentElement.classList.remove('wizard-locked');
      if (before && before.isConnected) before.focus();
    };
  }, [trigger]);

  /* Each step starts with its title in focus, so a screen reader reads where
     it is and Tab moves on from there. */
  useEffect(() => {
    titleRef.current?.focus();
  }, [step]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === titleRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const data = load.s === 'ready' ? load.data : null;
  const viewZone = data?.window.timeZone ?? tz;
  const hostZone = data?.hostZone ?? 'America/La_Paz';
  const days = useMemo(() => (data ? daysOf(data.slots, data.window.timeZone, data.window.from, data.window.days) : []), [data]);
  const dayTimes = days.find((d) => d.day === day)?.slots ?? [];
  const hasTimes = days.some((d) => d.slots.length > 0);

  const pickTime = (iso: string) => {
    setStart(iso);
    setPickError(false);
    if (!sentSlot.current) {
      sentSlot.current = true;
      emit({ k: 'booking', a: 'slot' });
    }
  };

  const toDetails = () => {
    if (!start) {
      setPickError(true);
      return;
    }
    setTaken(false);
    setStep('details');
  };

  const honeypot = useRef<HTMLInputElement>(null);
  const fieldRefs = useRef<Partial<Record<BookField, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || !start) return;
    const problems = draftProblems(draft);
    if (problems.length) {
      setErrors(Object.fromEntries(problems.map((p) => [p, true])));
      fieldRefs.current[problems[0]]?.focus();
      return;
    }
    setErrors({});
    setPending(true);
    const res = await book({
      start,
      name: draft.name.trim(),
      email: draft.email.trim(),
      role,
      weddingDate: draft.weddingDate,
      phone: draft.phone.trim(),
      notes: draft.notes,
      lang,
      visitorTz: viewZone,
      idempotencyKey: key.current,
      fax_number: honeypot.current?.value ?? '',
    });
    setPending(false);
    if (res.kind === 'booked') {
      emit({ k: 'booking', a: 'booked' });
      setDone(res);
      setStep('done');
      return;
    }
    if (res.kind === 'error') {
      /* No answer: the outcome is unknown, so the next press reuses the key. */
      setErrors({ network: true });
      return;
    }
    /* A definite refusal: a new key for the next try. */
    key.current = newKey();
    if (res.kind === 'invalid') {
      if (res.field === 'start') return backToTimes(null);
      if (res.field) {
        setErrors({ [res.field]: true });
        fieldRefs.current[res.field]?.focus();
      } else setErrors({ form: true });
      return;
    }
    if (res.kind === 'taken') return backToTimes(res.slots);
    setLoad({ s: 'closed' });
    setStep('times');
  };

  /* The time is gone: back to the list, fresh times from the 409 when it
     sent them (14 days from today in the visitor's zone), else a new read. */
  const backToTimes = (fresh: string[] | null) => {
    setTaken(true);
    setStart(null);
    setStep('times');
    if (fresh && data) {
      const from = dayOf(new Date().toISOString(), viewZone);
      const next: OpenSlots = { ...data, slots: fresh, window: { from, days: 14, timeZone: viewZone }, nextOpen: null };
      ++reqId.current;
      setLoad({ s: 'ready', data: next });
      setDay(daysOf(fresh, viewZone, from, 14).find((d) => d.slots.length)?.day ?? null);
    } else read(viewZone);
  };

  const setField = (k: keyof Draft) => (e: { target: { value: string } }) => {
    const v = e.target.value;
    setDraft((d) => ({ ...d, [k]: v }));
    if (errors[k as BookField]) setErrors((x) => ({ ...x, [k]: false }));
  };

  /* A field's message sits inside its label for layout, hidden from the
     label's name (so the name stays "Email") and read through
     aria-describedby when the field gets focus. */
  const errId = (f: string) => `${uid}-${f}-err`;
  const fieldProps = (f: BookField) => ({
    'aria-invalid': errors[f] ? true : undefined,
    'aria-describedby': errors[f] ? errId(f) : undefined,
  });

  const contact = (
    <div className="book__contact">
      <a className="btn btn--ghost" href={`mailto:${contactEmail}`}>
        {contactEmail}
      </a>
      {WHATSAPP ? (
        <a className="btn btn--ghost" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">
          {c.whatsapp}
        </a>
      ) : null}
    </div>
  );

  const titleText = step === 'times' ? c.title : step === 'details' ? c.detailsTitle : c.doneTitle;

  return (
    <div
      className="wiz-backdrop book-backdrop"
      data-area="booking"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="wiz glass book"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <button type="button" className="wiz__close" onClick={onClose} aria-label={c.close}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h2 className="wiz__title book__title" id={`${uid}-title`} ref={titleRef} tabIndex={-1}>
          {titleText}
        </h2>

        {step === 'times' && (
          <div className="book__body">
            <p className="wiz__sub">
              <BrandText text={c.description} />
            </p>
            {/* Same height while loading, so nothing moves when the list arrives. */}
            {data || load.s === 'loading' ? (
              <p className="book__meta" aria-hidden={data ? undefined : true}>
                {data ? fill(c.duration, { n: data.durationMin }) : '\u00a0'}
              </p>
            ) : null}

            {/* The zones matter only while there are times to show. */}
            {data || load.s === 'loading' ? (
            <div className="book__zone">
              <p>
                <BrandText text={`${fill(c.zoneLine, { zone: zonePhrase(viewZone, lang) })} ${fill(c.hostLine, { host: zonePhrase(hostZone, lang) })}`} />
              </p>
              {zoneOpen ? (
                <label className="field book__zone-pick">
                  <span>{c.zoneLabel}</span>
                  <select
                    value={tz}
                    onChange={(e) => {
                      setTz(e.target.value);
                      setTaken(false);
                      read(e.target.value);
                    }}
                  >
                    {zoneChoices(visitorZone(), hostZone).map((z) => (
                      <option key={z} value={z}>
                        {`${zonePhrase(z, lang)} (${zoneOffset(z, Date.now())})`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <button type="button" className="book-link" onClick={() => setZoneOpen(true)}>
                  {c.changeZone}
                </button>
              )}
            </div>
            ) : null}

            {taken ? (
              <p className="book__notice" role="alert">
                {c.taken}
              </p>
            ) : null}

            {load.s === 'loading' && (
              <div className="book__skeleton" aria-busy="true">
                <span className="visually-hidden" role="status">
                  {c.loading}
                </span>
                <div className="book-days">
                  {Array.from({ length: 14 }, (_, i) => (
                    <span key={i} className="book-day book-day--ghost" />
                  ))}
                </div>
                <div className="book-times">
                  {Array.from({ length: 8 }, (_, i) => (
                    <span key={i} className="book-time book-time--ghost" />
                  ))}
                </div>
              </div>
            )}

            {load.s === 'closed' && (
              <div className="book__empty">
                <p>{c.closed}</p>
                {contact}
              </div>
            )}

            {load.s === 'error' && (
              <div className="book__empty">
                <p role="alert">{c.error}</p>
                <div className="book__contact">
                  <button type="button" className="btn btn--gold" onClick={() => read(tz)}>
                    {c.retry}
                  </button>
                </div>
                {contact}
              </div>
            )}

            {data && !hasTimes && (
              <div className="book__empty">
                {data.nextOpen ? (
                  <>
                    <p>{c.emptyWindow}</p>
                    <div className="book__contact">
                      <button type="button" className="btn btn--gold" onClick={() => read(viewZone, dayOf(data.nextOpen!, viewZone))}>
                        {fill(c.nextOpen, { day: shortDay(dayOf(data.nextOpen, viewZone), lang) })}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>{c.closed}</p>
                    {contact}
                  </>
                )}
              </div>
            )}

            {data && hasTimes && (
              <form
                className="book__pick"
                onSubmit={(e) => {
                  e.preventDefault();
                  toDetails();
                }}
              >
                <fieldset className="book__set">
                  <legend className="book__legend">{c.dayLegend}</legend>
                  <div className="book-days">
                    {days.map((d) => {
                      const p = dayParts(d.day, lang);
                      const n = d.slots.length;
                      const count = n === 0 ? c.dayNone : n === 1 ? c.dayOne : fill(c.dayMany, { n });
                      return (
                        <label key={d.day} className={['book-day', d.day === day ? 'on' : '', n === 0 ? 'off' : ''].join(' ').trim()}>
                          <input
                            type="radio"
                            name={`${uid}-day`}
                            value={d.day}
                            checked={d.day === day}
                            disabled={n === 0}
                            aria-label={`${dayLong(d.day, lang)}, ${count}`}
                            onChange={() => {
                              setDay(d.day);
                              setStart(null);
                            }}
                          />
                          <span className="book-day__wd" aria-hidden="true">
                            {p.weekday}
                          </span>
                          <span className="book-day__date" aria-hidden="true">
                            {p.date}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {day ? (
                  <fieldset className="book__set">
                    <legend className="book__legend">{fill(c.timesLegend, { day: dayLong(day, lang) })}</legend>
                    <div className="book-times">
                      {dayTimes.map((iso) => (
                        <label key={iso} className={iso === start ? 'book-time on' : 'book-time'}>
                          <input
                            type="radio"
                            name={`${uid}-time`}
                            value={iso}
                            checked={iso === start}
                            onChange={() => pickTime(iso)}
                            aria-describedby={pickError ? `${uid}-pick-err` : undefined}
                          />
                          <span>{timeLabel(iso, viewZone, lang)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                {pickError ? (
                  <p className="book__error" id={`${uid}-pick-err`} role="alert">
                    {c.pickFirst}
                  </p>
                ) : null}

                <div className="wiz__nav book__nav">
                  <button type="submit" className="btn btn--gold btn--lg" data-track="book-time">
                    {c.next}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {step === 'details' && start && (
          <form className="book__body" onSubmit={submit} noValidate aria-busy={pending || undefined}>
            <p className="book__chosen">
              <span>{`${whenLabel(start, viewZone, lang)}, ${zonePhrase(viewZone, lang)}`}</span>
              <button type="button" className="book-link" onClick={() => setStep('times')}>
                {c.changeTime}
              </button>
            </p>

            <div className="wiz__fields book__fields">
              <label className="field">
                <span>{c.fields.name}</span>
                <input
                  ref={(el) => {
                    fieldRefs.current.name = el;
                  }}
                  autoComplete="name"
                  maxLength={LIMITS.name}
                  value={draft.name}
                  onChange={setField('name')}
                  {...fieldProps('name')}
                />
                {errors.name ? <em className="book__error" aria-hidden="true" id={errId('name')}>{c.errors.name}</em> : null}
              </label>
              <label className="field">
                <span>{c.fields.email}</span>
                <input
                  ref={(el) => {
                    fieldRefs.current.email = el;
                  }}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={LIMITS.email}
                  value={draft.email}
                  onChange={setField('email')}
                  {...fieldProps('email')}
                />
                {errors.email ? <em className="book__error" aria-hidden="true" id={errId('email')}>{c.errors.email}</em> : null}
              </label>

              <fieldset className="book__set book__roles field--full">
                <legend className="book__legend">{c.fields.role}</legend>
                <div className="book-roles">
                  {(['couple', 'planner', 'other'] as const).map((r) => (
                    <label key={r} className={role === r ? 'book-role on' : 'book-role'}>
                      <input type="radio" name={`${uid}-role`} value={r} checked={role === r} onChange={() => setRole(r)} />
                      <span>{c.roles[r]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="field">
                <span>{c.fields.weddingDate}</span>
                <input
                  ref={(el) => {
                    fieldRefs.current.weddingDate = el;
                  }}
                  type="date"
                  value={draft.weddingDate}
                  onChange={setField('weddingDate')}
                  {...fieldProps('weddingDate')}
                />
                {errors.weddingDate ? <em className="book__error" aria-hidden="true" id={errId('weddingDate')}>{c.errors.weddingDate}</em> : null}
              </label>
              <label className="field">
                <span>{c.fields.phone}</span>
                <input
                  ref={(el) => {
                    fieldRefs.current.phone = el;
                  }}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={LIMITS.phone}
                  value={draft.phone}
                  onChange={setField('phone')}
                  {...fieldProps('phone')}
                />
                {errors.phone ? <em className="book__error" aria-hidden="true" id={errId('phone')}>{c.errors.phone}</em> : null}
              </label>
              <label className="field field--full">
                <span>{c.fields.notes}</span>
                <textarea
                  ref={(el) => {
                    fieldRefs.current.notes = el;
                  }}
                  rows={3}
                  maxLength={LIMITS.notes}
                  value={draft.notes}
                  onChange={setField('notes')}
                  {...fieldProps('notes')}
                />
                {errors.notes ? <em className="book__error" aria-hidden="true" id={errId('notes')}>{c.errors.notes}</em> : null}
              </label>
              {/* Honeypot: people never see or reach it; the API quietly drops a filled one. */}
              <label className="book__hp" aria-hidden="true">
                Fax
                <input ref={honeypot} name="fax_number" tabIndex={-1} autoComplete="off" defaultValue="" />
              </label>
            </div>

            {errors.network || errors.form ? (
              <p className="book__error book__error--form" role="alert">
                {errors.network ? c.errors.network : c.errors.form}
              </p>
            ) : null}

            <div className="wiz__nav book__nav">
              <button type="submit" className="btn btn--gold btn--lg" disabled={pending} aria-disabled={pending || undefined} data-track="book-submit">
                {pending ? c.sending : c.submit}
              </button>
            </div>
          </form>
        )}

        {step === 'done' && done && (
          <div className="book__body book__done">
            {done.start ? (
              <p className="book__when">{`${whenLabel(done.start, viewZone, lang)}, ${zonePhrase(viewZone, lang)}`}</p>
            ) : start ? (
              <p className="book__when">{`${whenLabel(start, viewZone, lang)}, ${zonePhrase(viewZone, lang)}`}</p>
            ) : null}
            {done.start && (done.hostZone ?? hostZone) !== viewZone ? (
              <p className="book__meta">
                <BrandText
                  text={fill(c.doneHost, { time: timeLabel(done.start, done.hostZone ?? hostZone, lang), host: zonePhrase(done.hostZone ?? hostZone, lang) })}
                />
              </p>
            ) : null}
            <p className="wiz__sub">{done.replay ? c.doneReplay : fill(c.doneSent, { email: draft.email.trim() })}</p>
            <div className="book__contact">
              {done.icsUrl ? (
                <a className="btn btn--gold" href={done.icsUrl} download data-track="book-ics">
                  {c.addToCalendar}
                </a>
              ) : null}
              {done.manageUrl ? (
                <a className="btn btn--ghost" href={done.manageUrl} data-track="book-manage">
                  {c.manage}
                </a>
              ) : null}
              <button type="button" className={done.icsUrl ? 'book-link' : 'btn btn--gold'} onClick={onClose}>
                {c.backToSite}
              </button>
            </div>
            <p className="book__slogan">{SLOGAN[lang]}</p>
          </div>
        )}
      </div>
    </div>
  );
}
