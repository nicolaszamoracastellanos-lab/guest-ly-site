import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useLang } from './LanguageContext';
import type { PlanId } from './WizardContext';
import { ORDER_INBOX, PAY_LINKS, WHATSAPP, sendNotification } from '../config';

interface WizardProps {
  initialPlan: PlanId;
  initialRange: number;
  onClose: () => void;
}

interface Fields {
  name: string;
  partner: string;
  email: string;
  phone: string;
  date: string;
  location: string;
  notes: string;
}

const EMPTY_FIELDS: Fields = { name: '', partner: '', email: '', phone: '', date: '', location: '', notes: '' };

/* 3-step order wizard, mirroring the production gs-* modal:
   1 Plan (shared price matrix) → 2 Details (form, no network) → 3 Confirm
   (summary + prefilled mailto draft — matches production's email-order flow). */
export function Wizard({ initialPlan, initialRange, onClose }: WizardProps) {
  const { t } = useLang();
  const w = t.wizard;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [range, setRange] = useState(() => Math.min(Math.max(initialRange, 0), 3));
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const sheetRef = useRef<HTMLDivElement>(null);

  const plans = t.pricing.plans;
  const selected = plans.find((p) => p.id === plan) ?? plans[1];
  const price = selected.prices[range];

  /* Scroll lock + ESC while the modal is mounted. */
  useEffect(() => {
    document.documentElement.classList.add('wizard-locked');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('wizard-locked');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  /* Back to top of the sheet on step change. */
  useEffect(() => {
    sheetRef.current?.scrollTo(0, 0);
  }, [step]);

  const setField = (key: keyof Fields) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((v) => ({ ...v, [key]: e.target.value }));

  const rangeLabel = w.step1.ranges[range];
  const couple = [fields.name, fields.partner].filter(Boolean).join(' & ') || '—';
  const continueLabel = w.continueLabel.replace('{plan}', selected.name).replace('{price}', `$${price}`);

  /* Order payload — same field names and subject line as production. */
  const order = useMemo(
    () => ({
      couple,
      email: fields.email || '—',
      phone: fields.phone || '—',
      wedding_date: fields.date || '—',
      location: fields.location || '—',
      plan: `${selected.name} · ${rangeLabel}`,
      creation_fee: `$${price}`,
      hosting: selected.hosting,
      notes: fields.notes || '—',
    }),
    [couple, fields, selected, rangeLabel, price],
  );
  const orderSubject = `New order — ${couple} · ${selected.name} · $${price}`;

  const confirmOrder = () => {
    /* Notify Guest-ly, fire-and-forget — the mailto fallback below covers failures. */
    sendNotification(orderSubject, order).catch(() => {});
    setStep(3);
  };

  const mailtoHref = useMemo(() => {
    const body = Object.entries(order)
      .map(([k, v]) => `${k.replace(/_/g, ' ').toUpperCase()}: ${v}`)
      .join('\n');
    return `mailto:${ORDER_INBOX}?subject=${encodeURIComponent(orderSubject)}&body=${encodeURIComponent(body)}`;
  }, [order, orderSubject]);

  /* Stripe payment link for this plan × guest range ('' → fallback note). */
  const payLink = (PAY_LINKS[plan] ?? [])[range] || '';
  const payUrl = payLink
    ? payLink + (fields.email ? (payLink.includes('?') ? '&' : '?') + 'prefilled_email=' + encodeURIComponent(fields.email) : '')
    : '';

  return (
    <div
      className="wiz-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="wiz glass" role="dialog" aria-modal="true" aria-label={w.step1.title} ref={sheetRef}>
        <button type="button" className="wiz__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <ol className="wiz__steps">
          {w.stepLabels.map((label, i) => (
            <li key={label} className={step >= i + 1 ? 'on' : ''}>
              <span className="wiz__dot" aria-hidden="true">
                {i + 1}
              </span>
              <span className="wiz__step-label">{label}</span>
            </li>
          ))}
        </ol>

        {step === 1 && (
          <div className="wiz__body">
            <h2 className="wiz__title">{w.step1.title}</h2>
            <p className="wiz__sub">{w.step1.sub}</p>

            <div className="range-pills range-pills--wiz" role="group" aria-label={t.pricing.rangeSub}>
              {w.step1.ranges.map((r, i) => (
                <button
                  key={r}
                  type="button"
                  className={i === range ? 'pill on' : 'pill'}
                  aria-pressed={i === range}
                  onClick={() => setRange(i)}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="wiz__plans" role="radiogroup" aria-label={w.stepLabels[0]}>
              {plans.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  role="radio"
                  aria-checked={plan === pl.id}
                  className={plan === pl.id ? 'wiz-plan on' : 'wiz-plan'}
                  onClick={() => setPlan(pl.id)}
                >
                  <span className="wiz-plan__name">
                    {pl.name}
                    {pl.popular ? (
                      <em className="wiz-plan__pop" aria-hidden="true">
                        ✦
                      </em>
                    ) : null}
                  </span>
                  <span className="wiz-plan__channels">{pl.channels}</span>
                  <span className="wiz-plan__price">${pl.prices[range]}</span>
                  <span className="wiz-plan__fee">{pl.feeNote}</span>
                </button>
              ))}
            </div>

            <button type="button" className="btn btn--gold btn--lg wiz__continue" onClick={() => setStep(2)}>
              {continueLabel}
            </button>
          </div>
        )}

        {step === 2 && (
          <form
            className="wiz__body"
            onSubmit={(e) => {
              e.preventDefault();
              confirmOrder();
            }}
          >
            <h2 className="wiz__title">{w.step2.title}</h2>
            <p className="wiz__sub">{w.step2.sub}</p>

            <div className="wiz__fields">
              <label className="field">
                <span>{w.step2.fields.name}</span>
                <input required autoComplete="name" value={fields.name} onChange={setField('name')} />
              </label>
              <label className="field">
                <span>{w.step2.fields.partner}</span>
                <input value={fields.partner} onChange={setField('partner')} />
              </label>
              <label className="field">
                <span>{w.step2.fields.email}</span>
                <input required type="email" autoComplete="email" value={fields.email} onChange={setField('email')} />
              </label>
              <label className="field">
                <span>{w.step2.fields.phone}</span>
                <input type="tel" autoComplete="tel" value={fields.phone} onChange={setField('phone')} />
              </label>
              <label className="field">
                <span>{w.step2.fields.date}</span>
                <input required type="date" value={fields.date} onChange={setField('date')} />
              </label>
              <label className="field">
                <span>{w.step2.fields.location}</span>
                <input required value={fields.location} onChange={setField('location')} />
              </label>
              <label className="field field--full">
                <span>{w.step2.fields.notes}</span>
                <textarea rows={3} value={fields.notes} onChange={setField('notes')} />
              </label>
            </div>

            <div className="wiz__nav">
              <button type="button" className="btn btn--ghost" onClick={() => setStep(1)}>
                {w.step2.back}
              </button>
              <button type="submit" className="btn btn--gold">
                {w.step2.confirm}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="wiz__body wiz__body--confirm">
            <span className="badge">
              <span className="badge__dot" aria-hidden="true" />
              {w.step3.badge}
            </span>
            <h2 className="wiz__title">{w.step3.title}</h2>

            <div className="wiz-summary">
              <h3 className="wiz-summary__head">{w.step3.summaryTitle}</h3>
              <dl>
                <div>
                  <dt>{w.step3.rows.plan}</dt>
                  <dd>{selected.name}</dd>
                </div>
                <div>
                  <dt>{w.step3.rows.guests}</dt>
                  <dd>{rangeLabel}</dd>
                </div>
                <div>
                  <dt>{w.step3.rows.couple}</dt>
                  <dd>{couple}</dd>
                </div>
                <div>
                  <dt>{w.step3.rows.fee}</dt>
                  <dd>${price}</dd>
                </div>
                <div>
                  <dt>{w.step3.rows.hosting}</dt>
                  <dd>{selected.hosting}</dd>
                </div>
              </dl>
            </div>

            <div className="wiz-pay">
              {payUrl ? (
                <>
                  <a className="btn btn--gold btn--lg" href={payUrl} target="_blank" rel="noopener noreferrer">
                    {w.step3.payCta.replace('{price}', `$${price}`)}
                  </a>
                  <p className="wiz-pay__note">{w.step3.payNoteLinked}</p>
                </>
              ) : (
                <p className="wiz-pay__note">
                  {w.step3.payNoteFallback.replace('{email}', fields.email || '—')}
                </p>
              )}
              {WHATSAPP ? (
                <a
                  className="wiz-pay__wa"
                  href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(orderSubject)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {w.step3.whatsapp}
                </a>
              ) : null}
            </div>

            <div className="wiz-next">
              <h3 className="wiz-next__head">{w.step3.nextTitle}</h3>
              <ol>
                {w.step3.next.map((n, i) => (
                  <li key={i}>
                    <span className="wiz-next__n" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="wiz-next__txt">
                      <strong>{n.title}</strong>
                      <span>{n.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="wiz-mailfb">
              {w.step3.mailFallback} <a href={mailtoHref}>{w.step3.mailFallbackLink}</a>.
            </p>

            <div className="wiz__nav wiz__nav--confirm">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                {w.step3.backHome}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
