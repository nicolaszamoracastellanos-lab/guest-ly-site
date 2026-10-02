// Decides when the welcome tour shows and draws it above the app.
//
// Mounted once in the root layout (after the stack and the assistant bubble,
// before the biometric lock and the update screen, which stay on top).
//
// Automatic trigger: the session going from "none" to signed in. That is a
// real sign-in (password, email link, Apple, Google), a new account signing in
// for the first time, or a guest opening their invitation. Restoring a saved
// session at launch goes from "loading" to signed in and never triggers it.
// The tour then waits until the person is on their home surface (a guest is
// past the notification step) and shows once per person, variant and tour
// version.
//
// It can never block: any failure reading storage counts as "seen", and a
// render error inside the tour is caught and simply closes it.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "expo-router";
import { can, useSession, type Me } from "@/lib/session";
import { TourOverlay } from "./TourOverlay";
import { clearTourRequest, hasSeenTour, markTourSeen, requestAutoTour, setTourOnScreen, useTourRequest, type TourVariant } from "./state";
import type { TourNames } from "./steps";

// Entrance, auth and wedding-setup screens: the tour never draws over them.
const ENTRANCE = ["/", "/sign-in", "/sign-up", "/invite", "/find", "/notify", "/auth/callback", "/setup"];
// Where the automatic tour may appear: a home surface, or the locked
// "almost ready" home of a self-serve wedding waiting for activation.
const AUTO_HOME = /^\/(guest|couple|planner|pending)(\/|$)/;

/** Which accounts get the "almost ready" couple tour when no variant is
 *  named: a self-serve wedding waiting for activation (the locked home).
 *  Replaceable with setPendingAccountCheck if that state moves. */
let pendingCheck: (me: Me) => boolean = (me) => {
  const m = me as Me & { locked?: boolean; tenant: { billing_status?: string } };
  return m.locked === true || m.tenant.billing_status === "pending_payment";
};

export function setPendingAccountCheck(fn: (me: Me) => boolean): void {
  pendingCheck = fn;
}

type Person = { personId: string; variant: TourVariant; surface: "guest" | "couple" | "planner"; name: string | null; couple: string | null; planner: TourNames["planner"] };

export function TourHost({ blocked }: { blocked: boolean }) {
  const { state } = useSession();
  const pathname = usePathname();
  const request = useTourRequest();
  const [shown, setShown] = useState<{ variant: TourVariant; personId: string; seq: number; names: TourNames } | null>(null);
  const prev = useRef(state.status);

  // A fresh sign-in, not a restored session. "onboarding" is a new couple
  // account setting up its wedding: the tour comes once the wedding exists.
  useEffect(() => {
    const was = prev.current;
    prev.current = state.status;
    // Build 12: guests get no automatic tour (their Invitation tab opens on
    // the RSVP card); they can still replay it from Info.
    if ((was === "none" || was === "onboarding") && state.status === "user") requestAutoTour();
  }, [state.status]);

  // Who is signed in, as plain values so a token refresh does not restart
  // anything.
  const guestId = state.status === "guest" ? `${state.tenant.slug}:${state.guest.id}` : null;
  const guestName = state.status === "guest" ? state.guest.name : null;
  const guestCouple = state.status === "guest" ? state.tenant.couple_names : null;
  const userId = state.status === "user" ? state.me.user.id : null;
  const surface = state.status === "user" ? state.me.surface : null;
  const userCouple = state.status === "user" ? state.me.tenant.couple_names : null;
  const pending = state.status === "user" && state.me.surface !== "planner" ? safePending(state.me) : false;
  // The planner tour is built from what the couple shares on this wedding.
  const plannerMe = state.status === "user" && state.me.surface === "planner" ? state.me : null;
  const permKey = plannerMe ? ["budget", "tasks", "seating", "runsheet", "coordinator"].map((k) => (can(plannerMe, k) ? "1" : "0")).join("") : "";
  // A locked wedding that just became active: the full couple tour, once.
  const wasPending = useRef<{ id: string | null; pending: boolean }>({ id: null, pending: false });
  useEffect(() => {
    const before = wasPending.current;
    wasPending.current = { id: userId, pending };
    if (userId && before.id === userId && before.pending && !pending) requestAutoTour();
  }, [userId, pending]);

  const person = useMemo<Person | null>(() => {
    if (guestId) return { personId: guestId, variant: "guest", surface: "guest", name: firstName(guestName), couple: guestCouple, planner: null };
    if (userId) {
      const s = surface === "planner" ? "planner" : "couple";
      const on = (i: number) => permKey.charAt(i) === "1";
      const planner = s === "planner" && permKey ? { tools: { budget: on(0), tasks: on(1), seating: on(2), runsheet: on(3) }, tasks: on(1), coordinator: on(4) } : null;
      return { personId: userId, variant: s === "planner" ? "planner" : pending ? "couple-pending" : "couple", surface: s, name: null, couple: userCouple, planner };
    }
    return null;
  }, [guestId, guestName, guestCouple, userId, surface, userCouple, pending, permKey]);

  // The tour on screen belongs to whoever is signed in now; signing out (or a
  // 401) takes it away without marking it seen.
  const visible = shown && person && shown.personId === person.personId ? shown : null;

  // Present a pending request once the moment is right.
  useEffect(() => {
    if (!request || visible) return;
    if (state.status === "loading") return;
    if (!person) {
      clearTourRequest(request.seq);
      return;
    }
    if (blocked) return;
    if (ENTRANCE.includes(pathname) || pathname.startsWith("/i/") || pathname.startsWith("/setup/")) return;
    if (request.auto && !AUTO_HOME.test(pathname)) return;
    const variant = resolveVariant(request.variant, person);
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        if (request.once && (await hasSeenTour(variant, person.personId))) {
          clearTourRequest(request.seq);
          return;
        }
        if (cancelled) return;
        clearTourRequest(request.seq);
        setShown({ variant, personId: person.personId, seq: request.seq, names: { name: person.name, couple: person.couple, planner: person.planner } });
      },
      // The home screen draws first, then the tour arrives on top of it.
      request.auto ? 700 : 150
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [request, visible, person, blocked, pathname, state.status]);

  const onScreen = !!visible;
  useEffect(() => {
    setTourOnScreen(onScreen);
  }, [onScreen]);
  useEffect(() => () => setTourOnScreen(false), []);

  if (!visible) return null;
  return (
    <TourBoundary key={visible.seq} onError={() => setShown(null)}>
      <TourOverlay
        variant={visible.variant}
        names={visible.names}
        onClose={(how) => {
          void markTourSeen(visible.variant, visible.personId, how);
          setShown(null);
        }}
      />
    </TourBoundary>
  );
}

/** A named variant must match the session: couples get couple tours, and so on. */
function resolveVariant(asked: TourVariant | undefined, person: Person): TourVariant {
  if (!asked) return person.variant;
  if (person.surface === "couple" && (asked === "couple" || asked === "couple-pending")) return asked;
  if (person.surface === "planner" && asked === "planner") return asked;
  if (person.surface === "guest" && asked === "guest") return asked;
  return person.variant;
}

function safePending(me: Me): boolean {
  try {
    return pendingCheck(me);
  } catch {
    return false;
  }
}

function firstName(full: string | null): string | null {
  const f = (full ?? "").trim().split(/\s+/)[0];
  return f ? f : null;
}

/** If anything inside the tour throws, the tour disappears; the app never does. */
class TourBoundary extends React.Component<{ children: React.ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
