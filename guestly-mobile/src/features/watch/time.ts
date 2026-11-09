/** "HH:MM" or "HH:MM:SS" to minutes since midnight; NaN when malformed. */
export function minutesOfClock(t: string | null | undefined): number {
  const m = (t ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
