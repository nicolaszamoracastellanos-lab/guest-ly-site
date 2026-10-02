// /guest/messages: kept for deep links (the "the couple replied" push, older
// builds' links). Build 12 shows the couple's replies in the Ask thread, so
// this route only forwards there.

import React from "react";
import { Redirect } from "expo-router";

export default function GuestMessages() {
  return <Redirect href="/guest/concierge" />;
}
