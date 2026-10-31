// Plan folded into Tools in build 13. The route stays for old pushes, the
// portal's links and deep links, and opens Tools.

import React from "react";
import { Redirect } from "expo-router";

export default function CouplePlanRedirect() {
  return <Redirect href="/couple/tools" />;
}
