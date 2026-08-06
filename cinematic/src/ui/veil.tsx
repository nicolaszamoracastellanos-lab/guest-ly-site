import type { ReactNode } from 'react';

/* TEMPORARY price veil: public pricing is being finalized, so every
   Guest-ly dollar amount renders blurred and is hidden from assistive
   tech. To restore prices, delete this file, the .price-veil CSS rule
   and the call sites; the underlying copy is untouched. */
const AMOUNT = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\/(?:mo|mes))?/g;

export function veilPrices(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(AMOUNT)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(
      <span key={at} className="price-veil" aria-hidden="true">
        {m[0]}
      </span>,
    );
    last = at + m[0].length;
  }
  if (last === 0) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}
