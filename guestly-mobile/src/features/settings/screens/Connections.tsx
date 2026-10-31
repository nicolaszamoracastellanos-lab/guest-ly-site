// Settings > Connections (read-only status), laid out like the web page:
// the couple's connections grouped by the server's categories, each with a
// status badge (green Connected, amber Needs attention, mute Not set up), the
// reason in plain words and the last activity; then the connections Guest-ly
// switches on for every wedding in their own "Managed by Guest-ly" section,
// each saying what it does (the server's line), with an Off badge. A card the couple sets up opens the web setup page in the
// browser (connectionsWebPath: /settings/integrations, which becomes a
// redirect to /settings/connections once that page ships); no secret, provider error or link ever reaches the app.

import React from "react";
import { View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { fmt, relTime, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { useSafeBack } from "@/lib/nav";
import { API_BASE } from "@/lib/api";
import { Screen, TopBar, BigTitle, Stack, Card, ListRow, Badge, Skeleton, T, SectionLabel, EmptyState } from "@/ui";
import { colors } from "@/ui/tokens";
import { HH_COPY } from "../copy";
import { useConnections, type ConnectionItem, type SettingsSurface } from "../hooks";
import { connectionsSummary, connectionsWebPath, groupConnections, splitManaged } from "../logic";

const KIND = { connected: "green", needs_attention: "amber", not_set_up: "mute" } as const;

export function ConnectionsScreen({ surface = "couple" }: { surface?: SettingsSurface }) {
  const c = useFeatureCopy(HH_COPY).connections;
  const app = useCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const query = useConnections(surface);
  const { data } = query;
  const split = splitManaged(data?.items ?? []);
  const groups = data ? groupConnections(split.listed, data.categories) : [];
  const managed = split.managed;
  const openWeb = () => void WebBrowser.openBrowserAsync(`${API_BASE}${connectionsWebPath(surface)}`).catch(() => {});

  const sub = (i: ConnectionItem) => {
    const parts = [i.reason, i.address ?? i.domain ?? null, i.last_ok_at ? fmt(c.lastOk, { when: relTime(i.last_ok_at, lang) }) : null].filter(Boolean);
    return parts.join("\n");
  };

  return (
    <Screen query={query} header={<TopBar onBack={back} title={app.settings.title} />} bottomInset={40} refresh={() => query.refetch()}>
      <BigTitle title={c.title} sub={data ? (connectionsSummary(data) ?? fmt(c.summary, { ok: data.summary.connected ?? 0, need: data.summary.needs_attention ?? 0 })) : c.sub} size={38} />
      {!data ? (
        <Stack gap={12} style={{ marginTop: 20 }}>
          <Skeleton h={120} r={18} />
          <Skeleton h={120} r={18} />
        </Stack>
      ) : groups.length === 0 && managed.length === 0 ? (
        <View style={{ marginTop: 20 }}>
          <EmptyState title={c.empty} />
        </View>
      ) : (
        <Stack gap={10} style={{ marginTop: 20 }}>
          {groups.map((g) => (
            <View key={g.key} style={{ gap: 8, marginTop: 6 }}>
              <SectionLabel>{g.name}</SectionLabel>
              <Card kind="solid" padding={0} style={{ paddingHorizontal: 16 }}>
                {g.items.map((i, n) => (
                  <ListRow
                    key={i.provider}
                    title={i.name}
                    sub={sub(i)}
                    below={<Badge label={i.chip ?? c.status[i.status]} kind={KIND[i.status]} dot={i.status === "connected"} />}
                    onPress={i.action_by === "couple" && i.status !== "connected" ? openWeb : undefined}
                    chevron={i.action_by === "couple" && i.status !== "connected"}
                    last={n === g.items.length - 1}
                    testID={`connection-${i.provider}`}
                  />
                ))}
              </Card>
            </View>
          ))}
          {groups.length > 0 ? (
            <T v="meta13" color={colors.ivory55} style={{ marginTop: 6 }}>
              {c.by.couple}
            </T>
          ) : null}
          {managed.length > 0 ? (
            <View style={{ gap: 8, marginTop: 14 }} testID="connections-managed">
              <SectionLabel>{data.managed_group?.title ?? c.managedTitle}</SectionLabel>
              <T v="meta13" color={colors.ivory55}>
                {data.managed_group?.hint ?? c.managedHint}
              </T>
              <Card kind="solid" padding={0} style={{ paddingHorizontal: 16 }}>
                {managed.map((i, n) => (
                  <ListRow
                    key={i.provider}
                    title={i.name}
                    sub={i.reason}
                    below={<Badge label={i.chip ?? c.off} kind="mute" />}
                    last={n === managed.length - 1}
                    testID={`connection-${i.provider}`}
                  />
                ))}
              </Card>
            </View>
          ) : null}
        </Stack>
      )}
    </Screen>
  );
}
