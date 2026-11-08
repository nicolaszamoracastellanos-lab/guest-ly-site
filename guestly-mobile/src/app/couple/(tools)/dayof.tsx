// Day-of mode for the couple. With the Day pack on for this wedding (#30,
// MW_DAY_PACK) the live view reads the saved pack and works offline; without
// it (flag off, or a portal that answers 404) the older screen below shows
// parties in, the runsheet and escalations from the server. The half-folded
// Duo table pose keeps its own layout.

import React from "react";
import { Pressable, View } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { fmt, useCopy, useLang } from "@/i18n";
import { clockLabel } from "@/features/guest/format";
import { useCoupleDayOf } from "@/lib/hooks";
import { Screen, TopBar, IconButton, Badge, T, Row, Button, Card, SectionLabel, Stack, Skeleton, Icon, useLayout, useSideInsetsStyle, useTopInset, toast } from "@/ui";
import { useReservedRegions } from "@/lib/duo";
import { useQueryClient } from "@tanstack/react-query";
import { post } from "@/lib/api";
import { useUserSession } from "@/lib/session";
import { StyleSheet } from "react-native";
import { colors } from "@/ui/tokens";
import { nightOrder } from "@/features/runsheet/list";
import { useSafeBack } from "@/lib/nav";
import { LiveDay } from "@/features/dayof/LiveDay";
import { useDayPack, useDayPackFlag } from "@/features/dayof/hooks";
import { ServerLivePanel, liveRowState, useServerLive } from "@/features/dayof/ServerLive";
import { PreviewBanner, PreviewDayControl, usePreviewActive } from "@/features/dayof/PreviewDay";
import { dayofBlocks, readLive } from "@/features/dayof/liveDayCore";

export default function CoupleDayOf() {
  const flag = useDayPackFlag();
  const slug = useUserSession()?.me.tenant.slug ?? null;
  const { status } = useDayPack("couple", slug, flag);
  const layout = useLayout();
  if (flag && slug && !status.missing && layout.pose !== "table") return <LiveDay role="couple" slug={slug} />;
  return <ServerDayOf />;
}

function ServerDayOf() {
  const copy = useCopy();
  const router = useRouter();
  // A section like the others: a back button to where you came from (N2).
  const back = useSafeBack();
  const focused = useIsFocused();
  const mainQuery = useCoupleDayOf({ poll: focused });
  const { data, isLoading } = mainQuery;
  // Part 9 audit, D-038. The server marks a block done by the clock alone, so
  // six months before the wedding every block read DONE with a line through it.
  // Progress only means something on the day itself. And a block after midnight
  // ("01:30 last song") belongs at the END of the night, not first in the list.
  const live = !!data?.day_of;
  const blocks = [...(data?.runsheet ?? [])]
    .sort((a, b) => nightOrder(a.starts_at) - nightOrder(b.starts_at))
    .map((b) => ({ ...b, state: live ? b.state : ("later" as const) }));
  const rowState = (b: { id: string; state: string }) => (liveView ? liveRowState(liveView.state, b.id, b.state) : b.state);
  const layout = useLayout();
  const regions = useReservedRegions();
  const side = useSideInsetsStyle();
  const topInset = useTopInset();
  const qc = useQueryClient();
  const session = useUserSession();
  const { lang } = useLang();
  const canEdit = session?.me.can_edit ?? false;
  const [marking, setMarking] = React.useState(false);
  // #3 (MW_LIVE_DAY, 1.4.0): Now and Next ticking on the phone from the server's
  // answer; without `live` (flag off, an older portal) the screen is as before.
  const [overlay, setOverlay] = React.useState<Record<string, string>>({});
  const onOverlay = React.useCallback((id: string, status: string | null) => {
    setOverlay((o) => {
      const next = { ...o };
      if (status) next[id] = status;
      else delete next[id];
      return next;
    });
  }, []);
  const liveView = useServerLive(data, mainQuery.dataUpdatedAt, session?.me.tenant.slug, overlay);
  // Demo weddings only: "Preview the day" runs the live view at a chosen moment (previewClock.ts).
  const slug = session?.me.tenant.slug ?? null;
  const previewOn = usePreviewActive(slug);
  // A preview's marks live only in the overlay: they go when it starts or ends (any way it ends).
  const [wasPreview, setWasPreview] = React.useState(previewOn);
  if (wasPreview !== previewOn) {
    setWasPreview(previewOn);
    setOverlay({});
  }
  const liveRead = React.useMemo(() => readLive(data?.live), [data?.live]);
  const previewDay = data?.runsheet_day ?? session?.me.tenant.wedding_date?.slice(0, 10) ?? null;
  const previewBlocks = React.useMemo(() => (data && previewDay ? dayofBlocks(data.runsheet, previewDay) : []), [data, previewDay]);
  const pct = data && data.parties_total ? Math.min(100, Math.round((data.parties_in / data.parties_total) * 100)) : 0;

  // Wedding-day mode (iPhone Duo, half folded on the table): "Now" and "Next"
  // big above the fold, to read at arm's length; marking it done and the door
  // below it, where the thumbs are (Apple, "Strike a pose"). Same function as
  // the normal screen, only arranged.
  if (layout.pose === "table") {
    const now = blocks.find((b) => b.state === "now") ?? null;
    const next = blocks.find((b) => b.state === "next") ?? blocks.find((b) => b.state === "later") ?? null;
    const fold = regions.division;
    const foldH = fold && fold.active ? fold.height : 36;
    const topH = fold && fold.active ? fold.y : Math.round(layout.height / 2 - foldH / 2);
    const markDone = async () => {
      if (!now || marking) return;
      setMarking(true);
      try {
        await post(`/couple/runsheet/${now.id}/status`, { status: "done" });
        await qc.invalidateQueries({ queryKey: ["couple-dayof"] });
        toast(copy.coupleDayOf.markedDone, { icon: "check" });
      } catch {
        toast(copy.common.errorBody, { icon: "warning" });
      } finally {
        setMarking(false);
      }
    };
    return (
      <View style={[tableStyles.root, side]}>
        <View style={{ height: topH, paddingTop: topInset }}>
          <TopBar onBack={back} right={<Badge label={copy.coupleDayOf.title} kind="green" />} />
          <View style={tableStyles.read}>
            {now ? (
              <>
                <T v="label11" color={colors.goldLight}>{copy.coupleDayOf.nowLabel}</T>
                <T v="display44" center numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{now.title}</T>
                <T v="title30" color={colors.goldLight}>{[now.starts_at.slice(0, 5), now.location].filter(Boolean).join(" · ")}</T>
              </>
            ) : (
              <T v="body16" color={colors.ivory70} center>{data && !data.day_of ? copy.coupleDayOf.notToday : copy.coupleDayOf.nothingNow}</T>
            )}
            {next ? (
              <View style={{ marginTop: 6, alignItems: "center" }}>
                <T v="label11" color={colors.ivory55}>{copy.coupleDayOf.nextLabel}</T>
                <T v="title30" center numberOfLines={1}>{`${next.starts_at.slice(0, 5)} · ${next.title}`}</T>
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ height: foldH }} accessible={false} importantForAccessibility="no" />
        <View style={tableStyles.controls}>
          {now && canEdit ? <Button label={copy.coupleDayOf.markDone} icon="check" onPress={() => void markDone()} loading={marking} testID="dayof-mark-done" /> : null}
          <Button label={copy.coupleDayOf.checkIn} icon="qr" kind={now && canEdit ? "glass" : "primary"} onPress={() => router.push("/couple/checkin")} />
          <Row style={{ justifyContent: "space-between" }}>
            <T v="body15" color={colors.ivory70}>
              {data ? `${data.parties_in} / ${data.parties_total} ${copy.coupleDayOf.partiesIn.toLowerCase()}` : "·"}
            </T>
            <Button label={copy.coupleDayOf.open} kind="text" small full={false} haptic={false} onPress={() => router.push("/couple/runsheet")} />
          </Row>
        </View>
      </View>
    );
  }

  return (
    <Screen query={mainQuery} refresh header={<TopBar onBack={back} right={<Row gap={8}><Badge label={copy.coupleDayOf.title} kind="green" /><IconButton name="bell" label={copy.coupleHome.tabs.messages} onPress={() => router.push("/couple/messages")} /></Row>} />}>
      {liveRead ? <PreviewBanner slug={slug} now={liveView?.now ?? mainQuery.dataUpdatedAt} timeZone={liveRead.timeZone} /> : null}
      {liveRead && !previewOn ? <PreviewDayControl slug={slug} blocks={previewBlocks} timeZone={liveRead.timeZone} day={previewDay} /> : null}
      {liveView ? <ServerLivePanel view={liveView} canEdit={canEdit} onOverlay={onOverlay} preview={previewOn} /> : null}
      <Row gap={24} align="flex-end" style={{ marginTop: liveView ? 28 : 16 }}>
        <View>
          <SectionLabel color={liveView ? undefined : colors.goldLight}>{copy.coupleDayOf.partiesIn}</SectionLabel>
          <Row gap={6} align="baseline">
            <T v="numeral80" style={{ lineHeight: 78, letterSpacing: -1 }}>
              {data ? data.parties_in : "·"}
            </T>
            <T v="name24" color={colors.ivory55}>
              / {data?.parties_total ?? "·"}
            </T>
          </Row>
        </View>
        <View style={{ paddingBottom: 10 }}>
          <SectionLabel>{copy.coupleDayOf.seats}</SectionLabel>
          <Row gap={4} align="baseline">
            <T v="title34">{data?.seats_in ?? "·"}</T>
            <T v="meta13" color={colors.ivory55}>
              / {data?.seats_total ?? "·"}
            </T>
          </Row>
        </View>
      </Row>
      <View style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(247,243,236,0.1)", marginTop: 12 }}>
        {/* With the live panel the Now diamond is the screen's one gold. */}
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: liveView ? colors.ivory70 : colors.gold, borderRadius: 2 }} />
      </View>
      <Button label={copy.coupleDayOf.checkIn} icon="qr" kind={liveView ? "glass" : "primary"} onPress={() => router.push("/couple/checkin")} style={{ marginTop: 18 }} />

      <Row style={{ justifyContent: "space-between", marginTop: 28 }}>
        <SectionLabel>{copy.coupleDayOf.runsheet}</SectionLabel>
        {liveView ? (
          // #3: with the live panel the Now diamond is the screen's one gold, so this link is ivory (as the road card's).
          <Pressable accessibilityRole="button" accessibilityLabel={copy.coupleDayOf.open} hitSlop={8} onPress={() => router.push("/couple/runsheet")} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
            <Row gap={4}>
              <T v="meta13" color={colors.ivory70}>
                {copy.coupleDayOf.open}
              </T>
              <Icon name="chev" size={14} color={colors.ivory55} />
            </Row>
          </Pressable>
        ) : (
          <Button label={copy.coupleDayOf.open} kind="text" small full={false} haptic={false} onPress={() => router.push("/couple/runsheet")} />
        )}
      </Row>
      <Card kind="solid" padding={2} style={{ marginTop: 8, paddingHorizontal: 18 }}>
        {isLoading && !data ? (
          <Stack gap={10} style={{ paddingVertical: 12 }}>
            <Skeleton h={40} />
            <Skeleton h={40} />
          </Stack>
        ) : null}
        {data && !data.runsheet.length ? (
          <View style={{ paddingVertical: 14, gap: 10 }}>
            <T v="body15" color={colors.ivory55}>
              {copy.coupleDayOf.noRunsheet}
            </T>
            <Button label={copy.coupleDayOf.buildRunsheet} kind="glass" small onPress={() => router.push("/couple/runsheet")} />
          </View>
        ) : null}
        {blocks.map((row, i, arr) => {
          const b = { ...row, state: rowState(row) };
          return (
          <Row key={b.id} gap={14} style={{ minHeight: 48, paddingVertical: 6, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: colors.ivory09 }}>
            {liveView ? (
              // #3: wedding-day times in Jost with tabular figures, in the reader's clock (never Cormorant for numbers).
              <T v="liveTitle" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} color={b.state === "now" ? colors.ivory : colors.ivory55} style={{ width: 84, fontVariant: ["tabular-nums"] }}>
                {clockLabel(null, b.starts_at.slice(0, 5), lang)}
              </T>
            ) : (
              <T v="time20" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} color={b.state === "now" ? colors.goldLight : colors.ivory55} style={{ width: 62 }}>
                {b.starts_at.slice(0, 5)}
              </T>
            )}
            <View style={{ flex: 1 }}>
              <T v="body15" color={b.state === "now" ? colors.ivory : b.state === "done" ? colors.ivory40 : colors.ivory70} style={b.state === "done" && { textDecorationLine: "line-through" }}>
                {b.title}
              </T>
              {b.location || b.owner ? (
                <T v="meta13" color={colors.ivory55}>
                  {[b.location, b.owner].filter(Boolean).join(" · ")}
                </T>
              ) : null}
            </View>
            {b.state === "done" ? <Badge label={copy.common.doneLabel} kind="mute" /> : b.state === "now" ? <Badge label={copy.common.now} kind={liveView ? "mute" : "gold"} /> : null}
          </Row>
          );
        })}
      </Card>

      {data?.escalations.length ? (
        <Card kind="solid" padding={14} style={{ marginTop: 14 }} border="rgba(245,158,11,0.35)">
          <Row style={{ justifyContent: "space-between" }}>
            <Badge label={fmt(copy.coupleDayOf.escalated, { n: data.escalations.length })} kind="amber" />
            <Button label={copy.coupleDayOf.answerBoth} kind="text" small full={false} haptic={false} onPress={() => router.push("/couple/messages")} />
          </Row>
          <T v="body15" color={colors.ivory90} style={{ marginTop: 8 }}>
            {data.escalations.map((e) => e.text).join(" ")}
          </T>
        </Card>
      ) : null}
      {data && !data.day_of && !previewOn ? (
        <Row gap={10} style={{ marginTop: 16 }}>
          <Icon name="info" size={18} color={colors.ivory55} />
          <T v="meta13" color={colors.ivory55} style={{ flex: 1 }}>
            {copy.coupleDayOf.notToday}
          </T>
        </Row>
      ) : null}
    </Screen>
  );
}

const tableStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  read: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 24 },
  controls: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 12 },
});
