// Helpers that send tab stacks back to their lists. The tab bar itself is the
// system bar now (ui/NativeRoleTabs); these helpers only walk navigation state.

type NestedState = { key?: string; index?: number; type?: string; routes?: { name: string }[]; routeNames?: string[] };

/** Back to a tab stack's list. A record pushed into a stack that had never
 *  mounted can be that stack's only screen ([new], [[id]]): popping to the top
 *  does nothing there, so the stack is reset to its "index" instead (review
 *  fix, build 12). Returns true when it dispatched. */
export function resetStackToRoot(dispatch: (a: { type: string; target?: string; payload?: object }) => void, nested: NestedState | undefined): boolean {
  if (!nested?.key || nested.type !== "stack") return false;
  const first = nested.routes?.[0]?.name;
  if (first && first !== "index" && nested.routeNames?.includes("index")) {
    dispatch({ type: "RESET", target: nested.key, payload: { index: 0, routes: [{ name: "index" }] } });
    return true;
  }
  if ((nested.index ?? 0) > 0) {
    dispatch({ type: "POP_TO_TOP", target: nested.key });
    return true;
  }
  return false;
}

type TabRoute = { key: string; name: string; state?: unknown };
export type TabNav = { getState: () => { key: string; index: number; routes: TabRoute[] }; dispatch: (a: { type: string; target?: string; payload?: object }) => void };

/** Sends tab stacks back to their lists: the one with `only`, or every one but
 *  `skip`. Only tabs whose stack already reported a state can be reset (a stack
 *  that never mounted has nothing to pop). */
export function resetTabs(nav: TabNav, opts: { only?: string; skip?: string; tabs: ReadonlySet<string> }) {
  const st = nav.getState();
  for (const r of st.routes) {
    if ((opts.only && r.key !== opts.only) || r.key === opts.skip || !opts.tabs.has(r.name)) continue;
    if (r.state) resetStackToRoot((a) => nav.dispatch(a), r.state as NestedState);
  }
}
