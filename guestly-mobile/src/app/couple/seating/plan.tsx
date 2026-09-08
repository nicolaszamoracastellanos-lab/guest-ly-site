// Floor plan: the venue photo, upload from camera or library, and the
// concierge reading that finds the tables.

import React, { useState } from "react";
import { View, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { get, post, ApiFailure } from "@/lib/api";
import {
  Screen,
  TopBar,
  BigTitle,
  Card,
  T,
  Button,
  Row,
  Stack,
  Loading,
  Banner,
} from "@/ui";
import { colors, FILL } from "@/ui/tokens";
import { COPY } from "@/features/seating/copy";
import {
  useCoupleSeating,
  seedDraft,
  SEATING_KEY,
  type SeatingSurface,
} from "@/features/seating/hooks";

export default function SeatingPlan() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useCoupleSeating();
  const image = useQuery({
    queryKey: ["couple-seating-image"],
    queryFn: () => get<{ signed_url: string | null }>("/couple/seating/image"),
    staleTime: 45_000,
  });
  const [busy, setBusy] = useState<"upload" | "read" | null>(null);
  const [lastRead, setLastRead] = useState<number | null>(null);

  async function pick(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(fromCamera ? c.cameraDenied : c.photoDenied);
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.85,
      base64: true,
      allowsEditing: false,
    };
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const a = res.assets[0];
    const mime =
      a.mimeType &&
      ["image/jpeg", "image/png", "image/webp"].includes(a.mimeType)
        ? a.mimeType
        : "image/jpeg";
    setBusy("upload");
    try {
      await post("/couple/seating/upload", {
        image_base64: a.base64,
        mime,
        width: a.width,
        height: a.height,
      });
      await Promise.all([
        image.refetch(),
        qc.invalidateQueries({ queryKey: SEATING_KEY }),
      ]);
    } catch (err) {
      Alert.alert(c.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(null);
    }
  }

  async function read() {
    setBusy("read");
    try {
      const r = await post<{
        analysis: { tables_found?: number; tables?: unknown[] };
        surface: SeatingSurface;
      }>("/couple/seating/analyze", { mode: "detect_tables" });
      qc.setQueryData(SEATING_KEY, r.surface);
      seedDraft(r.surface, true);
      const found =
        r.analysis.tables_found ??
        (Array.isArray(r.analysis.tables)
          ? r.analysis.tables.length
          : r.surface.tables.filter((t) => t.source === "ai").length);
      setLastRead(found);
    } catch (err) {
      Alert.alert(c.error, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(null);
    }
  }

  const url = image.data?.signed_url ?? null;

  return (
    <Screen
      header={<TopBar onBack={() => router.back()} title={c.floorPlan} />}
      bottomInset={40}
    >
      <BigTitle title={c.floorPlan} sub={c.floorPlanIntro} size={34} />
      <Card
        kind="solid"
        padding={0}
        style={{ marginTop: 20, height: 260, overflow: "hidden" }}
      >
        {url ? (
          <Image
            source={{ uri: url }}
            style={FILL}
            contentFit="contain"
            transition={200}
            accessibilityLabel={c.floorPlan}
          />
        ) : (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            {image.isLoading ? (
              <Loading />
            ) : (
              <T v="body15" color={colors.ivory55}>
                {c.noPlan}
              </T>
            )}
          </View>
        )}
      </Card>
      {busy === "upload" ? <Loading label={c.uploading} /> : null}
      <Row gap={8} style={{ marginTop: 14 }}>
        <View style={{ flex: 1 }}>
          <Button
            label={c.takePhoto}
            small
            kind="glass"
            icon="camera"
            onPress={() => pick(true)}
            disabled={!!busy}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={c.pickPhoto}
            small
            kind="glass"
            icon="photo"
            onPress={() => pick(false)}
            disabled={!!busy}
          />
        </View>
      </Row>

      {url || data?.has_floor_plan ? (
        <Stack gap={10} style={{ marginTop: 26 }}>
          <T v="meta13" color={colors.ivory55}>
            {c.readPlanHint}
          </T>
          <Button
            label={busy === "read" ? c.reading : c.readPlan}
            icon="sparkle"
            onPress={read}
            loading={busy === "read"}
            disabled={!!busy}
          />
          {lastRead !== null ? (
            <Banner
              icon="check"
              title={fmt(c.readDone, { n: lastRead })}
              kind="gold"
            />
          ) : null}
          {data?.analysis_notes ? (
            <T v="meta13" color={colors.ivory55}>
              {data.analysis_notes}
            </T>
          ) : null}
        </Stack>
      ) : null}
    </Screen>
  );
}
