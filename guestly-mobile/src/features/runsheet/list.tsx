// The runsheet day list, shared by the couple (editable) and planner (read-only) screens.

import React from "react";
import { View, Pressable } from "react-native";
import { useLang, longDate } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { Card, T, Badge, Stack, SectionLabel } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "./copy";
import { statusKind, type RunsheetBlock, type RunsheetSurface } from "./hooks";

export function RunsheetList({
  data,
  canEdit,
  onStatus,
  onOpen,
}: {
  data: RunsheetSurface;
  canEdit: boolean;
  onStatus?: (b: RunsheetBlock) => void;
  onOpen?: (b: RunsheetBlock) => void;
}) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  return (
    <Stack gap={18} style={{ marginTop: 20 }}>
      {data.days.map((d) => (
        <View key={d.day}>
          <SectionLabel color={colors.goldLight}>
            {longDate(d.day, lang)}
          </SectionLabel>
          <Card
            kind="solid"
            padding={2}
            style={{ marginTop: 8, paddingHorizontal: 18 }}
          >
            {[...d.blocks].sort((a, b) => nightOrder(a.starts_at) - nightOrder(b.starts_at)).map((b, i) => (
              <Pressable
                key={b.id}
                onPress={onOpen ? () => onOpen(b) : undefined}
                accessibilityRole={onOpen ? "button" : undefined}
                style={{
                  flexDirection: "row",
                  gap: 14,
                  alignItems: "flex-start",
                  minHeight: 56,
                  paddingVertical: 10,
                  borderBottomWidth: i === d.blocks.length - 1 ? 0 : 1,
                  borderBottomColor: colors.ivory09,
                }}
              >
                {/* Wide enough for "09:00" in the display face, and one line always:
                    the time used to break into "09:0 / 0" (Part 9 audit, D-009). */}
                <View style={{ width: 76 }}>
                  <T
                    v="title26"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    color={
                      b.status === "done" ? colors.ivory40 : colors.goldLight
                    }
                  >
                    {b.starts_at}
                  </T>
                  {b.ends_at ? (
                    <T v="meta13" color={colors.ivory40}>
                      {b.ends_at}
                    </T>
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <T
                    v="body16"
                    color={b.status === "done" ? colors.ivory55 : colors.ivory}
                    style={
                      b.status === "done" && {
                        textDecorationLine: "line-through",
                      }
                    }
                  >
                    {b.title}
                  </T>
                  {b.location || b.owner || b.vendor_name ? (
                    <T v="meta13" color={colors.ivory55}>
                      {[b.location, b.owner, b.vendor_name]
                        .filter(Boolean)
                        .join(" · ")}
                    </T>
                  ) : null}
                  {/* The status sits under the title, so a long badge no longer
                      squeezes the title into one word per line. 44 pt target. */}
                  <Pressable
                    onPress={canEdit && onStatus ? () => onStatus(b) : undefined}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.status}: ${c.statuses[b.status]}`}
                    disabled={!canEdit || !onStatus}
                    style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
                  >
                    <Badge
                      label={c.statuses[b.status]}
                      kind={statusKind(b.status)}
                    />
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
    </Stack>
  );
}

/** Minutes since 05:00, so a block at 01:30 sorts after 23:00: the wedding
 *  night runs past midnight and its last song is not the first thing of the day. */
export function nightOrder(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10) || 0);
  const mins = h * 60 + m;
  return mins < 5 * 60 ? mins + 24 * 60 : mins;
}
