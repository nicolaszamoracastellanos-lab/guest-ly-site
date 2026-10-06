// Couple home (Inicio, build 12, F2): in this order and nothing else
//   1. the RSVP summary ("86 of 120 replied" and Going / Not going / Pending,
//      each opening Guests filtered),
//   2. quick actions (Add guest, Share invite, Send announcement),
//   3. Reminders: the rows that used to be "Today's briefing" / "Needs you",
//      each opening exactly its item,
//   4. the Coordinator card.
// On the wedding day a banner opens Wedding day mode above the summary.
// Build 13: Settings is the gear at the top right, over the photo (the More
// tab is gone), and Send announcement opens the Broadcast tab's composer.

import React from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useLang } from "@/i18n";
import { useUserSession, useSession } from "@/lib/session";
import { useCoupleHome, useCoupleRsvps } from "@/lib/hooks";
import { Screen, T, Row, Icon, IconButton, Card, Banner, Skeleton, SectionLabel, BriefingRow, PhotoHero, ScreenBannerSlot, Stack, useTopInset, type IconName } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { useCoupleCopy, useShareInvite, ProgressRing, fullDate, dayMonth, statusIcon } from "@/features/couple/ui";

const photo = require("../../../assets/photos/hands.jpg");
// Where the clasped hands and the ring sit in hands.jpg, as expo-image's
// object position: 90% down keeps them in the upper half of the box, above
// the names (I2).
const HANDS_FOCAL = { x: 0.5, y: 0.9 };

type BriefingLike = { text: string; href: string; tone: "risk" | "warn" | "info"; kind?: unknown; target_id?: unknown; filter?: unknown };

export default function CoupleHome() {
  const c = useCoupleCopy();
  const { lang } = useLang();
  const router = useRouter();
  // The hero as tall as in the approved M7: 40% of the screen, but leaving
  // room for the RSVP summary above the fold (never under 220 pt). On a Pro
  // Max that shows the sleeves and both hands, not just the ring.
  const { height: winH } = useWindowDimensions();
  const heroMin = Math.round(Math.max(220, Math.min(winH * 0.4, winH - 470)));
  const user = useUserSession();
  const top = useTopInset();
  const { dayOfManual } = useSession();
  const shareInvite = useShareInvite();
  const mainQuery = useCoupleHome();
  const { data, isLoading } = mainQuery;
  // The RSVP deadline lives on the RSVP list (the pending page is the one
  // Guests reads for its reminder bar, so this is usually cached already).
  const rsvps = useCoupleRsvps("pending");
  const couple = data?.couple_names ?? user?.me.tenant.couple_names ?? "";
  const days = data?.countdown && !data.countdown.passed ? data.countdown.days : null;
  const date = fullDate(data?.wedding_date, lang);
  const dayOf = (data?.day_of ?? false) || dayOfManual;
  const canEdit = user?.me.can_edit ?? false;

  // Parties everywhere, so the numbers here match the chips on Guests.
  const t = data?.totals;
  const going = t?.attending_parties ?? 0;
  const notGoing = t?.declined_parties ?? 0;
  const pending = t?.pending_parties ?? 0;
  const total = t ? Math.max(t.parties, going + notGoing + pending) : 0;
  const replied = going + notGoing;
  const deadline = rsvps.data?.deadline ? dayMonth(rsvps.data.deadline, lang) : "";
  const briefing = (data?.briefing ?? []) as BriefingLike[];

  const openGuests = (filter: string) => router.push({ pathname: "/couple/guests", params: { filter } } as never);

  return (
    // The photo starts at the top edge, behind the clock (I2); plain night
    // under it so the fade has no seam (I8). Pull down to refresh (S2).
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Screen query={mainQuery} padded={false} topInset={false} backdrop={false} refresh={() => Promise.all([mainQuery.refetch(), rsvps.refetch()])}>
        <PhotoHero source={photo} focal={HANDS_FOCAL} flow minHeight={heroMin} maxHeightFraction={0.44} gradient={0.6} accessibilityLabel={couple}>
          <SectionLabel color={colors.goldLight}>{c.home.yourWedding}</SectionLabel>
          <T v="title42" style={{ marginTop: 6 }}>
            {couple}
          </T>
          {days !== null || date ? (
            <T v="body16" color={colors.ivory90} style={{ marginTop: 6 }}>
              {days !== null ? <T v="body16" color={colors.ivory} style={{ fontWeight: "600" }}>{c.home.days(days)}</T> : null}
              {days !== null && date ? " · " : ""}
              {date}
            </T>
          ) : null}
        </PhotoHero>

        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          {/* The one connection banner of this screen, under the photo (S4). */}
          <ScreenBannerSlot />
          {dayOf ? (
            <Pressable onPress={() => router.push("/couple/dayof")} accessibilityRole="button" accessibilityLabel={`${c.home.dayOf}. ${c.home.dayOfBody}`} style={{ marginBottom: 12 }}>
              <Banner icon="clock" title={c.home.dayOf} body={c.home.dayOfBody} kind="gold" action={<Icon name="chev" size={18} color={colors.ivory40} />} />
            </Pressable>
          ) : null}

          {/* 1. RSVP summary */}
          {isLoading && !data ? (
            <Skeleton h={190} r={16} />
          ) : (
            <Card kind="solid" padding={16} radiusKey="tile">
              <Pressable onPress={() => openGuests("all")} accessibilityRole="button" accessibilityLabel={`${c.home.replied(replied, total)} ${c.home.repliedWord}. ${deadline ? c.home.deadline(deadline) : c.home.noDeadline}`} testID="home-replies" style={({ pressed }) => [styles.replyTop, pressed && { opacity: 0.8 }]}>
                <ProgressRing value={replied} total={total} size={84} label={total ? `${Math.round((replied / total) * 100)}%` : "·"} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="title26">
                    {c.home.replied(replied, total)} {c.home.repliedWord}
                  </T>
                  <T v="meta13" color={colors.ivory70}>
                    {deadline ? c.home.deadline(deadline) : c.home.noDeadline}
                  </T>
                </View>
                <Icon name="chev" size={18} color={colors.ivory40} />
              </Pressable>
              <Row gap={8} style={{ marginTop: 14 }}>
                <Stat status="attending" n={going} label={c.home.going} onPress={() => openGuests("attending")} />
                <Stat status="declined" n={notGoing} label={c.home.notGoing} onPress={() => openGuests("declined")} />
                <Stat status="pending" n={pending} label={c.home.pending} onPress={() => openGuests("pending")} />
              </Row>
            </Card>
          )}

          {/* 2. Quick actions */}
          <Row gap={8} style={{ marginTop: 16 }} align="stretch">
            {canEdit ? <Quick icon="plus" label={c.home.addGuest} onPress={() => router.push("/couple/guests/new")} testID="home-add-guest" /> : null}
            <Quick icon="share" label={c.home.share} onPress={() => void shareInvite()} testID="home-share" />
            {canEdit ? <Quick icon="megaphone" label={c.home.announce} onPress={() => router.push("/couple/broadcasts/new")} testID="home-announce" /> : null}
          </Row>

          {/* 3. Reminders (what used to be "Needs you") */}
          <View style={{ marginTop: 22 }}>
            {briefing.length ? (
              <>
                <SectionLabel color={colors.goldLight} style={{ marginBottom: 4 }}>
                  {c.home.remindersCount(briefing.length)}
                </SectionLabel>
                {briefing.map((b, i) => (
                  <BriefingRow key={i} text={b.text} tone={b.tone} onPress={() => open(b)} />
                ))}
              </>
            ) : data ? (
              <Card kind="solid" padding={16} radiusKey="tile">
                <SectionLabel style={{ marginBottom: 8 }}>{c.home.remindersCount(0)}</SectionLabel>
                <Row gap={12} align="flex-start">
                  <Icon name="check" size={22} color={colors.greenText} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="body16">{c.home.noReminders}</T>
                    <T v="meta13" color={colors.ivory70}>
                      {c.home.noRemindersBody}
                    </T>
                  </View>
                </Row>
              </Card>
            ) : (
              <Stack gap={8}>
                <Skeleton h={58} />
                <Skeleton h={58} />
              </Stack>
            )}
          </View>

          {/* 4. The Coordinator */}
          <Pressable onPress={() => router.push("/assistant" as never)} accessibilityRole="button" accessibilityLabel={`${c.home.ask}. ${c.home.askBody}`} testID="home-coordinator" style={({ pressed }) => [{ marginTop: 18 }, pressed && { opacity: 0.85 }]}>
            <Card kind="solid" padding={16} radiusKey="tile" border={colors.goldBorder}>
              <Row gap={14}>
                <View style={styles.askIcon}>
                  <Icon name="sparkle" size={22} color={colors.goldLight} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="name24">{c.home.ask}</T>
                  <T v="meta13" color={colors.ivory70}>
                    {c.home.askBody}
                  </T>
                </View>
                <Icon name="chev" size={18} color={colors.ivory40} />
              </Row>
            </Card>
          </Pressable>
        </View>
      </Screen>
      {/* Settings (build 13): over the photo, top right, under the clock. */}
      <View pointerEvents="box-none" style={[styles.over, { top }]}>
        <IconButton name="gear" label={c.tools.settings} onPress={() => router.push("/settings")} testID="home-settings" />
      </View>
    </View>
  );

  // The portal's stable row kind (v1.2, N13) opens the exact screen; a row
  // without one (production portal before v1.2) or of a kind this build does
  // not know falls back to its web link.
  function open(row: BriefingLike) {
    const kind = typeof row.kind === "string" ? row.kind : null;
    const target = typeof row.target_id === "string" && row.target_id ? row.target_id : null;
    if (kind === "requests_open") return void router.push((target ? { pathname: "/couple/requests/[id]", params: { id: target } } : "/couple/requests") as never);
    if (kind === "escalation_open") return void router.push((target ? { pathname: "/couple/messages/[id]", params: { id: target } } : { pathname: "/couple/messages", params: { filter: "needs_you" } }) as never);
    if (kind === "rsvp_pace" || kind === "new_rsvps") {
      const filter = row.filter === "pending" || row.filter === "changed" ? row.filter : kind === "new_rsvps" ? "changed" : "pending";
      return void openGuests(filter);
    }
    if (kind === "tasks_due" && target) return void router.push({ pathname: "/couple/tasks/[id]", params: { id: target } } as never);
    if (kind === "tasks_due" || kind === "tasks_overdue") return void router.push("/couple/tasks");
    if (kind === "budget_over" || kind === "vendor_unpaid") return void router.push("/couple/budget");
    if (kind === "open_gaps" || kind === "gap_repeat") return void router.push("/couple/brain");
    go(row.href);
  }

  function go(href: string) {
    const map: [string, string][] = [
      ["/rsvps", "/couple/guests"],
      ["/conversations", "/couple/messages"],
      ["/requests", "/couple/requests"],
      ["/guests", "/couple/guests"],
      ["/checkin", "/couple/checkin"],
      ["/tasks", "/couple/tasks"],
      ["/budget", "/couple/budget"],
      ["/vendors", "/couple/vendors"],
      ["/seating", "/couple/seating"],
      ["/runsheet", "/couple/runsheet"],
      ["/broadcasts", "/couple/broadcasts"],
      ["/brain", "/couple/brain"],
      ["/website", "/couple/website"],
      ["/dashboard", "/couple/insights"],
    ];
    const hit = map.find(([web]) => href.startsWith(web));
    router.push((hit ? hit[1] : "/couple/tools") as never);
  }
}

function Stat({ status, n, label, onPress }: { status: string; n: number; label: string; onPress: () => void }) {
  const color = status === "attending" ? colors.greenText : status === "declined" ? colors.ivory70 : colors.amber;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${n}`} style={({ pressed }) => [styles.stat, pressed && { opacity: 0.8 }]}>
      <T v="title30" color={colors.ivory} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontVariant: ["lining-nums"] }}>
        {String(n)}
      </T>
      <Row gap={4}>
        <Icon name={statusIcon(status)} size={14} color={color} />
        <T v="meta13" color={colors.ivory70} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1 }}>
          {label}
        </T>
      </Row>
    </Pressable>
  );
}

function Quick({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.8 }]}>
      <Icon name={icon} size={22} color={colors.goldLight} />
      <T v="meta13" color={colors.ivory90} center numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  over: { position: "absolute", right: 14, alignItems: "flex-end" },
  replyTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  stat: { flex: 1, minWidth: 0, minHeight: 64, borderRadius: 12, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: colors.ivory09, paddingVertical: 8, paddingHorizontal: 10, gap: 2 },
  quick: { flex: 1, minWidth: 0, minHeight: 76, borderRadius: radius.tile, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6, paddingVertical: 10 },
  askIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.goldWash, alignItems: "center", justifyContent: "center" },
});
