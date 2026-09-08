// Seating: tables with their fill, the parties still without a seat, and the
// explicit Save. The draft store is shared with the table detail screen.

import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure } from "@/lib/api";
import { useOnline } from "@/lib/query";
import {
  Screen,
  TopBar,
  BigTitle,
  Card,
  T,
  Badge,
  Button,
  Row,
  Stack,
  Skeleton,
  SectionLabel,
  StatTile,
  Sheet,
  Input,
  Segmented,
  ListRow,
  Avatar,
  Toggle,
  Icon,
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
  SEATING_KEY,
  type SeatingParty,
} from "@/features/seating/hooks";

export default function SeatingIndex() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const { data, isLoading, error } = useCoupleSeating();
  const draft = useDraft();
  const save = useSavePlan();
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pick, setPick] = useState<SeatingParty | null>(null);
  const [showUnconfirmed, setShowUnconfirmed] = useState(false);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("8");
  const [shape, setShape] = useState<"round" | "rect">("round");

  useEffect(() => {
    if (data) seedDraft(data);
  }, [data]);

  const view = useMemo(
    () => (data ? deriveDraft(data, draft) : null),
    [data, draft],
  );
  const unseated =
    view?.parties.filter((p) => p.confirmed && p.unseated > 0) ?? [];
  const unconfirmed =
    view?.parties.filter((p) => !p.confirmed && p.unseated > 0) ?? [];
  const pendingDb = error instanceof ApiFailure && error.code === "pending_db";

  function back() {
    if (!draft.dirty) return router.back();
    Alert.alert(c.discardTitle, c.discardBody, [
      { text: c.keepEditing, style: "cancel" },
      {
        text: c.discard,
        style: "destructive",
        onPress: () => {
          if (data) seedDraft(data, true);
          router.back();
        },
      },
    ]);
  }

  async function onSave() {
    setSaving(true);
    try {
      await save();
      void qc.invalidateQueries({ queryKey: SEATING_KEY });
    } catch (err) {
      Alert.alert(c.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setSaving(false);
    }
  }

  function addTable() {
    const label =
      name.trim() ||
      fmt(c.tableNamePlaceholder, {}).replace(
        /1$/,
        String((view?.tables.length ?? 0) + 1),
      );
    const cap = Math.min(50, Math.max(1, parseInt(seats, 10) || 8));
    draftActions.addTable(label, cap, shape);
    setName("");
    setAddOpen(false);
  }

  const peopleLabel = (n: number) =>
    n === 1 ? c.person : fmt(c.people, { n });

  return (
    <Screen
      header={
        <TopBar
          onBack={back}
          title={c.title}
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
      <BigTitle
        title={c.title}
        sub={
          view && view.stats.unseated_parties === 0 && view.stats.seated > 0
            ? c.allSeated
            : c.subtitle
        }
        size={38}
      />
      {pendingDb ? (
        <T v="body15" color={colors.ivory55} style={{ marginTop: 16 }}>
          {error.messages[lang]}
        </T>
      ) : null}
      {isLoading && !data ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={78} r={16} />
          <Skeleton h={120} r={18} />
        </Stack>
      ) : null}
      {view ? (
        <>
          <Row gap={8} style={{ marginTop: 18 }}>
            <StatTile
              value={String(view.stats.seated)}
              label={c.stats.seated}
            />
            <StatTile
              value={String(view.stats.unseated_people)}
              label={c.stats.unseated}
              color={view.stats.unseated_people ? colors.amber : colors.ivory}
            />
            <StatTile
              value={String(view.stats.free_seats)}
              label={c.stats.free}
              color={colors.goldLight}
            />
          </Row>

          <Row gap={8} style={{ marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Button
                label={c.suggest}
                small
                kind="glass"
                icon="sparkle"
                onPress={() => router.push("/couple/seating/auto")}
                disabled={!view.tables.length}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={c.floorPlan}
                small
                kind="glass"
                icon="photo"
                onPress={() => router.push("/couple/seating/plan")}
              />
            </View>
          </Row>

          <Row style={{ justifyContent: "space-between", marginTop: 26 }}>
            <SectionLabel>
              {c.tables} · {view.stats.tables}
            </SectionLabel>
            <Pressable
              onPress={() => setAddOpen(true)}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Row gap={6}>
                <Icon name="plus" size={16} color={colors.goldLight} />
                <T v="meta13" color={colors.goldLight}>
                  {c.addTable}
                </T>
              </Row>
            </Pressable>
          </Row>
          {!view.tables.length ? (
            <T v="body15" color={colors.ivory55} style={{ marginTop: 10 }}>
              {c.noTables}
            </T>
          ) : (
            <Card
              kind="solid"
              padding={2}
              style={{ marginTop: 8, paddingHorizontal: 18 }}
            >
              {view.tables.map((t, i) => (
                <ListRow
                  key={t.id}
                  leading={
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: t.shape === "round" ? 20 : 10,
                        borderWidth: 1,
                        borderColor: t.over_capacity
                          ? "rgba(245,158,11,0.6)"
                          : colors.goldBorder,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <T v="meta13" color={colors.goldLight}>
                        {t.seated}
                      </T>
                    </View>
                  }
                  title={t.label}
                  sub={`${fmt(c.seatedOf, { seated: t.seated, capacity: t.capacity })}${t.source === "ai" && t.confidence !== undefined && t.confidence < 1 ? ` · ${c.draft}` : ""}`}
                  trailing={
                    t.over_capacity ? (
                      <Badge label={c.overCapacity} kind="amber" />
                    ) : undefined
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/couple/seating/table/[id]",
                      params: { id: t.id },
                    })
                  }
                  last={i === view.tables.length - 1}
                />
              ))}
            </Card>
          )}

          <SectionLabel style={{ marginTop: 26 }}>
            {c.unseated} · {unseated.length}
          </SectionLabel>
          <T v="meta13" color={colors.ivory55} style={{ marginTop: 4 }}>
            {c.unseatedHint}
          </T>
          {unseated.length ? (
            <Card
              kind="solid"
              padding={2}
              style={{ marginTop: 8, paddingHorizontal: 18 }}
            >
              {unseated.map((p, i) => (
                <ListRow
                  key={p.rsvp_id}
                  leading={<Avatar initials={initialsOf(p.name)} />}
                  title={p.name}
                  sub={
                    p.table_ids.length
                      ? `${peopleLabel(p.unseated)} · ${fmt(c.splitAcross, { n: p.table_ids.length })}`
                      : peopleLabel(p.unseated)
                  }
                  onPress={() =>
                    view.tables.length ? setPick(p) : setAddOpen(true)
                  }
                  last={i === unseated.length - 1}
                />
              ))}
            </Card>
          ) : null}

          {unconfirmed.length ? (
            <View style={{ marginTop: 22 }}>
              <Toggle
                value={showUnconfirmed}
                onChange={setShowUnconfirmed}
                label={`${c.showUnconfirmed} (${unconfirmed.length})`}
              />
              {showUnconfirmed ? (
                <>
                  <T v="meta13" color={colors.ivory55} style={{ marginTop: 8 }}>
                    {c.unconfirmedHint}
                  </T>
                  <Card
                    kind="solid"
                    padding={2}
                    style={{ marginTop: 8, paddingHorizontal: 18 }}
                  >
                    {unconfirmed.map((p, i) => (
                      <ListRow
                        key={p.rsvp_id}
                        leading={<Avatar initials={initialsOf(p.name)} />}
                        title={p.name}
                        sub={peopleLabel(p.unseated)}
                        onPress={() =>
                          view.tables.length ? setPick(p) : setAddOpen(true)
                        }
                        last={i === unconfirmed.length - 1}
                      />
                    ))}
                  </Card>
                </>
              ) : null}
            </View>
          ) : null}

          {draft.dirty ? (
            <Button
              label={c.savePlan}
              onPress={onSave}
              loading={saving}
              disabled={!online}
              style={{ marginTop: 28 }}
            />
          ) : null}
        </>
      ) : null}

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} top={220}>
        <Stack gap={12} style={{ paddingHorizontal: 20 }}>
          <T v="title26">{c.addTable}</T>
          <SectionLabel>{c.tableName}</SectionLabel>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={c.tableNamePlaceholder.replace(
              /1$/,
              String((view?.tables.length ?? 0) + 1),
            )}
            autoFocus
          />
          <SectionLabel>{c.seats}</SectionLabel>
          <Input
            value={seats}
            onChangeText={(t) => setSeats(t.replace(/[^0-9]/g, "").slice(0, 2))}
            keyboardType="number-pad"
          />
          <SectionLabel>{c.shape}</SectionLabel>
          <Segmented<"round" | "rect">
            value={shape}
            options={[
              { value: "round", label: c.round },
              { value: "rect", label: c.rect },
            ]}
            onChange={setShape}
          />
          <Button
            label={c.addTable}
            icon="plus"
            onPress={addTable}
            style={{ marginTop: 6 }}
          />
        </Stack>
      </Sheet>

      <Sheet visible={!!pick} onClose={() => setPick(null)} top={180}>
        {pick && view ? (
          <Stack gap={10} style={{ paddingHorizontal: 20 }}>
            <T v="title26">{fmt(c.pickTable, { name: pick.name })}</T>
            <T v="meta13" color={colors.ivory55}>
              {peopleLabel(pick.unseated)}
            </T>
            <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
              {view.tables.map((t, i) => (
                <ListRow
                  key={t.id}
                  title={t.label}
                  sub={fmt(c.noRoom, { free: t.free })}
                  trailing={
                    t.free < pick.unseated ? (
                      <Badge label={c.overCapacity} kind="amber" />
                    ) : undefined
                  }
                  chevron={false}
                  onPress={() => {
                    draftActions.seatParty(pick, t.id);
                    setPick(null);
                  }}
                  last={i === view.tables.length - 1}
                />
              ))}
            </Card>
          </Stack>
        ) : null}
      </Sheet>
    </Screen>
  );
}
