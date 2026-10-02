// Small couple-surface pieces shared by the build 12 tabs: the chip row that
// fades at its right edge and keeps the lit chip in view (I13), the share
// invitation action, and the status words of a guest row.

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { View, ScrollView, Pressable, Share, StyleSheet, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { get } from "@/lib/api";
import { useFeatureCopy } from "@/i18n/feature";
import { T, Icon, type IconName } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { SETTINGS_KEY, type CoupleSettings } from "@/features/settings/hooks";
import { COPY } from "./copy";

export function useCoupleCopy() {
  return useFeatureCopy(COPY);
}

/** A horizontal chip row whose right edge fades out (so a cut chip reads as
 *  "more this way") and that scrolls the selected chip into view. Children are
 *  `Chip`s; pass the index of the lit one. */
export function FadedChipRow({ children, selected, padLeft = 24 }: { children: ReactNode; selected?: number; padLeft?: number }) {
  const scroll = useRef<ScrollView>(null);
  const xs = useRef<{ x: number; w: number }[]>([]);
  const [width, setWidth] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const offset = useRef(0);
  const reveal = useCallback(() => {
    if (selected === undefined || !width) return;
    const it = xs.current[selected];
    if (!it) return;
    const left = it.x;
    const right = it.x + it.w;
    if (left < offset.current + padLeft) scroll.current?.scrollTo({ x: Math.max(0, left - padLeft), animated: true });
    else if (right > offset.current + width - 40) scroll.current?.scrollTo({ x: right - width + 48, animated: true });
  }, [selected, width, padLeft]);
  useEffect(() => {
    reveal();
  }, [reveal]);
  const items = React.Children.toArray(children);
  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => {
          offset.current = e.nativeEvent.contentOffset.x;
          const end = e.nativeEvent.contentOffset.x + e.nativeEvent.layoutMeasurement.width >= e.nativeEvent.contentSize.width - 4;
          if (end !== atEnd) setAtEnd(end);
        }}
        contentContainerStyle={{ gap: 8, paddingLeft: padLeft, paddingRight: 40, alignItems: "center" }}
      >
        {items.map((child, i) => (
          <View
            key={i}
            onLayout={(e) => {
              xs.current[i] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width };
              if (i === selected) reveal();
            }}
          >
            {child}
          </View>
        ))}
      </ScrollView>
      {atEnd ? null : <LinearGradient pointerEvents="none" colors={["rgba(13,17,23,0)", colors.night]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fade} />}
    </View>
  );
}

/** "Going, party of 2" / "Va con 2" and friends: always a word, never color alone. */
export function guestStatusText(c: ReturnType<typeof useCoupleCopy>, status: string, party: number): string {
  const n = Math.max(1, party || 1);
  if (status === "attending") return c.guests.going(n);
  if (status === "declined") return c.guests.declined(n);
  return c.guests.pendingRow(n);
}

export function statusIcon(status: string): IconName {
  return status === "attending" ? "check" : status === "declined" ? "x-circle" : "clock";
}

export function statusColor(status: string): string {
  return status === "attending" ? colors.greenText : status === "declined" ? colors.ivory55 : colors.amber;
}

/** Opens the iOS share sheet with the invitation link and code. Without a
 *  code yet it opens the invitation code screen, where the code is made. */
export function useShareInvite() {
  const qc = useQueryClient();
  const router = useRouter();
  const c = useCoupleCopy();
  return useCallback(async () => {
    try {
      const s = await qc.fetchQuery({ queryKey: SETTINGS_KEY, queryFn: () => get<CoupleSettings>("/couple/settings"), staleTime: 30_000 });
      if (s.invite_code && s.invite_url) {
        await Share.share({ message: c.shareText(s.wedding?.couple_names ?? "", s.invite_url, s.invite_code) });
        return;
      }
    } catch {
      // Offline or the settings failed: the invitation screen says so itself.
    }
    router.push("/couple/settings/invite");
  }, [qc, router, c]);
}

/** "21 de marzo de 2027" / "21 March 2027": a date with its year, no weekday. */
export function fullDate(iso: string | null | undefined, lang: "en" | "es"): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { day: "numeric", month: "long", year: "numeric" });
}

/** "15 de enero" / "January 15": a deadline in a sentence. */
export function dayMonth(iso: string | null | undefined, lang: "en" | "es"): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { day: "numeric", month: "long" });
}

/** A progress ring with a centered label (replies of the total). */
export function ProgressRing({ value, total, size = 88, label }: { value: number; total: number; size?: number; label?: string }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.ivory14} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.gold} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circ * frac} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {label ? (
        <T v="body16" color={colors.ivory} style={{ fontVariant: ["tabular-nums"] }}>
          {label}
        </T>
      ) : null}
    </View>
  );
}

/** One row of a grouped list inside a card: icon, title, sub, chevron. */
export function MenuRow({ icon, title, sub, onPress, last, trailing, testID }: { icon: IconName; title: string; sub?: string | null; onPress?: () => void; last?: boolean; trailing?: ReactNode; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={sub ? `${title}, ${sub}` : title} style={({ pressed }) => [styles.menuRow, !last && styles.menuRowLine, pressed && onPress ? { opacity: 0.7 } : null]}>
      <View style={styles.menuIcon}>
        <Icon name={icon} size={22} color={colors.goldLight} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T v="body16" color={colors.ivory90}>
          {title}
        </T>
        {sub ? (
          <T v="meta13" color={colors.ivory55}>
            {sub}
          </T>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chev" size={18} color={colors.ivory40} /> : null)}
    </Pressable>
  );
}

export function MenuCard({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.menuCard, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  fade: { position: "absolute", right: 0, top: 0, bottom: 0, width: 44 },
  menuCard: { borderRadius: radius.tile, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)", paddingHorizontal: 16 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingVertical: 10 },
  menuRowLine: { borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  menuIcon: { width: 28, alignItems: "center" },
});
