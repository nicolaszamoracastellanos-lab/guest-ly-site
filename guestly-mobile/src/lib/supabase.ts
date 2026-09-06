// Supabase is used for ONE thing in the app: obtaining and refreshing the
// couple or planner JWT. No table is ever queried from here; every read and
// write goes through the portal's mobile API. The anon key is public by
// design; the service role key never leaves the portal server.

import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(url, anon, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    // Refresh tokens only while the app is in the foreground.
    AppState.addEventListener("change", (state) => {
      if (state === "active") client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}

export function supabaseConfigured(): boolean {
  return !!url && !!anon;
}
