// The guest's wallet pass links (portal wave E1): Apple Wallet serves the
// .pkpass at /api/wallet/apple/{slug}?g={guestId}, Google Wallet redirects to
// its save link from /api/wallet/google/{slug}?g={guestId}. The guest id is
// the credential, the same bearer model as the web pass page. Pure.

export type WalletKind = "apple" | "google";

/** iOS gets Apple Wallet, Android Google Wallet, anything else nothing. */
export function walletKindFor(os: string): WalletKind | null {
  return os === "ios" ? "apple" : os === "android" ? "google" : null;
}

export function walletUrl(base: string, kind: WalletKind, slug: string, guestId: string, lang: "en" | "es"): string {
  const q = new URLSearchParams({ g: guestId, lang });
  return `${base.replace(/\/+$/, "")}/api/wallet/${kind}/${encodeURIComponent(slug)}?${q.toString()}`;
}

/** Whether a probe answer means the pass exists: a 404 is "wallet not set up
 *  yet" (no certificate on the portal) or an unknown guest, a 5xx a failure;
 *  a 200 (Apple) or a redirect (Google) is a pass. */
export function walletAvailable(status: number): boolean {
  return (status >= 200 && status < 400) || status === 0;
}
