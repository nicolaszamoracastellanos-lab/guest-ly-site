// Planner Broadcast (build 13; was "Guest reminders"). Sends go through the
// couple: the planner sees the wedding's approved templates (read-only), asks
// the couple to send (a send_reminders request), requests a new template from
// the Guest-ly team and follows their own requests. Audience sizes and the
// sent history stay. A portal from before build 13 sends no requests: that
// part simply does not show.

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { fmt, plural, relTime, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { Screen, TopBar, BigTitle, Card, ListRow, Badge, Button, EmptyState, Skeleton, Stack, SectionLabel, T, Chip, ChipRow, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/broadcasts/copy";
import { templateLanguages, usePlannerBroadcasts } from "@/features/broadcasts/hooks";
import { deliveryLine, groupTitle } from "@/features/broadcasts/format";
import { TemplateRequestList, languageList, useTemplateRequests } from "@/features/broadcasts/requests";
import { useSafeBack } from "@/lib/nav";
import { can, useTenantKey, useUserSession } from "@/lib/session";

const INVALIDATE = ["planner-broadcasts"];

// Keyed by the wedding, like the tab roots (F1).
export default function PlannerBroadcastsRoute() {
  return <PlannerBroadcasts key={useTenantKey()} />;
}

function PlannerBroadcasts() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const back = useSafeBack();
  const me = useUserSession()?.me;
  const mainQuery = usePlannerBroadcasts();
  const { data, isLoading } = mainQuery;
  const history = data?.history ?? [];
  const templates = data?.templates ?? [];
  const req = useTemplateRequests({ surface: "planner", requests: data?.template_requests, canRequest: data?.can_request_template ?? false, invalidate: INVALIDATE });
  // "Ask the couple to send" files a request, which rides on the tasks tool.
  const canAsk = can(me, "tasks");

  return (
    <Screen query={mainQuery} refresh header={<TopBar onBack={back} />}>
      <BigTitle title={c.plannerTabTitle} sub={c.plannerTabSubtitle} />
      <Stack gap={10} style={{ marginTop: 18 }}>
        {canAsk ? <Button label={c.plannerAsk} icon="megaphone" onPress={() => router.push({ pathname: "/planner/requests/new", params: { kind: "send_reminders" } })} testID="planner-broadcast-ask" /> : null}
        {req.canRequest ? <Button label={c.requestTemplate} icon="plus" kind="glass" onPress={() => req.openForm()} disabled={req.atLimit} testID="planner-broadcast-request" /> : null}
        {req.canRequest && req.atLimit ? (
          <T v="meta13" color={colors.ivory55}>
            {c.requestLimit}
          </T>
        ) : null}
      </Stack>

      {/* The couple's approved templates, read-only. */}
      {data ? (
        <>
          <SectionLabel style={{ marginTop: 28, marginBottom: 8 }}>{c.plannerTemplates}</SectionLabel>
          {templates.length ? (
            <>
              <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
                {templates.map((t, i) => (
                  <ListRow
                    key={t.id ?? t.key}
                    leading={<Icon name="mail" size={22} color={colors.goldLight} />}
                    title={t.id ? t.label : (c.templateNames as Record<string, string>)[t.key] ?? t.label}
                    sub={languageList(c, templateLanguages(t)) || null}
                    trailing={t.simulated ? <Badge label={c.demo} kind="amber" /> : undefined}
                    chevron={false}
                    last={i === templates.length - 1}
                  />
                ))}
              </Card>
              <T v="meta13" color={colors.ivory55} style={{ marginTop: 8 }}>
                {c.plannerTemplatesNote}
              </T>
            </>
          ) : (
            <EmptyState title={c.templatesEmpty} body={req.canRequest ? c.plannerNotReady : undefined} />
          )}
        </>
      ) : null}

      {req.list.length ? (
        <>
          <SectionLabel style={{ marginTop: 28, marginBottom: 8 }}>{c.yourRequests}</SectionLabel>
          <TemplateRequestList requests={req.list} onOpen={req.openDetail} />
        </>
      ) : null}

      {data ? (
        <View style={{ marginTop: 28 }}>
          <SectionLabel style={{ marginBottom: 8 }}>{c.plannerAudiences}</SectionLabel>
          <T v="meta13" color={colors.ivory55} style={{ marginBottom: 10 }}>
            {fmt(c.plannerPhones, { with: plural(data.guests_with_phone, c.plannerWithPhone), without: data.guests_without_phone })}
          </T>
          <ChipRow>
            {data.audiences.map((a) => (
              <Chip key={a.key} label={`${a.label[lang]} ${a.count}`} />
            ))}
          </ChipRow>
        </View>
      ) : null}
      <SectionLabel style={{ marginTop: 28, marginBottom: 8 }}>{c.history}</SectionLabel>
      <Stack gap={10}>
        {isLoading && !data ? <Skeleton h={72} r={18} /> : null}
        {data && !history.length ? <EmptyState title={c.historyEmpty} /> : null}
        {history.length ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            {history.map((g, i) => (
              <ListRow
                key={g.id}
                title={groupTitle(g, c.unknownBatch)}
                sub={`${deliveryLine(g, c)} · ${relTime(g.ts, lang)}`}
                trailing={g.groupKind === "campaign" ? <Badge label={fmt(c.recipients, { n: g.audience })} kind={g.failed ? "amber" : "green"} /> : undefined}
                chevron={false}
                last={i === history.length - 1}
              />
            ))}
          </Card>
        ) : null}
      </Stack>
      {req.sheets}
    </Screen>
  );
}
