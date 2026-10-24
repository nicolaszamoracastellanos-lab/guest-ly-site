// Planner Messages root: the inbox, with the selected thread beside it in two panes.
import React, { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { useCopy } from "@/i18n";
import { MasterDetail } from "@/ui/MasterDetail";
import { T, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { PlannerInbox, PlannerThread } from "@/features/planner/Messages";
import { useTenantKey } from "@/lib/session";

const listHref = (s?: string) => (s ? { pathname: "/planner/messages", params: { sel: s } } : "/planner/messages") as never;
const detailHref = (id: string) => ({ pathname: "/planner/messages/[id]", params: { id } }) as never;

export default function PlannerMessagesIndex() {
  const { sel } = useLocalSearchParams<{ sel?: string }>();
  const copy = useCopy();
  const key = useTenantKey();
  const renderDetail = useCallback((id: string) => <PlannerThread id={id} />, []);
  return (
    <MasterDetail
      key={key}
      detailRoute={false}
      selected={sel ?? null}
      list={<PlannerInbox />}
      renderDetail={renderDetail}
      listHref={listHref}
      detailHref={detailHref}
      placeholder={<><Icon name="chat" size={34} color={colors.goldLight} /><T v="body15" color={colors.ivory70} style={{ textAlign: "center" }}>{copy.messages.pickOne}</T></>}
    />
  );
}
