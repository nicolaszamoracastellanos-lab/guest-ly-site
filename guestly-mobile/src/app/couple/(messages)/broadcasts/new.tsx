// New announcement route. With room for two panes the composer opens in the
// Messages tab beside the inbox; the preset a link carries (audience, template,
// guest) travels with it.

import React, { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { Inbox } from "@/features/inbox/Inbox";
import { messagesDetailHref, messagesListHref, renderMessagesDetail } from "@/features/inbox/selection";
import { MasterDetail } from "@/ui/MasterDetail";
import { NewBroadcast } from "@/features/broadcasts/NewBroadcast";

export default function NewBroadcastRoute() {
  const p = useLocalSearchParams<{ audience?: string; template?: string; guest?: string }>();
  const listHref = useCallback((s?: string) => messagesListHref(s, { audience: p.audience, template: p.template, guest: p.guest }), [p.audience, p.template, p.guest]);
  // One pane: the composer itself (the shared MasterDetail returns the list when it is told "new" is selected).
  return <MasterDetail detailRoute selected="new" list={<Inbox />} renderDetail={() => <NewBroadcast />} listHref={listHref} detailHref={messagesDetailHref} placeholder={null} />;
}
