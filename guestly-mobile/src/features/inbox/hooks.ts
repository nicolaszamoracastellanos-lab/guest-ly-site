import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

export type Sentiment = "positive" | "neutral" | "negative" | "frustrated";

export type InboxItem = {
  id: string;
  channel: string;
  name: string;
  initials: string;
  preview: string;
  last_at: string;
  needs_you: boolean;
  upset: boolean;
  guest_id: string | null;
  sentiment: Sentiment;
  has_gap: boolean;
  message_count: number;
  lang: string | null;
};

export type TranscriptLine = {
  id: string;
  role: "guest" | "bot" | "couple";
  text: string;
  created_at: string;
  is_gap: boolean;
  gap_question: string | null;
  sentiment: Sentiment | null;
  needs_couple: boolean;
};

export type ConversationDetail = {
  id: string;
  channel: string;
  name: string;
  initials: string;
  guest_id: string | null;
  lang: string | null;
  started_at: string;
  last_message_at: string;
  sentiment: Sentiment;
  gap_count: number;
  open_events: number;
  whatsapp_link: string | null;
  can_reply_in_app: boolean;
  messages: TranscriptLine[];
};

export const useInboxList = (filter: string) =>
  useQuery({
    queryKey: ["couple-inbox", filter],
    queryFn: () => get<{ items: InboxItem[]; needs_you: number }>(`/couple/messages?filter=${filter}`),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });

export const useConversation = (id: string) =>
  useQuery({ queryKey: ["couple-conversation", id], queryFn: () => get<ConversationDetail>(`/couple/messages/${id}`), refetchInterval: 20_000, enabled: !!id });
