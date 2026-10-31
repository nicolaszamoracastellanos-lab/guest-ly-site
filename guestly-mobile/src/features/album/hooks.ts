// Album data (portal wave D2, mobile routes api/mobile/v1/guest/album and
// couple/album). Built against the contract in docs/hh/SCREENS-PLAN.md
// section 7 (master prompt 6.2) before the routes exist: while the portal
// answers 404 the entry rows and screens hide (isMissingEndpoint), so the
// album lights up when the D2 branch merges, with no app release.
//
//   GET  /guest/album?cursor=      { enabled, share_with_guests, can_upload?, items, next_cursor }
//   POST /guest/album/upload-url   { content_type, bytes } -> { id, upload_url, headers }
//   PUT  upload_url                (the file, then)
//   POST /guest/album/{id}/done    { caption? }
//   GET  /couple/album?status=&cursor=   { items (with guest_name), next_cursor, settings?, share_url? }
//   POST /couple/album/{id}        { status: "approved" | "hidden" }
//   POST /couple/album/settings    { enabled?, moderation?, share_with_guests? }

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { API_BASE, get, isMissingEndpoint } from "@/lib/api";
import { normalizePhotos, type AlbumPhoto, type AlbumStatus } from "./grid";

export type AlbumSettings = { enabled: boolean; moderation: "auto" | "review"; share_with_guests: boolean };

type GuestPage = { enabled: boolean; share_with_guests: boolean; can_upload: boolean; items: AlbumPhoto[]; next_cursor: string | null };
type CouplePage = { items: AlbumPhoto[]; next_cursor: string | null; settings: AlbumSettings | null; share_url: string | null };

export const GUEST_ALBUM_KEY = ["guest-album"] as const;
export const COUPLE_ALBUM_KEY = ["couple-album"] as const;

const qs = (cursor: string | null | undefined, extra: Record<string, string> = {}) => {
  const p = new URLSearchParams(extra);
  if (cursor) p.set("cursor", cursor);
  const s = p.toString();
  return s ? `?${s}` : "";
};

function settingsOf(raw: unknown): AlbumSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return { enabled: r.enabled === true, moderation: r.moderation === "review" ? "review" : "auto", share_with_guests: r.share_with_guests !== false };
}

export function useGuestAlbum(opts: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: GUEST_ALBUM_KEY,
    enabled: opts.enabled ?? true,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<GuestPage> => {
      const r = await get<Record<string, unknown>>(`/guest/album${qs(pageParam)}`);
      return {
        enabled: r.enabled !== false,
        share_with_guests: r.share_with_guests !== false,
        can_upload: r.can_upload !== false && r.enabled !== false,
        items: normalizePhotos(r.items, API_BASE),
        next_cursor: typeof r.next_cursor === "string" ? r.next_cursor : null,
      };
    },
    getNextPageParam: (last) => last.next_cursor,
    // A missing route is an answer, not a failure to retry.
    retry: (n, err) => !isMissingEndpoint(err) && n < 2,
    staleTime: 30_000,
  });
}

export function useCoupleAlbum(status: AlbumStatus, opts: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: [...COUPLE_ALBUM_KEY, status],
    enabled: opts.enabled ?? true,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<CouplePage> => {
      const r = await get<Record<string, unknown>>(`/couple/album${qs(pageParam, { status })}`);
      return {
        items: normalizePhotos(r.items, API_BASE),
        next_cursor: typeof r.next_cursor === "string" ? r.next_cursor : null,
        settings: settingsOf(r.settings),
        share_url: typeof r.share_url === "string" ? r.share_url : null,
      };
    },
    getNextPageParam: (last) => last.next_cursor,
    retry: (n, err) => !isMissingEndpoint(err) && n < 2,
    staleTime: 15_000,
  });
}

/** Whether the album exists on this portal, for the entry rows (Tools, Info).
 *  One light read of the first page; a 404 means "not shipped yet". */
export function useAlbumAvailable(surface: "guest" | "couple"): boolean {
  const q = useQuery({
    queryKey: ["album-available", surface],
    queryFn: async () => {
      const r = await get<Record<string, unknown>>(surface === "guest" ? "/guest/album" : "/couple/album?status=pending");
      return surface === "guest" ? r.enabled !== false : true;
    },
    retry: (n, err) => !isMissingEndpoint(err) && n < 1,
    staleTime: 10 * 60_000,
  });
  return q.data === true;
}
