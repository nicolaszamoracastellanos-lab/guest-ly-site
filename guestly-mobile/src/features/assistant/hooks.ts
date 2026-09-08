import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { ActionCard } from "./stream";

export type AssistantSurface = "couple" | "planner";

export type SessionSummary = { id: string; title: string | null; last_active_at: string; created_at: string };

export type TimelineItem =
  | { kind: "user"; text: string }
  | { kind: "coordinator"; text: string }
  | { kind: "tools"; names: string[] }
  | { kind: "card"; card: ActionCard };

export function coordinatorBase(surface: AssistantSurface): string {
  return surface === "planner" ? "/planner/coordinator" : "/couple/coordinator";
}

export function useAssistantSessions(surface: AssistantSurface, enabled = true) {
  return useQuery({
    queryKey: ["assistant-sessions", surface],
    queryFn: () => get<{ enabled: boolean; sessions: SessionSummary[] }>(`${coordinatorBase(surface)}/sessions`),
    enabled,
    staleTime: 30_000,
  });
}

export function useAssistantSession(surface: AssistantSurface, id: string | null) {
  return useQuery({
    queryKey: ["assistant-session", surface, id],
    queryFn: () => get<{ session: SessionSummary; items: TimelineItem[] }>(`${coordinatorBase(surface)}/sessions/${id}`),
    enabled: !!id,
    staleTime: 10_000,
  });
}
