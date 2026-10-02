// Day-of route, kept for deep links (a push on the wedding day). On the day the
// guest Home renders the same view itself (v1.2, N1), so it is never lost
// after a tap on Home. The view lives in features/guest/DayOfView.tsx.

import { GuestDayOfView } from "@/features/guest/DayOfView";

export default function GuestDayOf() {
  return <GuestDayOfView />;
}
