// More folded into Tools in build 13 (Settings is the gear on Home and the
// last row of Tools). The route stays for old pushes and links, and opens
// Tools.

import React from "react";
import { Redirect } from "expo-router";

export default function CoupleMoreRedirect() {
  return <Redirect href="/couple/tools" />;
}
