// Más (build 12): the invitation code, then everything that is not one of the
// four tabs, as one list. Settings appears once (the gear row). Sections that
// moved: Tasks, Budget, Seating and the day's schedule to Plan; announcements
// to Messages; RSVPs into Guests. Nothing else was removed: the planner's
// requests, wedding day mode and the concierge insights stay here too.

import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { plural, useCopy } from "@/i18n";
import { useMore } from "@/lib/hooks";
import { useUserSession } from "@/lib/session";
import { useCoupleSettings } from "@/features/settings/hooks";
import { Screen, TopBar, Wordmark, BigTitle, T, Icon, Footer, Skeleton } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { useCoupleCopy, useShareInvite, MenuRow, MenuCard } from "@/features/couple/ui";

export default function CoupleMore() {
  const copy = useCopy();
  const c = useCoupleCopy();
  const router = useRouter();
  const user = useUserSession();
  const more = useMore();
  const settings = useCoupleSettings();
  const shareInvite = useShareInvite();
  const slug = more.data?.site_slug ?? user?.me.tenant.slug ?? "";
  const requests = more.data?.entries.requests?.count;
  const code = settings.data?.invite_code ?? null;

  return (
    <Screen header={<TopBar left={<Wordmark height={20} />} />} refresh={() => Promise.all([more.refetch(), settings.refetch()])}>
      <View style={{ marginTop: 10 }}>
        <BigTitle title={c.more.title} sub={user?.me.tenant.couple_names} />
      </View>

      {/* The invitation code, one tap from sharing (it used to sit four taps deep in Settings). */}
      <Pressable onPress={() => router.push("/couple/settings/invite")} accessibilityRole="button" accessibilityLabel={code ? `${c.more.code}, ${code.split("").join(" ")}` : c.more.code} style={({ pressed }) => [styles.code, pressed && { opacity: 0.85 }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="meta13" color={colors.ivory70}>
            {c.more.code}
          </T>
          {code ? (
            <T v="title30" color={colors.ivory} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ letterSpacing: 4 }}>
              {code}
            </T>
          ) : settings.isLoading ? (
            <Skeleton h={30} w={140} />
          ) : (
            <Icon name="chev" size={18} color={colors.ivory40} />
          )}
        </View>
        <Pressable onPress={() => void shareInvite()} accessibilityRole="button" accessibilityLabel={c.more.share} style={({ pressed }) => [styles.share, pressed && { opacity: 0.8 }]}>
          <Icon name="share" size={18} color={colors.goldLight} />
          <T v="meta13" color={colors.goldLight}>
            {c.more.share}
          </T>
        </Pressable>
      </Pressable>

      <MenuCard style={{ marginTop: 16 }}>
        <MenuRow icon="globe" title={c.more.site} sub={slug ? `guest-ly.com/${slug}` : undefined} onPress={() => router.push("/couple/website")} testID="more-site" />
        <MenuRow icon="book" title={c.more.brain} sub={c.more.brainSub} onPress={() => router.push("/couple/brain")} testID="more-brain" />
        <MenuRow icon="sparkle" title={c.more.coordinator} sub={c.more.coordinatorSub} onPress={() => router.push("/assistant" as never)} testID="more-coordinator" />
        <MenuRow icon="qr" title={c.more.checkin} sub={c.more.checkinSub} onPress={() => router.push("/couple/checkin")} testID="more-checkin" />
        <MenuRow icon="clock" title={c.more.dayof} sub={c.more.dayofSub} onPress={() => router.push("/couple/dayof")} testID="more-dayof" />
        <MenuRow icon="tasks" title={c.more.requests} sub={typeof requests === "number" && requests > 0 ? plural(requests, copy.more.subs.requests) : c.more.requestsSub} onPress={() => router.push("/couple/requests")} testID="more-requests" />
        <MenuRow icon="star" title={c.more.insights} sub={c.more.insightsSub} onPress={() => router.push("/couple/insights")} testID="more-insights" />
        <MenuRow icon="info" title={c.more.guide} sub={c.more.guideSub} onPress={() => router.push({ pathname: "/web", params: { path: "/guide", title: c.more.guide } } as never)} testID="more-guide" />
        <MenuRow icon="gear" title={c.more.settings} sub={c.more.settingsSub} onPress={() => router.push("/settings")} testID="more-settings" last />
      </MenuCard>
      <Footer version={copy.common.footerVersion} trademark={copy.common.footerTrademark} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20, padding: 16, borderRadius: radius.tile, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: colors.goldBorder },
  share: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.goldBorder },
});
