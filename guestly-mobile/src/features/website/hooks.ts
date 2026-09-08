// Website builder data: the surface query, a local draft of the config
// with debounced autosave, and the image upload helper.

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { get, post, ApiFailure } from "@/lib/api";

export type Bilingual = { en: string | null; es: string | null };
export type WebsiteTheme = "night" | "ivory" | "gold";
export type SectionType = "hero" | "countdown" | "story" | "gallery" | "video" | "schedule" | "travel" | "registry" | "party" | "faq" | "rsvp" | "chat";

export type TravelItem = {
  id: string;
  kind: "hotel" | "venue" | "tip";
  title: Bilingual;
  body: Bilingual;
  url: string | null;
  map_url: string | null;
  address: string | null;
  phone: string | null;
  promo_code: string | null;
};
export type PartyMember = { id: string; name: string; role: Bilingual; bio: Bilingual; photo_url: string | null };
export type RegistryLink = { label: Bilingual; url: string | null };
export type RegistryItem = { id: string; kind: "link" | "image" | "note"; title: Bilingual; body: Bilingual; url: string | null; image_url: string | null; sort: number };
export type GalleryImage = { url: string | null; caption: Bilingual };
export type CustomSection = { id: string; heading: Bilingual; body: Bilingual; photo_url: string | null };
export type FaqItem = { q: Bilingual; a: Bilingual };
export type EventOverride = { hidden: boolean; note: Bilingual; title: Bilingual; description: Bilingual; image_url: string | null };
export type RsvpQuestion = { id: string; kind: "select" | "text"; label: Bilingual; options: { id: string; label: Bilingual }[]; event_id: string | null; required: boolean };

export type Section =
  | { type: "hero"; enabled: boolean; image_url: string | null; names_display: Bilingual; tagline: Bilingual; show_date: boolean; show_city: boolean }
  | { type: "countdown"; enabled: boolean; heading: Bilingual }
  | { type: "story"; enabled: boolean; heading: Bilingual; body: Bilingual; accent_image_url: string | null }
  | { type: "gallery"; enabled: boolean; heading: Bilingual; images: GalleryImage[] }
  | { type: "video"; enabled: boolean; heading: Bilingual; url: string | null }
  | { type: "schedule"; enabled: boolean; heading: Bilingual; show_private_events: boolean; event_overrides: Record<string, EventOverride> }
  | { type: "travel"; enabled: boolean; heading: Bilingual; items: TravelItem[] }
  | { type: "registry"; enabled: boolean; heading: Bilingual; note: Bilingual; links: RegistryLink[] }
  | { type: "party"; enabled: boolean; heading: Bilingual; members: PartyMember[] }
  | { type: "faq"; enabled: boolean; heading: Bilingual; hide_facts_items: boolean; extra_items: FaqItem[] }
  | { type: "rsvp"; enabled: boolean; heading: Bilingual; body: Bilingual; questions: RsvpQuestion[] }
  | { type: "chat"; enabled: boolean; heading: Bilingual; body: Bilingual };

export type WaLink = { enabled: boolean; number: string | null; prefill_en: string | null; prefill_es: string | null };

export type WebsiteConfig = {
  version: 1;
  sections: Section[];
  photo_accents: { url: string | null; alt: Bilingual }[];
  seo: { title: string | null; description: Bilingual; og_image_url: string | null };
  footer_hashtag: string | null;
  custom_sections: CustomSection[];
  site_slug: string | null;
  privacy: { require_password: boolean; password_hash: null; password_salt: null; noindex: boolean };
  reminders: Record<string, unknown>;
  registry: { mode: "external" | "page" | "hidden"; external_url: string | null; items: RegistryItem[] };
  chat: { whatsapp: WaLink; planner: WaLink & { name: string | null } };
  notifications: Record<string, unknown>;
  tasks: Record<string, unknown>;
};

export type ThemeSwatch = { key: WebsiteTheme; bg: string; text: string; accent: string; soft: string };

export type WebsiteSurface = {
  config: WebsiteConfig;
  theme: WebsiteTheme;
  themes: ThemeSwatch[];
  published: boolean;
  has_password: boolean;
  site_slug: string;
  public_url: string;
  preview_url: string;
  bot_live: boolean;
  signed: Record<string, string>;
  inherited: {
    names: string | null;
    date_display: string | null;
    city: string | null;
    events: { id: string; name: string; meta: string; description: string | null; is_private: boolean }[];
    faq: { question: string; answer: string }[];
    registry_note: string | null;
    travel_fallback: { title: string; body: string | null; map_url: string | null; kind: string }[];
  };
};

export const WEBSITE_KEY = ["website"] as const;

export function useWebsite() {
  return useQuery({ queryKey: WEBSITE_KEY, queryFn: () => get<WebsiteSurface>("/couple/website"), staleTime: 15_000 });
}

/** A signed URL for a gated image path, or the path itself when absolute. */
export function imageUri(path: string | null | undefined, signed: Record<string, string> | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return signed?.[path] ?? null;
}

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

/**
 * A local copy of the config that autosaves 900 ms after the last change.
 * The surface query is patched in place on success so other screens see
 * the new value without a refetch; signed URLs for freshly uploaded photos
 * are merged in by `rememberSigned`.
 */
export function useConfigDraft() {
  const qc = useQueryClient();
  const { data, isLoading } = useWebsite();
  const [draft, setDraft] = useState<WebsiteConfig | null>(null);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<{ en: string; es: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<WebsiteConfig | null>(null);

  useEffect(() => {
    if (data && !latest.current) {
      latest.current = data.config;
      setDraft(data.config);
    }
  }, [data]);

  const flush = useCallback(async () => {
    const cfg = latest.current;
    if (!cfg) return;
    setState("saving");
    try {
      await post<{ saved_at: string }>("/couple/website/config", { config: cfg });
      qc.setQueryData<WebsiteSurface>(WEBSITE_KEY, (old) => (old ? { ...old, config: cfg } : old));
      setState("saved");
      setError(null);
    } catch (err) {
      setState("error");
      setError(err instanceof ApiFailure ? err.messages : { en: "Could not save.", es: "No se pudo guardar." });
    }
  }, [qc]);

  const update = useCallback(
    (fn: (cfg: WebsiteConfig) => WebsiteConfig) => {
      const base = latest.current;
      if (!base) return;
      const next = fn(base);
      latest.current = next;
      setDraft(next);
      setState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 900);
    },
    [flush]
  );

  const rememberSigned = useCallback(
    (path: string, url: string) => {
      qc.setQueryData<WebsiteSurface>(WEBSITE_KEY, (old) => (old ? { ...old, signed: { ...old.signed, [path]: url } } : old));
    },
    [qc]
  );

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void flush();
      }
    },
    [flush]
  );

  return { surface: data, isLoading, draft, update, state, error, flush, rememberSigned };
}

export function updateSection<TType extends SectionType>(cfg: WebsiteConfig, type: TType, fn: (s: Extract<Section, { type: TType }>) => Extract<Section, { type: TType }>): WebsiteConfig {
  return { ...cfg, sections: cfg.sections.map((s) => (s.type === type ? fn(s as Extract<Section, { type: TType }>) : s)) };
}

export function slugId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const MAX_B64 = 4_200_000;

export type PickedUpload = { path: string; url: string };

/**
 * Opens the photo library, uploads the pick through the portal (private
 * bucket) and returns the gated path to store plus a signed URL to show.
 * Returns null when the user cancels. Throws ApiFailure-like errors.
 */
export async function pickAndUpload(opts?: { allowsMultipleSelection?: boolean }): Promise<PickedUpload[] | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new ApiFailure(0, { code: "no_permission", message_en: "Allow photo access in Settings to pick a picture.", message_es: "Permita el acceso a fotos en Ajustes para elegir una imagen." });
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.6,
    base64: true,
    allowsMultipleSelection: opts?.allowsMultipleSelection ?? false,
    selectionLimit: 8,
  });
  if (res.canceled) return null;
  const out: PickedUpload[] = [];
  for (const asset of res.assets) {
    if (!asset.base64) continue;
    if (asset.base64.length > MAX_B64) {
      throw new ApiFailure(0, { code: "too_big", message_en: "That photo is too large. Choose one under 4 MB.", message_es: "Esa foto es demasiado grande. Elija una de menos de 4 MB." });
    }
    const up = await post<PickedUpload>("/couple/website/image", { base64: asset.base64, mime: asset.mimeType ?? "image/jpeg" });
    out.push(up);
  }
  return out;
}
