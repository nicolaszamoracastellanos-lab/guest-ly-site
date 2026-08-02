/* ── SITE CONFIG ──
   Every PENDING input from the wave 5 master prompt lands here, so going
   live is a paste-values-and-rebuild operation. */

/* PAYMENTS: Stripe Payment Link URLs, one per plan (each plan is a single
   one-time price). See STRIPE-SETUP.md in the repo root for the
   click-by-click guide. Leave '' until a link exists; the wizard falls back
   to "we'll send you a payment link" so nothing breaks. */
export const PAY_LINKS: Record<'essentials' | 'signature' | 'grande', string> = {
  essentials: '',
  signature: '',
  grande: '',
};

/* Receives order notifications via FormSubmit (same inbox as production). */
export const ORDER_INBOX = 'nicolas@guest-ly.com';

/* WhatsApp number, digits only with country code (e.g. '59171234567');
   '' hides the WhatsApp button on the confirmation step. */
export const WHATSAPP = '19106107193';

/* LIVE HERO DEMO: endpoint of the dedicated sandbox concierge (a fictional
   demo wedding on its own tenant). See docs/sandbox-bot-setup.md for how to
   stand it up. NEVER point this at the alexnico production functions.
   '' ships the scripted loop; a URL turns the hero chat into a real,
   typeable conversation. */
export const SANDBOX_BOT_ENDPOINT = 'https://alexnico.guest-ly.com/.netlify/functions/demo-chat';

export const LIVE_DEMO: 'live' | 'scripted' = SANDBOX_BOT_ENDPOINT ? 'live' : 'scripted';

/* Client-side guardrails for the live demo (the sandbox function must add
   its own IP rate limiting and a low max_tokens cap on top). */
export const DEMO_LIMITS = {
  maxMessages: 6,
  maxChars: 250,
  minIntervalMs: 3000,
};

/* LEGAL: registered entity name for the footer and terms page. */
export const LEGAL_ENTITY = 'ZC Ventures LLC';

export function sendNotification(subject: string, data: Record<string, string>) {
  return fetch(`https://formsubmit.co/ajax/${ORDER_INBOX}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ _subject: subject, _captcha: 'false', _template: 'box', ...data }),
  });
}
