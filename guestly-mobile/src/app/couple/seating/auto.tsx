// Suggest seating: preview the deterministic auto-assign, then apply it.

import React, { useState } from "react";
import { View, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, ApiFailure } from "@/lib/api";
import {
  Screen,
  TopBar,
  BigTitle,
  Card,
  T,
  Button,
  Row,
  Stack,
  SectionLabel,
  Toggle,
  Icon,
  Badge,
} from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/seating/copy";
import {
  useCoupleSeating,
  seedDraft,
  SEATING_KEY,
  type AutoAssignResult,
  type SeatingCriterion,
} from "@/features/seating/hooks";

const ALL: SeatingCriterion[] = ["party", "relationship", "tags", "surname"];

export default function SeatingAuto() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useCoupleSeating();
  const [criteria, setCriteria] = useState<SeatingCriterion[]>(ALL);
  const [includeUnconfirmed, setIncludeUnconfirmed] = useState(false);
  const [preview, setPreview] = useState<AutoAssignResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);

  // Seed the order from the saved plan once it arrives (state adjusted
  // during render, keyed on the server value).
  const serverOrder =
    data?.criteria_order?.length === 4 ? data.criteria_order.join(",") : null;
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  if (serverOrder && serverOrder !== seededFrom) {
    setSeededFrom(serverOrder);
    setCriteria(serverOrder.split(",") as SeatingCriterion[]);
  }

  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...criteria];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setCriteria(next);
    setPreview(null);
  }

  async function run(apply: boolean) {
    setBusy(apply ? "apply" : "preview");
    try {
      const r = await post<AutoAssignResult>("/couple/seating/auto-assign", {
        criteria,
        include_unconfirmed: includeUnconfirmed,
        apply,
      });
      if (apply && r.surface) {
        qc.setQueryData(SEATING_KEY, r.surface);
        seedDraft(r.surface, true);
        router.back();
        return;
      }
      setPreview(r);
    } catch (err) {
      Alert.alert(c.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen
      header={<TopBar onBack={() => router.back()} title={c.suggest} />}
      bottomInset={40}
    >
      <BigTitle title={c.suggest} sub={c.suggestIntro} size={34} />
      <SectionLabel style={{ marginTop: 22 }}>{c.criteria}</SectionLabel>
      <T v="meta13" color={colors.ivory55} style={{ marginTop: 4 }}>
        {c.criteriaHint}
      </T>
      <Card
        kind="solid"
        padding={2}
        style={{ marginTop: 8, paddingHorizontal: 18 }}
      >
        {criteria.map((k, i) => (
          <Pressable
            key={k}
            onPress={() => moveUp(i)}
            accessibilityRole="button"
            style={{
              minHeight: 52,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: i === criteria.length - 1 ? 0 : 1,
              borderBottomColor: colors.ivory09,
            }}
          >
            <Row gap={12}>
              <T v="title26" color={colors.goldLight}>
                {i + 1}
              </T>
              <T v="body16">{c.criterion[k]}</T>
            </Row>
            {i > 0 ? (
              <Icon name="down" size={18} color={colors.ivory55} />
            ) : null}
          </Pressable>
        ))}
      </Card>
      <View style={{ marginTop: 14 }}>
        <Toggle
          value={includeUnconfirmed}
          onChange={(v) => {
            setIncludeUnconfirmed(v);
            setPreview(null);
          }}
          label={c.includeUnconfirmed}
        />
      </View>

      <Button
        label={c.preview}
        kind="glass"
        icon="sparkle"
        onPress={() => run(false)}
        loading={busy === "preview"}
        style={{ marginTop: 20 }}
      />

      {preview ? (
        <Stack gap={10} style={{ marginTop: 18 }}>
          <Row gap={8}>
            <Badge
              label={fmt(c.placed, {
                n: preview.placed.length,
                t: preview.tables_used,
              })}
              kind="green"
            />
            {preview.unplaced.length ? (
              <Badge
                label={fmt(c.unplaced, { n: preview.unplaced.length })}
                kind="amber"
              />
            ) : null}
          </Row>
          {preview.placed.length ? (
            <Card kind="solid" padding={14}>
              {preview.placed.slice(0, 40).map((p) => (
                <Row
                  key={p.rsvp_id}
                  style={{ justifyContent: "space-between", minHeight: 36 }}
                >
                  <T v="body15" style={{ flex: 1 }}>
                    {p.name}
                  </T>
                  <T v="meta13" color={colors.goldLight}>
                    {data?.tables.find((t) => t.id === p.table_id)?.label ??
                      p.table_id}
                  </T>
                </Row>
              ))}
            </Card>
          ) : null}
          {preview.warnings.length ? (
            <View>
              <SectionLabel>{c.warnings}</SectionLabel>
              {preview.warnings.map((w, i) => (
                <T
                  key={i}
                  v="meta13"
                  color={colors.amber}
                  style={{ marginTop: 4 }}
                >
                  {w[lang]}
                </T>
              ))}
            </View>
          ) : null}
          <Button
            label={c.apply}
            onPress={() => run(true)}
            loading={busy === "apply"}
            disabled={!preview.placed.length}
            style={{ marginTop: 6 }}
          />
        </Stack>
      ) : null}
    </Screen>
  );
}
