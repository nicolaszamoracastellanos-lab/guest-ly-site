// Couple home (Inicio). HH craft pass, Oct 30 2026: wedding-first, the same
// order as the web dashboard, and nothing else:
//   0. the names, the countdown and the date over the night surface,
//   1. Today: requests from the planner, guest messages that need the couple
//      and the reminder rows, each opening exactly its item,
//   2. Replies: a funnel (invited, replied, going) that opens Guests filtered,
//      with Share invite and Send announcement under it,
//   3. Getting ready: the setup steps the Home payload can prove, done or not,
//   4. Recent replies: the last answers, newest first,
//   5. the Coordinator (the one gold mark).
// It replaces the progress ring, the three stat boxes and the three quick
// tiles (audit 1.6.6). Every number comes from GET /couple/home except the
// deadline and the recent replies, which come from GET /couple/rsvps (already
// loaded by Guests). Fields Home still lacks are in docs/hh/SCREENS-PLAN.md.

import React from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useLang, relTime } from "@/i18n";
import { useUserSession, useSession } from "@/lib/session";
import { useCoupleHome, useCoupleRsvps, type RsvpListItem } from "@/lib/hooks";
import { Screen, T, Row, Icon, IconButton, Card, Banner, Skeleton, SectionLabel, BriefingRow, PhotoHero, ScreenBannerSlot, Stack, Avatar, CoordinatorMark, useTopInset, useSideInsetsStyle, type IconName } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { useCoupleCopy, useShareInvite, fullDate, dayMonth, statusIcon, statusColor } from "@/features/couple/ui";

import { recentReplies, funnelFrom, share } from "@/features/couple/home";

type BriefingLike = { text: string; href: string; tone: "risk" | "warn" | "info"; kind?: unknown; target_id?: unknown; filter?: unknown };
type Step = { key: string; title: string; sub: string; done: boolean; onPress: () => void };


export default function CoupleHome() {
  const c = useCoupleCopy();
  const h = c.home;
  const { lang } = useLang();
  const router = useRouter();
  const { height: winH } = useWindowDimensions();
  // A shorter hero than the photo had: the names and date, then the work.
  const heroMin = Math.round(Math.max(200, Math.min(winH * 0.3, 280)));
  const user = useUserSession();
  const top = useTopInset();
  const side = useSideInsetsStyle();
  const { dayOfManual } = useSession();
  const shareInvite = useShareInvite();
  const mainQuery = useCoupleHome();
  const { data, isLoading } = mainQuery;
  // All replies: the deadline and the recent answers (Guests reads the same list).
  const rsvps = useCoupleRsvps("all");
  const couple = data?.couple_names ?? user?.me.tenant.couple_names ?? "";
  const days = data?.countdown && !data.countdown.passed ? data.countdown.days : null;
  const date = fullDate(data?.wedding_date, lang);
  const dayOf = (data?.day_of ?? false) || dayOfManual;
  const canEdit = user?.me.can_edit ?? false;

  // PEOPLE, the way the portal's dashboard and Guests count since wave 13
  // (attending + declined + pending = everyone invited).
  const t = data?.totals;
  const { invited: total, replied, going, notGoing, pending } = funnelFrom(t);
  const deadline = rsvps.data?.deadline ? dayMonth(rsvps.data.deadline, lang) : "";
  const briefing = (data?.briefing ?? []) as BriefingLike[];
  const breakdown = data?.needs_you_breakdown;
  const recent = recentReplies(rsvps.data?.items);

  const openGuests = (filter: string) => router.push({ pathname: "/couple/guests", params: { filter } } as never);

  const steps: Step[] = data
    ? [
        { key: "date", title: h.steps.date, sub: data.wedding_date ? date : h.steps.dateTodo, done: !!data.wedding_date, onPress: () => router.push({ pathname: "/web", params: { path: "/dashboard", title: h.steps.date } } as never) },
        { key: "guests", title: h.steps.guests, sub: (t?.parties ?? 0) > 0 ? h.steps.guestsDone(t?.parties ?? 0) : h.steps.guestsTodo, done: (t?.parties ?? 0) > 0, onPress: () => router.push((t?.parties ? "/couple/guests" : "/couple/guests/new") as never) },
        { key: "invite", title: h.steps.invite, sub: replied > 0 ? h.steps.inviteDone(replied) : h.steps.inviteTodo, done: replied > 0, onPress: () => (replied > 0 ? openGuests("all") : void shareInvite()) },
        { key: "concierge", title: h.steps.concierge, sub: data.concierge_live ? h.steps.conciergeDone : h.steps.conciergeTodo, done: data.concierge_live, onPress: () => router.push("/couple/brain") },
        { key: "budget", title: h.steps.budget, sub: data.budget_percent_paid !== null ? h.steps.budgetDone(data.budget_percent_paid) : h.steps.budgetTodo, done: data.budget_percent_paid !== null, onPress: () => router.push("/couple/budget") },
      ]
    : [];
  const stepsDone = steps.filter((s) => s.done).length;

  return (
    // The hero starts at the top edge, behind the clock; plain night under it
    // so the fade has no seam. Pull down to refresh.
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Screen query={mainQuery} padded={false} topInset={false} backdrop={false} refresh={() => Promise.all([mainQuery.refetch(), rsvps.refetch()])}>
        <PhotoHero motif={0} flow minHeight={heroMin} maxHeightFraction={0.36} gradient={0.6} accessibilityLabel={couple}>
          <SectionLabel color={colors.goldLight}>{h.yourWedding}</SectionLabel>
          <T v="title42" style={{ marginTop: 6 }}>
            {couple}
          </T>
          {days !== null || date ? (
            <T v="body16" color={colors.ivory90} style={{ marginTop: 6 }}>
              {days !== null ? <T v="body16" color={colors.ivory} style={{ fontWeight: "600" }}>{h.days(days)}</T> : null}
              {days !== null && date ? " · " : ""}
              {date}
            </T>
          ) : null}
        </PhotoHero>

        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <ScreenBannerSlot />
          {dayOf ? (
            <Pressable onPress={() => router.push("/couple/dayof")} accessibilityRole="button" accessibilityLabel={`${h.dayOf}. ${h.dayOfBody}`} style={{ marginBottom: 12 }}>
              <Banner icon="clock" title={h.dayOf} body={h.dayOfBody} kind="gold" action={<Icon name="chev" size={18} color={colors.ivory40} />} />
            </Pressable>
          ) : null}

          {/* 1. Today */}
          <SectionLabel style={styles.label}>{h.today}</SectionLabel>
          {!data ? (
            <Stack gap={8}>
              <Skeleton h={58} />
              <Skeleton h={58} />
            </Stack>
          ) : (breakdown?.requests ?? 0) + (breakdown?.conversations ?? 0) + briefing.length > 0 ? (
            <View>
              {breakdown && breakdown.requests > 0 ? <TodayRow icon="tasks" text={h.requestsWaiting(breakdown.requests)} onPress={() => router.push("/couple/requests")} testID="home-today-requests" /> : null}
              {breakdown && breakdown.conversations > 0 ? <TodayRow icon="chat" text={h.messagesWaiting(breakdown.conversations)} onPress={() => router.push({ pathname: "/couple/messages", params: { filter: "needs_you" } } as never)} testID="home-today-messages" /> : null}
              {briefing.map((b, i) => (
                <BriefingRow key={i} text={b.text} tone={b.tone} onPress={() => open(b)} />
              ))}
            </View>
          ) : (
            <Row gap={12} align="flex-start" style={styles.quiet}>
              <Icon name="check" size={22} color={colors.greenText} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="body16">{h.nothingToday}</T>
                <T v="meta13" color={colors.ivory70}>
                  {h.nothingTodayBody}
                </T>
              </View>
            </Row>
          )}

          {/* 2. Replies: the funnel */}
          <SectionLabel style={styles.label}>{h.replies}</SectionLabel>
          {isLoading && !data ? (
            <Skeleton h={170} r={16} />
          ) : (
            <Card kind="solid" padding={16} radiusKey="tile">
              <FunnelRow label={h.invited} n={total} of={total} sub={h.people(total)} onPress={() => openGuests("all")} testID="home-funnel-invited" />
              <FunnelRow label={h.repliedRow} n={replied} of={total} sub={deadline ? c.home.deadline(deadline) : c.home.noDeadline} onPress={() => openGuests("all")} testID="home-replies" />
              <FunnelRow label={h.goingRow} n={going} of={total} sub={h.notGoingPending(notGoing, pending)} onPress={() => openGuests("attending")} gold testID="home-funnel-going" last />
              <Row gap={10} style={{ marginTop: 14 }} align="stretch">
                <TextAction icon="share" label={h.share} onPress={() => void shareInvite()} testID="home-share" />
                {canEdit ? <TextAction icon="megaphone" label={h.announce} onPress={() => router.push("/couple/broadcasts/new")} testID="home-announce" /> : null}
              </Row>
            </Card>
          )}

          {/* 3. Getting ready */}
          {steps.length ? (
            <>
              <Row style={[styles.label, { justifyContent: "space-between" }]}>
                <SectionLabel>{h.setup}</SectionLabel>
                <T v="caption14" color={colors.ivory55}>
                  {h.setupCount(stepsDone, steps.length)}
                </T>
              </Row>
              <Card kind="solid" padding={0} radiusKey="tile" style={{ paddingHorizontal: 16 }}>
                {steps.map((s, i) => (
                  <StepRow key={s.key} step={s} last={i === steps.length - 1} />
                ))}
              </Card>
            </>
          ) : null}

          {/* 4. Recent replies */}
          <SectionLabel style={styles.label}>{h.activity}</SectionLabel>
          {!rsvps.data ? (
            <Skeleton h={120} r={16} />
          ) : recent.length ? (
            <Card kind="solid" padding={0} radiusKey="tile" style={{ paddingHorizontal: 16 }}>
              {recent.map((r, i) => (
                <ActivityRow key={r.id} item={r} when={relTime(r.updated_at, lang)} text={r.status === "attending" ? h.replyGoing(r.party_size ?? 1) : h.replyNotGoing} last={i === recent.length - 1} onPress={r.guest_id ? () => router.push({ pathname: "/couple/guests/[id]", params: { id: r.guest_id as string } } as never) : undefined} />
              ))}
            </Card>
          ) : (
            <T v="meta13" color={colors.ivory55} style={styles.quiet}>
              {h.activityEmpty}
            </T>
          )}

          {/* 5. The Coordinator */}
          <Pressable onPress={() => router.push("/couple/coordinator" as never)} accessibilityRole="button" accessibilityLabel={`${h.ask}. ${h.askBody}`} testID="home-coordinator" style={({ pressed }) => [{ marginTop: 24 }, pressed && { opacity: 0.85 }]}>
            <Card kind="solid" padding={16} radiusKey="tile" border={colors.goldBorder}>
              <Row gap={14}>
                <CoordinatorMark />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="name24">{h.ask}</T>
                  <T v="meta13" color={colors.ivory70}>
                    {h.askBody}
                  </T>
                </View>
                <Icon name="chev" size={18} color={colors.ivory40} />
              </Row>
            </Card>
          </Pressable>
        </View>
      </Screen>
      {/* Settings: over the hero, top right, under the clock. */}
      <View pointerEvents="box-none" style={[styles.over, { top, right: 14 + side.paddingRight }]}>
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

/** A Today row with its own icon (requests, messages). */
function TodayRow({ icon, text, onPress, testID }: { icon: IconName; text: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={text} style={({ pressed }) => [styles.todayRow, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={20} color={colors.amber} />
      <T v="body16" color={colors.ivory90} numberOfLines={2} style={{ flex: 1 }}>
        {text}
      </T>
      <Icon name="chev" size={18} color={colors.ivory40} />
    </Pressable>
  );
}

/** One step of the funnel: label and count on a line, a bar of its share of
 *  everyone invited, and a quiet line under it. */
function FunnelRow({ label, n, of, sub, onPress, gold, last, testID }: { label: string; n: number; of: number; sub: string; onPress: () => void; gold?: boolean; last?: boolean; testID?: string }) {
  const frac = share(n, of);
  const pct = of > 0 ? Math.round(frac * 100) : null;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${n}${pct !== null ? `, ${pct}%` : ""}. ${sub}`} style={({ pressed }) => [styles.funnelRow, !last && styles.line, pressed && { opacity: 0.75 }]}>
      <Row style={{ justifyContent: "space-between" }} align="baseline">
        <T v="body16" color={colors.ivory90}>
          {label}
        </T>
        <Row gap={8} align="baseline">
          <T v="name24" style={{ fontVariant: ["lining-nums", "tabular-nums"] }}>
            {String(n)}
          </T>
          {pct !== null ? (
            <T v="caption14" color={colors.ivory55} style={{ fontVariant: ["tabular-nums"], minWidth: 40, textAlign: "right" }}>
              {`${pct}%`}
            </T>
          ) : null}
        </Row>
      </Row>
      <View style={styles.track}>
        <View style={[styles.bar, { width: `${frac * 100}%`, backgroundColor: gold ? colors.gold : colors.ivory40 }]} />
      </View>
      <T v="caption14" color={colors.ivory55} numberOfLines={1} style={{ marginTop: 6 }}>
        {sub}
      </T>
    </Pressable>
  );
}

/** An action under the funnel: icon and words, no tile. */
function TextAction({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.textAction, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={18} color={colors.goldLight} />
      <T v="meta13" color={colors.goldLight} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}

function StepRow({ step, last }: { step: Step; last: boolean }) {
  return (
    <Pressable onPress={step.onPress} accessibilityRole="button" accessibilityState={{ checked: step.done }} accessibilityLabel={`${step.title}. ${step.sub}`} testID={`home-step-${step.key}`} style={({ pressed }) => [styles.stepRow, !last && styles.line, pressed && { opacity: 0.7 }]}>
      <View style={[styles.stepMark, step.done && styles.stepMarkDone]}>{step.done ? <Icon name="check" size={14} color={colors.night} strokeWidth={2.2} /> : null}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T v="body16" color={step.done ? colors.ivory70 : colors.ivory}>
          {step.title}
        </T>
        <T v="caption14" color={step.done ? colors.ivory55 : colors.amber} numberOfLines={2}>
          {step.sub}
        </T>
      </View>
      <Icon name="chev" size={18} color={colors.ivory40} />
    </Pressable>
  );
}

function ActivityRow({ item, when, text, last, onPress }: { item: RsvpListItem; when: string; text: string; last: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${item.name}, ${text}, ${when}`} style={({ pressed }) => [styles.activityRow, !last && styles.line, pressed && onPress ? { opacity: 0.7 } : null]}>
      <Avatar initials={item.initials} size={36} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T v="body16" numberOfLines={1}>
          {item.name}
        </T>
        <Row gap={6}>
          <Icon name={statusIcon(item.status)} size={14} color={statusColor(item.status)} />
          <T v="caption14" color={colors.ivory70} numberOfLines={1} style={{ flexShrink: 1 }}>
            {text}
          </T>
        </Row>
      </View>
      <T v="caption14" color={colors.ivory55}>
        {when}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  over: { position: "absolute", right: 14, alignItems: "flex-end" },
  label: { marginTop: 24, marginBottom: 8 },
  quiet: { paddingVertical: 6 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  todayRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 52, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  funnelRow: { paddingVertical: 10 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.ivory09, marginTop: 8, overflow: "hidden" },
  bar: { height: 4, borderRadius: 2 },
  textAction: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.goldBorder, paddingHorizontal: 12 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingVertical: 10 },
  stepMark: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.ivory40, alignItems: "center", justifyContent: "center" },
  stepMarkDone: { backgroundColor: colors.greenText, borderColor: colors.greenText },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 10 },
});
