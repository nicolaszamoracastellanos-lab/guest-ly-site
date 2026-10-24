// Messages tab root: the inbox (conversations and announcements), and on a
// window with room for two panes the open record beside it (Mail and Outlook
// pattern). ?sel= is the open conversation, announcement ("b:<id>") or the
// composer ("new"); picking a row never pushes a screen in two panes.

import React, { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { useCopy } from "@/i18n";
import { Inbox } from "@/features/inbox/Inbox";
import { messagesDetailHref, messagesListHref, renderMessagesDetail } from "@/features/inbox/selection";
import { MasterDetail } from "@/ui/MasterDetail";
import { T, Icon } from "@/ui";
import { colors } from "@/ui/tokens";

export default function MessagesIndex() {
  const { sel } = useLocalSearchParams<{ sel?: string }>();
  const copy = useCopy();
  const listHref = useCallback((s?: string) => messagesListHref(s), []);
  return (
    <MasterDetail
      detailRoute={false}
      selected={sel ?? null}
      list={<Inbox />}
      renderDetail={renderMessagesDetail}
      listHref={listHref}
      detailHref={messagesDetailHref}
      placeholder={<><Icon name="chat" size={34} color={colors.goldLight} /><T v="body15" color={colors.ivory70} style={{ textAlign: "center" }}>{copy.messages.pickOne}</T></>}
    />
  );
}
