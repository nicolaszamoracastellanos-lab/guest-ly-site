/* ── PAYMENTS & NOTIFICATIONS ──
   Mirrors the production index.html config block.
   Paste Stripe Payment Link URLs below — see STRIPE-SETUP.md in the repo root
   for the click-by-click guide. One URL per plan (each plan is a single
   one-time price). Leave '' until a link exists; the wizard falls back to
   "we'll send you a payment link" so nothing breaks. */

export const PAY_LINKS: Record<'essentials' | 'signature' | 'grande', string> = {
  essentials: '',
  signature: '',
  grande: '',
};

/* Receives order notifications via FormSubmit (same inbox as production). */
export const ORDER_INBOX = 'nicolas@guest-ly.com';

/* WhatsApp number, digits only with country code (e.g. '59171234567');
   '' hides the WhatsApp button on the confirmation step. */
export const WHATSAPP = '';

export function sendNotification(subject: string, data: Record<string, string>) {
  return fetch(`https://formsubmit.co/ajax/${ORDER_INBOX}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ _subject: subject, _captcha: 'false', _template: 'box', ...data }),
  });
}
