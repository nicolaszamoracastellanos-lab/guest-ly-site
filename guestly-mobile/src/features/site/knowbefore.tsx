// #45 Know before you go, the app's card (1.4.0, MW_KNOW_BEFORE): GET
// /guest/site sends a `knowbefore` section with data only. Three groups in one
// card: What to pack (the weather line, then a checklist whose ticks stay on
// this phone, keyed by packing[].key so a language switch keeps them), What to
// wear, Before you travel (entry notes, the couple's official link and the
// stock line, currency, tips). Builds below 1.4.0 get the same content as a
// plain custom section, which they already render. Nothing to show: no card.

import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFeatureCopy } from "@/i18n/feature";
import { scopedStorageKey } from "@/lib/scope";
import { openUrlSafe } from "@/features/guest/links";
import { Button, Card, Hairline, Icon, Row, Stack, T } from "@/ui";
import { colors, fonts } from "@/ui/tokens";
import { hasKnowBefore, type KnowBeforeSection } from "./knowbeforeCore";
import { KNOW_BEFORE_COPY } from "./knowbeforeCopy";

export { KNOW_BEFORE_COPY };



/** Packing ticks for one site, on this phone (sign-out clears them). */
function usePackTicks(siteSlug: string) {
  const key = scopedStorageKey(`gl.scoped.pack.${siteSlug}`);
  const [ticks, setTicks] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!alive || !raw) return;
        const list = JSON.parse(raw);
        if (Array.isArray(list)) setTicks(new Set(list.filter((x): x is string => typeof x === "string")));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  const toggle = (k: string) =>
    setTicks((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      void AsyncStorage.setItem(key, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  return { ticks, toggle };
}

export function KnowBeforeCard({ s, siteSlug, heading }: { s: KnowBeforeSection; siteSlug: string; heading?: (title: string) => React.ReactNode }) {
  const c = useFeatureCopy(KNOW_BEFORE_COPY);
  const { ticks, toggle } = usePackTicks(siteSlug);
  if (!hasKnowBefore(s)) return null;
  const pack = !!s.weather || s.packing.length > 0;
  const wear = !!s.dress_note || !!s.dress_all || s.dress_events.length > 0;
  const travel = !!s.entry || !!s.entry_link || s.currency.length > 0 || !!s.tipping;
  let shown = 0;
  const rule = () => (shown++ > 0 ? <Hairline style={{ marginVertical: 16 }} /> : null);
  return (
    <View testID="site-knowbefore">
      {heading ? heading(s.heading || c.heading) : null}
      <Card kind="solid" padding={16}>
        {pack ? (
          <View>
            {rule()}
            <T v="body16" style={{ fontFamily: fonts.bodyMedium }} accessibilityRole="header">
              {c.pack}
            </T>
            {s.weather ? (
              <T v="body15" color={colors.ivory70} style={{ marginTop: 6 }}>
                {s.weather}
              </T>
            ) : null}
            {s.packing.length ? (
              <View style={{ marginTop: 8 }}>
                {s.packing.map((it) => {
                  const on = ticks.has(it.key);
                  return (
                    <Pressable
                      key={it.key}
                      onPress={() => toggle(it.key)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={it.text}
                      style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}
                    >
                      <View style={[styles.box, on && styles.boxOn]}>{on ? <Icon name="check" size={16} color={colors.night} strokeWidth={2.2} /> : null}</View>
                      <T v="body15" color={on ? colors.ivory55 : colors.ivory} style={{ flex: 1 }}>
                        {it.text}
                      </T>
                    </Pressable>
                  );
                })}
                <T v="meta13" color={colors.ivory55} style={{ marginTop: 4 }}>
                  {c.ticksHere}
                </T>
              </View>
            ) : null}
          </View>
        ) : null}
        {wear ? (
          <View>
            {rule()}
            <T v="body16" style={{ fontFamily: fonts.bodyMedium }} accessibilityRole="header">
              {c.wear}
            </T>
            <Stack gap={4} style={{ marginTop: 6 }}>
              {s.dress_note ? (
                <T v="body15" color={colors.ivory70}>
                  {s.dress_note}
                </T>
              ) : null}
              {s.dress_all ? (
                <T v="body15" color={colors.ivory}>
                  {s.dress_all}
                </T>
              ) : (
                s.dress_events.map((d) => (
                  <T key={d.id} v="body15" color={colors.ivory}>
                    <T v="body15" color={colors.ivory70}>{`${d.title}: `}</T>
                    {d.code}
                  </T>
                ))
              )}
            </Stack>
          </View>
        ) : null}
        {travel ? (
          <View>
            {rule()}
            <T v="body16" style={{ fontFamily: fonts.bodyMedium }} accessibilityRole="header">
              {c.travel}
            </T>
            <Stack gap={6} style={{ marginTop: 6 }}>
              {s.entry ? (
                <T v="body15" color={colors.ivory70}>
                  {s.entry}
                </T>
              ) : null}
              {/* Visa text is never generated: the couple's words, their link, and one stock line. */}
              {s.entry || s.entry_link ? (
                <T v="meta13" color={colors.ivory55}>
                  {c.checkPassport}
                </T>
              ) : null}
              {s.entry_link ? <Button label={c.official} kind="glass" small icon="globe" full={false} onPress={() => openUrlSafe(s.entry_link!)} style={{ alignSelf: "flex-start", marginTop: 4 }} /> : null}
              {s.currency.length ? (
                <View style={{ marginTop: 6 }}>
                  <T v="meta13" color={colors.ivory55}>
                    {c.currency}
                  </T>
                  {s.currency.map((line, i) => (
                    <T key={i} v="body15" color={colors.ivory70}>
                      {line}
                    </T>
                  ))}
                </View>
              ) : null}
              {s.tipping ? (
                <View style={{ marginTop: 6 }}>
                  <T v="meta13" color={colors.ivory55}>
                    {c.tips}
                  </T>
                  <T v="body15" color={colors.ivory70}>
                    {s.tipping}
                  </T>
                </View>
              ) : null}
            </Stack>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 44, paddingVertical: 10 },
  box: { width: 22, height: 22, marginTop: 1, borderRadius: 6, borderWidth: 1.5, borderColor: colors.ivory40, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: colors.goldLight, borderColor: colors.goldLight },
});

export function KnowBeforeRow({ onPress, title }: { onPress: () => void; title: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [{ minHeight: 44 }, pressed && { opacity: 0.6 }]}>
      <Row gap={10}>
        <Icon name="info" size={20} color={colors.goldLight} />
        <T v="body16" style={{ flex: 1 }}>
          {title}
        </T>
        <Icon name="chev" size={18} color={colors.ivory40} />
      </Row>
    </Pressable>
  );
}
