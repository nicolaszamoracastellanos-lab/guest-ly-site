// Any route the app does not have (a malformed push route, an old or mistyped
// deep link) lands on the home of the session that is open, never on the
// router's developer "Unmatched route" page (core review P2-30).

import React from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "@/lib/session";
import { colors } from "@/ui/tokens";

export default function NotFound() {
  const { state } = useSession();
  if (state.status === "loading") return <View style={{ flex: 1, backgroundColor: colors.night }} />;
  const home =
    state.status === "guest"
      ? "/guest"
      : state.status === "user"
        ? state.me.surface === "planner"
          ? "/planner"
          : "/couple"
        : "/";
  return <Redirect href={home} />;
}
