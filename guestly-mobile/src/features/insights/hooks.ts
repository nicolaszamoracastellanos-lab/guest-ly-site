import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

export type InsightsView = {
  totals: {
    guest_messages_window: number;
    unique_guests: number;
    deflection_rate: number | null;
    gaps_window: number;
    gaps_total: number;
    attention_conversations: number;
    window_days: number;
  } | null;
  top_questions: { intent: string; label: string; count: number; previous: number; sample: string | null }[];
  gaps: { question: string; channel: string; created_at: string; occurrences: number }[];
  escalations: {
    question: string;
    guest: string | null;
    channel: string;
    occurrences: number;
    escalated: boolean;
    first_asked: string;
    last_asked: string;
    conversation_id: string | null;
  }[];
  daily: { day: string; web: number; whatsapp: number }[];
};

export const INSIGHTS_KEY = ["couple-insights"];
export const useInsights = () => useQuery({ queryKey: INSIGHTS_KEY, queryFn: () => get<InsightsView>("/couple/insights") });
export const usePlannerInsights = () => useQuery({ queryKey: ["planner-insights"], queryFn: () => get<InsightsView>("/planner/insights") });
