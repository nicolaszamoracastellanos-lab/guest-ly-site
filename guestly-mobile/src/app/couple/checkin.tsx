// Door check-in: camera scan of GL1:{guestId} passes, name search fallback,
// the ivory guest card, works offline with a replayable queue.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy, useLang, relTime } from "@/i18n";
import { ApiFailure, get } from "@/lib/api";
import { checkIn, drainQueue, newEventId, readQueue, type CheckinResult } from "@/lib/queue";
import { useCoupleDayOf, type GuestListItem } from "@/lib/hooks";
import { useOnline } from "@/lib/query";
import { TopBar, T, Badge, Card, Button, Input, ListRow, Avatar, Row, Stack, Icon } from "@/ui";
import { colors } from "@/ui/tokens";

const PASS_RE = /^GL1:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export default function DoorCheckin() {
  const copy = useCopy();
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const [permission, requestPermission] = useCameraPermissions();
  const { data: dayof } = useCoupleDayOf();
  const [queued, setQueued] = useState(0);
  const [typing, setTyping] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GuestListItem[]>([]);
  const [card, setCard] = useState<{ result: CheckinResult | null; pending?: { name: string; seats: number } } | null>(null);
  const [busy, setBusy] = useState(false);
  const lastScan = useRef<{ id: string; at: number } | null>(null);

  const refreshQueue = useCallback(() => readQueue().then((items) => setQueued(items.length)), []);
  useEffect(() => {
    void refreshQueue();
    if (!permission?.granted) void requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (online) drainQueue().then(() => { void refreshQueue(); void qc.invalidateQueries({ queryKey: ["couple-dayof"] }); });
  }, [online, qc, refreshQueue]);
  useEffect(() => {
    const term = q.trim();
    const t = setTimeout(async () => {
      if (!typing || term.length < 2) {
        setResults([]);
        return;
      }
      try {
        const r = await get<{ items: GuestListItem[] }>(`/couple/guests?q=${encodeURIComponent(term)}`);
        setResults(r.items.slice(0, 6));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, typing]);

  async function doCheckIn(guestId: string, name: string, seats: number) {
    if (busy) return;
    setBusy(true);
    try {
      const item = { client_event_id: newEventId(), guest_id: guestId, seats, scanned_at: new Date().toISOString(), name };
      const result = await checkIn(item);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCard({ result, pending: result ? undefined : { name, seats } });
      await refreshQueue();
      void qc.invalidateQueries({ queryKey: ["couple-dayof"] });
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(copy.common.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(false);
    }
  }

  function onScan(res: BarcodeScanningResult) {
    const m = res.data.match(PASS_RE);
    if (!m) return;
    const id = m[1].toLowerCase();
    const now = Date.now();
    if (lastScan.current && lastScan.current.id === id && now - lastScan.current.at < 4000) return;
    lastScan.current = { id, at: now };
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Seats: the party size comes back with the card; scan checks in the whole party.
    void doCheckIn(id, "", 1);
  }

  const guest = card?.result?.guest ?? null;
  const seats = guest?.party_size ?? card?.pending?.seats ?? 1;
  const top = Math.max(insets.top, 54);

  return (
    <View style={styles.root}>
      {permission?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={typing ? undefined : onScan} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.night }]} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(8,11,16,0.35)" }]} />
      <View style={{ paddingTop: top }}>
        <TopBar onBack={() => router.back()} title={copy.checkin.title} right={queued || !online ? <Badge label={fmt(copy.checkin.offlineQueued, { n: queued })} kind="amber" /> : undefined} />
      </View>
      {!typing ? (
        <View style={styles.frame}>
          {[styles.tl, styles.tr, styles.bl, styles.br].map((s, i) => (
            <View key={i} style={[styles.corner, s]} />
          ))}
          <View style={styles.scanline} />
        </View>
      ) : null}
      {!permission?.granted && !typing ? (
        <T v="body15" color={colors.ivory70} center style={{ marginHorizontal: 40, marginTop: 24 }}>
          {copy.checkin.cameraDenied}
        </T>
      ) : null}
      <T v="meta13" color={colors.ivory70} center style={{ marginTop: typing ? 12 : 26 }}>
        {copy.checkin.hint}
      </T>

      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16, gap: 12 }}>
        {typing ? (
          <Card kind="glass" blur padding={10}>
            <Input icon="search" value={q} onChangeText={setQ} placeholder={copy.guests.search} autoFocus autoCorrect={false} />
            {results.map((g, i) => (
              <ListRow key={g.id} leading={<Avatar initials={g.initials} />} title={g.name} sub={fmt(copy.guests.partyOf, { n: g.party_size })} trailing={g.checked_in_at ? <Badge label={copy.guests.detail.checkedIn} kind="green" /> : undefined} onPress={() => doCheckIn(g.id, g.name, g.party_size)} last={i === results.length - 1} />
            ))}
          </Card>
        ) : null}
        {card ? (
          <Card kind="paper" padding={18}>
            <Row style={{ justifyContent: "space-between" }}>
              <T v="title30" size={26} color={colors.ink} style={{ flex: 1 }}>
                {guest?.name ?? card.pending?.name ?? ""}
              </T>
              <View style={styles.okPill}>
                <T v="label11" color="#047857" style={{ letterSpacing: 1 }}>
                  {card.result?.already ? copy.guests.detail.checkedIn : copy.checkin.scanned}
                </T>
              </View>
            </Row>
            <T v="body15" color={colors.muted} style={{ marginTop: 4 }}>
              {[fmt(copy.guests.partyOf, { n: seats }), guest?.members?.length ? fmt(copy.checkin.withMembers, { members: guest.members.join(", ") }) : null, guest?.table ? fmt(copy.checkin.table, { t: guest.table }) : null].filter(Boolean).join(" · ")}
            </T>
            {card.result?.already && card.result.checked_in_at ? (
              <T v="meta13" color={colors.muted} style={{ marginTop: 4 }}>
                {fmt(copy.checkin.already, { time: relTime(card.result.checked_in_at, lang) })}
              </T>
            ) : null}
            {!card.result ? (
              <T v="meta13" color={colors.goldDim} style={{ marginTop: 4 }}>
                {fmt(copy.checkin.offlineQueued, { n: queued })}
              </T>
            ) : null}
            <Button label={copy.common.done} kind="paper" onPress={() => setCard(null)} style={{ marginTop: 14, backgroundColor: colors.gold, borderColor: colors.gold }} />
          </Card>
        ) : null}
        <Row style={{ justifyContent: "space-between" }}>
          <Row gap={6} align="baseline">
            <T v="title26" size={22}>
              {dayof?.parties_in ?? "·"}
            </T>
            <T v="meta13" size={14} color={colors.ivory70}>
              {fmt(copy.checkin.partiesIn, { n: "", total: dayof?.parties_total ?? "·" }).replace(/^\s*of\s*/i, "of ").replace(/^\s*de\s*/i, "de ")}
            </T>
          </Row>
          <Pressable onPress={() => setTyping((v) => !v)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
            <Row gap={6}>
              <Icon name={typing ? "camera" : "search"} size={16} color={colors.ivory70} />
              <T v="meta13" size={14} color={colors.ivory70}>
                {typing ? copy.checkin.title : copy.checkin.typeName}
              </T>
            </Row>
          </Pressable>
        </Row>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  frame: { alignSelf: "center", width: 280, height: 280, marginTop: 60 },
  corner: { position: "absolute", width: 26, height: 26, borderColor: colors.gold },
  tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 6 },
  scanline: { position: "absolute", left: 0, right: 0, top: "50%", height: 1, backgroundColor: "rgba(201,169,110,0.5)" },
  okPill: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(5,150,105,0.3)", backgroundColor: "rgba(5,150,105,0.1)", paddingHorizontal: 10, paddingVertical: 4 },
});
