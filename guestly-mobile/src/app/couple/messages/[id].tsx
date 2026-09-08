// Reply to a guest. App threads: stored and pushed. WhatsApp threads: the
// reply opens WhatsApp (the portal has no free-form send path). Web: noted.

import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform, Linking, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, T, Avatar, Row, Card, Input, Button, Badge, Stack } from "@/ui";
import { colors } from "@/ui/tokens";

export default function ReplyScreen() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useUserSession();
  const { id, name, channel, preview, guest } = useLocalSearchParams<{ id: string; name: string; channel: string; preview: string; guest: string }>();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const canEdit = user?.me.can_edit ?? false;

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await post<{ delivered: "app" | "whatsapp_link" | "noted"; whatsapp_link?: string | null }>(`/couple/messages/${id}/reply`, { text: text.trim() });
      await qc.invalidateQueries({ queryKey: ["couple-inbox"] });
      if (r.delivered === "app") {
        setNote(fmt(copy.inbox.sent, { name }));
        setText("");
      } else if (r.delivered === "whatsapp_link" && r.whatsapp_link) {
        await Linking.openURL(r.whatsapp_link);
        router.back();
      } else {
        setNote(copy.inbox.webNoted);
      }
    } catch (err) {
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={copy.inbox.title} />} bottomInset={40} keyboard>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Row gap={14} style={{ marginTop: 8 }}>
          <Avatar initials={name?.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()} size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <T v="title30">{name}</T>
            <Badge label={channel === "app" ? copy.inbox.filters.app : channel === "whatsapp" ? copy.inbox.filters.whatsapp : copy.inbox.filters.web} kind={channel === "app" ? "gold" : "mute"} />
          </View>
        </Row>
        <Card kind="solid" padding={14} style={{ marginTop: 22 }}>
          <T v="body16" color={colors.ivory90}>
            {`"${preview}"`}
          </T>
        </Card>
        {channel === "whatsapp" ? (
          <T v="meta13" color={colors.ivory55} style={{ marginTop: 10 }}>
            {copy.inbox.whatsappHint}
          </T>
        ) : null}
        {guest ? (
          <Button label={copy.guests.detail.edit} kind="text" full={false} onPress={() => router.push({ pathname: "/couple/guests/[id]", params: { id: guest } })} style={{ marginTop: 6 }} />
        ) : null}
        {canEdit ? (
          <Stack gap={10} style={{ marginTop: 20 }}>
            <Input value={text} onChangeText={setText} placeholder={copy.inbox.replyPlaceholder} multiline style={{ borderRadius: 18 }} autoFocus />
            <Button label={channel === "whatsapp" ? copy.inbox.openWhatsapp : copy.inbox.reply} onPress={send} loading={busy} disabled={!text.trim()} icon={channel === "whatsapp" ? "phone" : "chat"} />
            {note ? (
              <T v="body15" color={colors.greenText}>
                {note}
              </T>
            ) : null}
          </Stack>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}
