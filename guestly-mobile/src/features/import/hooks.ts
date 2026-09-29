import { postLong, AI_TIMEOUT_MS } from "@/features/shared/requests";

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

// The parse is a model read (the portal route allows 60 s) and the commit
// writes hundreds of rows: both outlast the 20 s default, which reported a
// false "offline" and invited a second, duplicating commit.
export const parseImport = (body: { text: string } | { file_base64: string; filename: string }) => postLong<ParsePreview>("/couple/guests/import/parse", body, AI_TIMEOUT_MS);
export const commitImport = (guests: Omit<DetectedGuest, "duplicate">[]) => postLong<ImportResult>("/couple/guests/import/commit", { guests }, AI_TIMEOUT_MS);
