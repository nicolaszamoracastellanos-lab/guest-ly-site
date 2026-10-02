// Planner Más / More (build 12, prototype P.more): who is signed in, the
// Coordinator, Switch wedding, the Guide, Settings, language and sign out.
//
// Build 11 listed every tool here. They moved, none removed: Tasks to
// Pendientes, Budget, Seating, Day-of schedule and Guest reminders to Boda;
// Vendors lives inside the Budget (F5). Coordinator and Guide keep their
// per-tool permission.

import React, { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { fmt, plural, useCopy, useLang } from "@/i18n";
import { usePlannerHome } from "@/lib/hooks";
import { can, useSession, useTenantKey, useUserSession } from "@/lib/session";
import { Screen, BigTitle, Card, ListRow, Footer, Stack, Avatar, T, Row, LangToggle, Button } from "@/ui";
import { colors } from "@/ui/tokens";
import { PlannerTop, IconDisc, WeddingSwitcher, weddingLabel } from "@/app/planner/_layout";

export default function PlannerMore() {
  return <PlannerMoreBody key={useTenantKey()} />;
}

function PlannerMoreBody() {
  const copy = useCopy();
  const c = copy.planner.b12;
  const { lang, setLang } = useLang();
  const router = useRouter();
  const { signOut } = useSession();
  const me = useUserSession()?.me;
  const home = usePlannerHome();
  const [switching, setSwitching] = useState(false);
  const name = (home.data?.greeting_name ?? "").trim();
  const weddings = me?.tenants.length ?? 0;
  const initials = (name || me?.user.email || "")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  function confirmSignOut() {
    Alert.alert(c.signOutTitle, c.signOutBody, [
      { text: copy.common.cancel, style: "cancel" },
      { text: copy.settings.signOut, style: "destructive", onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen header={<PlannerTop />}>
      <BigTitle title={c.tabs.more} />
      <Stack gap={12} style={{ marginTop: 20 }}>
        <Card kind="solid" padding={16}>
          <Row gap={14}>
            <Avatar initials={initials} size={56} />
            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
              <T v="name24" numberOfLines={1}>
                {name || me?.user.email || ""}
              </T>
              <T v="body15" color={colors.ivory55}>
                {plural(weddings, c.plannerOf)}
              </T>
            </Stack>
          </Row>
        </Card>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 16 }}>
          {can(me, "coordinator") ? <ListRow testID="planner-more-coordinator" leading={<IconDisc name="sparkle" />} title={copy.more.items.coordinator} sub={c.coordinatorSub} onPress={() => router.push("/assistant" as never)} /> : null}
          <ListRow
            testID="planner-more-switch"
            leading={<IconDisc name="rings" />}
            title={c.switchWedding}
            sub={me ? fmt(c.nowWedding, { name: weddingLabel(me.tenant.couple_names, me.tenant.wedding_date, lang) }) : null}
            onPress={() => setSwitching(true)}
            last={!can(me, "guide")}
          />
          {can(me, "guide") ? <ListRow testID="planner-more-guide" leading={<IconDisc name="book" />} title={copy.more.items.guide} sub={c.guideSub} onPress={() => router.push({ pathname: "/web", params: { path: "/planner/guide", title: copy.more.items.guide } } as never)} last /> : null}
        </Card>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 16 }}>
          <ListRow testID="planner-more-settings" leading={<IconDisc name="gear" />} title={copy.more.items.settings} sub={c.settingsSub} onPress={() => router.push("/settings")} />
          <Row gap={12} style={{ minHeight: 64 }}>
            <IconDisc name="globe" />
            <T v="body16" color={colors.ivory90} style={{ flex: 1 }}>
              {c.language}
            </T>
            <LangToggle value={lang} onChange={setLang} />
          </Row>
        </Card>
        <Button label={copy.settings.signOut} kind="text" onPress={confirmSignOut} style={{ alignSelf: "center", marginTop: 8 }} full={false} testID="planner-more-signout" />
      </Stack>
      <Footer version={copy.common.footerVersion} trademark={copy.common.footerTrademark} />
      <WeddingSwitcher visible={switching} onClose={() => setSwitching(false)} />
    </Screen>
  );
}
