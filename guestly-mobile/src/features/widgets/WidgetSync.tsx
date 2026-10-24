// Invisible components that keep the home screen widgets current. Each role
// layout mounts its own; they only read queries the screens already run.

import { useEffect } from "react";
import { useLang } from "@/i18n";
import { useCoupleDayOf, useCoupleHome, useGuestHome, usePlannerAgenda, usePlannerPortfolio } from "@/lib/hooks";
import { syncDayOfActivity } from "./liveActivities";
import { syncCoupleWidgets, syncDayOfWidget, syncGuestWidgets, syncPlannerWidgets } from "./sync";

export function CoupleWidgetSync() {
  const { lang } = useLang();
  const home = useCoupleHome();
  // The day-of widget and Live Activity only matter around the wedding, so the
  // run sheet is not fetched at every launch for weddings months away.
  const days = home.data?.countdown?.days;
  const nearWedding = home.data?.countdown ? home.data.countdown.passed || (days != null && days <= 2) : false;
  const dayof = useCoupleDayOf({ poll: false, enabled: nearWedding });
  useEffect(() => {
    if (home.data) syncCoupleWidgets(home.data, lang);
  }, [home.data, lang]);
  useEffect(() => {
    if (dayof.data) {
      syncDayOfWidget(dayof.data.runsheet, dayof.data.day_of, lang, "couple/dayof");
      void syncDayOfActivity(dayof.data.runsheet, dayof.data.day_of, lang, "couple/dayof");
    }
  }, [dayof.data, lang]);
  return null;
}

export function PlannerWidgetSync() {
  const { lang } = useLang();
  const portfolio = usePlannerPortfolio();
  const agenda = usePlannerAgenda();
  useEffect(() => {
    if (portfolio.data) syncPlannerWidgets(portfolio.data.weddings, agenda.data, lang);
  }, [portfolio.data, agenda.data, lang]);
  return null;
}

export function GuestWidgetSync() {
  const { lang } = useLang();
  const home = useGuestHome();
  useEffect(() => {
    if (home.data) syncGuestWidgets(home.data, lang);
  }, [home.data, lang]);
  return null;
}
