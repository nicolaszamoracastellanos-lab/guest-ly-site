// Guest home: the invitation. Full-bleed photo, the names at 60px, the
// countdown as type, one glass card for the RSVP, four quick actions.

import React, { useEffect } from "react";
import { View, StyleSheet, Image, ScrollView, Linking, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt, useCopy, useLang, longDate, shortDate } from "@/i18n";
import { useGuestSession } from "@/lib/session";
import { useGuestHome } from "@/lib/hooks";
import { useOnline } from "@/lib/query";
import { T, Card, Button, Badge, Countdown, ActionTile, Row, Gem, IconButton, Banner, Skeleton, Stack, SectionLabel } from "@/ui";
import { colors, TAB_BAR_HEIGHT, TAB_BAR_BOTTOM, FILL } from "@/ui/tokens";

const fallback = require("../../../assets/photos/bluehour.jpg");

export default function GuestHome() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const session = useGuestSession();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const { data, isLoading, refetch } = useGuestHome();

  useEffect(() => {
    if (data?.day_of) router.replace("/guest/dayof");
  }, [data?.day_of, router]);

  const couple = data?.couple_names ?? session?.tenant.couple_names ?? "";
  const [n1, n2] = splitNames(couple);
  const hero = data?.hero_image_url ?? session?.tenant.hero_image_url ?? null;
  const top = Math.max(insets.top, 54);
  const rsvp = data?.rsvp;
  const seats = rsvp ? (rsvp.max_party === 1 ? copy.guestHome.seatsOne : fmt(copy.guestHome.seatsMany, { n: rsvp.max_party })) : "";
  const deadline = rsvp?.deadline ? shortDate(rsvp.deadline, lang) : null;
  const name = data?.guest.name.split(" ")[0] ?? session?.guest.name.split(" ")[0] ?? "";
  const status = rsvp?.status ?? "pending";
  const rsvpText =
    status === "pending"
      ? fmt(deadline ? copy.guestHome.rsvpPrompt : copy.guestHome.rsvpPromptNoDeadline, { name, deadline, seats })
      : fmt(deadline ? copy.guestHome.rsvpDone : copy.guestHome.rsvpDoneNoDeadline, { deadline });

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 16 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={hero ? { uri: hero } : fallback} style={FILL} resizeMode="cover" />
          <LinearGradient
            colors={["rgba(8,11,16,0.3)", "rgba(8,11,16,0.08)", "rgba(13,17,23,0.55)", colors.night]}
            locations={[0, 0.26, 0.5, 1]}
            style={FILL}
          />
          <Row style={[styles.topRow, { top }]}>
            <Row gap={8}>
              <Gem />
              <T v="label11" color="rgba(247,243,236,0.85)" style={{ letterSpacing: 2 }}>
                {data?.city ?? session?.tenant.city ?? ""} · {data?.wedding_date ?? session?.tenant.wedding_date ?? ""}
              </T>
            </Row>
            <IconButton name="bell" onPress={() => router.push("/guest/messages")} label={copy.messages.title} />
          </Row>
          <View style={styles.names}>
            <SectionLabel color={colors.goldLight}>{copy.guestHome.invited}</SectionLabel>
            <T v="display60" size={n1.length > 14 ? 48 : 60} numberOfLines={2} adjustsFontSizeToFit style={{ marginTop: 10 }}>
              {n1}
            </T>
            {n2 ? (
              <T v="display60" size={n2.length > 14 ? 48 : 60} numberOfLines={2} adjustsFontSizeToFit>
                {n2}
              </T>
            ) : null}
            <T v="body15" color="rgba(247,243,236,0.8)" style={{ marginTop: 10 }}>
              {longDate(data?.wedding_date ?? session?.tenant.wedding_date, lang)}
              {data?.next_event?.location ? ` · ${data.next_event.location}` : ""}
            </T>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: -60 }}>
          {data?.countdown ? (
            <Countdown days={data.countdown.days} hours={data.countdown.hours} minutes={data.countdown.minutes} labels={{ days: copy.common.days, hours: copy.common.hours, min: copy.common.min }} />
          ) : isLoading ? (
            <Skeleton w={220} h={44} />
          ) : null}
        </View>

        {!online ? (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Banner icon="wifi-off" title={copy.common.offline} body={copy.common.offlineDetail} />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <Card kind="glass" blur padding={18}>
            <Row style={{ justifyContent: "space-between" }}>
              <SectionLabel color={colors.goldLight}>{copy.guestHome.yourRsvp}</SectionLabel>
              <Badge
                label={status === "attending" ? copy.guestHome.attending : status === "declined" ? copy.guestHome.declined : copy.guestHome.awaiting}
                kind={status === "attending" ? "green" : status === "declined" ? "mute" : "amber"}
              />
            </Row>
            {isLoading && !data ? (
              <Stack gap={8} style={{ marginTop: 12 }}>
                <Skeleton />
                <Skeleton w="70%" />
              </Stack>
            ) : (
              <T v="body16" color={colors.ivory90} style={{ marginTop: 12 }}>
                {rsvpText}
              </T>
            )}
            <Button
              label={status === "pending" ? copy.guestHome.answerNow : copy.guestHome.changeAnswer}
              small
              style={{ marginTop: 14, minHeight: 50 }}
              onPress={() => router.push("/guest/rsvp")}
              disabled={rsvp ? !rsvp.can_edit && status !== "pending" : false}
            />
          </Card>
        </View>

        <Row gap={8} style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <ActionTile icon="calendar" label={copy.guestHome.schedule} onPress={() => router.push("/guest/schedule")} />
          <ActionTile
            icon="pin"
            label={copy.guestHome.directions}
            onPress={() => data?.quick_links.directions_url && Linking.openURL(data.quick_links.directions_url)}
          />
          <ActionTile icon="hanger" label={copy.guestHome.dressCode} onPress={() => router.push("/guest/more")} />
          <ActionTile icon="sparkle" label={copy.guestHome.concierge} onPress={() => router.push("/guest/concierge")} />
        </Row>
        <Pressable onPress={() => refetch()} style={{ height: 1 }} accessibilityElementsHidden />
      </ScrollView>
    </View>
  );
}

/** "Camila & Andrés" becomes two display lines: "Camila" and "& Andrés". */
export function splitNames(names: string): [string, string] {
  const m = names.match(/^(.*?)\s*(&|y|and)\s+(.*)$/i);
  if (!m) return [names, ""];
  return [m[1], `& ${m[3]}`];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  hero: { overflow: "hidden", minHeight: 560, justifyContent: "flex-end", paddingBottom: 84 },
  topRow: { position: "absolute", left: 24, right: 20, justifyContent: "space-between" },
  names: { paddingHorizontal: 24 },
});
