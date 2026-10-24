// The Messages tab can show three kinds of record in its detail pane: a guest
// conversation ("<thread id>"), a sent announcement ("b:<id>") and the new
// announcement composer ("new"). One place maps a selection to what renders on
// the right and to the screen that shows it when there is only one pane.

import React from "react";
import type { Href } from "expo-router";
import { Conversation } from "./Conversation";
import { BroadcastDetail } from "@/features/broadcasts/BroadcastDetail";
import { NewBroadcast } from "@/features/broadcasts/NewBroadcast";

const isBroadcast = (sel: string) => sel === "new" || sel.startsWith("b:");

export function renderMessagesDetail(sel: string) {
  if (sel === "new") return <NewBroadcast />;
  if (sel.startsWith("b:")) return <BroadcastDetail id={sel.slice(2)} />;
  return <Conversation id={sel} />;
}

/** The screen that shows a selection on its own (one pane). */
export function messagesDetailHref(sel: string): Href {
  if (sel === "new") return "/couple/broadcasts/new" as Href;
  if (sel.startsWith("b:")) return { pathname: "/couple/broadcasts/[id]", params: { id: sel.slice(2) } } as Href;
  return { pathname: "/couple/messages/[id]", params: { id: sel } } as Href;
}

/** The inbox with a selection (two panes). Announcements open on the
 *  Announcements segment. `extra` carries a composer preset (audience,
 *  template, guest) so a "Send reminder" link keeps its preset. */
export function messagesListHref(sel?: string, extra?: Record<string, string | undefined>): Href {
  const params: Record<string, string> = {};
  if (sel) params.sel = sel;
  if (sel && isBroadcast(sel)) params.seg = "avisos";
  for (const [k, v] of Object.entries(extra ?? {})) if (v) params[k] = v;
  return (Object.keys(params).length ? { pathname: "/couple/messages", params } : "/couple/messages") as Href;
}
