// Announcement detail route (a pushed screen on one pane). With room for two
// panes it opens in the Messages tab beside the inbox instead.

import React from "react";
import { useLocalSearchParams } from "expo-router";
import { Inbox } from "@/features/inbox/Inbox";
import { messagesDetailHref, messagesListHref, renderMessagesDetail } from "@/features/inbox/selection";
import { MasterDetail } from "@/ui/MasterDetail";

const listHref = (s?: string) => messagesListHref(s);

export default function BroadcastDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MasterDetail detailRoute selected={id ? `b:${id}` : null} list={<Inbox />} renderDetail={renderMessagesDetail} listHref={listHref} detailHref={messagesDetailHref} placeholder={null} />;
}
