// Every URL the system hands the app (launch and while running) passes here
// before expo-router resolves it. Only sign-in returns are touched:
//
//   guestly://auth/callback?code=...            Google on Android, older emails
//   guestly://auth/callback#access_token=...    the portal's fallback page
//   https://app.guest-ly.com/auth/app/callback#access_token=...   universal link
//
// expo-router drops the #fragment that carries the tokens, and the root layout
// clears the launch URL once routed, so the full URL is kept in memory
// (features/signup/social) and the router goes to the plain /auth/callback,
// which reads it. Every other URL goes through unchanged. Never throws: an
// error here would crash the launch.

import { isAuthReturnUrl, setPendingAuthUrl } from "@/features/signup/social";

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (isAuthReturnUrl(path)) {
      setPendingAuthUrl(path);
      return "/auth/callback";
    }
  } catch {
    // fall through to the URL as given
  }
  return path;
}
