// One guest's note as its own screen; beside the list when there is room.

import React from "react";
import { useLocalSearchParams } from "expo-router";
import { MasterDetail } from "@/ui/MasterDetail";
import { ThankyouListScreen } from "@/features/thankyou/screens/List";
import { ThankyouNoteScreen } from "@/features/thankyou/screens/Note";

const listHref = (s?: string) => (s ? { pathname: "/couple/thankyou", params: { sel: s } } : "/couple/thankyou") as never;
const detailHref = (id: string) => ({ pathname: "/couple/thankyou/[id]", params: { id } }) as never;

export default function ThankyouNoteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MasterDetail detailRoute selected={id ?? null} list={<ThankyouListScreen />} renderDetail={(s) => <ThankyouNoteScreen key={s} id={s} />} listHref={listHref} detailHref={detailHref} placeholder={null} />;
}
