import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

export type ItineraryEvent = {
  key?: string;
  name?: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  ceremony_location?: string;
  ceremony_maps_url?: string;
  reception_location?: string;
  reception_maps_url?: string;
  dress_code?: string;
  cost?: string;
  maps_url?: string;
  notes?: string;
};

export type WeddingFacts = {
  couple?: { names?: string; wedding_date?: string; location?: string; website?: string; rsvp_link?: string };
  itinerary?: ItineraryEvent[];
  arrival_advice?: string;
  travel?: { international?: string; domestic?: string; visas?: string; notes?: string };
  hotels?: { name?: string; recommended?: boolean; notes?: string }[];
  hotel_areas?: string;
  transportation?: { uber?: string; taxis?: string; recommended_service?: { name?: string; whatsapp?: string; notes?: string; link?: string } };
  planner?: { name?: string; whatsapp?: string; helps_with?: string };
  money?: { currency?: string; exchange_rate?: string; exchanging?: string; tipping?: string };
  weather_packing?: { weather?: string; packing?: string; grooming?: string };
  altitude?: string;
  electricity?: string;
  communication?: string;
  health_safety?: string[];
  restaurants?: string[];
  food_to_try?: string[];
  things_to_do?: { bolivia?: string[]; tarija?: string[] };
  gifts?: string;
  custom_faq?: { question: string; answer: string }[];
  answer_policy?: string[];
};

export type BrainVersion = { version: number; published: boolean; published_at: string | null; updated_at: string | null };

export type BrainView = {
  facts: WeddingFacts;
  live_facts: WeddingFacts | null;
  head_version: number | null;
  published_version: number | null;
  published_at: string | null;
  draft_differs: boolean;
  versions: BrainVersion[];
  engine_configured: boolean;
  preview_available: boolean;
};

export const BRAIN_KEY = ["brain"];

export const useBrain = () => useQuery({ queryKey: BRAIN_KEY, queryFn: () => get<BrainView>("/couple/brain") });
