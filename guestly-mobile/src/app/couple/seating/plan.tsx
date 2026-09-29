// Floor plan: the venue photo, upload from camera or library, and the
// concierge reading that finds the tables.

import React, { useState } from "react";
import { View, Alert } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { fmt, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { get } from "@/lib/api";
import { useUserSession } from "@/lib/session";
import { prepareImageForUpload } from "@/features/shared/images";
import { postLong, outcomeUnknown, AI_TIMEOUT_MS, UPLOAD_TIMEOUT_MS, errorText } from "@/features/shared/requests";
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
import { useSafeBack } from "@/lib/nav";

export default function SeatingPlan() {
  const c = useFeatureCopy(COPY);
  const app = useCopy();
  const { lang } = useLang();
  const canEdit = useUserSession()?.me.can_edit ?? false;
  const back = useSafeBack();
  const qc = useQueryClient();
  const mainQuery = useCoupleSeating();
  const { data } = mainQuery;
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
    // No base64 from the picker: a 12 to 48 MP photo went up as 5 to 12 MB
    // of JSON, past the host's request limit. It is shrunk to a 2048 px JPEG
    // on the phone first.
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 1,
      base64: false,
      allowsEditing: false,
    };
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setBusy("upload");
    try {
      const img = await prepareImageForUpload(a);
      if (!img.base64 || img.base64.length > 4_000_000) {
        Alert.alert(c.photoTooBig);
        return;
      }
      await postLong(
        "/couple/seating/upload",
        {
          image_base64: img.base64,
          mime: img.mime,
          width: img.width,
          height: img.height,
        },
        UPLOAD_TIMEOUT_MS,
      );
      await Promise.all([
        image.refetch(),
        qc.invalidateQueries({ queryKey: SEATING_KEY }),
      ]);
    } catch (err) {
      Alert.alert(c.error, errorText(err, lang, app.common.errorBody));
    } finally {
      setBusy(null);
    }
  }

  async function read() {
    if (busy) return;
    setBusy("read");
    try {
      // A vision read takes 25 to 50 s. It writes tables server-side, so a
      // timeout is never retried automatically (that would read twice).
      const r = await postLong<{
        analysis: { tables_found?: number; tables?: unknown[] };
        surface: SeatingSurface;
      }>("/couple/seating/analyze", { mode: "detect_tables" }, AI_TIMEOUT_MS);
      qc.setQueryData(SEATING_KEY, r.surface);
      seedDraft(r.surface, true);
      const found =
        r.analysis.tables_found ??
        (Array.isArray(r.analysis.tables)
          ? r.analysis.tables.length
          : r.surface.tables.filter((t) => t.source === "ai").length);
      setLastRead(found);
    } catch (err) {
      if (outcomeUnknown(err)) {
        Alert.alert(c.readMaybeDone);
        void qc.invalidateQueries({ queryKey: SEATING_KEY });
      } else {
        Alert.alert(c.error, errorText(err, lang, app.common.errorBody));
      }
    } finally {
      setBusy(null);
    }
  }

  const url = image.data?.signed_url ?? null;

  return (
    <Screen query={mainQuery}
      header={<TopBar onBack={back} title={c.title} />}
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
      {!canEdit ? (
        <T v="meta13" color={colors.ivory55} style={{ marginTop: 14 }}>
          {c.readOnly}
        </T>
      ) : null}
      {canEdit ? (
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
      ) : null}

      {canEdit && (url || data?.has_floor_plan) ? (
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
