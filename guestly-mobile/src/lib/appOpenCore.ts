// K21 (with #37 "Seen"): an app open is an open, a background refetch is not.
// GET /guest/home records the guest's open on the portal (30 minute dedupe);
// app 1.4.0 sends ?seen=0 on every fetch that is not an open: an interval,
// an invalidation after a write, a reconnect. One open per cold start and per
// return to the foreground. Pure, so node tests it (scripts/tests/seen.test.ts).

export type OpenGate = {
  /** The app came to the foreground (or started): the next Home fetch is an open. */
  markOpen(): void;
  /** Path for the next Home fetch; takes the open if there is one. */
  homePath(): string;
  /** The fetch that carried the open failed: the next one carries it again. */
  restore(): void;
  pending(): boolean;
};

export function createOpenGate(base = "/guest/home"): OpenGate {
  let open = true; // a cold start is an open
  return {
    markOpen() {
      open = true;
    },
    homePath() {
      if (open) {
        open = false;
        return base;
      }
      return `${base}?seen=0`;
    },
    restore() {
      open = true;
    },
    pending() {
      return open;
    },
  };
}
