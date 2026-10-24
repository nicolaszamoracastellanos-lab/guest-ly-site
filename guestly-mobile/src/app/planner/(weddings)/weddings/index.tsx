// Weddings tab root. With room for two panes the portfolio sits on the left
// and the selected wedding's summary on the right (?sel=<slug>).

import React, { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { useFeatureCopy } from "@/i18n/feature";
import { MasterDetail } from "@/ui/MasterDetail";
import { T, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/planner/copy";
import { WeddingsList, WeddingSummary } from "@/features/planner/Weddings";

export default function WeddingsIndex() {
  const { sel } = useLocalSearchParams<{ sel?: string }>();
  const l = useFeatureCopy(COPY);
  const listHref = useCallback((s?: string) => (s ? { pathname: "/planner/weddings", params: { sel: s } } : "/planner/weddings") as never, []);
  const detailHref = useCallback((slug: string) => ({ pathname: "/planner/weddings/[slug]", params: { slug } }) as never, []);
  return (
    <MasterDetail
      detailRoute={false}
      selected={sel ?? null}
      list={<WeddingsList />}
      renderDetail={(slug) => <WeddingSummary slug={slug} />}
      listHref={listHref}
      detailHref={detailHref}
      placeholder={<><Icon name="rings" size={34} color={colors.goldLight} /><T v="body15" color={colors.ivory70} style={{ textAlign: "center" }}>{l.pickWedding}</T></>}
    />
  );
}
