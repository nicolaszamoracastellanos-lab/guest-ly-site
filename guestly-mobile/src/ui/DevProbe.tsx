// Development-only probe for the iPhone Duo work. Mounted by the root layout
// ONLY when EXPO_PUBLIC_DUO_PROBE=1 at bundle time (so it is dead code in a
// normal build). It does two things:
//  1. a small HUD with window size, bucket, pose, insets and hinge, so each
//     pose can be measured and captured;
//  2. polls a local server on the Mac (127.0.0.1:8099) for commands, so the
//     simulator can be driven from a terminal: go to a route, sign in as a demo
//     account (the server adds the credentials; they are never in the bundle),
//     sign out. Nothing here reaches production users.

import React, { useEffect } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ScreenOrientation from "expo-screen-orientation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLayout } from "./layout";
import { setDevOpenness, setDevPose } from "./devPose";
import { InviteEnvelope, resetEnvelope } from "@/features/guest/InviteEnvelope";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useReservedRegions } from "@/lib/duo";
import { get } from "@/lib/api";
import { dumpWidgetTimelines } from "@/features/widgets/sync";
import { startSampleActivities } from "@/features/widgets/liveActivities";
import { clearTourRequest, markTourSeen } from "@/features/tour/state";

const BASE = "http://127.0.0.1:8099";

type Cmd = { go?: string; signIn?: { email: string; password: string }; signOut?: boolean; hud?: boolean; skipTour?: boolean; orient?: "landscape" | "portrait" | "auto"; selFirst?: "guests" | "messages"; widgetsDump?: boolean; envelope?: boolean; seedMessages?: boolean; open?: number | null; liveActivities?: boolean; pose?: "closed" | "flat" | "book" | "table" | "tent" | "auto" };

export function DevProbe() {
  const router = useRouter();
  const { signOut, state } = useSession();
  const stateRef = React.useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const l = useLayout();
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const regions = useReservedRegions();
  const [hud, setHud] = React.useState(true);
  const [dump, setDump] = React.useState("");
  const [envelope, setEnvelope] = React.useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const res = await fetch(`${BASE}/cmd`);
        const cmd = (await res.json()) as Cmd;
        if (cmd.hud !== undefined) setHud(cmd.hud);
        if (cmd.signOut) await signOut();
        if (cmd.skipTour) {
          clearTourRequest();
          const st = stateRef.current;
          if (st.status === "user") for (const v of ["couple", "planner", "couple-pending"] as const) await markTourSeen(v, st.me.user.id, "skipped");
        }
        if (cmd.signIn) await supabase().auth.signInWithPassword(cmd.signIn);
        if (cmd.orient === "landscape") await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        if (cmd.orient === "portrait") await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        if (cmd.orient === "auto") await ScreenOrientation.unlockAsync();
        if (cmd.selFirst) {
          const res = await get<{ items?: { id: string }[]; threads?: { id: string }[] }>(cmd.selFirst === "guests" ? "/couple/guests?limit=1" : "/couple/messages?limit=1");
          const id = res.items?.[0]?.id ?? res.threads?.[0]?.id;
          if (id) router.navigate({ pathname: cmd.selFirst === "guests" ? "/couple/guests" : "/couple/messages", params: { sel: id } } as never);
        }
        if (cmd.liveActivities) setDump(await startSampleActivities("en"));
        if (cmd.widgetsDump) setDump(await dumpWidgetTimelines());
        if (cmd.seedMessages) {
          // Sample planner inbox and thread, so the populated screens can be seen without a live tool grant.
          const now = Date.now();
          const iso = (m: number) => new Date(now - m * 60_000).toISOString();
          const item = (id: string, name: string, channel: string, preview: string, ago: number, needs: boolean) => ({ id, channel, name, initials: name.split(" ").map((w) => w[0]).slice(0, 2).join(""), preview, last_at: iso(ago), needs_you: needs, upset: false, guest_id: null, sentiment: "neutral", has_gap: needs, message_count: 4, lang: "es" });
          qc.setQueryData(["planner-inbox", "all"], { needs_you: 1, items: [
            item("11111111-1111-4111-8111-111111111111", "Valentina Ríos", "app", "¿A qué hora empieza la ceremonia?", 12, true),
            item("22222222-2222-4222-8222-222222222222", "Invitado de WhatsApp", "whatsapp", "¿Hay estacionamiento en el lugar?", 95, false),
            item("33333333-3333-4333-8333-333333333333", "Visitante web 3", "web", "¿Puedo llevar a un acompañante?", 420, false),
          ] });
          const line = (id: string, role: "guest" | "bot", text: string, ago: number, gap = false) => ({ id, role, text, created_at: iso(ago), is_gap: gap, gap_question: gap ? text : null, sentiment: null, needs_couple: false });
          qc.setQueryData(["planner-thread", "11111111-1111-4111-8111-111111111111"], { id: "11111111-1111-4111-8111-111111111111", channel: "app", name: "Valentina Ríos", initials: "VR", guest_id: null, lang: "es", started_at: iso(30), last_message_at: iso(12), sentiment: "neutral", gap_count: 1, open_events: 0, whatsapp_link: null, can_reply_in_app: false, messages: [
            line("a1", "guest", "Hola, ¿a qué hora empieza la ceremonia?", 30),
            line("a2", "bot", "La ceremonia empieza a las **5:00 pm** en el jardín principal.", 29),
            line("a3", "guest", "¿Y hay transporte desde el hotel?", 13, true),
          ] });
        }
        if (cmd.envelope !== undefined) {
          if (cmd.envelope) resetEnvelope();
          setEnvelope(cmd.envelope);
        }
        if (cmd.open !== undefined) setDevOpenness(cmd.open);
        if (cmd.pose) setDevPose(cmd.pose === "auto" ? null : cmd.pose);
        if (cmd.go) router.navigate(cmd.go as never);
      } catch {
        // server not running: stay quiet
      }
      if (alive) setTimeout(tick, 900);
    };
    const t = setTimeout(tick, 1500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [router, signOut]);

  const sample = envelope ? <InviteEnvelope names="Camila & Andrés" date="Sunday, 21 March 2027" hint="Open it to see your invitation" ready /> : null;
  if (!hud) return sample;
  const fold = regions.division ? `fold ${Math.round(regions.division.x)},${Math.round(regions.division.y)} ${Math.round(regions.division.width)}x${Math.round(regions.division.height)}${regions.division.active ? "*" : ""}` : regions.available ? "fold none" : "fold n/a";
  return (
    <>
    {sample}
    <View pointerEvents="none" style={[styles.box, { top: insets.top + 2, left: insets.left + 4 }]}>
      <Text style={styles.text}>
        {Math.round(win.width)}x{Math.round(win.height)} {l.bucket} {l.pose}
      </Text>
      <Text style={styles.text}>
        ins t{insets.top} r{insets.right} b{insets.bottom} l{insets.left} {l.hinge ? `${l.hinge.status} ${Math.round(l.hinge.angle)}` : "no hinge"}
      </Text>
      <Text style={styles.text}>
        {l.twoPane ? "two" : "one"} pane {fold}
      </Text>
      {dump ? <Text style={styles.text}>{dump}</Text> : null}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, zIndex: 9999 },
  text: { color: "#9ae6c4", fontSize: 10, fontVariant: ["tabular-nums"] },
});
