// Account deletion from the app (App Store guideline 5.1.1(v)). Works in
// every state: no wedding yet (onboarding), locked, or a live wedding. The
// portal deletes the account for real (see its lib/account-deletion).
//
// Sign in with Apple accounts first ask Apple for a fresh authorization code
// so the portal can revoke the Apple token. If the person cancels that sheet,
// nothing is deleted.

import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { post } from "@/lib/api";
import { supabase, supabaseConfigured } from "@/lib/supabase";

async function isAppleAccount(): Promise<boolean> {
  if (Platform.OS !== "ios" || !supabaseConfigured()) return false;
  const { data } = await supabase().auth.getSession();
  const meta = (data.session?.user.app_metadata ?? {}) as { provider?: string; providers?: string[] };
  return meta.provider === "apple" || (meta.providers ?? []).includes("apple");
}

export class DeleteCancelled extends Error {}

export async function deleteMyAccount(): Promise<void> {
  let code: string | null = null;
  if (await isAppleAccount()) {
    try {
      const cred = await AppleAuthentication.signInAsync({ requestedScopes: [] });
      code = cred.authorizationCode ?? null;
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "ERR_REQUEST_CANCELED") throw new DeleteCancelled();
      // Apple unavailable (for example no Apple ID on a simulator): delete anyway.
    }
  }
  await post("/auth/delete-account", code ? { apple_authorization_code: code } : {});
}
