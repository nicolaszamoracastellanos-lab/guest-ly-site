import { useQuery } from "@tanstack/react-query";
import { get, post } from "@/lib/api";

export type Bilingual = { en: string | null; es: string | null };
export type RsvpQuestionOption = { id: string; label: Bilingual };
export type RsvpQuestion = {
  id: string;
  kind: "select" | "text";
  label: Bilingual;
  options: RsvpQuestionOption[];
  event_id: string | null;
  required: boolean;
};
export type QuestionEvent = { id: string; title: { en: string; es: string }; date: string | null };

export const useRsvpQuestions = () =>
  useQuery({ queryKey: ["rsvp-questions"], queryFn: () => get<{ questions: RsvpQuestion[]; events: QuestionEvent[] }>("/couple/rsvps/questions") });

export const saveRsvpQuestions = (questions: RsvpQuestion[]) => post<{ questions: RsvpQuestion[] }>("/couple/rsvps/questions", { questions });

export function slug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `q_${Date.now().toString(36)}`
  );
}

/** A slug id that is not already in `taken`: "diet", then "diet_2", "diet_3".
 *  Two questions (or two options) with the same label used to share an id,
 *  which merged their answers and duplicated React keys. */
export function uniqueSlug(text: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slug(text);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}
