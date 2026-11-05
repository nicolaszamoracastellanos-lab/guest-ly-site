// The door chip (HH, Oct 30 2026): "Offline, 3 pending" while the phone has no
// connection, "3 pending, tap to send" when it is back and something waits,
// "Sending 3" while a drain runs, nothing when all is delivered. It listens to
// the queue itself, so a drain started anywhere (launch, foreground, the
// network coming back) updates it. Tapping it sends now.

import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, useCopy } from "@/i18n";
import { useOnline } from "@/lib/query";
import { isCheckin, isDraining, isForOpenWedding, readQueue, subscribeQueue } from "@/lib/queue";
import { chipState } from "@/lib/queueMath";
import { T, Icon } from "@/ui";
import { colors, radius } from "@/ui/tokens";

/** The open wedding's pending check-ins, live. */
export function usePendingCheckins(): { pending: number; syncing: boolean } {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(isDraining());
  useEffect(() => {
    let alive = true;
    void readQueue().then((items) => {
      if (alive) setPending(items.filter((i) => isCheckin(i) && isForOpenWedding(i)).length);
    });
    const off = subscribeQueue((n) => {
      if (!alive) return;
      setPending(n);
      setSyncing(isDraining());
    });
    return () => {
      alive = false;
      off();
    };
  }, []);
  return { pending, syncing };
}

export function QueueChip({ onSend, testID = "checkin-queue-chip" }: { onSend?: () => void; testID?: string }) {
  const copy = useCopy().checkin;
  const online = useOnline();
  const { pending, syncing } = usePendingCheckins();
  const state = chipState(pending, online, syncing);
  if (state === "hidden") return null;
  const label =
    state === "offline" ? copy.chipOffline : state === "offlinePending" ? fmt(copy.chipOfflinePending, { n: pending }) : state === "syncing" ? fmt(copy.chipSyncing, { n: pending }) : fmt(copy.chipPending, { n: pending });
  const tappable = state === "pending" && !!onSend;
  const offline = state === "offline" || state === "offlinePending";
  return (
    <Pressable
      testID={testID}
      onPress={tappable ? onSend : undefined}
      disabled={!tappable}
      accessibilityRole={tappable ? "button" : "text"}
      accessibilityLabel={label}
      accessibilityHint={copy.chipHint}
      accessibilityLiveRegion="polite"
      hitSlop={6}
      style={({ pressed }) => [styles.chip, offline ? styles.offline : styles.waiting, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.icon}>
        <Icon name={offline ? "wifi-off" : syncing ? "arrow-up" : "clock"} size={16} color={offline ? colors.amber : colors.goldLight} />
      </View>
      <T v="caption14" color={offline ? colors.amber : colors.goldLight} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1 },
  offline: { borderColor: "rgba(245,158,11,0.45)", backgroundColor: "rgba(8,11,16,0.72)" },
  waiting: { borderColor: colors.goldBorder, backgroundColor: "rgba(8,11,16,0.72)" },
  icon: { width: 16, alignItems: "center" },
});
