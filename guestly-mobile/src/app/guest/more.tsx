// Info tab (build 12, prototype G.info; route name "more" kept for links).
//
// The couple's site as cards: the story on a photo, then Photos, Questions,
// Hotels, Gifts, Dress code and one "Wedding site" row. Then settings:
// language, notifications, the tour replay, and "Leave this wedding" behind a
// confirmation that shows the invitation code (needed to come back).
// While the couple has not published the site, only the rows that do not
// depend on it show (D-004).

import React, { useState } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { fmt, useCopy, useLang, mediumDate } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { unregisterPush } from "@/lib/push";
import { useGuestSession, useSession } from "@/lib/session";
import { useGuestHome, useGuestSchedule } from "@/lib/hooks";
import { Screen, Card, ListRow, Icon, LangToggle, Toggle, Footer, Stack, T, Sheet, Button, SectionLabel, PhotoHero } from "@/ui";
import { colors } from "@/ui/tokens";
import { TOUR_COPY, startTour } from "@/features/tour";
import { DressCodeSheet } from "@/features/guest/DressCodeSheet";
import { GUEST_COPY } from "@/features/guest/copy";
import { useGuestSite, sectionsOf } from "@/features/site/hooks";

const storyFallback = require("../../../assets/photos/walk.jpg");

export default function GuestInfo() {
  const copy = useCopy();
  const g = useFeatureCopy(GUEST_COPY);
  const { lang, setLang } = useLang();
  const router = useRouter();
  const tour = useFeatureCopy(TOUR_COPY);
  const session = useGuestSession();
  const { signOut, pushToken, setPushToken } = useSession();
  const { data: home } = useGuestHome();
  const { data: schedule } = useGuestSchedule();
  // The switch shows what the server has: on only while a token is saved.
  const notif = !!pushToken;
  const [notifBusy, setNotifBusy] = useState(false);
  const [dressOpen, setDressOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  async function toggleNotifications(v: boolean) {
    if (notifBusy) return;
    if (v) {
      router.push({ pathname: "/notify", params: { surface: "guest", from: "more" } });
      return;
    }
    if (!pushToken) return;
    setNotifBusy(true);
    try {
      // Off means off: the server stops sending before the switch moves.
      if (await unregisterPush("guest", pushToken)) setPushToken(null);
      else Alert.alert(copy.common.error);
    } finally {
      setNotifBusy(false);
    }
  }
  const site = useGuestSite();
  const siteOff = site.error instanceof ApiFailure && site.error.code === "not_found";
  const story = sectionsOf(site.data, ["story"])[0];
  const photos = sectionsOf(site.data, ["gallery"])[0]?.images.length ?? 0;
  const dress = home?.dress_code ?? schedule?.events.find((e) => e.dress_code)?.dress_code ?? null;
  const couple = session?.tenant.couple_names ?? home?.couple_names ?? "";
  const when = home?.wedding_date ?? session?.tenant.wedding_date ?? null;
  const slug = site.data?.site_slug ?? session?.tenant.slug ?? "";
  const go = (path: string) => router.push(path as never);

  return (
    <Screen padded={false}>
      <View style={styles.head}>
        <T v="label11" color={colors.ivory70} numberOfLines={1}>
          {[couple, mediumDate(when, lang)].filter(Boolean).join(" · ")}
        </T>
        <T v="title42" size={40} accessibilityRole="header">
          {g.info.title}
        </T>
      </View>
      <Stack gap={16} style={{ paddingHorizontal: 16, marginTop: 8 }}>
        {siteOff ? null : (
          <Pressable testID="info-story" onPress={() => go("/guest/site/story")} accessibilityRole="button" accessibilityLabel={g.info.story} style={({ pressed }) => [styles.story, pressed && { transform: [{ scale: 0.99 }] }]}>
            <PhotoHero source={story?.image_url ? { uri: story.image_url } : storyFallback} height={196} gradient={0.6} topShade={false} focal={{ x: 0.5, y: 0.6 }} gutter={16} bottomPadding={16}>
              <T v="label11" color="rgba(247,243,236,0.86)">
                {couple}
              </T>
              <T v="name24">{story?.heading || g.info.story}</T>
            </PhotoHero>
          </Pressable>
        )}
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          {siteOff ? null : (
            <>
              <ListRow leading={<Icon name="photo" size={22} color={colors.goldLight} />} title={g.info.photos} sub={photos ? String(photos) : null} onPress={() => go("/guest/site/gallery")} />
              <ListRow leading={<Icon name="book" size={22} color={colors.goldLight} />} title={g.info.faq} onPress={() => go("/guest/site/faq")} />
              <ListRow leading={<Icon name="bed" size={22} color={colors.goldLight} />} title={g.info.hotels} onPress={() => go("/guest/site/hotels")} />
              <ListRow leading={<Icon name="gift" size={22} color={colors.goldLight} />} title={g.info.gifts} onPress={() => go("/guest/site/gifts")} />
            </>
          )}
          {/* The sub-line is cut at two lines; the row opens the whole text (N8). */}
          <ListRow leading={<Icon name="hanger" size={22} color={colors.goldLight} />} title={g.info.dressCode} sub={dress} onPress={() => setDressOpen(true)} last={siteOff} />
          {siteOff ? null : <ListRow testID="info-site" leading={<Icon name="globe" size={22} color={colors.goldLight} />} title={g.info.site} sub={slug ? `app.guest-ly.com/${slug}` : null} onPress={() => go("/guest/site")} last />}
        </Card>

        <SectionLabel style={{ marginTop: 8, paddingHorizontal: 4 }}>{g.info.settings}</SectionLabel>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow leading={<Icon name="globe" size={22} color={colors.goldLight} />} title={g.info.language} trailing={<LangToggle value={lang} onChange={setLang} />} chevron={false} />
          <ListRow
            leading={<Icon name="bell" size={22} color={colors.goldLight} />}
            title={g.info.notifications}
            sub={notif ? g.info.on : g.info.off}
            trailing={<Toggle value={notif} label={g.info.notifications} onChange={(v) => void toggleNotifications(v)} />}
            chevron={false}
          />
          <ListRow testID="guest-tour" leading={<Icon name="sparkle" size={22} color={colors.goldLight} />} title={tour.replay} sub={tour.replayDetail} onPress={() => startTour()} last />
        </Card>

        <Button testID="info-leave" label={g.info.leave} kind="ghost" icon="signout" onPress={() => setLeaveOpen(true)} style={{ borderColor: "rgba(240,162,162,0.5)" }} />
      </Stack>
      <Footer version={copy.common.footerVersion} trademark={copy.common.footerTrademark} />
      <DressCodeSheet visible={dressOpen} onClose={() => setDressOpen(false)} />
      <Sheet visible={leaveOpen} onClose={() => setLeaveOpen(false)} top={320}>
        <T v="title30" accessibilityRole="header">
          {fmt(g.info.leaveTitle, { couple })}
        </T>
        <T v="body15" color={colors.ivory70} style={{ marginTop: 8 }}>
          {g.info.leaveBody}
        </T>
        {session?.inviteCode ? (
          <T v="body16" color={colors.goldLight} selectable style={{ marginTop: 8, letterSpacing: 2 }}>
            {fmt(g.info.leaveCode, { code: session.inviteCode })}
          </T>
        ) : null}
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Button
            testID="info-leave-go"
            label={g.info.leaveGo}
            kind="ghost"
            style={{ borderColor: colors.red }}
            onPress={() => {
              setLeaveOpen(false);
              void signOut();
            }}
          />
          <Button label={copy.common.cancel} kind="text" onPress={() => setLeaveOpen(false)} />
        </Stack>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 4 },
  story: { borderRadius: 16, overflow: "hidden" },
});
