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
            {d.blocks.map((b, i) => (
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
                <View style={{ width: 58 }}>
                  <T
                    v="title26"
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
                </View>
                <Pressable
                  onPress={canEdit && onStatus ? () => onStatus(b) : undefined}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={c.status}
                  disabled={!canEdit || !onStatus}
                  style={{ paddingTop: 2 }}
                >
                  <Badge
                    label={c.statuses[b.status]}
                    kind={statusKind(b.status)}
                  />
                </Pressable>
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
    </Stack>
  );
}
