// Sign in with Apple and Google, shared by /sign-in and /sign-up. The same
// call signs an existing person in or, for a new couple, creates the account:
// Supabase creates the auth user and the session provider then finds no
// wedding and routes to /setup.
//
// First-time Apple or Google accounts need Supabase Auth "Allow new users to
// sign up" switched on. When it is off, Supabase answers signup_disabled and
// the screens say so and point to email signup (authErrorKind).

import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";

/** Apple sends the person's name on the FIRST authorization only. Kept for
 *  this launch so the wedding setup can start with it filled in. */
let socialGivenName: string | null = null;
export function takeSocialGivenName(): string | null {
  return socialGivenName;
}

export function authRedirectUrl(): string {
  return Linking.createURL("auth/callback");
}

export async function signInWithApple(): Promise<void> {
  const nonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
    nonce: hashed,
  });
  if (!cred.identityToken) throw Object.assign(new Error("apple_no_token"), { code: "apple_no_token" });
  if (cred.fullName?.givenName) socialGivenName = cred.fullName.givenName;
  const { error } = await supabase().auth.signInWithIdToken({ provider: "apple", token: cred.identityToken, nonce });
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = authRedirectUrl();
  const { data, error } = await supabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) throw error ?? new Error("google_no_url");
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== "success") return;
  await completeAuthFromUrl(res.url);
}

/** Finishes a sign-in from a redirect URL: a PKCE ?code=, or (older links,
 *  implicit flow) tokens in the #fragment, or an ?error= / #error=. */
export async function completeAuthFromUrl(url: string): Promise<void> {
  const query = new URLSearchParams(url.split("?")[1]?.split("#")[0] ?? "");
  const frag = new URLSearchParams(url.split("#")[1] ?? "");
  const errorCode = query.get("error_code") ?? frag.get("error_code") ?? query.get("error") ?? frag.get("error");
  if (errorCode) throw Object.assign(new Error(errorCode), { code: errorCode });
  const code = query.get("code");
  if (code) {
    const { error } = await supabase().auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }
  const access = frag.get("access_token");
  const refresh = frag.get("refresh_token");
  if (access && refresh) {
    const { error } = await supabase().auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) throw error;
    return;
  }
  throw Object.assign(new Error("no_auth_params"), { code: "no_auth_params" });
}

export type AuthErrorKind = "cancel" | "rate" | "invalid" | "no_account" | "signup_disabled" | "network" | "unknown";

/** Supabase and Apple errors, sorted into what the screens can say. Never
 *  shows the provider's raw English message (Part 9 audit, D-026). */
export function authErrorKind(err: unknown): AuthErrorKind {
  const e = (err ?? {}) as { message?: string; status?: number; code?: string; name?: string };
  const text = `${e.code ?? ""} ${e.message ?? ""} ${e.name ?? ""}`.toLowerCase();
  if (text.includes("err_request_canceled") || text.includes("cancel")) return "cancel";
  if (text.includes("signup_disabled") || text.includes("signups not allowed")) return "signup_disabled";
  if (e.status === 429 || text.includes("rate limit") || text.includes("too many") || text.includes("over_request")) return "rate";
  if (text.includes("invalid login") || text.includes("invalid_credentials") || text.includes("invalid_grant")) return "invalid";
  if (text.includes("user not found") || text.includes("otp_disabled")) return "no_account";
  if (e.status === 0 || text.includes("network") || text.includes("fetch") || text.includes("timeout") || text.includes("offline")) return "network";
  return "unknown";
}

export const appleAvailable = Platform.OS === "ios";
