// In-app web view. Used only for the wedding site preview and the help
// guide; every other capability is native. Params:
//   url    absolute portal URL (public site or preview) OR
//   path   a portal path that needs the couple's session (bridge signs in)
//   title  header title
// Anything off the portal origin is refused, so this can never become a
// general browser.
//
// Part 9 audit (D-019, D-037). The fence is tighter than the origin now:
//  - `path` must be on the allow-list in bridge.ts (the two guides);
//  - inside the view, navigation stays under the page that was opened. The
//    portal draws its own header and navigation around the guide; a small style
//    sheet hides them, in-page links to other rooms are swallowed, and a route
//    change that still gets through is sent back;
//  - the guide follows the app language (the portal reads a gl_lang_ui cookie);
//  - a refused page offers Back, not a Try again that cannot help.

import React, { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLang } from "@/i18n";
import { ApiFailure } from "@/lib/api";
import { TopBar, IconButton, T, EmptyState, Button, useTopInset } from "@/ui";
import { colors, COLUMN } from "@/ui/tokens";
import { allowedSignedInPath, isPortalUrl, isWithin, signedInUrl } from "@/features/webview/bridge";
import { useSafeBack } from "@/lib/nav";

const COPY = {
  en: { loading: "Opening", refused: "That page is not part of Guest-ly.", failed: "Could not open the page.", retry: "Try again", reload: "Reload", back: "Go back" },
  es: { loading: "Abriendo", refused: "Esa página no es parte de Guest-ly.", failed: "No se pudo abrir la página.", retry: "Intentar de nuevo", reload: "Recargar", back: "Volver" },
};

export default function InAppWeb() {
  const { lang } = useLang();
  const c = COPY[lang];
  const back = useSafeBack();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const params = useLocalSearchParams<{ url?: string; path?: string; title?: string }>();
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const [fence, setFence] = useState<string[]>([]);
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
      setRefused(false);
      setTarget(null);
      try {
        const path = allowedSignedInPath(params.path);
        if (params.path && path) {
          const u = await signedInUrl(path);
          if (alive) {
            setFence(["/auth/mobile", path]);
            setTarget(u);
          }
        } else if (!params.path && params.url && isPortalUrl(params.url)) {
          // A public or preview wedding site: stay under its first path segment.
          const first = new URL(params.url).pathname.split("/").filter(Boolean)[0];
          setFence([first ? `/${first}` : "/"]);
          setTarget(params.url);
        } else {
          setRefused(true);
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

  const signedIn = !!params.path;

  function guard(nav: { url: string }): boolean {
    if (nav.url.startsWith("about:")) return true;
    if (nav.url.startsWith("mailto:")) {
      void Linking.openURL(nav.url).catch(() => {});
      return false;
    }
    // A dead or expired bridge link lands on the portal login: say so calmly.
    if (isPortalUrl(nav.url) && new URL(nav.url).pathname.startsWith("/login")) {
      setError(c.failed);
      return false;
    }
    return isWithin(nav.url, fence);
  }

  // Client-side route changes never reach `guard`; send those back.
  function watch(nav: WebViewNavigation) {
    if (!nav.url || nav.url.startsWith("about:") || isWithin(nav.url, fence)) return;
    ref.current?.injectJavaScript("history.length > 1 ? history.back() : null; true;");
  }

  // Runs before the page paints. Signed-in pages only: hide the portal frame,
  // keep links inside the fence, and make the page follow the app language.
  const home = fence[fence.length - 1] ?? "/";
  const injected = signedIn
    ? `(function(){
        try {
          var want=${JSON.stringify(lang)};
          var m=document.cookie.match(/(?:^|;\\s*)gl_lang_ui=(en|es)/);
          if(!m||m[1]!==want){document.cookie='gl_lang_ui='+want+'; path=/; max-age=31536000; SameSite=Lax'; if(location.pathname.indexOf('/auth/')!==0){location.reload();}}
          var css='body aside, body header, body nav{display:none !important} body main{margin-left:0 !important;padding-top:16px !important;padding-bottom:32px !important}';
          var add=function(){if(document.getElementById('gl-embed'))return;var st=document.createElement('style');st.id='gl-embed';st.appendChild(document.createTextNode(css));(document.head||document.documentElement).appendChild(st);};
          add();document.addEventListener('DOMContentLoaded',add);
          var home=${JSON.stringify(home)};
          document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var h=a.getAttribute('href')||'';if(h.indexOf('mailto:')===0||h.charAt(0)==='#')return;var u;try{u=new URL(h,location.href);}catch(_){return;}if(u.origin!==location.origin||(u.pathname!==home&&u.pathname.indexOf(home+'/')!==0)){e.preventDefault();e.stopPropagation();}},true);
        } catch(_){}
      })(); true;`
    : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.night, paddingTop: top, paddingBottom: error ? insets.bottom : 0 }}>
      <View style={COLUMN}>
        <TopBar onBack={back} title={params.title ?? "Guest-ly"} right={error ? undefined : <IconButton name="undo" label={c.reload} onPress={() => ref.current?.reload()} />} />
      </View>
      {error ? (
        <View style={[COLUMN, { padding: 24 }]}>
          <EmptyState title={error} action={refused ? <Button label={c.back} small kind="glass" onPress={back} /> : <Button label={c.retry} small onPress={() => setAttempt((n) => n + 1)} />} />
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
          onNavigationStateChange={watch}
          injectedJavaScriptBeforeContentLoaded={injected}
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
