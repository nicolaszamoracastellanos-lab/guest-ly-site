// Broadcast tab (build 13; was a section under Messages). In this order:
//   1. New broadcast, or "Broadcasts aren't set up yet" with why and the way
//      to request a template when the wedding has no approved one,
//   2. Your templates (label, languages, Demo on the demo wedding),
//   3. Sent: history with delivery counts,
//   4. Request a template and Your requests (status pills, the team's note).
// The portal lists only templates this wedding can send, so the app no longer
// second-guesses them. A portal from before build 13 sends no requests: that
// part simply does not show.

import React from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fmt, relTime, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, Wordmark, BigTitle, Card, ListRow, Badge, Banner, Button, EmptyState, Skeleton, Stack, SectionLabel, T, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/broadcasts/copy";
import { templateLanguages, useBroadcasts } from "@/features/broadcasts/hooks";
import { groupTitle, deliveryLine } from "@/features/broadcasts/format";
import { TemplateRequestList, languageList, useTemplateRequests } from "@/features/broadcasts/requests";
import { MenuCard, MenuRow } from "@/features/couple/ui";

// Kept here too: the planner imported them from this file.
export { groupTitle, deliveryLine };

const INVALIDATE = ["broadcasts"];

export default function Broadcasts() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const user = useUserSession();
  const mainQuery = useBroadcasts();
  const { data, isLoading } = mainQuery;
  const editor = user?.me.can_edit ?? false;
  const templates = data?.templates ?? [];
  // Older portal: ready when it lists any template.
  const ready = data ? data.templates_ready ?? templates.length > 0 : true;
  const canSend = data ? data.can_send : editor;
  const history = data?.history ?? [];
  const anyPhone = (data?.guests ?? []).some((g) => g.has_phone);
  const req = useTemplateRequests({ surface: "couple", requests: data?.template_requests, canRequest: data?.can_request_template ?? false, invalidate: INVALIDATE });

  // A composer that found no template opens this tab with ?request=1.
  const params = useLocalSearchParams<{ request?: string; kind?: string }>();
  const [seenRequest, setSeenRequest] = React.useState<string | undefined>(undefined);
  if (data && params.request && params.request !== seenRequest) {
    setSeenRequest(params.request);
    if (req.canRequest && !req.atLimit) req.openForm(params.kind === "rsvp_closing" ? "rsvp_closing" : null);
  }

  const requestButton = req.canRequest ? (
    <Button label={c.requestTemplate} icon="plus" kind={ready ? "glass" : "primary"} onPress={() => req.openForm()} disabled={req.atLimit} testID="broadcasts-request-template" />
  ) : null;

  return (
    <Screen query={mainQuery} refresh header={<TopBar left={<Wordmark height={20} />} />}>
      <View style={{ marginTop: 10 }}>
        <BigTitle title={c.tabTitle} sub={c.tabSubtitle} />
      </View>

      {/* 1. Send, or why not yet */}
      <View style={{ marginTop: 20, gap: 12 }}>
        {!editor ? <Banner icon="lock" title={c.readOnly} /> : null}
        {isLoading && !data ? <Skeleton h={56} r={28} /> : null}
        {data && ready ? (
          <>
            {canSend && !anyPhone ? <Banner icon="phone" title={c.noPhones} /> : null}
            {canSend ? <Button label={c.newBroadcast} icon="megaphone" onPress={() => router.push("/couple/broadcasts/new")} disabled={!anyPhone} testID="broadcasts-new" /> : null}
          </>
        ) : null}
        {data && !ready ? (
          <Card kind="solid" padding={18} radiusKey="tile" border={colors.goldBorder}>
            <Stack gap={10}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.goldWash, alignItems: "center", justifyContent: "center" }}>
                <Icon name="megaphone" size={22} color={colors.goldLight} />
              </View>
              <T v="title26">{c.notReadyTitle}</T>
              <T v="body15" color={colors.ivory70}>
                {req.canRequest ? c.notReadyBody : c.notReadyBodyNoRequest}
              </T>
              {requestButton ? <View style={{ marginTop: 4 }}>{requestButton}</View> : null}
              {req.canRequest && req.atLimit ? (
                <T v="meta13" color={colors.ivory55}>
                  {c.requestLimit}
                </T>
              ) : null}
            </Stack>
          </Card>
        ) : null}
      </View>

      {/* 2. Your templates */}
      {data && templates.length ? (
        <>
          <SectionLabel style={{ marginTop: 28, marginBottom: 8 }}>{c.yourTemplates}</SectionLabel>
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
          {templates.some((t) => t.simulated) ? (
            <T v="meta13" color={colors.ivory55} style={{ marginTop: 8 }}>
              {c.demoNote}
            </T>
          ) : null}
        </>
      ) : null}

      {/* 3. Sent */}
      <SectionLabel style={{ marginTop: 28, marginBottom: 8 }}>{c.history}</SectionLabel>
      <Stack gap={10}>
        {isLoading && !data ? (
          <>
            <Skeleton h={72} r={18} />
            <Skeleton h={72} r={18} />
          </>
        ) : null}
        {data && !history.length ? <EmptyState title={c.historyEmpty} body={c.historyEmptyBody} /> : null}
        {history.length ? (
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            {history.map((g, i) => (
              <ListRow
                key={g.id}
                title={groupTitle(g, c.unknownBatch)}
                sub={`${deliveryLine(g, c)} · ${relTime(g.ts, lang)}`}
                trailing={g.groupKind === "campaign" ? <Badge label={g.failed ? fmt(c.failed, { n: g.failed }) : fmt(c.recipients, { n: g.audience })} kind={g.failed ? "amber" : "green"} /> : undefined}
                onPress={g.groupKind === "campaign" ? () => router.push({ pathname: "/couple/broadcasts/[id]", params: { id: g.id } }) : undefined}
                chevron={g.groupKind === "campaign"}
                last={i === history.length - 1}
              />
            ))}
          </Card>
        ) : null}
        {data?.ledger_available === false && history.length ? (
          <T v="meta13" color={colors.ivory40}>
            {lang === "es" ? "Los estados de entrega no están disponibles en este momento." : "Delivery states are not available right now."}
          </T>
        ) : null}
      </Stack>

      {/* 4. Requests */}
      {req.canRequest && ready ? (
        <MenuCard style={{ marginTop: 28 }}>
          <MenuRow icon="plus" title={c.requestTemplate} sub={req.atLimit ? c.requestLimit : c.requestTemplateSub} onPress={req.atLimit ? undefined : () => req.openForm()} testID="broadcasts-request-row" last />
        </MenuCard>
      ) : null}
      {req.list.length ? (
        <>
          <SectionLabel style={{ marginTop: 28, marginBottom: 8 }}>{c.yourRequests}</SectionLabel>
          <TemplateRequestList requests={req.list} onOpen={req.openDetail} />
        </>
      ) : null}
      {req.sheets}
    </Screen>
  );
}
