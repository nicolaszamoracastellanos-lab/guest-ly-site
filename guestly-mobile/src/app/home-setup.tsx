// /home-setup: the five questions that build the customizable Home (Oct 31
// 2026), presented as a modal over Home. Couples who can edit only; anyone
// else is sent back to where they came from.

import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { useUserSession } from "@/lib/session";
import { HomeQuiz } from "@/features/couple/HomeQuiz";

export default function HomeSetupRoute() {
  const user = useUserSession();
  const router = useRouter();
  const allowed = !!user && user.me.surface !== "planner" && user.me.can_edit;
  useEffect(() => {
    if (user && !allowed) {
      if (router.canGoBack()) router.back();
      else router.replace("/couple" as never);
    }
  }, [user, allowed, router]);
  return allowed ? <HomeQuiz /> : null;
}
