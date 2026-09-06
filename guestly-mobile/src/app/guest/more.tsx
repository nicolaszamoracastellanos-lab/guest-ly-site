// Guest more: dress code, hotels, gifts, language, notifications, leave.

import React, { useState } from "react";
import { Alert, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useCopy, useLang } from "@/i18n";
import { useGuestSession, useSession } from "@/lib/session";
import { useGuestHome, useGuestSchedule } from "@/lib/hooks";
import { Screen, BigTitle, Card, ListRow, Icon, LangToggle, Toggle, Footer, Stack, T } from "@/ui";
import { colors } from "@/ui/tokens";

export default function GuestMore() {
  const copy = useCopy();
  const { lang, setLang } = useLang();
  const router = useRouter();
  const session = useGuestSession();
  const { signOut, pushToken } = useSession();
  const { data: home } = useGuestHome();
  const { data: schedule } = useGuestSchedule();
  const [notif, setNotif] = useState(!!pushToken);
  const site = session ? `https://app.guest-ly.com/${session.tenant.site_slug}` : null;

  return (
    <Screen>
      <BigTitle title={copy.guestMore.title} sub={session?.tenant.couple_names} />
      <Stack gap={12} style={{ marginTop: 22 }}>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow leading={<Icon name="hanger" size={22} color={colors.goldLight} />} title={copy.guestMore.dressCode} sub={home?.dress_code ?? schedule?.events.find((e) => e.dress_code)?.dress_code ?? null} chevron={false} />
          <ListRow leading={<Icon name="pin" size={22} color={colors.goldLight} />} title={copy.guestMore.hotels} onPress={() => site && Linking.openURL(`${site}#travel`)} />
          <ListRow leading={<Icon name="star" size={22} color={colors.goldLight} />} title={copy.guestMore.gifts} onPress={() => site && Linking.openURL(`${site}/registry`)} />
          <ListRow leading={<Icon name="globe" size={22} color={colors.goldLight} />} title={copy.guestMore.aboutWedding} onPress={() => site && Linking.openURL(site)} last />
        </Card>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow leading={<Icon name="globe" size={22} color={colors.goldLight} />} title={copy.guestMore.language} trailing={<LangToggle value={lang} onChange={setLang} />} chevron={false} />
          <ListRow
            leading={<Icon name="bell" size={22} color={colors.goldLight} />}
            title={copy.guestMore.notifications}
            trailing={<Toggle value={notif} onChange={(v) => { setNotif(v); if (v) router.push({ pathname: "/notify", params: { surface: "guest" } }); }} />}
            chevron={false}
            last
          />
        </Card>
        <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
          <ListRow leading={<Icon name="chat" size={22} color={colors.goldLight} />} title={copy.messages.title} onPress={() => router.push("/guest/messages")} />
          <ListRow
            leading={<Icon name="signout" size={22} color={colors.goldLight} />}
            title={copy.guestMore.leave}
            onPress={() =>
              Alert.alert(copy.guestMore.leave, copy.guestMore.leaveConfirm, [
                { text: copy.common.cancel, style: "cancel" },
                { text: copy.guestMore.leave, style: "destructive", onPress: () => void signOut() },
              ])
            }
            chevron={false}
            last
          />
        </Card>
        <T v="meta13" color={colors.ivory40} center>
          {copy.guestMore.leaveConfirm}
        </T>
      </Stack>
      <Footer version={copy.common.footerVersion} trademark={copy.common.footerTrademark} />
    </Screen>
  );
}
