// /tour?variant=guest|couple|pending|couple-pending|planner[&once=1]
//
// A route door into the welcome tour for code that prefers navigation, and for
// links. The tour is not a screen of its own: it is the overlay drawn by
// <TourHost /> in the root layout, so deep links and push taps keep landing on
// their real screens underneath. This route asks for the tour and steps back
// out of the way at once; it is presented as an invisible, unanimated modal.

import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSession } from "@/lib/session";
import { parseVariant, startTour, startTourOnce } from "@/features/tour";

export default function TourRoute() {
  const { variant, once } = useLocalSearchParams<{ variant?: string; once?: string }>();
  const router = useRouter();
  const { state } = useSession();
  const status = state.status;
  const home = state.status === "guest" ? "/guest" : state.status === "user" ? (state.me.surface === "planner" ? "/planner" : "/couple") : "/";

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "none") (once === "1" ? startTourOnce : startTour)({ variant: parseVariant(variant) });
    if (router.canGoBack()) router.back();
    else router.replace(home as never);
  }, [status, variant, once, router, home]);

  return null;
}
