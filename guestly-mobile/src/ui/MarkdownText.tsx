// Minimal inline-markdown rendering for AI replies (concierge + coordinator).
// D-045: replies were rendered as plain text, so **bold** showed as literal
// asterisks. Scope is deliberately small: **bold** only, matched to what the
// two assistants actually emit. No links, lists, or italics here; add them
// only if a real reply needs them, so this stays a render helper, not a
// markdown engine.
import React from "react";
import { Text as RNText } from "react-native";
import { fonts } from "./tokens";

const BOLD = /\*\*(.+?)\*\*/g;

/** Splits `text` on **bold** spans; everything else renders unchanged. */
export function renderInlineBold(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  BOLD.lastIndex = 0;
  let i = 0;
  while ((match = BOLD.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(
      <RNText key={`b${i++}`} style={{ fontFamily: fonts.bodySemibold }}>
        {match[1]}
      </RNText>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
