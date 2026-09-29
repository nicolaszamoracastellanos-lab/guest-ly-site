// Look: the three site themes as swatch cards.

import React, { useState } from "react";
import { View, Pressable, Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { post } from "@/lib/api";
import { useUserSession } from "@/lib/session";
import { errorText } from "@/features/shared/requests";
import { useFeatureCopy } from "@/i18n/feature";
import { Screen, TopBar, BigTitle, T, Badge, Stack, Skeleton, Icon, Banner } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { COPY } from "@/features/website/copy";
import { useWebsite, WEBSITE_KEY, type WebsiteSurface, type WebsiteTheme } from "@/features/website/hooks";
import { useSafeBack } from "@/lib/nav";

export default function WebsiteThemeScreen() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const canEdit = useUserSession()?.me.can_edit ?? false;
  const mainQuery = useWebsite();
  const { data, isLoading } = mainQuery;
  const [busy, setBusy] = useState<WebsiteTheme | null>(null);

  async function choose(theme: WebsiteTheme) {
    if (!canEdit || !data || data.theme === theme) return;
    setBusy(theme);
    try {
      await post("/couple/website/theme", { theme });
      qc.setQueryData<WebsiteSurface>(WEBSITE_KEY, (old) => (old ? { ...old, theme } : old));
    } catch (err) {
      Alert.alert(c.theme, errorText(err, lang, c.errors.saveFailed));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen query={mainQuery} header={<TopBar onBack={back} title={c.title} />} bottomInset={40}>
      <BigTitle title={c.theme} sub={c.subtitle} size={38} />
      <Stack gap={12} style={{ marginTop: 20 }}>
        {!canEdit ? <Banner icon="lock" title={c.readOnly} kind="gold" /> : null}
        {isLoading && !data ? <Skeleton h={140} r={18} /> : null}
        {(data?.themes ?? []).map((t) => {
          const on = data?.theme === t.key;
          return (
            <Pressable key={t.key} onPress={() => void choose(t.key)} disabled={!canEdit || busy !== null} accessibilityRole="button" accessibilityState={{ selected: on, disabled: !canEdit }} style={({ pressed }) => [{ borderRadius: radius.card, overflow: "hidden", borderWidth: 2, borderColor: on ? colors.gold : colors.ivory14, opacity: pressed || busy === t.key ? 0.7 : 1 }]}>
              <View style={{ backgroundColor: t.bg, padding: 20, minHeight: 130, justifyContent: "flex-end" }}>
                <View style={{ position: "absolute", top: 14, right: 14 }}>{on ? <Badge label={c.inUse} kind="gold" /> : null}</View>
                <View style={{ width: 8, height: 8, backgroundColor: t.accent, transform: [{ rotate: "45deg" }], marginBottom: 12 }} />
                <T v="title30" color={t.text}>
                  {c.themes[t.key]}
                </T>
                <T v="meta13" color={t.accent} numberOfLines={1}>
                  {[data?.inherited.names, data?.inherited.date_display ?? c.previewDate].filter(Boolean).join(" · ")}
                </T>
                <View style={{ marginTop: 12, alignSelf: "flex-start", backgroundColor: t.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon name="mail" size={16} color={t.bg} />
                  <T v="meta13" color={t.bg}>
                    RSVP
                  </T>
                </View>
              </View>
            </Pressable>
          );
        })}
      </Stack>
    </Screen>
  );
}
