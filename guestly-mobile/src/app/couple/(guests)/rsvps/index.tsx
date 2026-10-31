// RSVPs are part of Invitados since build 12 (decision D3). This route stays
// because pushes (lib/push SECTIONS, WEB_MAP "/rsvps"), the portal and older
// links open /couple/rsvps, optionally with ?filter=: it lands on the guest
// list with the same filter lit.

import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

const KNOWN = ["all", "pending", "changed", "attending", "declined"];

export default function RsvpsRedirect() {
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const f = typeof filter === "string" && KNOWN.includes(filter) ? filter : "all";
  return <Redirect href={{ pathname: "/couple/guests", params: { filter: f } } as never} />;
}
