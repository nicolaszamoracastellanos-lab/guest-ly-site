// MasterDetail: one record screen that shows a list AND the open record when
// the window has room for both (iPhone Duo inner display, outer display in
// landscape), and one of them otherwise. The route a person is on never
// changes because the phone folds or unfolds:
//
//   two panes + list route    list on the left, the selected record on the
//                             right; picking a row only changes ?sel=
//   two panes + detail route  the Duo was unfolded while a record was open as
//                             its own screen: go to the list route with that
//                             record selected (dismissTo pops the sheet)
//   one pane  + detail route  the record alone, with its back button
//   one pane  + list route    the list; if a record was selected when the
//                             phone folded, push its screen and clear ?sel=
//
// Apple (Group Lab): "Treat display transitions as size-class changes, not a
// scene disconnect". The record stays where it was.

import React, { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useLayout, useSideInsetsStyle } from "./layout";
import { TwoPane, TwoPanePlaceholder } from "./TwoPane";

type PaneCtx = {
  /** True inside the right-hand pane of a two pane layout. */
  embedded: boolean;
  /** The selected record id (list route) or null. */
  selected: string | null;
  /** Select a record (two panes) or clear the selection with null. */
  select: (id: string | null) => void;
};

const PaneContext = createContext<PaneCtx>({ embedded: false, selected: null, select: () => {} });

/** Inside a list or a detail screen: are we in a two pane layout, and what is
 *  selected? Row presses use `open` instead of pushing; the detail's back
 *  button clears the selection instead of popping. */
export function usePane(): PaneCtx & { open: (id: string, push: () => void) => void } {
  const ctx = useContext(PaneContext);
  const open = useCallback((id: string, push: () => void) => (ctx.embedded ? ctx.select(id) : push()), [ctx]);
  // Stable between renders: rows memoized on a callback built from this (the
  // guest and thread rows) would otherwise re-render on every parent render.
  return useMemo(() => ({ ...ctx, open }), [ctx, open]);
}

export function MasterDetail({
  list,
  renderDetail,
  selected,
  detailRoute,
  listHref,
  detailHref,
  placeholder,
}: {
  list: ReactNode;
  renderDetail: (id: string) => ReactNode;
  /** `?sel=` on the list route, or the `id` param on the detail route. */
  selected: string | null;
  /** True when this screen is the detail route ([id]). */
  detailRoute: boolean;
  /** Href of the list route, with ?sel= when a record is selected. */
  listHref: (sel?: string) => Href;
  /** The screen that shows a record on its own (one pane). Omit it when the
   *  list shows the record another way (a sheet): a selection is then ignored
   *  and cleared when the window folds back to one pane. */
  detailHref?: (id: string) => Href;
  placeholder: ReactNode;
}) {
  const router = useRouter();
  const { twoPane } = useLayout();
  const side = useSideInsetsStyle();

  // Display change while a record is open as its own screen: show it beside
  // the list. dismissTo pops the sheet back to the existing list instead of
  // stacking a second copy of it.
  useEffect(() => {
    if (twoPane && detailRoute && selected) router.dismissTo(listHref(selected));
  }, [twoPane, detailRoute, selected, router, listHref]);

  // Display change back to one pane while a record is selected on the list:
  // clear the selection, then open the record as its own screen.
  useEffect(() => {
    if (!twoPane && !detailRoute && selected) {
      router.setParams({ sel: undefined } as never);
      if (detailHref) router.push(detailHref(selected));
    }
  }, [twoPane, detailRoute, selected, router, detailHref]);

  // A new selection also drops the composer preset (audience, template, guest) a
  // link may have left in the address, so the next composer starts clean.
  const select = useCallback((id: string | null) => router.setParams({ sel: id ?? undefined, audience: undefined, template: undefined, guest: undefined } as never), [router]);
  const ctx = useMemo<PaneCtx>(() => ({ embedded: twoPane, selected: detailRoute ? null : selected, select }), [twoPane, detailRoute, selected, select]);

  if (twoPane) {
    if (detailRoute) return null;
    return (
      <PaneContext.Provider value={ctx}>
        {/* The window's side insets (status column, bar rail) are applied once,
            here; the Screen of each pane skips them (usePane().embedded). */}
        <View style={[{ flex: 1 }, side]}>
          <TwoPane list={list} detail={selected ? renderDetail(selected) : null} placeholder={<TwoPanePlaceholder>{placeholder}</TwoPanePlaceholder>} />
        </View>
      </PaneContext.Provider>
    );
  }
  if (detailRoute && selected) return <>{renderDetail(selected)}</>;
  if (!detailRoute && selected && detailHref) return null;
  return <>{list}</>;
}
