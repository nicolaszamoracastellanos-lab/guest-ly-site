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
// tiles (audit 1.6.6). Every number comes from GET /couple/home. HH wave F:
// the portal now sends the nine setup steps, the activity feed, the deadline
// guests see and the Opened step of the funnel; against an older portal Home
// falls back to the steps it derives and the recent replies from
// GET /couple/rsvps. After the wedding a card offers the referral link.
//
// Customizable Home (Oct 31 2026): when the portal sends a saved `layout`,
// the sections become the wedding's cards (features/couple/CustomHome), in
// the couple's order and sizes; the pieces below are the bodies of their
// cards. No layout (an older portal) = this Home exactly as before; a layout
// not set up yet = this Home plus an invitation to the five questions.

import React from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useLang, relTime } from "@/i18n";
import { useUserSession, useSession } from "@/lib/session";
import { useCoupleHome, useCoupleRsvps, type HomeActivity, type RsvpListItem } from "@/lib/hooks";
import { Screen, T, Row, Icon, IconButton, Card, Banner, Skeleton, SectionLabel, BriefingRow, PhotoHero, ScreenBannerSlot, Stack, Avatar, CoordinatorMark, Button, toastError, useTopInset, useSideInsetsStyle, type IconName } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { useCoupleCopy, useShareInvite, fullDate, dayMonth, statusIcon, statusColor } from "@/features/couple/ui";

import { recentReplies, funnelFrom, share, todayBriefing, setupRoute, activityIcon, isIsoDay } from "@/features/couple/home";
import { ReferralCard } from "@/features/referral/ReferralCard";
import { CustomHome, RoadBody, type CardBody } from "@/features/couple/CustomHome";
import { readLayout, useSaveHomeLayout, type CoupleHomeWithLayout } from "@/features/couple/homeCards";
import { HOME_COPY } from "@/features/couple/homeCopy";
import { STANDARD_ANSWERS, suggestedCards, type CardId } from "@/features/couple/homeLayout";
import { onlyServed, readRoad, roadCardRoute } from "@/features/couple/road";
import { useFeatureCopy } from "@/i18n/feature";

type BriefingLike = { text: string; href: string; tone: "risk" | "warn" | "info"; kind?: unknown; target_id?: unknown; filter?: unknown };
// onPress absent: the step only reports (no screen in the app can change it yet).
type Step = { key: string; title: string; sub: string; done: boolean; onPress?: () => void };


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
  // An older portal without the HH fields: the deadline and the recent answers
  // come from the RSVP list (Guests reads the same list).
  const legacy = !!data && (data.activity === undefined || data.rsvp_deadline === undefined);
  const hc = useFeatureCopy(HOME_COPY);
  const layout = readLayout((data as CoupleHomeWithLayout | undefined)?.layout);
  const custom = layout?.configured ? layout : null;
  // #6: the road on the Home that is not set up yet, where the layout lists it shown.
  const road = readRoad((data as CoupleHomeWithLayout | undefined)?.cards?.road);
  const roadOnPlainHome = !!road && !custom && !!layout?.cards.some((x) => x.id === "road" && !x.hidden);
  const shown = (id: CardId) => !!custom?.cards.some((x) => x.id === id && !x.hidden);
  const saveLayout = useSaveHomeLayout();
  const rsvps = useCoupleRsvps("all", { enabled: legacy || shown("replies") });
  const couple = data?.couple_names ?? user?.me.tenant.couple_names ?? "";
  const days = data?.countdown && !data.countdown.passed ? data.countdown.days : null;
  const date = fullDate(data?.wedding_date, lang);
  const dayOf = (data?.day_of ?? false) || dayOfManual;
  const canEdit = user?.me.can_edit ?? false;
  // The countdown card says the days; the hero then keeps only the date.
  const heroDays = shown("countdown") ? null : days;
  const openQuiz = () => router.push("/home-setup" as never);
  const skipQuiz = async () => {
    try {
      // K8: only the cards the server listed; it keeps its own entry for the rest.
      await saveLayout.mutateAsync({ answers: STANDARD_ANSWERS, cards: onlyServed(suggestedCards(STANDARD_ANSWERS), layout?.served ?? null), dismissed: [], quiz_state: "skipped" });
    } catch {
      toastError(hc.saveFailed);
    }
  };

  // PEOPLE, the way the portal's dashboard and Guests count since wave 13
  // (attending + declined + pending = everyone invited).
  const t = data?.totals;
  const { invited: total, replied, going, notGoing, pending } = funnelFrom(t);
  const rawDeadline = data?.rsvp_deadline !== undefined ? data.rsvp_deadline : rsvps.data?.deadline;
  const deadline = rawDeadline ? (isIsoDay(rawDeadline) ? dayMonth(rawDeadline, lang) : rawDeadline) : "";
  const funnel = data?.funnel ?? null;
  const activity = data?.activity;
  const breakdown = data?.needs_you_breakdown;
  // The briefing minus the rows the two breakdown rows above it already say.
  const briefing = todayBriefing((data?.briefing ?? []) as BriefingLike[], breakdown);
  const recent = recentReplies(rsvps.data?.items);

  const openGuests = (filter: string) => router.push({ pathname: "/couple/guests", params: { filter } } as never);

  // The portal's nine steps (lib/setup) when it sends them, each opening the
  // app screen that finishes it (setupRoute); else the five Home can prove.
  // The date step opens Settings > Wedding details (never /dashboard in /web).
  const serverSteps: Step[] | null = data?.setup?.steps?.length
    ? data.setup.steps.map((st) => {
        const route = setupRoute(st.key);
        return {
          key: st.key,
          title: st.label,
          sub: st.key === "date_city" && data.wedding_date ? date : st.progress && !st.done ? h.stepProgress(st.progress.have, st.progress.need) : st.done ? h.stepDone : h.stepTodo,
          done: st.done,
          onPress: route ? () => router.push(route as never) : undefined,
        };
      })
    : null;
  const steps: Step[] = serverSteps ?? (data
    ? [
        { key: "date", title: h.steps.date, sub: data.wedding_date ? date : h.steps.dateTodo, done: !!data.wedding_date, onPress: canEdit ? () => router.push("/couple/settings/general" as never) : undefined },
        { key: "guests", title: h.steps.guests, sub: (t?.parties ?? 0) > 0 ? h.steps.guestsDone(t?.parties ?? 0) : h.steps.guestsTodo, done: (t?.parties ?? 0) > 0, onPress: () => router.push((t?.parties ? "/couple/guests" : "/couple/guests/new") as never) },
        { key: "invite", title: h.steps.invite, sub: replied > 0 ? h.steps.inviteDone(replied) : h.steps.inviteTodo, done: replied > 0, onPress: () => (replied > 0 ? openGuests("all") : void shareInvite()) },
        { key: "concierge", title: h.steps.concierge, sub: data.concierge_live ? h.steps.conciergeDone : h.steps.conciergeTodo, done: data.concierge_live, onPress: () => router.push("/couple/brain") },
        { key: "budget", title: h.steps.budget, sub: data.budget_percent_paid !== null ? h.steps.budgetDone(data.budget_percent_paid) : h.steps.budgetTodo, done: data.budget_percent_paid !== null, onPress: () => router.push("/couple/budget") },
      ]
    : []);
  const stepsDone = steps.filter((s) => s.done).length;

  // The pieces of Home, shared by the sections below (no layout) and the cards (a layout).
  const hasToday = (breakdown?.requests ?? 0) + (breakdown?.conversations ?? 0) + briefing.length > 0;
  const todayInner = !data ? (
    <Stack gap={8}>
      <Skeleton h={58} />
      <Skeleton h={58} />
    </Stack>
  ) : hasToday ? (
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
  );
  const funnelInner = (
    <>
      <FunnelRow label={h.invited} n={total} of={total} sub={h.people(total)} onPress={() => openGuests("all")} testID="home-funnel-invited" />
      {funnel && funnel.total > 0 ? <FunnelRow label={h.openedRow} n={funnel.opened} of={funnel.total} sub={h.openedSub(funnel.opened, funnel.total)} onPress={() => openGuests("all")} testID="home-funnel-opened" /> : null}
      <FunnelRow label={h.repliedRow} n={replied} of={total} sub={deadline ? c.home.deadline(deadline) : c.home.noDeadline} onPress={() => openGuests("all")} testID="home-replies" />
      <FunnelRow label={h.goingRow} n={going} of={total} sub={h.notGoingPending(notGoing, pending)} onPress={() => openGuests("attending")} gold testID="home-funnel-going" last />
      <Row gap={10} style={{ marginTop: 14 }} align="stretch">
        <TextAction icon="share" label={h.share} onPress={() => void shareInvite()} testID="home-share" />
        {canEdit ? <TextAction icon="megaphone" label={h.announce} onPress={() => router.push("/couple/broadcasts/new")} testID="home-announce" /> : null}
      </Row>
    </>
  );
  const stepRows = steps.map((s, i) => <StepRow key={s.key} step={s} last={i === steps.length - 1} />);
  const feedRows = activity?.length
    ? activity.map((a, i) => (
        <FeedRow key={`${a.at}-${i}`} item={a} when={relTime(a.at, lang)} last={i === activity.length - 1} onPress={a.target?.kind === "guest" ? () => router.push({ pathname: "/couple/guests/[id]", params: { id: a.target!.id } } as never) : undefined} />
      ))
    : null;
  const recentRows = recent.length
    ? recent.map((r, i) => (
        <ActivityRow key={r.id} item={r} when={relTime(r.updated_at, lang)} text={r.status === "attending" ? h.replyGoing(r.party_size ?? 1) : h.replyNotGoing} last={i === recent.length - 1} onPress={r.guest_id ? () => router.push({ pathname: "/couple/guests/[id]", params: { id: r.guest_id as string } } as never) : undefined} />
      ))
    : null;
  const nextStep = steps.find((s) => !s.done);
  // The cards that reuse these pieces (features/couple/CustomHome draws the rest).
  const bodies: Partial<Record<CardId, CardBody>> = {
    briefing: () => todayInner,
    rsvp: ({ half }) =>
      half ? (
        <View style={{ gap: 4 }}>
          <T v="title34" style={{ fontVariant: ["lining-nums", "tabular-nums"] }}>
            {String(going)}
          </T>
          <T v="meta13" color={colors.ivory55}>
            {hc.going(total)}
          </T>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${share(going, total) * 100}%`, backgroundColor: colors.gold }]} />
          </View>
        </View>
      ) : (
        funnelInner
      ),
    setup: ({ half, size }) =>
      half || size === "s" ? (
        <View style={{ gap: 4 }}>
          <T v="title34" style={{ fontVariant: ["lining-nums", "tabular-nums"] }}>
            {`${stepsDone}/${steps.length}`}
          </T>
          {nextStep ? (
            <T v="meta13" color={colors.goldLight} numberOfLines={2}>
              {nextStep.title}
            </T>
          ) : null}
        </View>
      ) : (
        <View>{stepRows}</View>
      ),
    activity: () =>
      feedRows ? (
        <View>{feedRows}</View>
      ) : (
        <T v="meta13" color={colors.ivory55}>
          {activity === undefined ? h.activityEmpty : h.activityLiveEmpty}
        </T>
      ),
    replies: ({ half }) =>
      !rsvps.data ? (
        <Skeleton h={half ? 60 : 120} r={12} />
      ) : recentRows ? (
        <View>{half ? recentRows.slice(0, 2) : recentRows}</View>
      ) : (
        <T v="meta13" color={colors.ivory55}>
          {h.activityEmpty}
        </T>
      ),
  };

  return (
    // The hero starts at the top edge, behind the clock; plain night under it
    // so the fade has no seam. Pull down to refresh.
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Screen query={mainQuery} padded={false} topInset={false} backdrop={false} refresh={() => Promise.all([mainQuery.refetch(), legacy ? rsvps.refetch() : null])}>
        <PhotoHero motif={1} flow minHeight={heroMin} maxHeightFraction={0.36} gradient={0.6} accessibilityLabel={couple}>
          <SectionLabel color={colors.goldLight}>{h.yourWedding}</SectionLabel>
          <T v="title42" style={{ marginTop: 6 }}>
            {couple}
          </T>
          {heroDays !== null || date ? (
            <T v="body16" color={colors.ivory90} style={{ marginTop: 6 }}>
              {heroDays !== null ? <T v="body16" color={colors.ivory} style={{ fontWeight: "600" }}>{h.days(heroDays)}</T> : null}
              {heroDays !== null && date ? " · " : ""}
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

          {custom && data ? (
            <CustomHome data={data} layout={custom} cards={(data as CoupleHomeWithLayout).cards} bodies={bodies} canEdit={canEdit} onOpenQuiz={openQuiz} />
          ) : (
            <>
              {/* Not set up yet: the five questions, offered to editors. */}
              {layout && !layout.configured && layout.canEdit && canEdit ? (
                <Card kind="solid" padding={16} radiusKey="tile" border={colors.goldBorder} style={{ marginTop: 20 }}>
                  <T v="name24">{hc.inviteTitle}</T>
                  <T v="meta13" color={colors.ivory70} style={{ marginTop: 4 }}>
                    {hc.inviteBody}
                  </T>
                  <Row gap={10} style={{ marginTop: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Button label={hc.inviteStart} small onPress={openQuiz} testID="home-quiz-start" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button label={hc.inviteSkip} small kind="glass" onPress={() => void skipQuiz()} loading={saveLayout.isPending} testID="home-quiz-skip" />
                    </View>
                  </Row>
                </Card>
              ) : null}

              {/* 1. Today */}
              <SectionLabel style={styles.label}>{h.today}</SectionLabel>
              {todayInner}

              {roadOnPlainHome && road ? (
                <>
                  <SectionLabel style={styles.label}>{hc.cards.road}</SectionLabel>
                  <Pressable onPress={() => router.push(roadCardRoute(road) as never)} accessibilityRole="button" accessibilityLabel={hc.cards.road} accessibilityHint={road.nextStep?.linkLabel || undefined} testID="home-road" style={({ pressed }) => pressed && { opacity: 0.85 }}>
                    <Card kind="solid" padding={16} radiusKey="tile">
                      <RoadBody road={road} size="m" half={false} copy={hc} />
                    </Card>
                  </Pressable>
                </>
              ) : null}

              {/* 2. Replies: the funnel */}
              <SectionLabel style={styles.label}>{h.replies}</SectionLabel>
              {isLoading && !data ? (
                <Skeleton h={170} r={16} />
              ) : (
                <Card kind="solid" padding={16} radiusKey="tile">
                  {funnelInner}
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
                    {stepRows}
                  </Card>
                </>
              ) : null}

              {/* 4. Activity: the portal's feed, or the recent replies on an older portal */}
              {activity === null ? null : activity !== undefined ? (
                <>
                  <SectionLabel style={styles.label}>{h.activityLive}</SectionLabel>
                  {feedRows ? (
                    <Card kind="solid" padding={0} radiusKey="tile" style={{ paddingHorizontal: 16 }}>
                      {feedRows}
                    </Card>
                  ) : (
                    <T v="meta13" color={colors.ivory55} style={styles.quiet}>
                      {h.activityLiveEmpty}
                    </T>
                  )}
                </>
              ) : (
                <>
                  <SectionLabel style={styles.label}>{h.activity}</SectionLabel>
                  {!rsvps.data ? (
                    <Skeleton h={120} r={16} />
                  ) : recentRows ? (
                    <Card kind="solid" padding={0} radiusKey="tile" style={{ paddingHorizontal: 16 }}>
                      {recentRows}
                    </Card>
                  ) : (
                    <T v="meta13" color={colors.ivory55} style={styles.quiet}>
                      {h.activityEmpty}
                    </T>
                  )}
                </>
              )}
            </>
          )}

          {/* After the wedding: the referral link (hidden until the wedding has one). */}
          {data?.countdown?.passed ? <ReferralCard /> : null}

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
      <T v="meta13" color={colors.goldLight} numberOfLines={2} style={{ flexShrink: 1, textAlign: "center" }}>
        {label}
      </T>
    </Pressable>
  );
}

function StepRow({ step, last }: { step: Step; last: boolean }) {
  const tappable = !!step.onPress;
  return (
    <Pressable onPress={step.onPress} disabled={!tappable} accessibilityRole={tappable ? "button" : "text"} accessibilityState={{ checked: step.done }} accessibilityLabel={`${step.title}. ${step.sub}`} testID={`home-step-${step.key}`} style={({ pressed }) => [styles.stepRow, !last && styles.line, pressed && tappable && { opacity: 0.7 }]}>
      <View style={[styles.stepMark, step.done && styles.stepMarkDone]}>{step.done ? <Icon name="check" size={14} color={colors.night} strokeWidth={2.2} /> : null}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T v="body16" color={step.done ? colors.ivory70 : colors.ivory}>
          {step.title}
        </T>
        <T v="caption14" color={step.done ? colors.ivory55 : colors.amber} numberOfLines={2}>
          {step.sub}
        </T>
      </View>
      {tappable ? <Icon name="chev" size={18} color={colors.ivory40} /> : null}
    </Pressable>
  );
}

/** One line of the portal's activity feed: an icon for its kind, the sentence
 *  the server wrote in this language, and when. */
function FeedRow({ item, when, last, onPress }: { item: HomeActivity; when: string; last: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${item.text}, ${when}`} style={({ pressed }) => [styles.activityRow, !last && styles.line, pressed && onPress ? { opacity: 0.7 } : null]}>
      <View style={styles.feedIcon}>
        <Icon name={activityIcon(item.kind)} size={18} color={colors.ivory70} />
      </View>
      <T v="body15" color={colors.ivory90} numberOfLines={2} style={{ flex: 1, minWidth: 0 }}>
        {item.text}
      </T>
      <T v="caption14" color={colors.ivory55}>
        {when}
      </T>
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
  feedIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.ivory14, alignItems: "center", justifyContent: "center" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 10 },
});
