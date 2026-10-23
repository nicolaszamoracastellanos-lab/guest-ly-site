// Broadcasts live inside Guest messages now (build 15). This route stays for
// the portal's links, push taps and the composer's "request a template" hop:
// it opens Messages on the Broadcasts side and keeps the query.

import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

// The planner imports these from this file.
export { groupTitle, deliveryLine } from "@/features/broadcasts/format";

export default function Broadcasts() {
  const params = useLocalSearchParams<{ request?: string; kind?: string }>();
  return <Redirect href={{ pathname: "/couple/messages", params: { seg: "avisos", ...(params.request ? { request: params.request } : {}), ...(params.kind ? { kind: params.kind } : {}) } } as never} />;
}
