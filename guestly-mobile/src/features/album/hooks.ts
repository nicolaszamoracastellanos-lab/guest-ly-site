// Album data, on the portal's album routes (hh/d-album-thankyou,
// src/lib/mobile/album.ts; contract in ./grid.ts and docs/hh/SCREENS-PLAN.md
// section 7). One GET per surface answers { album, photos } with every photo
// this caller may see (the couple: every status, filtered into tabs here).
// While the portal answers 404 (the album branch not deployed yet) the entry
// rows and screens hide (isMissingEndpoint), so the album lights up when it
// is deployed, with no app release. A guest's 403 means the couple keeps the
// album closed.

import { useQuery } from "@tanstack/react-query";
import { API_BASE, ApiFailure, get, isMissingEndpoint } from "@/lib/api";
import { normalizeAlbumAnswer, type AlbumAnswer } from "./grid";

export type { AlbumSettings } from "./grid";

export const GUEST_ALBUM_KEY = ["guest-album"] as const;
export const COUPLE_ALBUM_KEY = ["couple-album"] as const;

/** The guest's album is closed (the couple turned it off): an answer, not a failure. */
export function isAlbumClosed(err: unknown): boolean {
  return err instanceof ApiFailure && err.status === 403;
}

/** A missing route or a closed album is final; anything else may retry twice. */
const retry = (n: number, err: unknown) => !isMissingEndpoint(err) && !isAlbumClosed(err) && n < 2;

async function fetchAlbum(surface: "guest" | "couple"): Promise<AlbumAnswer> {
  return normalizeAlbumAnswer(await get<unknown>(`/${surface}/album`), API_BASE);
}

export function useGuestAlbum(opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: GUEST_ALBUM_KEY, enabled: opts.enabled ?? true, queryFn: () => fetchAlbum("guest"), retry, staleTime: 30_000 });
}

export function useCoupleAlbum(opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: COUPLE_ALBUM_KEY, enabled: opts.enabled ?? true, queryFn: () => fetchAlbum("couple"), retry, staleTime: 15_000 });
}

/** Whether the album row shows (Tools for the couple, Info for the guest).
 *  It reads the same query as the screen: a 404 means "not deployed yet";
 *  for a guest, a closed album hides the row too. */
export function useAlbumAvailable(surface: "guest" | "couple"): boolean {
  const q = useQuery({
    queryKey: surface === "guest" ? GUEST_ALBUM_KEY : COUPLE_ALBUM_KEY,
    queryFn: () => fetchAlbum(surface),
    retry,
    staleTime: 10 * 60_000,
  });
  if (!q.data) return false;
  return surface === "guest" ? q.data.album.enabled && q.data.album.upload : true;
}
