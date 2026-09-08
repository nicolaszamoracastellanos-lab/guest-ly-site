// Data for the guest-side wedding site. One query, keyed by language, since
// the API resolves every bilingual field server-side.

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import { useLang } from "@/i18n";

export type SiteLink = { label: string | null; url: string };

export type SiteSection =
  | { type: "hero"; names: string; tagline: string | null; date_line: string | null; city: string | null; image_url: string | null }
  | { type: "countdown"; heading: string | null; days: number; hours: number; minutes: number; past: boolean }
  | { type: "story"; heading: string | null; body: string | null; image_url: string | null }
  | { type: "party"; heading: string | null; members: { id: string; name: string; role: string | null; bio: string | null; photo_url: string | null }[] }
  | {
      type: "schedule";
      heading: string | null;
      events: { id: string; title: string; description: string | null; date: string | null; time: string | null; location: string | null; maps_url: string | null; dress_code: string | null; note: string | null; image_url: string | null }[];
    }
  | {
      type: "travel";
      heading: string | null;
      items: { id: string; kind: "hotel" | "venue" | "tip"; title: string | null; body: string | null; url: string | null; map_url: string | null; address: string | null; phone: string | null; promo_code: string | null }[];
    }
  | {
      type: "registry";
      heading: string | null;
      note: string | null;
      mode: "external" | "page" | "hidden";
      external_url: string | null;
      links: SiteLink[];
      items: { id: string; kind: "link" | "image" | "note"; title: string | null; body: string | null; url: string | null; image_url: string | null }[];
    }
  | { type: "faq"; heading: string | null; items: { q: string; a: string }[] }
  | { type: "gallery"; heading: string | null; images: { url: string; caption: string | null }[] }
  | { type: "video"; heading: string | null; provider: "youtube" | "vimeo"; id: string; embed_url: string; url: string }
  | { type: "chat"; heading: string | null; body: string | null; whatsapp_url: string | null; planner_url: string | null; planner_name: string | null }
  | { type: "custom"; id: string; heading: string | null; body: string | null; image_url: string | null };

export type SectionType = SiteSection["type"];

export type GuestSite = {
  published: boolean;
  site_slug: string;
  couple_names: string;
  wedding_date: string | null;
  theme: "night" | "ivory" | "gold";
  lang: "en" | "es";
  hashtag: string | null;
  password_protected: boolean;
  sections: SiteSection[];
  accents: { url: string; alt: string | null }[];
};

export function useGuestSite() {
  const { lang } = useLang();
  return useQuery({
    queryKey: ["guest-site", lang],
    queryFn: () => get<GuestSite>("/guest/site"),
    staleTime: 5 * 60_000,
    retry: (count, err) => !(err instanceof Error && "code" in err && (err as { code?: string }).code === "not_found") && count < 2,
  });
}

/** Sections of the given types, in the couple's order. */
export function sectionsOf<TType extends SectionType>(site: GuestSite | undefined, types: TType[]): Extract<SiteSection, { type: TType }>[] {
  if (!site) return [];
  return site.sections.filter((s): s is Extract<SiteSection, { type: TType }> => (types as string[]).includes(s.type));
}
