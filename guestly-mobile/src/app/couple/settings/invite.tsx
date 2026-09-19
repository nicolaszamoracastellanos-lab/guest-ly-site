// The invitation code card: copy, share, regenerate.

import React, { useState } from "react";
import { Alert, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useFeatureCopy } from "@/i18n/feature";
import { Screen, TopBar, BigTitle, Card, T, Stack, Skeleton, Button, Row, Gem, EmptyState, SectionLabel, ButtonRow } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/settings/copy";
import { useCoupleSettings, SETTINGS_KEY, type CoupleSettings } from "@/features/settings/hooks";
import { useSafeBack } from "@/lib/nav";

export default function InviteCode() {
  const c = useFeatureCopy(COPY).invite;
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const mainQuery = useCoupleSettings();
  const { data, isLoading } = mainQuery;
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(kind: "code" | "link") {
    if (!data?.invite_code || !data.invite_url) return;
    await Clipboard.setStringAsync(kind === "code" ? data.invite_code : data.invite_url);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
  }

  function regenerate() {
    Alert.alert(c.regenerate, c.regenerateConfirm, [
      { text: lang === "es" ? "Cancelar" : "Cancel", style: "cancel" },
      {
        text: c.regenerate,
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            const r = await post<{ invite_code: string; invite_url: string }>("/couple/settings/invite-code", {});
            qc.setQueryData<CoupleSettings>(SETTINGS_KEY, (old) => (old ? { ...old, invite_code: r.invite_code, invite_url: r.invite_url } : old));
          } catch (err) {
            Alert.alert(c.title, err instanceof ApiFailure ? err.messages[lang] : "");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <Screen query={mainQuery} header={<TopBar onBack={back} title={c.title} />} bottomInset={40}>
      <BigTitle title={c.title} sub={c.subtitle} size={38} />
      <Stack gap={14} style={{ marginTop: 20 }}>
        {isLoading && !data ? <Skeleton h={180} r={18} /> : null}
        {data && !data.invite_code ? <EmptyState title={c.pending} /> : null}
        {data?.invite_code && data.invite_url ? (
          <>
            <Card kind="paper" padding={22}>
              <Row gap={8}>
                <Gem />
                <T v="label11" color={colors.goldDim}>
                  {data.wedding.couple_names}
                </T>
              </Row>
              {/* One line, always: the code used to wrap to "CAMAN / D" on a 375 pt phone (D-013). */}
              <T v="display60" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{ marginTop: 14, letterSpacing: 6 }} accessibilityLabel={data.invite_code.split("").join(" ")}>
                {data.invite_code}
              </T>
              <T v="meta13" color={colors.muted} numberOfLines={2} style={{ marginTop: 8 }}>
                {data.invite_url}
              </T>
            </Card>
            <ButtonRow>
              <Button label={copied === "code" ? c.copied : c.copyCode} small kind="glass" onPress={() => void copy("code")} />
              <Button label={copied === "link" ? c.copied : c.copyLink} small kind="glass" onPress={() => void copy("link")} />
            </ButtonRow>
            <Button label={c.share} icon="share" onPress={() => void Share.share({ message: fmt(c.shareText, { code: data.invite_code, url: data.invite_url }) })} />
            {data.can_edit ? (
              <>
                <SectionLabel style={{ marginTop: 10 }}>{c.regenerate}</SectionLabel>
                <Button label={c.regenerate} kind="ghost" icon="undo" onPress={regenerate} loading={busy} />
              </>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Screen>
  );
}
