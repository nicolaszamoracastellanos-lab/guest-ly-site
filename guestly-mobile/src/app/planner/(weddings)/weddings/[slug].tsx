// One wedding's summary as its own screen (one pane, or a link). With room for
// two panes it opens beside the portfolio instead.

import React from "react";
import { useLocalSearchParams } from "expo-router";
import { MasterDetail } from "@/ui/MasterDetail";
import { WeddingsList, WeddingSummary } from "@/features/planner/Weddings";

const listHref = (s?: string) => (s ? { pathname: "/planner/weddings", params: { sel: s } } : "/planner/weddings") as never;
const detailHref = (slug: string) => ({ pathname: "/planner/weddings/[slug]", params: { slug } }) as never;

export default function WeddingSummaryRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <MasterDetail detailRoute selected={slug ?? null} list={<WeddingsList />} renderDetail={(s) => <WeddingSummary slug={s} />} listHref={listHref} detailHref={detailHref} placeholder={null} />;
}
