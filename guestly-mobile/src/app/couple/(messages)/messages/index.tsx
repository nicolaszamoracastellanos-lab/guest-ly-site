// Messages tab root: the inbox, and on a window with room for two panes the
// open conversation beside it (Mail and Outlook pattern). ?sel= is the open
// thread; picking a row never pushes a screen in two panes.

import React, { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { useCopy } from "@/i18n";
import { Inbox } from "@/features/inbox/Inbox";
import { Conversation } from "@/features/inbox/Conversation";
import { MasterDetail } from "@/ui/MasterDetail";
import { T, Icon } from "@/ui";
import { colors } from "@/ui/tokens";

export default function MessagesIndex() {
  const { sel } = useLocalSearchParams<{ sel?: string }>();
  const copy = useCopy();
  const listHref = useCallback((s?: string) => (s ? { pathname: "/couple/messages", params: { sel: s } } : "/couple/messages") as never, []);
  const detailHref = useCallback((id: string) => ({ pathname: "/couple/messages/[id]", params: { id } }) as never, []);
  return (
    <MasterDetail
      detailRoute={false}
      selected={sel ?? null}
      list={<Inbox />}
      renderDetail={(id) => <Conversation id={id} />}
      listHref={listHref}
      detailHref={detailHref}
      placeholder={<><Icon name="chat" size={34} color={colors.goldLight} /><T v="body15" color={colors.ivory70} style={{ textAlign: "center" }}>{copy.messages.pickOne}</T></>}
    />
  );
}
