// Sign in with Apple and Google, shared by /sign-in and /sign-up. The same
// call signs an existing person in or, for a new couple, creates the account:
// Supabase creates the auth user and the session provider then finds no
// wedding and routes to /setup.
//
// First-time Apple or Google accounts need Supabase Auth "Allow new users to
// sign up" switched on. When it is off, Supabase answers signup_disabled and
// the screens say so and point to email signup (authErrorKind).

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { post, ApiFailure } from "@/lib/api";

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

// ---------------------------------------------------------------------------
// Emailed sign-in (build 13). The portal sends ONE email with a link and an
// 8-digit code (POST /auth/email-link). The link carries the tokens in its
// #fragment, so it does not depend on a PKCE verifier saved by this install
// (the old link failed after a reinstall or from another app's browser). On
// another device, or when the link does not open the app, the person types
// the code here instead. A new email replaces the previous link and code.

export const EMAIL_CODE_LENGTH = 8;

/** A sign-in the person started on this phone (a link opened, a code typed).
 *  The session provider uses it to tell a real sign-in that lands during the
 *  launch from auth-js restoring the saved session (lib/session). */
let interactiveAt = 0;
export function noteInteractiveSignIn(): void {
  interactiveAt = Date.now();
}
export function interactiveSignInRecent(withinMs = 2 * 60_000): boolean {
  return Date.now() - interactiveAt < withinMs;
}

// The address the last email went to, so the code step survives the app being
// closed while the person reads their mail, and the "link did not work" screen
// can go straight to the code. Only the address and the time; never the code.
const K_EMAIL_LINK = "gl.signin.emailLink";
const PENDING_FOR_MS = 15 * 60_000;

export async function rememberEmailSignIn(email: string | null): Promise<void> {
  try {
    if (email) await AsyncStorage.setItem(K_EMAIL_LINK, JSON.stringify({ email, at: Date.now() }));
    else await AsyncStorage.removeItem(K_EMAIL_LINK);
  } catch {
    // storage is a convenience here
  }
}

export async function pendingEmailSignIn(withinMs = PENDING_FOR_MS): Promise<{ email: string; at: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(K_EMAIL_LINK);
    if (!raw) return null;
    const v = JSON.parse(raw) as { email?: unknown; at?: unknown };
    if (typeof v.email !== "string" || typeof v.at !== "number" || Date.now() - v.at > withinMs) return null;
    return { email: v.email, at: v.at };
  } catch {
    return null;
  }
}

// An emailed link stays valid for an hour (Supabase mailer_otp_exp 3600).
export const LINK_VALID_MS = 60 * 60_000;

/** The email claim of a Supabase access token, without verifying it (the
 *  server does that on setSession); only used to match the pending address. */
function tokenEmail(accessToken: string): string | null {
  try {
    const part = accessToken.split(".")[1] ?? "";
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const claims = JSON.parse(globalThis.atob(b64)) as { email?: unknown };
    return typeof claims.email === "string" ? claims.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Sends the sign-in email. The portal always answers ok (it never says
 *  whether an account exists). A portal without the route yet (404) falls
 *  back to the Supabase email, whose link only works on this phone. */
export async function sendEmailSignIn(email: string, lang: "en" | "es"): Promise<void> {
  try {
    await post<unknown>("/auth/email-link", { email, lang }, { credential: { kind: "none" }, handleAuth: false });
  } catch (err) {
    if (!(err instanceof ApiFailure) || err.status !== 404) throw err;
    const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: false } });
    if (error) throw error;
  }
  await rememberEmailSignIn(email);
}

/** Signs in with the 8-digit code from the email (mirrors confirmCode in
 *  features/signup/api). SIGNED_IN follows and the session provider takes over. */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  noteInteractiveSignIn();
  const { error } = await supabase().auth.verifyOtp({ email, token: code, type: "email" });
  if (error) throw error;
  await rememberEmailSignIn(null);
}

// ---------------------------------------------------------------------------
// Links back into the app. Both guestly://auth/callback... and the universal
// link https://app.guest-ly.com/auth/app/callback... are caught in
// app/+native-intent, which keeps the FULL url here (expo-router drops the
// #fragment, and the root layout clears the launch URL) and routes to
// /auth/callback, which reads it. Tokens never go into the route params.

let pendingAuthUrl: string | null = null;
const authUrlListeners = new Set<() => void>();

function authPath(url: string): string | null {
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^?#]*)/i.exec(url);
  if (!m) return null;
  let rest = m[2];
  if (m[1].toLowerCase() === "https") {
    const slash = rest.indexOf("/");
    const host = (slash < 0 ? rest : rest.slice(0, slash)).toLowerCase();
    if (host !== "app.guest-ly.com") return null;
    rest = slash < 0 ? "" : rest.slice(slash + 1);
  } else if (m[1].toLowerCase() === "http") {
    return null;
  }
  return rest.replace(/^\/+|\/+$/g, "").toLowerCase();
}

/** guestly://auth/callback or https://app.guest-ly.com/auth/app/callback. */
export function isAuthReturnUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const p = authPath(url);
  return p === "auth/callback" || p === "auth/app/callback";
}

export function setPendingAuthUrl(url: string): void {
  pendingAuthUrl = url;
  authUrlListeners.forEach((l) => l());
}
export function peekPendingAuthUrl(): string | null {
  return pendingAuthUrl;
}
export function subscribePendingAuthUrl(listener: () => void): () => void {
  authUrlListeners.add(listener);
  return () => {
    authUrlListeners.delete(listener);
  };
}

const OTP_TYPES = ["email", "magiclink", "signup", "invite", "recovery", "email_change"] as const;
type OtpType = (typeof OTP_TYPES)[number];

/** Finishes a sign-in from a redirect URL: a PKCE ?code=, a ?token_hash=,
 *  tokens in the #fragment (the emailed link), or an ?error= / #error=. */
export async function completeAuthFromUrl(url: string): Promise<void> {
  const query = new URLSearchParams(url.split("?")[1]?.split("#")[0] ?? "");
  const frag = new URLSearchParams(url.split("#")[1] ?? "");
  const errorCode = query.get("error_code") ?? frag.get("error_code") ?? query.get("error") ?? frag.get("error");
  if (errorCode) throw Object.assign(new Error(errorCode), { code: errorCode });
  noteInteractiveSignIn();
  const code = query.get("code");
  if (code) {
    const { error } = await supabase().auth.exchangeCodeForSession(code);
    if (error) throw error;
    await rememberEmailSignIn(null);
    return;
  }
  // A link that carries ready-made credentials only counts when this phone
  // asked for it: otherwise any web page could open guestly://auth/callback
  // with someone else's tokens and sign this phone into that account. A PKCE
  // ?code= needs no such check (its verifier only exists on this install).
  const pending = await pendingEmailSignIn(LINK_VALID_MS);
  const tokenHash = query.get("token_hash") ?? frag.get("token_hash");
  if (tokenHash) {
    if (!pending) throw Object.assign(new Error("not_started_here"), { code: "not_started_here" });
    const raw = query.get("type") ?? frag.get("type") ?? "email";
    const type: OtpType = (OTP_TYPES as readonly string[]).includes(raw) ? (raw as OtpType) : "email";
    const { data, error } = await supabase().auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) throw error;
    // The hash names no address before it is spent: if it signed in someone
    // other than the address this phone asked for, undo it at once.
    if ((data.user?.email ?? "").toLowerCase() !== pending.email.trim().toLowerCase()) {
      await supabase().auth.signOut({ scope: "local" });
      throw Object.assign(new Error("not_started_here"), { code: "not_started_here" });
    }
    await rememberEmailSignIn(null);
    return;
  }
  const access = frag.get("access_token");
  const refresh = frag.get("refresh_token");
  if (access && refresh) {
    if (!pending || tokenEmail(access) !== pending.email.trim().toLowerCase()) {
      throw Object.assign(new Error("not_started_here"), { code: "not_started_here" });
    }
    const { error } = await supabase().auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) throw error;
    await rememberEmailSignIn(null);
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
