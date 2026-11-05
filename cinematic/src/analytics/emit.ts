import { SITE_BEACON_URL } from '../config';

/* #23: hands one event to the landing beacon. Components call this for
   things a click listener cannot see (wizard step, demo chat count, and
   later #22 booking and #50 guide). Numbers and ids only, never typed text.
   Until the beacon chunk has loaded the events wait in an in-memory queue
   on window (never on the device); the beacon drains it and then takes
   pushes directly. With no SITE_BEACON_URL this is a no-op. */
export type BeaconEvent = { k: string; [key: string]: string | number };

export function emit(event: BeaconEvent) {
  if (!SITE_BEACON_URL) return;
  const w = window as unknown as { __glt?: { push(e: BeaconEvent): unknown; length?: number } };
  const q = (w.__glt ??= [] as BeaconEvent[]);
  if ((q.length ?? 0) < 50) q.push(event);
}
