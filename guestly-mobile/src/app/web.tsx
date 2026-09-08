// In-app web view. Used only for the wedding site preview and the help
// guide; every other capability is native. Params:
//   url    absolute portal URL (public site or preview) OR
//   path   a portal path that needs the couple's session (bridge signs in)
//   title  header title
// Anything off the portal origin is refused, so this can never become a
// general browser.

import React, { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLang } from "@/i18n";
import { ApiFailure } from "@/lib/api";
import { TopBar, IconButton, T, EmptyState, Button } from "@/ui";
import { colors } from "@/ui/tokens";
import { isPortalUrl, signedInUrl } from "@/features/webview/bridge";

const COPY = {
  en: { loading: "Opening", refused: "That page is not part of Guest-ly.", failed: "Could not open the page.", retry: "Try again", reload: "Reload" },
  es: { loading: "Abriendo", refused: "Esa página no es parte de Guest-ly.", failed: "No se pudo abrir la página.", retry: "Intentar de nuevo", reload: "Recargar" },
};

export default function InAppWeb() {
  const { lang } = useLang();
  const c = COPY[lang];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string; path?: string; title?: string }>();
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const ref = useRef<WebView>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Resolved on the next tick so the effect body itself sets no state.
      await Promise.resolve();
      if (!alive) return;
      setError(null);
      setTarget(null);
      try {
        if (params.path) {
          const u = await signedInUrl(params.path);
          if (alive) setTarget(u);
        } else if (params.url && isPortalUrl(params.url)) {
          setTarget(params.url);
        } else {
          setError(c.refused);
        }
      } catch (err) {
        if (alive) setError(err instanceof ApiFailure ? err.messages[lang] : c.failed);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.path, params.url, attempt, lang, c.refused, c.failed]);

  function guard(nav: WebViewNavigation): boolean {
    if (isPortalUrl(nav.url)) return true;
    return false;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.night, paddingTop: Math.max(insets.top, 54) }}>
      <TopBar onBack={() => router.back()} title={params.title ?? "Guest-ly"} right={<IconButton name="undo" label={c.reload} onPress={() => ref.current?.reload()} />} />
      {error ? (
        <View style={{ padding: 24 }}>
          <EmptyState title={error} action={<Button label={c.retry} small onPress={() => setAttempt((n) => n + 1)} />} />
        </View>
      ) : null}
      {target && !error ? (
        <WebView
          ref={ref}
          source={{ uri: target }}
          style={{ flex: 1, backgroundColor: colors.night }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setError(c.failed)}
          onShouldStartLoadWithRequest={guard}
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          sharedCookiesEnabled
          incognito={false}
        />
      ) : null}
      {loading && !error ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 120, left: 0, right: 0, alignItems: "center", gap: 8 }}>
          <ActivityIndicator color={colors.goldLight} />
          <T v="meta13" color={colors.ivory55}>
            {c.loading}
          </T>
        </View>
      ) : null}
    </View>
  );
}
