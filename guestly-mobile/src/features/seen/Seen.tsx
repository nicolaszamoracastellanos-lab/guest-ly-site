// #37 "Seen" lines: an eye and words ("Seen today 18:04"), or the crossed eye
// ("Not seen yet"), never a color alone. Times are instants shown in the
// phone's zone, relative only under an hour.

import React from "react";
import { View } from "react-native";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { Icon, Row, T } from "@/ui";
import { colors } from "@/ui/tokens";
import { SEEN_COPY } from "./copy";
import { listNames, seenWhen, viewerLabel, whenText, type GuestSeen, type RunsheetSeen } from "./core";

export function useSeenWhen() {
  const c = useFeatureCopy(SEEN_COPY);
  const { lang } = useLang();
  return (iso: string | null | undefined): string => {
    const w = seenWhen(iso, lang);
    return w ? whenText(w, c.when) : "";
  };
}

/** One muted line with the eye. `at` null: "Not seen yet" with the crossed eye. */
export function SeenLine({ at, style, testID }: { at: string | null; style?: object; testID?: string }) {
  const c = useFeatureCopy(SEEN_COPY);
  const when = useSeenWhen();
  const text = at ? fmt(c.seen, { when: when(at) }) : c.notSeen;
  return (
    <View style={style} testID={testID} accessible accessibilityLabel={text}>
      <Row gap={6}>
        <Icon name={at ? "eye" : "eye-off"} size={14} color={colors.ivory55} />
        <T v="meta13" color={colors.ivory55} numberOfLines={1} style={{ flexShrink: 1, fontVariant: ["tabular-nums"] }}>
          {text}
        </T>
      </Row>
    </View>
  );
}

/** The guest card's line: last open and the visits since the first. */
export function GuestSeenLine({ seen }: { seen: GuestSeen | null | undefined }) {
  const c = useFeatureCopy(SEEN_COPY);
  const when = useSeenWhen();
  if (seen === undefined) return null;
  if (seen === null) return <SeenLine at={null} testID="guest-seen" />;
  const text = seen.views > 1 ? fmt(c.detail, { when: when(seen.last_seen_at), views: seen.views, first: when(seen.first_seen_at) }) : fmt(c.seen, { when: when(seen.last_seen_at) });
  return (
    <View testID="guest-seen" accessible accessibilityLabel={text}>
      <Row gap={6} align="flex-start">
        <Icon name="eye" size={14} color={colors.ivory55} />
        <T v="meta13" color={colors.ivory55} style={{ flex: 1, fontVariant: ["tabular-nums"] }}>
          {text}
        </T>
      </Row>
    </View>
  );
}

/** The planner's runsheet line: who of the couple's side saw this version. */
export function RunsheetSeenLine({ seen }: { seen: RunsheetSeen | null }) {
  const c = useFeatureCopy(SEEN_COPY);
  const when = useSeenWhen();
  if (!seen) return null;
  let icon: "eye" | "eye-off" = "eye-off";
  let lines: string[];
  if (seen.state === "none") lines = [c.runsheet.none];
  else {
    const pick = seen.state === "current" ? seen.viewers.filter((v) => v.current) : seen.viewers.slice(0, 1);
    const names = listNames(pick.map((v) => viewerLabel(v, c.roles)), c.and);
    if (seen.state === "current") {
      icon = "eye";
      lines = [fmt(c.runsheet.seenBy, { names, when: when(seen.at) })];
    } else lines = [c.runsheet.stale, fmt(c.runsheet.lastOpened, { names, when: when(seen.at) })];
  }
  return (
    <View testID="runsheet-seen" style={{ marginTop: 12 }} accessible accessibilityLabel={lines.join(". ")}>
      <Row gap={8} align="flex-start">
        <Icon name={icon} size={16} color={colors.ivory55} />
        <View style={{ flex: 1 }}>
          {lines.map((l, i) => (
            <T key={i} v={i === 0 ? "body15" : "meta13"} color={i === 0 ? colors.ivory70 : colors.ivory55}>
              {l}
            </T>
          ))}
        </View>
      </Row>
    </View>
  );
}
