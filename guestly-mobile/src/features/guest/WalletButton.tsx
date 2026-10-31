// "Add to Apple Wallet" (iOS) or "Save to Google Wallet" (Android) for a
// guest who is going. It opens the portal's pass link in the browser: Safari
// hands the .pkpass to Wallet, Chrome follows Google's save link. A native
// PassKit module is out of scope (master prompt 8.1).
//
// The button only shows when the portal really has a pass: one HEAD probe per
// guest and day (a 404 means the wallet is not set up on the portal yet, so
// nothing shows rather than a dead button).

import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { API_BASE } from "@/lib/api";
import { useSession } from "@/lib/session";
import { T, Icon, toast } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { GUEST_COPY } from "./copy";
import { walletAvailable, walletKindFor, walletUrl } from "./wallet";

export function WalletButton({ style }: { style?: object }) {
  const g = useFeatureCopy(GUEST_COPY);
  const { lang } = useLang();
  const { state } = useSession();
  const kind = walletKindFor(Platform.OS);
  const slug = state.status === "guest" ? state.tenant.slug : null;
  const guestId = state.status === "guest" ? state.guest.id : null;
  const url = kind && slug && guestId ? walletUrl(API_BASE, kind, slug, guestId, lang) : null;
  const probe = useQuery({
    queryKey: ["wallet-pass", kind, slug, guestId],
    queryFn: async () => {
      const r = await fetch(url as string, { method: "HEAD" });
      return walletAvailable(r.status);
    },
    enabled: !!url,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });
  if (!url || probe.data !== true) return null;
  const label = kind === "apple" ? g.wallet.apple : g.wallet.google;
  return (
    <View style={[{ alignItems: "center", gap: 8 }, style]}>
      <Pressable
        onPress={() => void WebBrowser.openBrowserAsync(url).catch(() => toast(g.wallet.failed, { icon: "warning" }))}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="guest-wallet"
        style={({ pressed }) => [styles.badge, pressed && { opacity: 0.85 }]}
      >
        <Icon name={kind === "apple" ? "apple" : "google"} size={20} color="#ffffff" />
        <T v="button17" color="#ffffff" numberOfLines={1}>
          {label}
        </T>
      </Pressable>
      <T v="meta13" color={colors.ivory55} center>
        {g.wallet.caption}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  // Black, as the wallet badges are on every surface (Apple and Google
  // guidelines); our own type until the official artwork is added.
  badge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 48, paddingHorizontal: 20, borderRadius: radius.chip, backgroundColor: "#000000", borderWidth: 1, borderColor: "rgba(247,243,236,0.24)" },
});
