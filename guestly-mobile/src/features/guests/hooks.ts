// The couple guest list, page by page. The API answers 60 parties at a time
// with `next_cursor` (and, on newer servers, `has_more`); the list used to read
// only the first page, so a 300-guest wedding stopped at 60 names.
//
// Keys start with "couple-guests" so every existing invalidation of the guest
// list (add, edit, import, record RSVP) also refreshes these pages.

import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { GuestListItem, Totals } from "@/lib/hooks";

type Cursor = string | number;
type GuestPage = { items: GuestListItem[]; next_cursor?: Cursor | null; has_more?: boolean; totals: Totals };

/** The value, once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function pagePath(q: string, filter: string, cursor: Cursor | null): string {
  const params = [`q=${encodeURIComponent(q)}`, `filter=${encodeURIComponent(filter)}`];
  if (cursor !== null && cursor !== undefined && cursor !== "") params.push(`cursor=${encodeURIComponent(String(cursor))}`);
  return `/couple/guests?${params.join("&")}`;
}

function nextCursor(p: GuestPage): Cursor | undefined {
  if (p.has_more === false) return undefined;
  if (p.next_cursor === null || p.next_cursor === undefined || p.next_cursor === "") return undefined;
  return p.next_cursor;
}

/**
 * Every party matching `q` and `filter`, fetched a page at a time. `q` is
 * debounced here, so a caller can pass the raw text field value.
 */
export function useGuestPages(q: string, filter: string, opts: { enabled?: boolean } = {}) {
  const term = useDebounced(q.trim(), 250);
  const query = useInfiniteQuery({
    queryKey: ["couple-guests", "pages", term, filter],
    queryFn: ({ pageParam }) => get<GuestPage>(pagePath(term, filter, pageParam)),
    initialPageParam: null as Cursor | null,
    getNextPageParam: (last) => nextCursor(last),
    placeholderData: (prev) => prev,
    enabled: opts.enabled ?? true,
  });
  const pages = query.data?.pages;
  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: GuestListItem[] = [];
    for (const p of pages ?? []) {
      for (const g of p.items) {
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        out.push(g);
      }
    }
    return out;
  }, [pages]);
  const totals = pages?.[0]?.totals;
  /** Safe to pass straight to FlatList's onEndReached. */
  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetching) void query.fetchNextPage();
  };
  return { ...query, items, totals, loadMore, term };
}

/** Names (and rows) for specific guests, for pickers and request summaries:
 *  one `?ids=` lookup instead of searching the first page of the list. */
export function useGuestsByIds(ids: string[]) {
  const key = [...new Set(ids)].sort().slice(0, 200);
  return useQuery({
    queryKey: ["couple-guests", "ids", key.join(",")],
    queryFn: () => get<GuestPage>(`/couple/guests?ids=${key.map(encodeURIComponent).join(",")}&limit=${Math.max(20, key.length)}`),
    enabled: key.length > 0,
    staleTime: 60_000,
    select: (p) => p.items,
  });
}
