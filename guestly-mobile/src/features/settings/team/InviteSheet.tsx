// The partner invitation: email, access (can edit or can view), the email's
// language, an optional first name. POST /couple/team/invite; the portal
// sends C14 through notify.ts and answers 409 already_member.

import React, { useState } from "react";
import { View } from "react-native";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, ApiFailure } from "@/lib/api";
import { errorText } from "@/features/shared/requests";
import { Sheet, SheetActions, T, Field, Input, Segmented, Stack } from "@/ui";
import { colors } from "@/ui/tokens";
import { HH_COPY } from "../copy";
import type { TeamInvite } from "../hooks";
import { looksLikeEmail } from "../logic";
import { FieldError } from "../ui";

export type InviteResult = { id: string; invite: TeamInvite; email_sent: boolean };

export function InviteSheet({ visible, onClose, onSent }: { visible: boolean; onClose: () => void; onSent: (r: InviteResult) => void }) {
  const c = useFeatureCopy(HH_COPY);
  const t = c.team;
  const { lang } = useLang();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("admin");
  const [mailLang, setMailLang] = useState<"en" | "es">(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setEmail("");
    setFirstName("");
    setRole("admin");
    setMailLang(lang);
    setError(null);
  }

  async function send() {
    if (busy || !looksLikeEmail(email)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<InviteResult>("/couple/team/invite", { email: email.trim(), role, lang: mailLang, first_name: firstName.trim() || undefined });
      reset();
      onSent(r);
    } catch (err) {
      if (err instanceof ApiFailure && err.code === "already_member") setError(t.already);
      else if (err instanceof ApiFailure && err.fields.email) setError(err.fields.email[lang]);
      else setError(errorText(err, lang, c.common.error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      top={110}
      footer={<SheetActions onCancel={onClose} onSave={() => void send()} saveLabel={t.send} saving={busy} disabled={!looksLikeEmail(email)} saveTestID="team-invite-send" />}
    >
      <T v="title30">{t.inviteTitle}</T>
      <T v="meta13" color={colors.ivory55} style={{ marginTop: 4 }}>
        {t.accept}
      </T>
      <Stack gap={16} style={{ marginTop: 18 }}>
        <Field label={t.email}>
          <Input
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError(null);
            }}
            placeholder={t.emailPlaceholder}
            placeholderTextColor={colors.ivory40}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            testID="team-invite-email"
          />
          <FieldError text={error} />
        </Field>
        <Field label={t.firstName}>
          <Input value={firstName} onChangeText={setFirstName} autoCapitalize="words" textContentType="givenName" />
        </Field>
        <Field label={t.role}>
          <Segmented
            value={role}
            options={[
              { value: "admin", label: t.roleAdmin },
              { value: "viewer", label: t.roleViewer },
            ]}
            onChange={setRole}
          />
        </Field>
        <Field label={t.lang}>
          <View>
            <Segmented
              value={mailLang}
              options={[
                { value: "es", label: "Español" },
                { value: "en", label: "English" },
              ]}
              onChange={setMailLang}
            />
          </View>
        </Field>
      </Stack>
    </Sheet>
  );
}
