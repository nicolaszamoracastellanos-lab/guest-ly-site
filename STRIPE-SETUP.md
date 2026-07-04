# Stripe setup — from sandbox to first dollar

The site is already wired for payments. The order flow now ends with a
**"Pay creation fee · $X →"** button that opens a Stripe Payment Link for the
exact plan + guest-count the couple picked. All that's missing is the 12 links.
This file is the click-by-click guide to create them and paste them in.

> **Where they get pasted:** `index.html`, the `PAY_LINKS` block (search for
> `── PAYMENTS & NOTIFICATIONS ──`). Until a link is pasted, the button hides
> itself and the page says "we'll send you a payment link within 2 hours" — so
> nothing is ever broken while you work through this list.

---

## 0 · Test mode vs live mode (read this first)

The keys in your dashboard screenshot (`pk_test_…` / `sk_test_…`) are
**sandbox keys** — they can only simulate payments with test cards. To collect
real money you must **activate the account**:

1. In the Stripe dashboard, click **"Activate payments"** (or Settings →
   Account) and complete business verification: your details, business type
   (individual is fine), and a bank account for payouts.
2. Note for Bolivia: Stripe doesn't support BO-based accounts directly. If you
   hit that wall, the standard founder workarounds are a US LLC + US bank
   account (Stripe Atlas, Firstbase, or doola — ~1 week), or running the
   business through a supported country where you have residency/banking.
   Decide this early — it gates everything below.
3. Everything below is done in **live mode** (toggle top-right of the
   dashboard). You can do a dry run in test mode first with card
   `4242 4242 4242 4242`, any future date, any CVC.

## The fast path — one command instead of steps 1–4

Once the account is activated, you don't need to click through the dashboard.
On any machine with Node 18+ (your laptop is fine):

```bash
git clone https://github.com/nicolaszamoracastellanos-lab/guest-ly-site
cd guest-ly-site
STRIPE_SECRET_KEY=rk_live_... node scripts/create-stripe-links.mjs
```

The script creates all 3 products, 12 prices, 12 payment links, and the
`FOUNDING30` code, then **patches `PAY_LINKS` in index.html automatically**.
It's idempotent — re-running never duplicates anything. Use a **restricted
key** (Dashboard → Developers → API keys → Create restricted key) with write
access to Products, Payment Links, and Coupons/Promotion codes.

Alternatively, authorize the **Stripe connector** in your claude.ai connector
settings and tell Claude "run the Stripe bootstrap from STRIPE-SETUP.md" — no
key handling at all. (Note: the Claude Code cloud environment's network policy
currently blocks direct calls to api.stripe.com, so the connector or your
laptop are the two working routes.)

Steps 1–4 below are the manual dashboard equivalent — skip them if you used
the script.

## 1 · Create the products and prices (~15 min)

Dashboard → **Product catalog → Add product**. Create **3 products**, each
with **4 one-time prices** (USD):

| Product | 0–100 guests | 100–300 | 300–500 | 500+ |
|---|---|---|---|---|
| Guest-ly Basic — AI Web Concierge | $97 | $147 | $197 | $267 |
| Guest-ly Standard — All Channels | $247 | $347 | $447 | $547 |
| Guest-ly Premium — All Channels + Dashboard | $447 | $597 | $747 | $897 |

Tips:
- Add the price nickname (e.g. `standard-100-300`) so links are easy to match later.
- Description shown at checkout, e.g. Standard: *"AI concierge on Web,
  WhatsApp, SMS & Telegram — creation fee, first 3 months of hosting included."*

## 2 · Create the 12 Payment Links (~20 min)

Dashboard → **Payment Links → New**. One link per price. For **every** link use
the same settings:

- **Collect customers' phone numbers:** ON (you'll close on WhatsApp)
- **Custom fields** (up to 3):
  1. `Partner names` — text
  2. `Wedding date` — text
  3. `City / Country` — text
- **After payment → Don't show confirmation page → redirect to:**
  `https://guest-ly.com/#intake`
  (the site opens the intake form directly — the couple can fill it while the
  card is still warm)
- **Allow promotion codes:** ON (needed for the founding-couples code)

## 3 · Founding-couples promo code (~2 min)

Product catalog → **Coupons → New**: 30% off, one-time, **max 10 redemptions**.
Then create promotion code **`FOUNDING30`** from it. This is the launch offer —
mention it in outreach, cap it publicly at 10 couples.

## 4 · Paste the links into the site (~5 min)

In `index.html`, fill the array — order is `[0–100, 100–300, 300–500, 500+]`:

```js
var PAY_LINKS = {
  basic:    ['https://buy.stripe.com/…', 'https://buy.stripe.com/…', 'https://buy.stripe.com/…', 'https://buy.stripe.com/…'],
  standard: ['https://buy.stripe.com/…', 'https://buy.stripe.com/…', 'https://buy.stripe.com/…', 'https://buy.stripe.com/…'],
  premium:  ['https://buy.stripe.com/…', 'https://buy.stripe.com/…', 'https://buy.stripe.com/…', 'https://buy.stripe.com/…']
};
```

The site automatically appends the couple's email as `prefilled_email`, so
checkout arrives pre-filled.

While you're in that block, also set:

```js
var WHATSAPP = '591XXXXXXXX';   // your WhatsApp Business number → shows a
                                // "Prefer WhatsApp?" fallback on the order page
```

## 5 · Activate order notifications (~1 min, do not skip)

Order and intake submissions are delivered to **nicolas@guest-ly.com** via
FormSubmit (no account needed). The **first** submission triggers a one-time
activation email to that address — **click "Activate"** in it, otherwise
nothing gets delivered. So:

1. Make sure `nicolas@guest-ly.com` actually receives mail (Google Workspace,
   or a free forward via your domain registrar / Cloudflare Email Routing).
2. Deploy the site, place a test order yourself, and click the activation link.
3. Place a second test order and confirm it lands in the inbox.

## 6 · Later — hosting subscriptions (month 4+ per customer)

When a couple's 3 free hosting months are ending, send them a subscription
Payment Link. Create when you get your first customer, not now:
3 products — Hosting Basic $5/mo, Standard $12/mo, Premium $19/mo (recurring,
monthly) — one payment link each. A calendar reminder per customer is enough
at this volume.

---

**Security note:** never paste your secret key (`sk_live_…`) into a chat.
Use a restricted key as an environment variable (the script above), or the
claude.ai Stripe connector, which handles auth via OAuth.
