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
import * as ScreenOrientation from "expo-screen-orientation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLayout } from "./layout";
import { setDevPose } from "./devPose";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useReservedRegions } from "@/lib/duo";
import { get } from "@/lib/api";
import { dumpWidgetTimelines } from "@/features/widgets/sync";
import { startSampleActivities } from "@/features/widgets/liveActivities";
import { clearTourRequest, markTourSeen } from "@/features/tour/state";

const BASE = "http://127.0.0.1:8099";

type Cmd = { go?: string; signIn?: { email: string; password: string }; signOut?: boolean; hud?: boolean; skipTour?: boolean; orient?: "landscape" | "portrait" | "auto"; selFirst?: "guests" | "messages"; widgetsDump?: boolean; liveActivities?: boolean; pose?: "closed" | "flat" | "book" | "table" | "tent" | "auto" };

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

  if (!hud) return null;
  const fold = regions.division ? `fold ${Math.round(regions.division.x)},${Math.round(regions.division.y)} ${Math.round(regions.division.width)}x${Math.round(regions.division.height)}${regions.division.active ? "*" : ""}` : regions.available ? "fold none" : "fold n/a";
  return (
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
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, zIndex: 9999 },
  text: { color: "#9ae6c4", fontSize: 10, fontVariant: ["tabular-nums"] },
});
