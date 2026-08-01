import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useLang } from './LanguageContext';
import type { PlanId } from './WizardContext';
import { ORDER_INBOX, PAY_LINKS, WHATSAPP, sendNotification } from '../config';

interface WizardProps {
  initialPlan: PlanId;
  onClose: () => void;
}

interface Fields {
  name: string;
  partner: string;
  email: string;
  phone: string;
  notes: string;
}

type GuestRange = 'essentials' | 'signature' | 'grande' | 'grande-plus';

const EMPTY_FIELDS: Fields = { name: '', partner: '', email: '', phone: '', notes: '' };

const RANGE_TO_PLAN: Record<GuestRange, PlanId> = {
  essentials: 'essentials',
  signature: 'signature',
  grande: 'grande',
  'grande-plus': 'grande',
};

/* 4-step order wizard, inverted per wave 5: the couple starts with what
   they know by heart (guest count, date, city), gets a recommendation
   second, leaves contact details third (the lead is captured here, before
   any payment talk), and sees the honest payment step last. */
export function Wizard({ initialPlan, onClose }: WizardProps) {
  const { t, lang } = useLang();
  const w = t.wizard;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  /* The inversion: everyone answers guest count first, even from a plan
     card. The clicked plan stays preselected until the range recommends. */
  const [range, setRange] = useState<GuestRange | null>(null);
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [addon, setAddon] = useState(false);
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const sheetRef = useRef<HTMLDivElement>(null);

  const plans = t.pricing.plans;
  const selected = plans.find((p) => p.id === plan) ?? plans[1];
  const price = selected.price;
  const rangeLabel = w.step1.guestRanges.find((r) => r.id === range)?.label ?? selected.guests;

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

  const pickRange = (r: GuestRange) => {
    setRange(r);
    setPlan(RANGE_TO_PLAN[r]);
  };

  const couple = [fields.name, fields.partner].filter(Boolean).join(' & ') || '·';
  const addonIncluded = plan === 'grande';
  const addonLabel = addonIncluded ? w.step2.addon.includedNote : addon ? w.step4.addonYes : w.step4.addonNo;

  const reason =
    range === 'grande-plus'
      ? w.step2.reasonPlus
      : w.step2.reason.replace('{guests}', rangeLabel).replace('{plan}', selected.name);

  /* Order payload: same field names and subject shape as production. */
  const order = useMemo(
    () => ({
      couple,
      email: fields.email || '·',
      phone: fields.phone || '·',
      wedding_date: date || '·',
      location: location || '·',
      guest_range: rangeLabel,
      plan: `${selected.name} · ${selected.guests}`,
      ai_coordinator: addonIncluded ? 'included (Grande)' : addon ? 'yes ($79 one-time)' : 'no',
      price: `$${price} · one-time`,
      notes: fields.notes || '·',
      language: lang,
    }),
    [couple, fields, date, location, rangeLabel, selected, addon, addonIncluded, price, lang],
  );
  const orderSubject = `New order: ${couple} · ${selected.name} · $${price}`;

  const confirmOrder = () => {
    /* The lead is captured here, at the end of step 3, even if payment is
       abandoned. Fire-and-forget; the mailto fallback covers failures. */
    sendNotification(orderSubject, order).catch(() => {});
    setStep(4);
  };

  const mailtoHref = useMemo(() => {
    const body = Object.entries(order)
      .map(([k, v]) => `${k.replace(/_/g, ' ').toUpperCase()}: ${v}`)
      .join('\n');
    return `mailto:${ORDER_INBOX}?subject=${encodeURIComponent(orderSubject)}&body=${encodeURIComponent(body)}`;
  }, [order, orderSubject]);

  /* Stripe payment link for this plan ('' means the honest fallback). */
  const payLink = PAY_LINKS[plan] || '';
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
          <form
            className="wiz__body"
            onSubmit={(e) => {
              e.preventDefault();
              if (range) setStep(2);
            }}
          >
            <h2 className="wiz__title">{w.step1.title}</h2>
            <p className="wiz__sub">{w.step1.sub}</p>

            <fieldset className="wiz__ranges">
              <legend className="wiz__legend">{w.step1.guestsLabel}</legend>
              <div className="wiz__range-grid" role="radiogroup" aria-label={w.step1.guestsLabel}>
                {w.step1.guestRanges.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={range === r.id}
                    className={range === r.id ? 'wiz-range on' : 'wiz-range'}
                    onClick={() => pickRange(r.id)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="wiz__fields">
              <label className="field">
                <span>{w.step1.dateLabel}</span>
                <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="field">
                <span>{w.step1.locationLabel}</span>
                <input required value={location} onChange={(e) => setLocation(e.target.value)} />
              </label>
            </div>

            <button type="submit" className="btn btn--gold btn--lg wiz__continue" disabled={!range}>
              {w.step1.next}
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="wiz__body">
            <h2 className="wiz__title">{w.step2.title}</h2>
            <p className="wiz__sub">{reason}</p>

            <div className="wiz__plans" role="radiogroup" aria-label={w.stepLabels[1]}>
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
                    {pl.id === RANGE_TO_PLAN[range ?? 'signature'] ? (
                      <em className="wiz-plan__pop" aria-hidden="true">
                        ✦
                      </em>
                    ) : null}
                  </span>
                  <span className="wiz-plan__channels">{pl.guests}</span>
                  <span className="wiz-plan__price">${pl.price}</span>
                  <span className="wiz-plan__fee">{pl.priceNote}</span>
                </button>
              ))}
            </div>

            <p className="wiz__note">{w.step2.sub}</p>

            <label className={addonIncluded ? 'wiz-addon wiz-addon--included' : 'wiz-addon'}>
              <input
                type="checkbox"
                checked={addonIncluded ? true : addon}
                disabled={addonIncluded}
                onChange={(e) => setAddon(e.target.checked)}
              />
              <span className="wiz-addon__txt">
                <strong>{w.step2.addon.title}</strong>
                <span>{addonIncluded ? w.step2.addon.includedNote : w.step2.addon.pitch}</span>
              </span>
            </label>

            <div className="wiz__nav">
              <button type="button" className="btn btn--ghost" onClick={() => setStep(1)}>
                {w.step2.back}
              </button>
              <button type="button" className="btn btn--gold" onClick={() => setStep(3)}>
                {w.step2.next}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form
            className="wiz__body"
            onSubmit={(e) => {
              e.preventDefault();
              confirmOrder();
            }}
          >
            <h2 className="wiz__title">{w.step3.title}</h2>
            <p className="wiz__sub">{w.step3.sub}</p>

            <div className="wiz__fields">
              <label className="field">
                <span>{w.step3.fields.name}</span>
                <input required autoComplete="name" value={fields.name} onChange={setField('name')} />
              </label>
              <label className="field">
                <span>{w.step3.fields.partner}</span>
                <input value={fields.partner} onChange={setField('partner')} />
              </label>
              <label className="field">
                <span>{w.step3.fields.email}</span>
                <input required type="email" autoComplete="email" value={fields.email} onChange={setField('email')} />
              </label>
              <label className="field">
                <span>{w.step3.fields.phone}</span>
                <input type="tel" autoComplete="tel" value={fields.phone} onChange={setField('phone')} />
              </label>
              <label className="field field--full">
                <span>{w.step3.fields.notes}</span>
                <textarea rows={3} value={fields.notes} onChange={setField('notes')} />
              </label>
            </div>

            <div className="wiz__nav">
              <button type="button" className="btn btn--ghost" onClick={() => setStep(2)}>
                {w.step3.back}
              </button>
              <button type="submit" className="btn btn--gold">
                {w.step3.confirm}
              </button>
            </div>
          </form>
        )}

        {step === 4 && (
          <div className="wiz__body wiz__body--confirm">
            <span className="badge">
              <span className="badge__dot" aria-hidden="true" />
              {w.step4.badge}
            </span>
            <h2 className="wiz__title">{w.step4.title}</h2>

            <div className="wiz-summary">
              <h3 className="wiz-summary__head">{w.step4.summaryTitle}</h3>
              <dl>
                <div>
                  <dt>{w.step4.rows.plan}</dt>
                  <dd>{selected.name}</dd>
                </div>
                <div>
                  <dt>{w.step4.rows.guests}</dt>
                  <dd>{rangeLabel}</dd>
                </div>
                <div>
                  <dt>{w.step4.rows.couple}</dt>
                  <dd>{couple}</dd>
                </div>
                <div>
                  <dt>{w.step4.rows.date}</dt>
                  <dd>{date || '·'}</dd>
                </div>
                <div>
                  <dt>{w.step4.rows.addon}</dt>
                  <dd>{addonLabel}</dd>
                </div>
                <div>
                  <dt>{w.step4.rows.price}</dt>
                  <dd>${price}</dd>
                </div>
              </dl>
            </div>

            <div className="wiz-pay">
              {payUrl ? (
                <>
                  <a className="btn btn--gold btn--lg" href={payUrl} target="_blank" rel="noopener noreferrer">
                    {w.step4.payCta.replace('{price}', `$${price}`)}
                  </a>
                  <p className="wiz-pay__note">{w.step4.payNoteLinked}</p>
                </>
              ) : (
                <p className="wiz-pay__note">
                  {w.step4.payNoteFallback.replace('{email}', fields.email || '·')}
                </p>
              )}
              {WHATSAPP ? (
                <a
                  className="wiz-pay__wa"
                  href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(orderSubject)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {w.step4.whatsapp}
                </a>
              ) : null}
              <p className="wiz-pay__refund">
                {w.step4.refundLine} <a href="/refunds">{w.step4.refundLink}</a>.
              </p>
            </div>

            <div className="wiz-next">
              <h3 className="wiz-next__head">{w.step4.nextTitle}</h3>
              <ol>
                {w.step4.next.map((n, i) => (
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
              {w.step4.mailFallback} <a href={mailtoHref}>{w.step4.mailFallbackLink}</a>.
            </p>

            <div className="wiz__nav wiz__nav--confirm">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                {w.step4.backHome}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
