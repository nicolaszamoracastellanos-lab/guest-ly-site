// Conversation route. When the window grows to two panes while a thread is
// open, MasterDetail sends it to the inbox with this thread selected.

import React, { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { Inbox } from "@/features/inbox/Inbox";
import { Conversation } from "@/features/inbox/Conversation";
import { MasterDetail } from "@/ui/MasterDetail";

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listHref = useCallback((s?: string) => (s ? { pathname: "/couple/messages", params: { sel: s } } : "/couple/messages") as never, []);
  const detailHref = useCallback((tid: string) => ({ pathname: "/couple/messages/[id]", params: { id: tid } }) as never, []);
  return <MasterDetail detailRoute selected={id ?? null} list={<Inbox />} renderDetail={(tid) => <Conversation id={tid} />} listHref={listHref} detailHref={detailHref} placeholder={null} />;
}
