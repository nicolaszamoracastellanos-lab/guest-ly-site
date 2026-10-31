// Settings > Connections (read-only status). Cards grouped by the server's
// categories, each with a status badge (green Connected, amber Needs
// attention, mute Not set up), the reason in plain words and the last
// activity. A card the couple sets up opens the web Connections page in the
// browser; no secret, provider error or link ever reaches the app.

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
import { groupConnections } from "../logic";

const KIND = { connected: "green", needs_attention: "amber", not_set_up: "mute" } as const;

export function ConnectionsScreen({ surface = "couple" }: { surface?: SettingsSurface }) {
  const c = useFeatureCopy(HH_COPY).connections;
  const app = useCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const query = useConnections(surface);
  const { data } = query;
  const groups = data ? groupConnections(data.items, data.categories) : [];
  const webPath = surface === "planner" ? "/planner/settings/connections" : "/settings/connections";
  const openWeb = () => void WebBrowser.openBrowserAsync(`${API_BASE}${webPath}`).catch(() => {});

  const sub = (i: ConnectionItem) => {
    const parts = [i.reason, i.address ?? i.domain ?? null, i.last_ok_at ? fmt(c.lastOk, { when: relTime(i.last_ok_at, lang) }) : null].filter(Boolean);
    return parts.join("\n");
  };

  return (
    <Screen query={query} header={<TopBar onBack={back} title={app.settings.title} />} bottomInset={40} refresh={() => query.refetch()}>
      <BigTitle title={c.title} sub={data ? fmt(c.summary, { ok: data.summary.connected ?? 0, need: data.summary.needs_attention ?? 0 }) : c.sub} size={38} />
      {!data ? (
        <Stack gap={12} style={{ marginTop: 20 }}>
          <Skeleton h={120} r={18} />
          <Skeleton h={120} r={18} />
        </Stack>
      ) : groups.length === 0 ? (
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
                    below={<Badge label={c.status[i.status]} kind={KIND[i.status]} dot={i.status === "connected"} />}
                    onPress={i.action_by === "couple" && i.status !== "connected" ? openWeb : undefined}
                    chevron={i.action_by === "couple" && i.status !== "connected"}
                    last={n === g.items.length - 1}
                    testID={`connection-${i.provider}`}
                  />
                ))}
              </Card>
              {g.items.some((i) => i.action_by === "guestly" && i.status !== "connected") ? (
                <T v="meta13" color={colors.ivory55}>
                  {c.by.guestly}
                </T>
              ) : null}
            </View>
          ))}
          <T v="meta13" color={colors.ivory55} style={{ marginTop: 6 }}>
            {c.by.couple}
          </T>
        </Stack>
      )}
    </Screen>
  );
}
