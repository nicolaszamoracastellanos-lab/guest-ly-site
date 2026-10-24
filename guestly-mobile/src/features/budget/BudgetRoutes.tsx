// Budget routes shared by the couple and the planner. With room for two panes
// the overview (categories) sits on the left and the open category on the
// right; a line still opens as its own pushed screen. The selection is
// "<category id>~<budget id>" in ?sel=.

import React, { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { useFeatureCopy } from "@/i18n/feature";
import { useTenantKey } from "@/lib/session";
import { MasterDetail } from "@/ui/MasterDetail";
import { T, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "./copy";
import { BudgetOverviewScreen } from "./screens/Overview";
import { BudgetCategoryScreen } from "./screens/Category";

type Prefix = "/couple/budget" | "/planner/budget";
const parse = (sel: string) => {
  const [id, b] = sel.split("~");
  return { id, b: b || undefined };
};

export function BudgetIndexRoute({ prefix }: { prefix: Prefix }) {
  const { sel } = useLocalSearchParams<{ sel?: string }>();
  const copy = useFeatureCopy(COPY);
  // Keyed by the wedding: the root of this stack stays mounted across a wedding
  // switch, and its selected budget must not carry over (F1).
  const tenantKey = useTenantKey();
  const listHref = useCallback((s?: string) => (s ? { pathname: prefix, params: { sel: s } } : prefix) as never, [prefix]);
  const detailHref = useCallback((s: string) => ({ pathname: `${prefix}/category/[id]`, params: parse(s) }) as never, [prefix]);
  return (
    <MasterDetail
      detailRoute={false}
      selected={sel ?? null}
      list={<BudgetOverviewScreen key={tenantKey} />}
      renderDetail={(s) => <BudgetCategoryScreen {...parse(s)} />}
      listHref={listHref}
      detailHref={detailHref}
      placeholder={<><Icon name="grid" size={34} color={colors.goldLight} /><T v="body15" color={colors.ivory70} style={{ textAlign: "center" }}>{copy.pickCategory}</T></>}
    />
  );
}

export function BudgetCategoryRoute({ prefix }: { prefix: Prefix }) {
  const { id, b, add } = useLocalSearchParams<{ id: string; b?: string; add?: string }>();
  const tenantKey = useTenantKey();
  const listHref = useCallback((s?: string) => (s ? { pathname: prefix, params: { sel: s } } : prefix) as never, [prefix]);
  const detailHref = useCallback((s: string) => ({ pathname: `${prefix}/category/[id]`, params: parse(s) }) as never, [prefix]);
  return (
    <MasterDetail
      detailRoute
      selected={id ? `${id}~${b ?? ""}` : null}
      list={<BudgetOverviewScreen key={tenantKey} />}
      renderDetail={(s) => <BudgetCategoryScreen {...parse(s)} add={add} />}
      listHref={listHref}
      detailHref={detailHref}
      placeholder={null}
    />
  );
}
