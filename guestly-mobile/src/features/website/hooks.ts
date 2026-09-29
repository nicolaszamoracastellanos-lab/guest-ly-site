// Website builder data: the surface query, a local draft of the config
// with debounced autosave, and the image upload helper.

import { useCallback, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { get, post, ApiFailure } from "@/lib/api";
import { queryClient } from "@/lib/query";
import { useUserSession } from "@/lib/session";
import { prepareImageForUpload } from "@/features/shared/images";
import { postLong, UPLOAD_TIMEOUT_MS } from "@/features/shared/requests";

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

/*
 * One shared draft for every website screen (home, section editors, theme).
 * The query cache holds what the server last confirmed; `pending` holds the
 * edits not yet saved. Each edit is built on pending, or on the latest
 * cached config when nothing is pending, so a screen can never post an old
 * copy over another screen's save. RSVP questions are owned by RSVPs >
 * Questions: a save always carries the cached (server) questions, never the
 * ones the draft started from.
 */
type DraftStore = { pending: WebsiteConfig | null; state: SaveState; error: { en: string; es: string } | null };
let store: DraftStore = { pending: null, state: "idle", error: null };
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;

function emitStore(next: Partial<DraftStore>) {
  store = { ...store, ...next };
  for (const l of listeners) l();
}

function cachedConfig(): WebsiteConfig | null {
  return queryClient.getQueryData<WebsiteSurface>(WEBSITE_KEY)?.config ?? null;
}

/** Keeps the RSVP questions the server has, whatever the draft holds. */
function withServerQuestions(cfg: WebsiteConfig): WebsiteConfig {
  const server = cachedConfig()?.sections.find((sec) => sec.type === "rsvp");
  if (!server || server.type !== "rsvp") return cfg;
  return { ...cfg, sections: cfg.sections.map((sec) => (sec.type === "rsvp" ? { ...sec, questions: server.questions } : sec)) };
}

export async function flushWebsiteDraft(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const pending = store.pending;
  if (!pending) return;
  const gen = generation;
  const cfg = withServerQuestions(pending);
  emitStore({ state: "saving" });
  try {
    await post<{ saved_at: string }>("/couple/website/config", { config: cfg });
    if (gen !== generation) return;
    queryClient.setQueryData<WebsiteSurface>(WEBSITE_KEY, (old) => (old ? { ...old, config: { ...cfg, privacy: old.config.privacy } } : old));
    // Edits made while this save was in flight stay pending (and scheduled).
    emitStore({ pending: store.pending === pending ? null : store.pending, state: store.pending === pending ? "saved" : "dirty", error: null });
  } catch (err) {
    if (gen !== generation) return;
    emitStore({ state: "error", error: err instanceof ApiFailure ? err.messages : { en: "Could not save.", es: "No se pudo guardar." } });
  }
}

function updateWebsiteDraft(fn: (cfg: WebsiteConfig) => WebsiteConfig) {
  const base = store.pending ?? cachedConfig();
  if (!base) return;
  emitStore({ pending: fn(base), state: "dirty" });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushWebsiteDraft(), 900);
}

/** Forgets unsaved website edits: sign-out or a switch to another wedding. */
export function resetWebsiteDraft() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  generation += 1;
  emitStore({ pending: null, state: "idle", error: null });
}

function useDraftStore(): DraftStore {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => store,
    () => store
  );
}

/**
 * The shared website draft. `draft` is the unsaved edits, or the server
 * config when there are none. Edits autosave 900 ms after the last change.
 * `canEdit` is false for read-only roles; `update` then does nothing.
 * Signed URLs for freshly uploaded photos are merged in by `rememberSigned`.
 */
export function useConfigDraft() {
  const qc = useQueryClient();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const { data, isLoading } = useWebsite();
  const { pending, state, error } = useDraftStore();
  const draft = pending ?? data?.config ?? null;

  const update = useCallback(
    (fn: (cfg: WebsiteConfig) => WebsiteConfig) => {
      if (!canEdit) return;
      updateWebsiteDraft(fn);
    },
    [canEdit]
  );

  const rememberSigned = useCallback(
    (path: string, url: string) => {
      qc.setQueryData<WebsiteSurface>(WEBSITE_KEY, (old) => (old ? { ...old, signed: { ...old.signed, [path]: url } } : old));
    },
    [qc]
  );

  return { surface: data, isLoading, draft, update, state, error, flush: flushWebsiteDraft, rememberSigned, canEdit };
}

export function updateSection<TType extends SectionType>(cfg: WebsiteConfig, type: TType, fn: (s: Extract<Section, { type: TType }>) => Extract<Section, { type: TType }>): WebsiteConfig {
  return { ...cfg, sections: cfg.sections.map((s) => (s.type === type ? fn(s as Extract<Section, { type: TType }>) : s)) };
}

export function slugId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export type PickedUpload = { path: string; url: string };

/**
 * Opens the photo library, downscales each pick on the device (2048 px JPEG,
 * about 1.5 MB), uploads it through the portal (private bucket) and returns
 * the gated path to store plus a signed URL to show. Returns null when the
 * user cancels. Throws ApiFailure-like errors.
 */
export async function pickAndUpload(opts?: { allowsMultipleSelection?: boolean }): Promise<PickedUpload[] | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new ApiFailure(0, { code: "no_permission", message_en: "Allow photo access in Settings to pick a picture.", message_es: "Permite el acceso a fotos en Ajustes para elegir una imagen." });
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    base64: false,
    allowsMultipleSelection: opts?.allowsMultipleSelection ?? false,
    selectionLimit: 8,
  });
  if (res.canceled) return null;
  const out: PickedUpload[] = [];
  for (const asset of res.assets) {
    let img: Awaited<ReturnType<typeof prepareImageForUpload>>;
    try {
      img = await prepareImageForUpload(asset);
    } catch {
      throw new ApiFailure(0, { code: "bad_image", message_en: "We could not read that photo. Try another one.", message_es: "No pudimos leer esa foto. Prueba con otra." });
    }
    if (!img.base64) continue;
    const up = await postLong<PickedUpload>("/couple/website/image", { base64: img.base64, mime: img.mime }, UPLOAD_TIMEOUT_MS);
    out.push(up);
  }
  return out;
}
