// Guest card route (a full-height sheet on one pane). When the window grows to
// two panes while a card is open, MasterDetail sends it to the list route with
// this guest selected, so the same record stays on screen.

import React, { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { useCopy } from "@/i18n";
import { GuestsList } from "@/features/guests/GuestsList";
import { GuestDetail } from "@/features/guests/GuestDetail";
import { MasterDetail } from "@/ui/MasterDetail";

export default function GuestDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const copy = useCopy();
  void copy;
  const listHref = useCallback((s?: string) => (s ? { pathname: "/couple/guests", params: { sel: s } } : "/couple/guests") as never, []);
  const detailHref = useCallback((gid: string) => ({ pathname: "/couple/guests/[id]", params: { id: gid } }) as never, []);
  return <MasterDetail detailRoute selected={id ?? null} list={<GuestsList />} renderDetail={(gid) => <GuestDetail id={gid} />} listHref={listHref} detailHref={detailHref} placeholder={null} />;
}
