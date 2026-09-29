// Couple self-serve signup against the portal (docs/mobile-api.md, "Signup").

import { useQuery } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export type SignupStage = "account" | "pending_payment" | "active";

export type SignupStatus = {
  stage: SignupStage;
  email: string;
  lang: "en" | "es";
  wedding: { slug: string; couple_names: string; wedding_date: string | null; city: string | null; country: string | null } | null;
  /** Present only when the app reported the US storefront. */
  activation_url?: string;
  activation_email_at: string | null;
};

/** The email + password typed on /sign-up, kept in memory (never in the URL
 *  or on disk) for /sign-up/verify: its "Send a new code" repeats the call. */
let draft: { email: string; password: string; lang: "en" | "es"; codeLength: number } | null = null;
export function getSignupDraft() {
  return draft;
}
export function clearSignupDraft() {
  draft = null;
}

export async function startSignup(email: string, password: string, lang: "en" | "es"): Promise<number> {
  const res = await post<{ sent: boolean; code_length: number }>("/signup", { email, password, lang });
  const codeLength = res.code_length >= 6 && res.code_length <= 10 ? res.code_length : 8;
  draft = { email, password, lang, codeLength };
  return codeLength;
}

/** Confirms the emailed code. The session it returns fires SIGNED_IN, and the
 *  session provider takes the new account to /setup. */
export async function confirmCode(email: string, code: string): Promise<void> {
  const { error } = await supabase().auth.verifyOtp({ email, token: code, type: "email" });
  if (error) throw error;
}

export type WeddingDraft = {
  partner1: string;
  partner2: string;
  wedding_date: string | null;
  city: string;
  country: string | null;
  lang: "en" | "es";
};

export async function createWedding(input: WeddingDraft): Promise<SignupStatus> {
  const res = await post<{ created: boolean; status: SignupStatus }>("/signup/wedding", input);
  return res.status;
}

export async function resendActivationEmail(): Promise<void> {
  await post<{ sent: boolean }>("/signup/resend-activation", {});
}

export const SIGNUP_STATUS_KEY = "signup-status";

/** The locked home's data. `storefront` is the StoreKit country code or
 *  null; only "USA" makes the portal include activation_url. */
export function useSignupStatus(storefront: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [SIGNUP_STATUS_KEY, storefront ?? "none"],
    queryFn: () => get<SignupStatus>(`/signup/status${storefront ? `?storefront=${encodeURIComponent(storefront)}` : ""}`),
    enabled,
    staleTime: 15_000,
  });
}
