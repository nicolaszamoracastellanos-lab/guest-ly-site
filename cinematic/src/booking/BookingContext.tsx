import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { useLang } from '../ui/LanguageContext';
import { prefetchSlots, visitorZone } from './client';
import { bookCtaCopy } from './cta-copy';
import { startBooking, useBookingShown } from './state';
import './page.css';

/* #22: the booking dialog's opener, in the initial bundle only while
   BOOKING_ENABLED is on (src/switches.ts). The dialog itself is a lazy chunk:
   it is never in the prerendered page, and it loads, with the first slot
   list, on intent (pointer over, focus or touch on a booking button) or on
   the press. The buttons are not in the prerendered page either: BookGate
   adds them after one read of the API at idle, only for an "open" answer. Off, BookingProvider passes its children through, and every
   BookCta / BookLine call site sits behind the same literal, so this module
   and the dialog chunk leave the build. */

type BookingApi = { open: (trigger?: HTMLElement | null) => void; prefetch: () => void };
const BookingContext = /* @__PURE__ */ createContext<BookingApi>({ open: () => {}, prefetch: () => {} });

/* A chunk that fails to load (offline) renders nothing; the page stays usable. */
const loadDialog = (): Promise<{ default: ComponentType<{ trigger: HTMLElement | null; onClose: () => void }> }> =>
  import('./BookingModal').catch(() => ({ default: () => null }));
const BookingModal = /* @__PURE__ */ lazy(loadDialog);

function RealProvider({ children }: { children: ReactNode }) {
  const [opening, setOpening] = useState<{ id: number; trigger: HTMLElement | null } | null>(null);
  const warmed = useRef(false);
  useEffect(startBooking, []);

  const prefetch = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    void loadDialog().catch(() => {});
    void prefetchSlots(visitorZone());
    setTimeout(() => (warmed.current = false), 60000);
  }, []);
  const open = useCallback((trigger?: HTMLElement | null) => {
    setOpening((prev) => ({ id: (prev?.id ?? 0) + 1, trigger: trigger ?? null }));
  }, []);
  const close = useCallback(() => setOpening(null), []);
  const api = useMemo(() => ({ open, prefetch }), [open, prefetch]);

  /* "Book another time" in the booking emails and the manage page links to
     guest-ly.com/?book=demo: open the dialog, then drop the query so a
     reload does not reopen it. */
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('book') !== 'demo') return;
    url.searchParams.delete('book');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    open(null);
  }, [open]);

  return (
    <BookingContext.Provider value={api}>
      {children}
      {opening ? (
        <Suspense fallback={null}>
          <BookingModal key={opening.id} trigger={opening.trigger} onClose={close} />
        </Suspense>
      ) : null}
    </BookingContext.Provider>
  );
}

function PassThrough({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const BookingProvider = import.meta.env.VITE_BOOKING_ENABLED ? RealProvider : PassThrough;

/* Wraps every booking button and line: nothing renders until the one read at
   idle has answered "open" (./state.ts). Closed, unreachable or slow: nothing,
   so the page is the booking-off page. */
export function BookGate({ children }: { children: ReactNode }) {
  return useBookingShown() ? <>{children}</> : null;
}

type CtaProps = { id: string; variant?: 'ghost' | 'link'; large?: boolean; onBefore?: () => void };

export function BookCta({ id, variant = 'ghost', large, onBefore }: CtaProps) {
  const { lang } = useLang();
  const { open, prefetch } = useContext(BookingContext);
  const cls = variant === 'link' ? 'book-link' : large ? 'btn btn--ghost btn--lg' : 'btn btn--ghost';
  return (
    <button
      type="button"
      className={cls}
      data-track={`book-${id}`}
      data-book=""
      onPointerEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
      onClick={(e) => {
        onBefore?.();
        open(e.currentTarget);
      }}
    >
      {bookCtaCopy[lang].cta}
    </button>
  );
}


/* A sentence with a booking button at its end (pricing, order wizard). */
type LineProps = { id: string; line: 'pricingLine' | 'wizardLine'; onBefore?: () => void };

export function BookLine({ id, line, onBefore }: LineProps) {
  const { lang } = useLang();
  return (
    <p className={`book-line book-line--${id}`}>
      {/* In its own span: two adjacent text nodes would merge in the
          prerendered HTML and break hydration (React 418). */}
      <span>{bookCtaCopy[lang][line]}</span> <BookCta id={id} variant="link" onBefore={onBefore} />
    </p>
  );
}
