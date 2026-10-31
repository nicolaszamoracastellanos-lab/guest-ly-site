// Settings > Team. Couple: the people on the wedding (addresses masked except
// your own) and the open invitations, with Resend and Cancel on a long press
// or a tap; "Invite your partner" docked at the bottom opens InviteSheet; the
// toast after sending offers Undo (DELETE, the invitation is revoked).
// Planner: the agency's seats, read-only, for agency owners (403 otherwise:
// the Settings index hides the row then).

import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, plural, relTime, shortDate, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, del } from "@/lib/api";
import { errorText } from "@/features/shared/requests";
import { useSafeBack } from "@/lib/nav";
import { Screen, TopBar, BigTitle, Stack, Card, ListRow, Avatar, Badge, SectionLabel, Skeleton, T, Button, EmptyState, toast } from "@/ui";
import { colors } from "@/ui/tokens";
import { HH_COPY } from "../copy";
import { TEAM_KEY, usePlannerTeam, useTeam, type Team, type TeamInvite, type TeamMember } from "../hooks";
import { InviteSheet, type InviteResult } from "./InviteSheet";
import { avatarInitials, teamAddress } from "../logic";
import { router } from "expo-router";

/** Two initials from a name; one neutral letter from an address (never its local part as a name). */
function initialsOf(name: string, email: string, named = !!name.trim()): string {
  return named ? avatarInitials(name, true) : avatarInitials(name.trim() || email, false);
}

export function TeamScreen({ surface = "couple" }: { surface?: "couple" | "planner" }) {
  return surface === "planner" ? <PlannerTeam /> : <CoupleTeam />;
}

function CoupleTeam() {
  const c = useFeatureCopy(HH_COPY);
  const t = c.team;
  const app = useCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const query = useTeam();
  const { data } = query;
  const [inviting, setInviting] = useState(false);

  const patch = (fn: (d: Team) => Team) => qc.setQueryData<Team>(TEAM_KEY, (d) => (d ? fn(d) : d));

  async function cancelInvite(inv: TeamInvite, quiet = false) {
    const prev = qc.getQueryData<Team>(TEAM_KEY);
    patch((d) => ({ ...d, invites: d.invites.filter((i) => i.id !== inv.id) }));
    try {
      await del(`/couple/team/invite/${inv.id}`);
      if (!quiet) toast(t.cancelled);
    } catch (err) {
      if (prev) qc.setQueryData(TEAM_KEY, prev);
      toast(errorText(err, lang, c.common.error), { icon: "warning" });
    }
  }

  async function resend(inv: TeamInvite) {
    try {
      const r = await post<{ invite: TeamInvite; email_sent: boolean }>(`/couple/team/invite/${inv.id}/resend`, {});
      patch((d) => ({ ...d, invites: d.invites.map((i) => (i.id === inv.id ? r.invite : i)) }));
      toast(r.email_sent ? t.resent : t.sentNoEmail, r.email_sent ? {} : { icon: "warning" });
    } catch (err) {
      toast(errorText(err, lang, c.common.error), { icon: "warning" });
    }
  }

  function inviteMenu(inv: TeamInvite) {
    Alert.alert(inv.first_name || teamAddress(inv), undefined, [
      { text: t.resend, onPress: () => void resend(inv) },
      { text: t.cancel, style: "destructive", onPress: () => void cancelInvite(inv) },
      { text: app.common.cancel, style: "cancel" },
    ]);
  }

  function removeMember(m: TeamMember) {
    const name = m.name || teamAddress(m);
    Alert.alert(t.remove, fmt(t.removeConfirm, { name }), [
      { text: app.common.cancel, style: "cancel" },
      {
        text: t.remove,
        style: "destructive",
        onPress: async () => {
          const prev = qc.getQueryData<Team>(TEAM_KEY);
          patch((d) => ({ ...d, members: d.members.filter((x) => x.user_id !== m.user_id) }));
          try {
            await del(`/couple/team/members/${m.user_id}`);
            toast(t.removed);
          } catch (err) {
            if (prev) qc.setQueryData(TEAM_KEY, prev);
            toast(errorText(err, lang, c.common.error), { icon: "warning" });
          }
        },
      },
    ]);
  }

  function onSent(r: InviteResult) {
    setInviting(false);
    patch((d) => ({ ...d, invites: [r.invite, ...d.invites.filter((i) => i.id !== r.invite.id)] }));
    toast(r.email_sent ? t.sent : t.sentNoEmail, { icon: r.email_sent ? "check" : "warning", undo: () => void cancelInvite(r.invite, true) });
  }

  const invites = data?.invites ?? [];

  return (
    <Screen
      query={query}
      header={<TopBar onBack={back} title={app.settings.title} />}
      bottomInset={40}
      refresh={() => query.refetch()}
      dock={data?.can_invite && !data.invites_pending ? <Button label={t.invite} icon="plus" onPress={() => setInviting(true)} testID="team-invite" /> : undefined}
    >
      <BigTitle title={t.title} sub={t.sub} size={38} />
      {!data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={64} />
          <Skeleton h={64} />
        </Stack>
      ) : (
        <Stack gap={10} style={{ marginTop: 20 }}>
          {!data.can_invite ? (
            <T v="meta13" color={colors.amber}>
              {t.readOnly}
            </T>
          ) : null}
          <SectionLabel>{t.members}</SectionLabel>
          <Card kind="solid" padding={0} style={{ paddingHorizontal: 16 }}>
            {data.members.map((m, i) => (
              <ListRow
                key={m.user_id}
                leading={<Avatar initials={initialsOf(m.name, teamAddress(m), m.has_name ?? !!m.name)} size={40} />}
                title={m.is_me ? `${m.name || teamAddress(m)} (${t.you})` : m.name || teamAddress(m)}
                sub={
                  m.has_name === false
                    ? m.is_me
                      ? t.addName
                      : m.last_seen_at
                        ? fmt(t.lastSeen, { when: relTime(m.last_seen_at, lang) })
                        : t.neverSeen
                    : m.name
                      ? teamAddress(m)
                      : m.last_seen_at
                        ? fmt(t.lastSeen, { when: relTime(m.last_seen_at, lang) })
                        : t.neverSeen
                }
                below={<Badge label={t.roles[m.role] ?? m.role} kind={m.role === "owner" ? "gold" : "mute"} />}
                onLongPress={m.removable ? () => removeMember(m) : undefined}
                longPressLabel={m.removable ? t.remove : undefined}
                onPress={m.removable ? () => removeMember(m) : m.is_me && m.has_name === false ? () => router.push("/couple/settings/profile" as never) : undefined}
                chevron={!m.removable && m.is_me && m.has_name === false}
                last={i === data.members.length - 1}
              />
            ))}
          </Card>
          {data.invites_pending ? (
            <EmptyState title={t.pending} />
          ) : invites.length ? (
            <>
              <SectionLabel style={{ marginTop: 12 }}>{t.invites}</SectionLabel>
              <Card kind="solid" padding={0} style={{ paddingHorizontal: 16 }}>
                {invites.map((inv, i) => (
                  <ListRow
                    key={inv.id}
                    leading={<Avatar initials={initialsOf(inv.first_name ?? "", teamAddress(inv))} size={40} />}
                    title={inv.first_name || teamAddress(inv)}
                    sub={inv.status === "expired" ? t.expired : fmt(t.expires, { date: shortDate(inv.expires_at, lang) })}
                    below={<Badge label={t.roles[inv.role]} kind={inv.status === "expired" ? "amber" : "mute"} />}
                    onPress={data.can_invite ? () => inviteMenu(inv) : undefined}
                    onLongPress={data.can_invite ? () => inviteMenu(inv) : undefined}
                    longPressLabel={t.resend}
                    chevron={false}
                    last={i === invites.length - 1}
                    testID={`team-invite-${i}`}
                  />
                ))}
              </Card>
            </>
          ) : null}
          {data.members.length > 0 ? (
            <T v="meta13" color={colors.ivory55} style={{ marginTop: 6 }}>
              {plural(data.members.length, c.index.teamSub)}
            </T>
          ) : null}
        </Stack>
      )}
      <View>
        <InviteSheet visible={inviting} onClose={() => setInviting(false)} onSent={onSent} />
      </View>
    </Screen>
  );
}

function PlannerTeam() {
  const c = useFeatureCopy(HH_COPY);
  const t = c.team;
  const app = useCopy();
  const back = useSafeBack();
  const query = usePlannerTeam();
  const { data } = query;
  return (
    <Screen query={query} header={<TopBar onBack={back} title={app.settings.title} />} bottomInset={40}>
      <BigTitle title={t.title} sub={data?.agency.name ?? t.agency} size={38} />
      {!data ? (
        <Skeleton h={120} r={18} style={{ marginTop: 20 }} />
      ) : (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Card kind="solid" padding={0} style={{ paddingHorizontal: 16 }}>
            {data.members.map((m, i) => (
              <ListRow
                key={m.user_id}
                leading={<Avatar initials={initialsOf("", teamAddress(m))} size={40} />}
                title={m.is_me ? `${teamAddress(m)} (${t.you})` : teamAddress(m)}
                below={<Badge label={t.levels[m.level] ?? m.level} kind={m.level === "owner" ? "gold" : "mute"} />}
                chevron={false}
                last={i === data.members.length - 1}
              />
            ))}
          </Card>
          <T v="meta13" color={colors.ivory55}>
            {t.agencyNote}
          </T>
        </Stack>
      )}
    </Screen>
  );
}
