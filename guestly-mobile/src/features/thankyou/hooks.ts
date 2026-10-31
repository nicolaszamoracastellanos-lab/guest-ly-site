// Thank-you list data (portal wave D2: /thankyou). Built against the contract
// in docs/hh/SCREENS-PLAN.md section 8 before the mobile routes exist; while
// the portal answers 404 the Tools row and the screens hide.
//
//   GET  /couple/thankyou                   { items, source: "checkin" | "confirmed" }
//   POST /couple/thankyou/{guest_id}/draft  -> { draft }   (the server writes it; the app never talks to a model)
//   POST /couple/thankyou/{guest_id}        { draft?, done? }

import { useQuery } from "@tanstack/react-query";
import { get, isMissingEndpoint } from "@/lib/api";
import { normalizeItems, type ThankyouItem } from "./logic";

export type ThankyouList = { items: ThankyouItem[]; source: "checkin" | "confirmed" };

export const THANKYOU_KEY = ["couple-thankyou"] as const;

export function useThankyou(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: THANKYOU_KEY,
    enabled: opts.enabled ?? true,
    queryFn: async (): Promise<ThankyouList> => {
      const r = await get<Record<string, unknown>>("/couple/thankyou");
      return { items: normalizeItems(r.items), source: r.source === "checkin" ? "checkin" : "confirmed" };
    },
    retry: (n, err) => !isMissingEndpoint(err) && n < 2,
    staleTime: 30_000,
  });
}

/** The Tools row: from the wedding day on, and only once the portal has the route. */
export function useThankyouAvailable(afterWedding: boolean): boolean {
  const q = useThankyou({ enabled: afterWedding });
  return afterWedding && !!q.data;
}
