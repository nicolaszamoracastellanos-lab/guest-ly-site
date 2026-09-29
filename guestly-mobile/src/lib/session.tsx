// Session state for the whole app.
//
//   guest    signed guest token in SecureStore + the wedding summary
//   user     Supabase session (couple or planner) + the /auth/me payload
//   onboarding  Supabase session for a couple account with no wedding yet
//            (new signup, or a first Sign in with Apple / Google): /setup
//   none     entrance
//
// Rules (core review, Sep 29 2026):
// - Nothing that belongs to one person is shown to the next. Sign out, a new
//   guest identity and a 401 run resetUserScopedState() (lib/scope); a wedding
//   switch empties the query cache. The push token is unregistered with the
//   OLD credential before the credential changes.
// - A wedding is committed only after /auth/me answers for it: the tenant
//   header and the saved preference never point at a wedding the screen is
//   not showing (P0-4).
// - The last /auth/me payload is saved per user, so a cold start opens at once
//   and offline, and refreshes in the background. Only a real 401 signs out;
//   a network error keeps the saved session (P1-8).
// - The API asks Supabase for the live token on every request (lib/api), so
//   an expired JWT after an hour away refreshes instead of signing out (P1-6).
// - The boot runs once; a language change does not re-run it (P1-13).

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "@/lib/secure";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import { api, ApiFailure, setAuthHandlers, setCredential, setTokenSource, type Credential } from "@/lib/api";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { bindCacheScope, clearQueryCache } from "@/lib/query";
import { loadPushPrefs, registerPush, unregisterPush, type Surface } from "@/lib/push";
import { resetUserScopedState, runScopedResets, setStorageScope } from "@/lib/scope";
import { setLockSnapshot } from "@/lib/lock";
import { useLang } from "@/i18n";

export type TenantSummary = {
  slug: string;
  site_slug: string;
  couple_names: string;
  wedding_date: string | null;
  timezone: string;
  locale_default: "en" | "es";
  hero_image_url: string | null;
  city: string | null;
  status: string;
  tier: string;
};

export type Me = {
  user: { id: string; email: string };
  role: string;
  surface: "couple" | "planner";
  can_edit: boolean;
  tenant: {
    slug: string;
    couple_names: string;
    wedding_date: string | null;
    tier: string;
    status: string;
    locale_default: string;
    /** Self-serve signup: "pending_payment" until the wedding is activated. */
    billing_status?: string;
  };
  /** True while a self-serve wedding awaits activation: the locked home. */
  locked?: boolean;
  /** Planners only: each tool's level on the open wedding ("off", "view",
   *  "edit"). Null for couples; absent from older portals (everything on). */
  capabilities?: Record<string, "off" | "view" | "edit"> | null;
  tenants: { slug: string; couple_names: string; status: string; tier: string }[];
  min_version: string;
  update_required: boolean;
};

export type GuestIdentity = { id: string; name: string; language: string | null; max_party: number };

/** Whether the open session may use a planner tool at `level`. Couples, and
 *  planners on a portal that sends no map, may use everything; a missing id
 *  in a map reads "off", as on the server. */
export function can(me: Me | null | undefined, tool: string, level: "view" | "edit" = "view"): boolean {
  if (!me || me.surface !== "planner" || !me.capabilities) return true;
  const have = me.capabilities[tool] ?? "off";
  return level === "view" ? have === "view" || have === "edit" : have === "edit";
}

type State =
  | { status: "loading" }
  | { status: "none" }
  | { status: "guest"; token: string; tenant: TenantSummary; guest: GuestIdentity; inviteCode: string }
  | { status: "user"; jwt: string; me: Me }
  | { status: "onboarding"; jwt: string; email: string };

/** Why the last session ended on its own, for a one-time message. */
export type SessionNotice = "guest_ended" | "user_ended" | null;

type Ctx = {
  state: State;
  updateRequired: boolean;
  locked: boolean;
  unlock: () => void;
  signInGuest: (args: { token: string; tenant: TenantSummary; guest: GuestIdentity; inviteCode: string }) => Promise<void>;
  refreshMe: () => Promise<Me | null>;
  /** True when the wedding switched; false when /auth/me failed (nothing changed). */
  switchTenant: (slug: string) => Promise<boolean>;
  /** The slug being switched to, while the switch runs. */
  switchingTenant: string | null;
  signOut: () => Promise<void>;
  pushToken: string | null;
  setPushToken: (t: string | null) => void;
  biometricEnabled: boolean;
  setBiometricEnabled: (v: boolean) => Promise<void>;
  dayOfManual: boolean;
  setDayOfManual: (v: boolean) => Promise<void>;
  notice: SessionNotice;
  clearNotice: () => void;
};

const SessionContext = createContext<Ctx | null>(null);

const K_GUEST = "gl.guest"; // SecureStore: { token, inviteCode }
const K_GUEST_META = "gl.guest.meta"; // AsyncStorage: { tenant, guest }
const K_TENANT = "gl.tenant"; // AsyncStorage: preferred tenant slug
const K_BIO = "gl.biometric";
const K_DAYOF = "gl.dayof.manual";
const K_PUSH = "gl.push.token";
const K_ME = "gl.me"; // AsyncStorage: { userId, me } last /auth/me payload
const LOCK_AFTER_MS = 5 * 60 * 1000;

type MeResult =
  | { ok: true; me: Me }
  | { ok: false; reason: "no_wedding" | "unauthorized" | "network" | "other"; error: ApiFailure | null };

/** GET /auth/me with an explicit credential: the session's credential is
 *  untouched until the caller commits (P0-4). A 401 here is the caller's. */
async function fetchMe(jwt: string, tenantSlug: string | null): Promise<MeResult> {
  const credential: Credential = { kind: "user", jwt, tenantSlug };
  try {
    const me = await api<Me>("/auth/me", { credential, handleAuth: false });
    return { ok: true, me };
  } catch (err) {
    const f = err instanceof ApiFailure ? err : null;
    const reason = f?.code === "no_wedding" ? "no_wedding" : f?.status === 401 ? "unauthorized" : f?.status === 0 ? "network" : "other";
    return { ok: false, reason, error: f };
  }
}

async function readCachedMe(): Promise<{ userId: string; me: Me } | null> {
  try {
    const raw = await AsyncStorage.getItem(K_ME);
    const v = raw ? (JSON.parse(raw) as { userId?: unknown; me?: Me }) : null;
    return v && typeof v.userId === "string" && v.me?.tenant?.slug ? { userId: v.userId, me: v.me } : null;
  } catch {
    return null;
  }
}

/** auth-js could not reach Supabase (as opposed to a revoked session). */
function networkAuthError(e: unknown): boolean {
  const x = e as { name?: string; status?: number } | null;
  return !!x && (x.name === "AuthRetryableFetchError" || x.status === 0);
}

function surfaceOf(s: State): Surface | null {
  if (s.status === "guest") return "guest";
  if (s.status === "user") return s.me.surface === "planner" ? "planner" : "couple";
  return null;
}

async function liveJwt(fallback: string): Promise<string> {
  if (!supabaseConfigured()) return fallback;
  try {
    const { data } = await supabase().auth.getSession();
    return data.session?.access_token ?? fallback;
  } catch {
    return fallback;
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateRaw] = useState<State>({ status: "loading" });
  const [updateRequired, setUpdateRequired] = useState(false);
  const [locked, setLocked] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [pushToken, setPushTokenState] = useState<string | null>(null);
  const [biometricEnabled, setBio] = useState(false);
  const [dayOfManual, setDayOf] = useState(false);
  const [switchingTenant, setSwitchingTenant] = useState<string | null>(null);
  const [notice, setNotice] = useState<SessionNotice>(null);
  const background = useRef<number | null>(null);
  const { applyTenantDefault, lang } = useLang();

  // Refs so long-lived callbacks (auth listener, API handlers) see the latest
  // values without being re-created, and the boot never re-runs.
  const stateRef = useRef<State>(state);
  const pushRef = useRef<string | null>(null);
  const langDefaultRef = useRef(applyTenantDefault);
  useEffect(() => {
    langDefaultRef.current = applyTenantDefault;
  }, [applyTenantDefault]);
  const booting = useRef(true);
  const ending = useRef(false);

  // Every write goes through here, so stateRef is current the moment a
  // write happens (callbacks that read it right after never see a stale one).
  const setState = useCallback((next: State | ((s: State) => State)) => {
    const v = typeof next === "function" ? (next as (s: State) => State)(stateRef.current) : next;
    stateRef.current = v;
    setStateRaw(v);
  }, []);

  const applyLang = useCallback((l: string | null | undefined, guestLanguage?: string | null) => {
    langDefaultRef.current(l === "es" ? "es" : l === "en" ? "en" : l, guestLanguage);
  }, []);

  /** Makes `me` the open session: credential, cache scope, saved payload. */
  const enterUser = useCallback(
    (jwt: string, me: Me) => {
      setCredential({ kind: "user", jwt, tenantSlug: me.tenant.slug });
      const scope = `user:${me.user.id}:${me.tenant.slug}`;
      bindCacheScope(scope);
      setStorageScope(scope);
      applyLang(me.tenant.locale_default);
      setUpdateRequired(me.update_required);
      setState({ status: "user", jwt, me });
      void AsyncStorage.setItem(K_ME, JSON.stringify({ userId: me.user.id, me })).catch(() => {});
    },
    [applyLang, setState]
  );

  const enterOnboarding = useCallback(
    (jwt: string, email: string) => {
      setCredential({ kind: "user", jwt });
      setState({ status: "onboarding", jwt, email });
    },
    [setState]
  );

  /** Ends a session the server no longer accepts (401 after a refresh), or
   *  that Supabase signed out. Clears everything and says why, once. */
  const endSession = useCallback(
    async (why: SessionNotice) => {
      if (ending.current) return;
      const s = stateRef.current;
      if (s.status === "none" || s.status === "loading") return;
      ending.current = true;
      try {
        setCredential({ kind: "none" });
        setLocked(false);
        setState({ status: "none" });
        if (why) setNotice(why);
        await resetUserScopedState();
        await SecureStore.deleteItemAsync(K_GUEST).catch(() => {});
        await AsyncStorage.multiRemove([K_GUEST_META, K_TENANT, K_PUSH, K_ME]).catch(() => {});
        if (s.status !== "guest" && supabaseConfigured()) await supabase().auth.signOut({ scope: "local" }).catch(() => {});
        setBio(false);
        setDayOf(false);
        setPushTokenState(null);
        pushRef.current = null;
      } finally {
        ending.current = false;
      }
    },
    [setState]
  );

  // Guest tokens live 90 days and slide: refresh at launch and, after a day,
  // when the app comes back. A revoked token answers 401, which ends the
  // guest session cleanly (the API's unauthorized handler).
  const guestRefreshedAt = useRef(0);
  const refreshGuestToken = useCallback(async () => {
    const s = stateRef.current;
    if (s.status !== "guest") return;
    guestRefreshedAt.current = Date.now();
    try {
      const r = await api<{ token: string; expires_at: string | null }>("/auth/guest/refresh", { method: "POST", body: {} });
      const now = stateRef.current;
      if (!r?.token || now.status !== "guest" || now.guest.id !== s.guest.id || now.tenant.slug !== s.tenant.slug) return;
      await SecureStore.setItemAsync(K_GUEST, JSON.stringify({ token: r.token, inviteCode: now.inviteCode }));
      setCredential({ kind: "guest", token: r.token });
      setState({ ...now, token: r.token });
    } catch {
      // Offline, or a portal without the route: the current token still works.
    }
  }, [setState]);

  // The saved wedding was taken off this account (tenant_unavailable): forget
  // it and reopen on the account's current wedding, with a clean cache.
  const recovering = useRef(false);
  const recoverTenant = useCallback(async () => {
    const s = stateRef.current;
    if (s.status !== "user" || recovering.current) return;
    recovering.current = true;
    try {
      await AsyncStorage.removeItem(K_TENANT).catch(() => {});
      const jwt = await liveJwt(s.jwt);
      const r = await fetchMe(jwt, null);
      if (r.ok) {
        if (r.me.tenant.slug !== s.me.tenant.slug) {
          setCredential({ kind: "user", jwt, tenantSlug: r.me.tenant.slug });
          await clearQueryCache();
          await runScopedResets();
        }
        enterUser(jwt, r.me);
      } else if (r.reason === "no_wedding") enterOnboarding(jwt, s.me.user.email);
      else if (r.reason === "unauthorized") void endSession("user_ended");
    } finally {
      recovering.current = false;
    }
  }, [endSession, enterOnboarding, enterUser]);

  // Boot: restore whichever session exists. Runs once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bio, dayof, push] = await Promise.all([
          AsyncStorage.getItem(K_BIO),
          AsyncStorage.getItem(K_DAYOF),
          AsyncStorage.getItem(K_PUSH),
        ]);
        setBio(bio === "1");
        setDayOf(dayof === "1");
        setPushTokenState(push);
        pushRef.current = push;
        // Lock only when a session is actually restored (P2-27).
        const lockIfOn = () => {
          if (bio === "1") setLocked(true);
        };

        const guestRaw = await SecureStore.getItemAsync(K_GUEST);
        if (guestRaw) {
          const { token, inviteCode } = JSON.parse(guestRaw) as { token: string; inviteCode: string };
          const metaRaw = await AsyncStorage.getItem(K_GUEST_META);
          if (metaRaw) {
            const meta = JSON.parse(metaRaw) as { tenant: TenantSummary; guest: GuestIdentity };
            setCredential({ kind: "guest", token });
            const scope = `guest:${meta.tenant.slug}:${meta.guest.id}`;
            bindCacheScope(scope);
            setStorageScope(scope);
            applyLang(meta.tenant.locale_default, meta.guest.language);
            if (!cancelled) {
              lockIfOn();
              setState({ status: "guest", token, tenant: meta.tenant, guest: meta.guest, inviteCode });
              void refreshGuestToken();
            }
            return;
          }
        }
        if (supabaseConfigured()) {
          let session: { access_token: string; user: { id: string; email?: string } } | null = null;
          let authError: unknown = null;
          try {
            const r = await supabase().auth.getSession();
            session = r.data.session;
            authError = r.error;
          } catch (e) {
            authError = e;
          }
          const cached = await readCachedMe();
          if (session) {
            const jwt = session.access_token;
            if (cached && cached.userId === session.user.id) {
              // Open at once on the saved payload; refresh behind it.
              if (cancelled) return;
              lockIfOn();
              enterUser(jwt, cached.me);
              void (async () => {
                const r = await fetchMe(await liveJwt(jwt), cached.me.tenant.slug);
                if (stateRef.current.status !== "user") return;
                if (r.ok) enterUser(await liveJwt(jwt), r.me);
                else if (r.reason === "unauthorized") void endSession("user_ended");
                else if (r.reason === "no_wedding") enterOnboarding(jwt, session?.user.email ?? "");
                // network or server error: keep the saved session
              })();
              return;
            }
            const preferred = await AsyncStorage.getItem(K_TENANT);
            const r = await fetchMe(jwt, preferred);
            if (cancelled) return;
            if (r.ok) {
              lockIfOn();
              enterUser(jwt, r.me);
              return;
            }
            if (r.reason === "no_wedding") {
              enterOnboarding(jwt, session.user.email ?? "");
              return;
            }
          } else if (cached && networkAuthError(authError)) {
            // Offline with an expired token: open on the saved payload. The
            // API asks for a fresh token on every request once back online.
            if (cancelled) return;
            lockIfOn();
            enterUser("", cached.me);
            return;
          }
        }
        if (!cancelled) setState({ status: "none" });
      } catch {
        if (!cancelled) setState({ status: "none" });
      } finally {
        booting.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once by design (P1-13): everything it calls is stable or read by ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The API client asks Supabase for the live token on every user request.
  useEffect(() => {
    if (!supabaseConfigured()) return;
    setTokenSource({
      current: async () => (await supabase().auth.getSession()).data.session?.access_token ?? null,
      refresh: async () => (await supabase().auth.refreshSession()).data.session?.access_token ?? null,
    });
    return () => setTokenSource(null);
  }, []);

  // Keep the JWT fresh in the API client. Work that calls the API is deferred
  // out of the callback: auth-js holds its lock while it notifies.
  useEffect(() => {
    if (!supabaseConfigured()) return;
    const { data: sub } = supabase().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        const s = stateRef.current;
        if (s.status === "user" || s.status === "onboarding") setTimeout(() => void endSession(null), 0);
        return;
      }
      const jwt = session?.access_token;
      if (!jwt) return;
      if (event === "TOKEN_REFRESHED") {
        const s = stateRef.current;
        if (s.status === "user") {
          setCredential({ kind: "user", jwt, tenantSlug: s.me.tenant.slug });
          setState({ ...s, jwt });
        } else if (s.status === "onboarding") {
          setCredential({ kind: "user", jwt });
          setState({ ...s, jwt });
        }
        return;
      }
      if (event === "SIGNED_IN") {
        // auth-js emits SIGNED_IN while it restores the session at launch;
        // the boot owns that one (P2-21).
        if (booting.current) return;
        const s = stateRef.current;
        if (s.status === "user" && s.me.user.id === session?.user.id) {
          setCredential({ kind: "user", jwt, tenantSlug: s.me.tenant.slug });
          setState({ ...s, jwt });
          return;
        }
        setTimeout(() => {
          void (async () => {
            const preferred = await AsyncStorage.getItem(K_TENANT);
            const r = await fetchMe(jwt, preferred);
            if (r.ok) {
              // A different person than the one on screen (a guest, or another
              // account): nothing of theirs may stay, and a saved guest pass
              // must not win the next cold start.
              const cur = stateRef.current;
              if (cur.status === "guest" || (cur.status === "user" && cur.me.user.id !== r.me.user.id)) {
                await resetUserScopedState();
                await SecureStore.deleteItemAsync(K_GUEST).catch(() => {});
                await AsyncStorage.removeItem(K_GUEST_META).catch(() => {});
              }
              enterUser(jwt, r.me);
            } else if (r.reason === "no_wedding") {
              enterOnboarding(jwt, session?.user.email ?? "");
            } else {
              setState({ status: "none" });
            }
          })();
        }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [endSession, enterOnboarding, enterUser, setState]);

  // 401 anywhere (after one token refresh) means the session is gone; 426
  // means update the app. A guest whose invitation was removed or merged
  // is signed out cleanly with a message instead of error screens (P2-26).
  useEffect(() => {
    setAuthHandlers({
      unauthorized: (kind) => void endSession(kind === "guest" ? "guest_ended" : "user_ended"),
      update: () => setUpdateRequired(true),
      tenantUnavailable: () => void recoverTenant(),
    });
  }, [endSession, recoverTenant]);

  // Biometric lock after 5 minutes in the background; the privacy cover while
  // the app is not active (app switcher snapshot, P2-28).
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        // Only real background time counts toward the lock: "inactive" is
        // also the Face ID sheet, Control Center and incoming-call banners,
        // and the prompt that turns the lock on must not lock the app.
        if (next === "background" && !background.current) background.current = Date.now();
        if (biometricEnabled) setPrivacy(true);
      } else if (next === "active") {
        if (background.current && biometricEnabled && Date.now() - background.current > LOCK_AFTER_MS) setLocked(true);
        background.current = null;
        setPrivacy(false);
        if (stateRef.current.status === "guest" && Date.now() - guestRefreshedAt.current > 24 * 60 * 60 * 1000) void refreshGuestToken();
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [biometricEnabled, refreshGuestToken]);

  // Every presented surface reads the lock from lib/lock (P0-3).
  const signedIn = state.status === "guest" || state.status === "user";
  useEffect(() => {
    setLockSnapshot({ locked: locked && signedIn, privacy: privacy && signedIn && biometricEnabled });
  }, [locked, privacy, signedIn, biometricEnabled]);

  /** Re-sends the push registration (language change, wedding switch). */
  const reRegisterPush = useCallback(async () => {
    const token = pushRef.current;
    const surface = surfaceOf(stateRef.current);
    if (!token || !surface) return;
    const prefs = await loadPushPrefs();
    await registerPush(surface, token, prefs);
  }, []);

  // The server stores the push language at registration: follow a change.
  const langSeen = useRef(lang);
  useEffect(() => {
    if (langSeen.current === lang) return;
    langSeen.current = lang;
    void reRegisterPush();
  }, [lang, reRegisterPush]);

  const signInGuest = useCallback<Ctx["signInGuest"]>(
    async ({ token, tenant, guest, inviteCode }) => {
      const prev = stateRef.current;
      const same = prev.status === "guest" && prev.guest.id === guest.id && prev.tenant.slug === tenant.slug;
      if (!same) {
        // A different person on this phone: unregister the old push token with
        // the OLD credential, then clear everything of theirs.
        const oldToken = pushRef.current;
        const oldSurface = surfaceOf(prev);
        if (oldToken && oldSurface) await unregisterPush(oldSurface, oldToken);
        setPushTokenState(null);
        pushRef.current = null;
        await AsyncStorage.multiRemove([K_PUSH, K_ME]).catch(() => {});
        // New credential first: mounted screens refetch as the new guest.
        setCredential({ kind: "guest", token });
        await resetUserScopedState();
        setBio(false);
        setDayOf(false);
        setLocked(false);
      }
      await SecureStore.setItemAsync(K_GUEST, JSON.stringify({ token, inviteCode }));
      await AsyncStorage.setItem(K_GUEST_META, JSON.stringify({ tenant, guest }));
      setCredential({ kind: "guest", token });
      const scope = `guest:${tenant.slug}:${guest.id}`;
      bindCacheScope(scope);
      setStorageScope(scope);
      applyLang(tenant.locale_default, guest.language);
      setState({ status: "guest", token, tenant, guest, inviteCode });
    },
    [applyLang, setState]
  );

  // Also moves onboarding -> user once the wedding exists, and a locked
  // wedding -> the full couple surface once it is activated.
  const refreshMe = useCallback(async () => {
    const s = stateRef.current;
    if (s.status !== "user" && s.status !== "onboarding") return null;
    const jwt = await liveJwt(s.jwt);
    const r = await fetchMe(jwt, s.status === "user" ? s.me.tenant.slug : null);
    if (!r.ok) {
      if (r.reason === "no_wedding") enterOnboarding(jwt, s.status === "onboarding" ? s.email : s.me.user.email);
      return null;
    }
    enterUser(jwt, r.me);
    return r.me;
  }, [enterOnboarding, enterUser]);

  const switchTenant = useCallback(
    async (slug: string) => {
      const s = stateRef.current;
      if (s.status !== "user") return false;
      if (s.me.tenant.slug === slug) return true;
      setSwitchingTenant(slug);
      try {
        const jwt = await liveJwt(s.jwt);
        const r = await fetchMe(jwt, slug);
        // Nothing is committed unless the new wedding answered (P0-4).
        if (!r.ok || r.me.tenant.slug !== slug) return false;
        await AsyncStorage.setItem(K_TENANT, slug).catch(() => {});
        await AsyncStorage.removeItem("budget-selected").catch(() => {});
        // New tenant header first: the cache reset refetches mounted screens
        // for the new wedding, never with the old one's rows on screen (P0-2).
        setCredential({ kind: "user", jwt, tenantSlug: slug });
        await clearQueryCache();
        await runScopedResets();
        enterUser(jwt, r.me);
        void reRegisterPush();
        return true;
      } finally {
        setSwitchingTenant(null);
      }
    },
    [enterUser, reRegisterPush]
  );

  const signOut = useCallback(async () => {
    const s = stateRef.current;
    const token = pushRef.current;
    const surface = surfaceOf(s);
    // With the credential that registered it, before anything is cleared.
    if (token && surface) await unregisterPush(surface, token);
    setCredential({ kind: "none" });
    setLocked(false);
    setState({ status: "none" });
    await resetUserScopedState();
    await SecureStore.deleteItemAsync(K_GUEST).catch(() => {});
    await AsyncStorage.multiRemove([K_GUEST_META, K_TENANT, K_PUSH, K_ME]).catch(() => {});
    // Local: signing out on this phone must not end the same account's
    // session on the person's other devices (auth-js defaults to global).
    if (supabaseConfigured()) await supabase().auth.signOut({ scope: "local" }).catch(() => {});
    setBio(false);
    setDayOf(false);
    setPushTokenState(null);
    pushRef.current = null;
  }, [setState]);

  const setPushToken = useCallback((t: string | null) => {
    setPushTokenState(t);
    pushRef.current = t;
    if (t) AsyncStorage.setItem(K_PUSH, t).catch(() => {});
    else AsyncStorage.removeItem(K_PUSH).catch(() => {});
  }, []);

  const setBiometricEnabled = useCallback(async (v: boolean) => {
    setBio(v);
    await AsyncStorage.setItem(K_BIO, v ? "1" : "0");
  }, []);

  const setDayOfManual = useCallback(async (v: boolean) => {
    setDayOf(v);
    await AsyncStorage.setItem(K_DAYOF, v ? "1" : "0");
  }, []);

  const unlock = useCallback(() => setLocked(false), []);
  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      updateRequired,
      locked,
      unlock,
      signInGuest,
      refreshMe,
      switchTenant,
      switchingTenant,
      signOut,
      pushToken,
      setPushToken,
      biometricEnabled,
      setBiometricEnabled,
      dayOfManual,
      setDayOfManual,
      notice,
      clearNotice,
    }),
    [state, updateRequired, locked, unlock, signInGuest, refreshMe, switchTenant, switchingTenant, signOut, pushToken, setPushToken, biometricEnabled, setBiometricEnabled, dayOfManual, setDayOfManual, notice, clearNotice]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside SessionProvider");
  return ctx;
}

/** Narrow helpers for screens that know their surface. */
export function useGuestSession() {
  const { state } = useSession();
  return state.status === "guest" ? state : null;
}
export function useUserSession() {
  const { state } = useSession();
  return state.status === "user" ? state : null;
}

export { api };
