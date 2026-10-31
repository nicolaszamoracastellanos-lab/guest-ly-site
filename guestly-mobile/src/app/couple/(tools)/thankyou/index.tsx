// The thank-you list. With room for two panes the note opens beside it (?sel=).

import React, { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { useFeatureCopy } from "@/i18n/feature";
import { MasterDetail } from "@/ui/MasterDetail";
import { T, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { useTenantKey } from "@/lib/session";
import { THANKYOU_COPY } from "@/features/thankyou/copy";
import { ThankyouListScreen } from "@/features/thankyou/screens/List";
import { ThankyouNoteScreen } from "@/features/thankyou/screens/Note";

export default function ThankyouIndex() {
  const { sel } = useLocalSearchParams<{ sel?: string }>();
  const c = useFeatureCopy(THANKYOU_COPY);
  const key = useTenantKey();
  const listHref = useCallback((s?: string) => (s ? { pathname: "/couple/thankyou", params: { sel: s } } : "/couple/thankyou") as never, []);
  const detailHref = useCallback((id: string) => ({ pathname: "/couple/thankyou/[id]", params: { id } }) as never, []);
  return (
    <MasterDetail
      key={key}
      detailRoute={false}
      selected={sel ?? null}
      list={<ThankyouListScreen />}
      renderDetail={(id) => <ThankyouNoteScreen key={id} id={id} />}
      listHref={listHref}
      detailHref={detailHref}
      placeholder={<><Icon name="mail" size={34} color={colors.goldLight} /><T v="body15" color={colors.ivory70} style={{ textAlign: "center" }}>{c.pick}</T></>}
    />
  );
}
