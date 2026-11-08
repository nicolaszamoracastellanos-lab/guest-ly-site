// #26 queries. A 404 (flag off, or the couple does not ask for travel) reads
// as null: the entry rows and screens hide, never an error.

import { useQuery } from "@tanstack/react-query";
import { get, isMissingEndpoint } from "@/lib/api";
import { readGuestTravel, type Arrivals, type GuestTravel } from "./core";

async function orNull<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (isMissingEndpoint(err)) return null;
    throw err;
  }
}

export const GUEST_TRAVEL_KEY = ["guest-travel"];

export const useGuestTravel = () =>
  useQuery({
    queryKey: GUEST_TRAVEL_KEY,
    queryFn: () => orNull(async () => readGuestTravel(await get<GuestTravel>("/guest/travel"))),
    staleTime: 60_000,
  });

export const useCoupleArrivals = (enabled = true) =>
  useQuery({ enabled, queryKey: ["couple-arrivals"], queryFn: () => orNull(() => get<Arrivals>("/couple/arrivals")) });

export const usePlannerArrivals = (slug: string | null | undefined) =>
  useQuery({
    enabled: !!slug,
    queryKey: ["planner-arrivals", slug],
    queryFn: () => orNull(() => get<Arrivals>(`/planner/weddings/${encodeURIComponent(slug ?? "")}/arrivals`)),
  });
