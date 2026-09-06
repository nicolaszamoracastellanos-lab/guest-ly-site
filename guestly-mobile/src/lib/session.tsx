// Session state for the whole app.
//
//   guest    signed guest token in SecureStore + the wedding summary
//   user     Supabase session (couple or planner) + the /auth/me payload
//   none     entrance
//
// Sign out clears everything and deletes the push token server-side.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import { api, del, get, setAuthHandlers, setCredential } from "@/lib/api";
import { supabase, supabaseConfigured } from "@/lib/supabase";
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
  };
  tenants: { slug: string; couple_names: string; status: string; tier: string }[];
  min_version: string;
  update_required: boolean;
};

export type GuestIdentity = { id: string; name: string; language: string | null; max_party: number };

type State =
  | { status: "loading" }
  | { status: "none" }
  | { status: "guest"; token: string; tenant: TenantSummary; guest: GuestIdentity; inviteCode: string }
  | { status: "user"; jwt: string; me: Me };

type Ctx = {
  state: State;
  updateRequired: boolean;
  locked: boolean;
  unlock: () => void;
  signInGuest: (args: { token: string; tenant: TenantSummary; guest: GuestIdentity; inviteCode: string }) => Promise<void>;
  refreshMe: () => Promise<Me | null>;
  switchTenant: (slug: string) => Promise<void>;
  signOut: () => Promise<void>;
  pushToken: string | null;
  setPushToken: (t: string | null) => void;
  biometricEnabled: boolean;
  setBiometricEnabled: (v: boolean) => Promise<void>;
  dayOfManual: boolean;
  setDayOfManual: (v: boolean) => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

const K_GUEST = "gl.guest"; // SecureStore: { token, inviteCode }
const K_GUEST_META = "gl.guest.meta"; // AsyncStorage: { tenant, guest }
const K_TENANT = "gl.tenant"; // AsyncStorage: preferred tenant slug
const K_BIO = "gl.biometric";
const K_DAYOF = "gl.dayof.manual";
const K_PUSH = "gl.push.token";
const LOCK_AFTER_MS = 5 * 60 * 1000;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [updateRequired, setUpdateRequired] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pushToken, setPushTokenState] = useState<string | null>(null);
  const [biometricEnabled, setBio] = useState(false);
  const [dayOfManual, setDayOf] = useState(false);
  const background = useRef<number | null>(null);
  const { applyTenantDefault } = useLang();

  const loadMe = useCallback(async (jwt: string, tenantSlug?: string | null): Promise<Me | null> => {
    setCredential({ kind: "user", jwt, tenantSlug: tenantSlug ?? null });
    try {
      const me = await get<Me>("/auth/me");
      return me;
    } catch {
      return null;
    }
  }, []);

  // Boot: restore whichever session exists.
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
        if (bio === "1") setLocked(true);

        const guestRaw = await SecureStore.getItemAsync(K_GUEST);
        if (guestRaw) {
          const { token, inviteCode } = JSON.parse(guestRaw) as { token: string; inviteCode: string };
          const metaRaw = await AsyncStorage.getItem(K_GUEST_META);
          if (metaRaw) {
            const meta = JSON.parse(metaRaw) as { tenant: TenantSummary; guest: GuestIdentity };
            setCredential({ kind: "guest", token });
            applyTenantDefault(meta.tenant.locale_default);
            if (!cancelled) setState({ status: "guest", token, tenant: meta.tenant, guest: meta.guest, inviteCode });
            return;
          }
        }
        if (supabaseConfigured()) {
          const { data } = await supabase().auth.getSession();
          const jwt = data.session?.access_token;
          if (jwt) {
            const preferred = await AsyncStorage.getItem(K_TENANT);
            const me = await loadMe(jwt, preferred);
            if (me && !cancelled) {
              applyTenantDefault(me.tenant.locale_default === "es" ? "es" : "en");
              setUpdateRequired(me.update_required);
              setState({ status: "user", jwt, me });
              return;
            }
          }
        }
        if (!cancelled) setState({ status: "none" });
      } catch {
        if (!cancelled) setState({ status: "none" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyTenantDefault, loadMe]);

  // Keep the JWT fresh in the API client.
  useEffect(() => {
    if (!supabaseConfigured()) return;
    const { data: sub } = supabase().auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setCredential({ kind: "none" });
        setState((s) => (s.status === "user" ? { status: "none" } : s));
        return;
      }
      const jwt = session?.access_token;
      if (!jwt) return;
      if (event === "TOKEN_REFRESHED") {
        setState((s) => {
          if (s.status === "user") {
            setCredential({ kind: "user", jwt, tenantSlug: s.me.tenant.slug });
            return { ...s, jwt };
          }
          return s;
        });
      }
      if (event === "SIGNED_IN") {
        const preferred = await AsyncStorage.getItem(K_TENANT);
        const me = await loadMe(jwt, preferred);
        if (me) {
          applyTenantDefault(me.tenant.locale_default === "es" ? "es" : "en");
          setUpdateRequired(me.update_required);
          setState({ status: "user", jwt, me });
        } else {
          setState({ status: "none" });
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [applyTenantDefault, loadMe]);

  // 401 anywhere means the session is gone; 426 means update the app.
  useEffect(() => {
    setAuthHandlers({
      unauthorized: () => {
        setState((s) => (s.status === "guest" ? s : s.status === "user" ? { status: "none" } : s));
      },
      update: () => setUpdateRequired(true),
    });
  }, []);

  // Biometric lock after 5 minutes in the background.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        background.current = Date.now();
      } else if (next === "active" && background.current) {
        if (biometricEnabled && Date.now() - background.current > LOCK_AFTER_MS) setLocked(true);
        background.current = null;
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [biometricEnabled]);

  const signInGuest = useCallback<Ctx["signInGuest"]>(async ({ token, tenant, guest, inviteCode }) => {
    await SecureStore.setItemAsync(K_GUEST, JSON.stringify({ token, inviteCode }));
    await AsyncStorage.setItem(K_GUEST_META, JSON.stringify({ tenant, guest }));
    setCredential({ kind: "guest", token });
    setState({ status: "guest", token, tenant, guest, inviteCode });
  }, []);

  const refreshMe = useCallback(async () => {
    if (state.status !== "user") return null;
    const me = await loadMe(state.jwt, state.me.tenant.slug);
    if (me) setState({ status: "user", jwt: state.jwt, me });
    return me;
  }, [state, loadMe]);

  const switchTenant = useCallback(
    async (slug: string) => {
      if (state.status !== "user") return;
      await AsyncStorage.setItem(K_TENANT, slug);
      const me = await loadMe(state.jwt, slug);
      if (me) setState({ status: "user", jwt: state.jwt, me });
    },
    [state, loadMe]
  );

  const signOut = useCallback(async () => {
    const token = pushToken;
    try {
      if (token && state.status === "guest") await del("/guest/push", { expo_token: token });
      if (token && state.status === "user") {
        await del(state.me.surface === "planner" ? "/planner/push" : "/couple/push", { expo_token: token });
      }
    } catch {
      // best effort
    }
    await SecureStore.deleteItemAsync(K_GUEST).catch(() => {});
    await AsyncStorage.multiRemove([K_GUEST_META, K_TENANT, K_PUSH]).catch(() => {});
    if (supabaseConfigured()) await supabase().auth.signOut().catch(() => {});
    setPushTokenState(null);
    setCredential({ kind: "none" });
    setLocked(false);
    setState({ status: "none" });
  }, [pushToken, state]);

  const setPushToken = useCallback((t: string | null) => {
    setPushTokenState(t);
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

  const value = useMemo<Ctx>(
    () => ({
      state,
      updateRequired,
      locked,
      unlock: () => setLocked(false),
      signInGuest,
      refreshMe,
      switchTenant,
      signOut,
      pushToken,
      setPushToken,
      biometricEnabled,
      setBiometricEnabled,
      dayOfManual,
      setDayOfManual,
    }),
    [state, updateRequired, locked, signInGuest, refreshMe, switchTenant, signOut, pushToken, setPushToken, biometricEnabled, setBiometricEnabled, dayOfManual, setDayOfManual]
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
