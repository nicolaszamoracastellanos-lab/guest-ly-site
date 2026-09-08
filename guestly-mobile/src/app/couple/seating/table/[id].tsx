// One table: who sits here, add from the unseated parties, rename, resize,
// delete. Edits land in the shared draft; Save writes the plan.

import React, { useEffect, useMemo, useState } from "react";
import { View, Alert, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { useOnline } from "@/lib/query";
import {
  Screen,
  TopBar,
  T,
  Card,
  Button,
  Row,
  Stack,
  SectionLabel,
  Input,
  Segmented,
  ListRow,
  Avatar,
  Badge,
  Sheet,
  Icon,
  EmptyState,
} from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/seating/copy";
import {
  useCoupleSeating,
  useDraft,
  seedDraft,
  draftActions,
  deriveDraft,
  useSavePlan,
  initialsOf,
} from "@/features/seating/hooks";

export default function SeatingTable() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const online = useOnline();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useCoupleSeating();
  const draft = useDraft();
  const save = useSavePlan();
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (data) seedDraft(data);
  }, [data]);

  const view = useMemo(
    () => (data ? deriveDraft(data, draft) : null),
    [data, draft],
  );
  const table = view?.tables.find((t) => t.id === id) ?? null;
  const [label, setLabel] = useState<string | null>(null);
  const [seats, setSeats] = useState<string | null>(null);
  const labelValue = label ?? table?.label ?? "";
  const seatsValue = seats ?? (table ? String(table.capacity) : "");

  const fold = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const candidates = (view?.parties ?? [])
    .filter(
      (p) => p.unseated > 0 && (q ? fold(p.name).includes(fold(q)) : true),
    )
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed))
    .slice(0, 12);

  const groups = useMemo(() => {
    if (!table) return [];
    const map = new Map<
      string,
      {
        name: string;
        confirmed: boolean;
        rows: { index: number; person: string; kind: "main" | "companion" }[];
      }
    >();
    table.people.forEach((p, index) => {
      const g = map.get(p.rsvp_id) ?? {
        name: p.party_name,
        confirmed: p.confirmed,
        rows: [],
      };
      g.rows.push({ index, person: p.person, kind: p.kind });
      map.set(p.rsvp_id, g);
    });
    return [...map.entries()].map(([rsvp_id, g]) => ({ rsvp_id, ...g }));
  }, [table]);

  function commitLabel() {
    if (!table) return;
    const v = labelValue.trim();
    if (v && v !== table.label)
      draftActions.updateTable(table.id, { label: v.slice(0, 60) });
  }
  function commitSeats() {
    if (!table) return;
    const n = Math.min(
      50,
      Math.max(1, parseInt(seatsValue, 10) || table.capacity),
    );
    if (n !== table.capacity)
      draftActions.updateTable(table.id, { capacity: n });
    setSeats(String(n));
  }

  async function onSave() {
    commitLabel();
    commitSeats();
    setSaving(true);
    try {
      await save();
    } catch (err) {
      Alert.alert(c.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    if (!table) return;
    Alert.alert(c.deleteTable, fmt(c.deleteTableBody, { table: table.label }), [
      { text: c.cancel, style: "cancel" },
      {
        text: c.delete,
        style: "destructive",
        onPress: () => {
          draftActions.removeTable(table.id);
          router.back();
        },
      },
    ]);
  }

  const peopleLabel = (n: number) =>
    n === 1 ? c.person : fmt(c.people, { n });

  return (
    <Screen
      header={
        <TopBar
          onBack={() => router.back()}
          title={table?.label ?? c.title}
          right={
            draft.dirty ? (
              <Button
                label={c.savePlan}
                small
                onPress={onSave}
                loading={saving}
                disabled={!online}
                full={false}
              />
            ) : undefined
          }
        />
      }
      bottomInset={40}
    >
      {!table ? (
        <EmptyState title={c.error} />
      ) : (
        <>
          <Row gap={10} style={{ marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <SectionLabel>{c.tableName}</SectionLabel>
              <Input
                value={labelValue}
                onChangeText={setLabel}
                onBlur={commitLabel}
                style={{ marginTop: 6 }}
              />
            </View>
            <View style={{ width: 110 }}>
              <SectionLabel>{c.seats}</SectionLabel>
              <Input
                value={seatsValue}
                onChangeText={(t) =>
                  setSeats(t.replace(/[^0-9]/g, "").slice(0, 2))
                }
                onBlur={commitSeats}
                keyboardType="number-pad"
                style={{ marginTop: 6 }}
              />
            </View>
          </Row>
          <View style={{ marginTop: 12 }}>
            <Segmented<"round" | "rect">
              value={table.shape}
              options={[
                { value: "round", label: c.round },
                { value: "rect", label: c.rect },
              ]}
              onChange={(v) => draftActions.updateTable(table.id, { shape: v })}
            />
          </View>
          {table.source === "ai" &&
          table.confidence !== undefined &&
          table.confidence < 1 ? (
            <Row
              gap={10}
              style={{ marginTop: 12, justifyContent: "space-between" }}
            >
              <Badge
                label={`${c.fromPlan} · ${fmt(c.confidence, { pct: Math.round(table.confidence * 100) })}`}
                kind="amber"
              />
              <Pressable
                onPress={() =>
                  draftActions.updateTable(table.id, { confidence: 1 })
                }
                hitSlop={8}
              >
                <T v="meta13" color={colors.goldLight}>
                  {c.confirmTable}
                </T>
              </Pressable>
            </Row>
          ) : null}

          <Row style={{ justifyContent: "space-between", marginTop: 24 }}>
            <SectionLabel>
              {fmt(c.seatedOf, {
                seated: table.seated,
                capacity: table.capacity,
              })}
            </SectionLabel>
            {table.over_capacity ? (
              <Badge label={c.overCapacity} kind="amber" />
            ) : null}
          </Row>
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: "rgba(247,243,236,0.1)",
              marginTop: 8,
            }}
          >
            <View
              style={{
                width: `${Math.min(100, Math.round((table.seated / Math.max(1, table.capacity)) * 100))}%`,
                height: "100%",
                backgroundColor: table.over_capacity
                  ? colors.amber
                  : colors.gold,
                borderRadius: 2,
              }}
            />
          </View>

          {groups.length ? (
            <Card
              kind="solid"
              padding={2}
              style={{ marginTop: 12, paddingHorizontal: 18 }}
            >
              {groups.map((g, gi) => (
                <View key={g.rsvp_id}>
                  <Row
                    style={{
                      justifyContent: "space-between",
                      paddingTop: 12,
                      paddingBottom: 4,
                    }}
                  >
                    <Row gap={10}>
                      <Avatar initials={initialsOf(g.name)} size={32} />
                      <T v="body16">{g.name}</T>
                      {!g.confirmed ? (
                        <Badge label={c.unconfirmed} kind="mute" />
                      ) : null}
                    </Row>
                    <Pressable
                      onPress={() =>
                        draftActions.unseatParty(g.rsvp_id, table.id)
                      }
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={c.removeParty}
                    >
                      <Icon name="x" size={18} color={colors.ivory55} />
                    </Pressable>
                  </Row>
                  {g.rows.map((r, ri) => (
                    <Row
                      key={`${r.index}`}
                      style={{
                        justifyContent: "space-between",
                        minHeight: 40,
                        paddingLeft: 42,
                        borderBottomWidth:
                          gi === groups.length - 1 && ri === g.rows.length - 1
                            ? 0
                            : 1,
                        borderBottomColor: colors.ivory09,
                      }}
                    >
                      <T v="body15" color={colors.ivory70}>
                        {r.person}
                      </T>
                      <Pressable
                        onPress={() =>
                          draftActions.unseatPerson(table.id, r.index)
                        }
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={c.remove}
                      >
                        <T v="meta13" color={colors.ivory55}>
                          {c.remove}
                        </T>
                      </Pressable>
                    </Row>
                  ))}
                </View>
              ))}
            </Card>
          ) : (
            <T v="body15" color={colors.ivory55} style={{ marginTop: 12 }}>
              {c.unseatedHint}
            </T>
          )}

          <Button
            label={c.assign}
            icon="plus"
            kind="glass"
            onPress={() => setAddOpen(true)}
            style={{ marginTop: 16 }}
          />
          {draft.dirty ? (
            <Button
              label={c.savePlan}
              onPress={onSave}
              loading={saving}
              disabled={!online}
              style={{ marginTop: 10 }}
            />
          ) : null}
          <Button
            label={c.deleteTable}
            kind="ghost"
            onPress={remove}
            style={{ marginTop: 18 }}
          />
        </>
      )}

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} top={140}>
        <Stack gap={10} style={{ paddingHorizontal: 20, flex: 1 }}>
          <T v="title26">{c.unseated}</T>
          <Input
            icon="search"
            value={q}
            onChangeText={setQ}
            autoFocus
            autoCorrect={false}
          />
          {candidates.length ? (
            <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
              {candidates.map((p, i) => (
                <ListRow
                  key={p.rsvp_id}
                  leading={<Avatar initials={initialsOf(p.name)} />}
                  title={p.name}
                  sub={`${peopleLabel(p.unseated)}${p.confirmed ? "" : ` · ${c.unconfirmed}`}`}
                  chevron={false}
                  onPress={() => {
                    if (table) draftActions.seatParty(p, table.id);
                    setAddOpen(false);
                    setQ("");
                  }}
                  last={i === candidates.length - 1}
                />
              ))}
            </Card>
          ) : (
            <T v="body15" color={colors.ivory55}>
              {c.allSeated}
            </T>
          )}
        </Stack>
      </Sheet>
    </Screen>
  );
}
