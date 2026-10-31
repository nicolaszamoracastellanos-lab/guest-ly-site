// One planner thread on its own screen. When the window grows to two panes it
// moves to the inbox with this thread selected.
import React from "react";
import { useLocalSearchParams } from "expo-router";
import { MasterDetail } from "@/ui/MasterDetail";
import { PlannerInbox, PlannerThread } from "@/features/planner/Messages";

const listHref = (s?: string) => (s ? { pathname: "/planner/messages", params: { sel: s } } : "/planner/messages") as never;

export default function PlannerThreadRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MasterDetail detailRoute selected={id ?? null} list={<PlannerInbox />} renderDetail={(sel) => <PlannerThread id={sel} />} listHref={listHref} placeholder={null} />;
}
