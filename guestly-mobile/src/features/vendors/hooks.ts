// Vendor directory hooks. Couples read and write, planners read.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, del } from "@/lib/api";
import { useUserSession } from "@/lib/session";

export type VendorCategory = "venue" | "catering" | "photo" | "video" | "music" | "flowers" | "decor" | "beauty" | "attire" | "cake" | "transport" | "stationery" | "planner" | "rentals" | "other";
export type VendorStatus = "shortlist" | "contacted" | "quoted" | "booked" | "done" | "cancelled";

export type VendorRow = {
  id: string;
  name: string;
  category: VendorCategory;
  status: VendorStatus;
  contact_name: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  address: string;
  price_quoted: number | null;
  currency: string | null;
  rating: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
};
export type VendorBudgetItem = {
  id: string;
  budget_id: string;
  budget_name: string;
  vendor_id: string | null;
  title: string;
  vendor_text: string;
  total_base: number | null;
  base_currency: string;
};
export type VendorTask = { id: string; vendor_id: string; title: string; status: "open" | "in_progress" | "done" };
export type VendorsSurface = {
  pending: boolean;
  can_edit: boolean;
  vendors: VendorRow[];
  items: VendorBudgetItem[];
  tasks: VendorTask[];
  base_currency: string;
  categories: VendorCategory[];
  statuses: VendorStatus[];
};

export const VENDORS_KEY = "vendors";

export function useVendorsBase(): string {
  const user = useUserSession();
  return user?.me.surface === "planner" ? "/planner/vendors" : "/couple/vendors";
}

export function useVendors() {
  const base = useVendorsBase();
  return useQuery({ queryKey: [VENDORS_KEY, base], queryFn: () => get<VendorsSurface>(base), staleTime: 15_000 });
}

export function useVendorWrites() {
  const qc = useQueryClient();
  const done = () => Promise.all([qc.invalidateQueries({ queryKey: [VENDORS_KEY] }), qc.invalidateQueries({ queryKey: ["budget"] })]);
  const run = async <T>(p: Promise<T>): Promise<T> => {
    const r = await p;
    await done();
    return r;
  };
  return {
    create: (body: Record<string, unknown>) => run(post<{ id: string }>("/couple/vendors", body)),
    update: (id: string, body: Record<string, unknown>) => run(post<{ id: string }>(`/couple/vendors/${id}`, body)),
    remove: (id: string) => run(del<{ id: string }>(`/couple/vendors/${id}`)),
    link: (id: string, item_id: string) => run(post<{ linked: true }>(`/couple/vendors/${id}/link`, { item_id })),
    unlink: (id: string, item_id: string) => run(post<{ linked: false }>(`/couple/vendors/${id}/unlink`, { item_id })),
  };
}

export function waDigits(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  return d.length >= 7 ? d : null;
}

export function websiteHref(website: string): string | null {
  const w = website.trim();
  if (!w) return null;
  if (/^https?:\/\//i.test(w)) return w;
  return `https://${w}`;
}

export function instagramHref(handle: string): string | null {
  const h = handle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
  return h ? `https://instagram.com/${h}` : null;
}
