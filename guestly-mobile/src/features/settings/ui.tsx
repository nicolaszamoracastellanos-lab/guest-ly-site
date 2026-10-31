// Small pieces the Settings screens share.

import React from "react";
import { T } from "@/ui";
import { colors } from "@/ui/tokens";

/** A field's error from the server, in the reader's language, under the field. */
export function FieldError({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    <T v="meta13" color={colors.red} accessibilityLiveRegion="polite">
      {text}
    </T>
  );
}
