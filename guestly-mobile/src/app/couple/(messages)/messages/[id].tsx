// Conversation route. When the window grows to two panes while a thread is
// open, MasterDetail sends it to the inbox with this thread selected.

import React from "react";
import { useLocalSearchParams } from "expo-router";
import { Inbox } from "@/features/inbox/Inbox";
import { messagesDetailHref, messagesListHref, renderMessagesDetail } from "@/features/inbox/selection";
import { MasterDetail } from "@/ui/MasterDetail";

const listHref = (s?: string) => messagesListHref(s);

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MasterDetail detailRoute selected={id ?? null} list={<Inbox />} renderDetail={renderMessagesDetail} listHref={listHref} detailHref={messagesDetailHref} placeholder={null} />;
}
