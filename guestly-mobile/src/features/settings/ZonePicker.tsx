// Time zone field: shows the city of the stored zone; a tap opens a sheet
// with a search and the zones grouped by region (logic.ts zoneGroups). The
// phone's own zone and the current one are pinned on top.

import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { T, Icon, Input, Sheet, ListRow, SectionLabel, Card } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { HH_COPY } from "./copy";
import { zoneCity, zoneGroups } from "./logic";

export function phoneZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function ZonePicker({ value, onChange, disabled, label }: { value: string; onChange: (tz: string) => void; disabled?: boolean; label: string }) {
  const c = useFeatureCopy(HH_COPY).general;
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const here = phoneZone();
  const groups = useMemo(() => zoneGroups(q, lang, [value, here]), [q, lang, value, here]);

  return (
    <>
      <Pressable
        onPress={disabled ? undefined : () => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${zoneCity(value)}`}
        style={({ pressed }) => [styles.field, disabled && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}
      >
        <Icon name="globe" size={18} color={colors.ivory55} />
        <T v="body16" style={{ flex: 1 }} numberOfLines={1}>
          {zoneCity(value)}
        </T>
        <T v="caption14" color={colors.ivory40} numberOfLines={1}>
          {value}
        </T>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} top={120} form={false}>
        <T v="title30">{label}</T>
        <View style={{ marginTop: 14 }}>
          <Input icon="search" value={q} onChangeText={setQ} placeholder={c.searchZone} placeholderTextColor={colors.ivory40} autoCorrect={false} clearable />
        </View>
        {groups.length === 0 ? (
          <T v="meta13" color={colors.ivory55} style={{ marginTop: 16 }}>
            {c.noZone}
          </T>
        ) : null}
        {groups.map((g) => (
          <View key={g.key} style={{ marginTop: 16 }}>
            {g.title ? <SectionLabel style={{ marginBottom: 6 }}>{g.title}</SectionLabel> : null}
            <Card kind="solid" padding={0} style={{ paddingHorizontal: 16 }}>
              {g.zones.map((z, i) => (
                <ListRow
                  key={z}
                  title={zoneCity(z)}
                  sub={z === here ? `${z} · ${c.thisPhone}` : z}
                  trailing={z === value ? <Icon name="check" size={20} color={colors.goldLight} /> : undefined}
                  chevron={false}
                  last={i === g.zones.length - 1}
                  onPress={() => {
                    onChange(z);
                    setOpen(false);
                    setQ("");
                  }}
                />
              ))}
            </Card>
          </View>
        ))}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: radius.chip, borderWidth: 1, borderColor: colors.ivory14, backgroundColor: "rgba(247,243,236,0.04)" },
});
