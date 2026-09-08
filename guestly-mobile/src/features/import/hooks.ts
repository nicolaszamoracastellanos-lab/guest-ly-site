import { post } from "@/lib/api";

export type DetectedGuest = {
  name: string;
  phone: string | null;
  email: string | null;
  party_size: number;
  members: string[];
  tags: string[];
  notes: string | null;
  language: "en" | "es" | null;
  rsvp: "attending" | "declined" | null;
  duplicate: boolean;
};

export type ParsePreview = {
  guests: DetectedGuest[];
  mapping: Record<string, string>;
  skipped: number;
  total: number;
  truncated: boolean;
  duplicates: number;
};

export type ImportResult = { ok: true; imported: number; rsvpsRecorded: number };

export const parseImport = (body: { text: string } | { file_base64: string; filename: string }) => post<ParsePreview>("/couple/guests/import/parse", body);
export const commitImport = (guests: Omit<DetectedGuest, "duplicate">[]) => post<ImportResult>("/couple/guests/import/commit", { guests });
