// The couple's album: To review / Shown / Hidden. A tap opens the photo; a
// long press offers Show or Hide; Select turns on a multi-select bar (the
// inbox selection pattern) to act on many. The top bar copies the guests'
// album link and opens the album settings (open to guests, review first,
// guests see everyone's photos). Viewers read only.

import React, { useMemo, useState } from "react";
import { Alert, FlatList, View, ActivityIndicator } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, plural, useCopy, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { API_BASE, authHeaders, isMissingEndpoint, post } from "@/lib/api";
import { errorText } from "@/features/shared/requests";
import { useSafeBack } from "@/lib/nav";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Button, ButtonRow, EmptyState, Skeleton, Segmented, Sheet, Card, ToggleRow, Stack, T, Row, IconButton, QueryError, useBottomClearance, toast } from "@/ui";
import { colors } from "@/ui/tokens";
import { ALBUM_COPY } from "../copy";
import { COUPLE_ALBUM_KEY, useCoupleAlbum, type AlbumSettings } from "../hooks";
import type { AlbumPhoto, AlbumStatus } from "../grid";
import { GRID_GAP, PhotoTile, useTile } from "../PhotoGrid";
import { Lightbox } from "../Lightbox";

const PAD = 16;

/** The couple's own credential for photo bytes served by the portal. */
function usePhotoHeaders(): Record<string, string> | undefined {
  const [h, setH] = useState<Record<string, string> | undefined>(undefined);
  React.useEffect(() => {
    let alive = true;
    authHeaders()
      .then((x) => alive && setH(x))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return h;
}

export function CoupleAlbumScreen() {
  const c = useFeatureCopy(ALBUM_COPY);
  const app = useCopy();
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const user = useUserSession();
  const canEdit = user?.me.can_edit ?? false;
  const [status, setStatus] = useState<AlbumStatus>("pending");
  const query = useCoupleAlbum(status);
  const pages = useMemo(() => query.data?.pages ?? [], [query.data]);
  const photos = useMemo(() => pages.flatMap((p) => p.items), [pages]);
  const settings = pages[0]?.settings ?? null;
  const shareUrl = pages[0]?.share_url ?? (user?.me.tenant.slug ? `${API_BASE}/album/${user.me.tenant.slug}` : null);
  const headers = usePhotoHeaders();
  const { size, columns } = useTile(PAD);
  const { clearance } = useBottomClearance();
  const [open, setOpen] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function moderate(ids: string[], to: "approved" | "hidden") {
    if (!ids.length || busy) return;
    setBusy(true);
    // Optimistic: the photos leave this tab at once.
    const key = [...COUPLE_ALBUM_KEY, status];
    const prev = qc.getQueryData(key);
    qc.setQueryData(key, (d: typeof query.data) => (d ? { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.filter((i) => !ids.includes(i.id)) })) } : d));
    try {
      for (const id of ids) await post(`/couple/album/${encodeURIComponent(id)}`, { status: to });
      toast(plural(ids.length, to === "approved" ? c.approved : c.hiddenDone));
      setPicked(new Set());
      setSelecting(false);
    } catch (err) {
      qc.setQueryData(key, prev);
      toast(errorText(err, lang, app.common.errorBody), { icon: "warning" });
    } finally {
      setBusy(false);
      void qc.invalidateQueries({ queryKey: COUPLE_ALBUM_KEY });
    }
  }

  function menu(p: AlbumPhoto) {
    if (!canEdit) return;
    Alert.alert(p.guest_name ? fmt(c.by, { name: p.guest_name }) : c.byGuest, undefined, [
      ...(p.status !== "approved" ? [{ text: c.approve, onPress: () => void moderate([p.id], "approved") }] : []),
      ...(p.status !== "hidden" ? [{ text: c.hide, style: "destructive" as const, onPress: () => void moderate([p.id], "hidden") }] : []),
      { text: app.common.cancel, style: "cancel" as const },
    ]);
  }

  async function saveSettings(patch: Partial<AlbumSettings>) {
    const key = [...COUPLE_ALBUM_KEY, status];
    const prev = qc.getQueryData(key);
    qc.setQueryData(key, (d: typeof query.data) => (d ? { ...d, pages: d.pages.map((p, i) => (i === 0 && p.settings ? { ...p, settings: { ...p.settings, ...patch } } : p)) } : d));
    try {
      await post("/couple/album/settings", patch);
      void qc.invalidateQueries({ queryKey: COUPLE_ALBUM_KEY });
    } catch (err) {
      qc.setQueryData(key, prev);
      toast(errorText(err, lang, app.common.errorBody), { icon: "warning" });
    }
  }

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const right = (
    <Row gap={4}>
      {shareUrl ? (
        <IconButton
          name="copy"
          label={c.share}
          onPress={() =>
            void Clipboard.setStringAsync(shareUrl)
              .then(() => toast(c.copied))
              .catch(() => {})
          }
        />
      ) : null}
      {canEdit && settings ? <IconButton name="gear" label={c.settings} onPress={() => setSettingsOpen(true)} /> : null}
    </Row>
  );

  const dock =
    canEdit && selecting ? (
      <View style={{ gap: 8 }}>
        <T v="meta13" color={colors.ivory70} center>
          {plural(picked.size, c.selected)}
        </T>
        <ButtonRow>
          {status !== "approved" ? <Button label={c.approve} small onPress={() => void moderate([...picked], "approved")} disabled={!picked.size} loading={busy} /> : null}
          {status !== "hidden" ? <Button label={c.hide} small kind="glass" onPress={() => void moderate([...picked], "hidden")} disabled={!picked.size} loading={busy} /> : null}
        </ButtonRow>
      </View>
    ) : undefined;

  const header = (
    <View style={{ paddingHorizontal: PAD, paddingBottom: 12, gap: 14 }}>
      <BigTitle title={c.title} sub={c.coupleSub} size={38} />
      <Segmented
        value={status}
        options={[
          { value: "pending", label: c.tabs.pending },
          { value: "approved", label: c.tabs.approved },
          { value: "hidden", label: c.tabs.hidden },
        ]}
        onChange={(v) => {
          setStatus(v);
          setPicked(new Set());
        }}
      />
      {canEdit && photos.length ? (
        <Row style={{ justifyContent: "flex-end" }}>
          <Button
            label={selecting ? c.done : c.select}
            kind="text"
            small
            full={false}
            onPress={() => {
              setSelecting((v) => !v);
              setPicked(new Set());
            }}
            testID="album-select"
          />
        </Row>
      ) : null}
    </View>
  );

  return (
    <Screen scroll={false} padded={false} contentStyle={{ flex: 1 }} header={<TopBar onBack={back} title={c.title} right={right} />} dock={dock}>
      <FlatList
        key={columns}
        data={photos}
        numColumns={columns}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={columns > 1 ? { gap: GRID_GAP, paddingHorizontal: PAD } : undefined}
        contentContainerStyle={{ gap: GRID_GAP, paddingBottom: clearance + (selecting ? 120 : 24) }}
        ListHeaderComponent={header}
        onEndReached={() => (query.hasNextPage && !query.isFetchingNextPage ? void query.fetchNextPage() : undefined)}
        onEndReachedThreshold={0.6}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.goldLight} style={{ marginVertical: 18 }} /> : undefined}
        renderItem={({ item, index }) => (
          <PhotoTile
            photo={item}
            size={size}
            headers={headers}
            label={[fmt(c.photo, { n: index + 1, total: photos.length }), item.guest_name ? fmt(c.by, { name: item.guest_name }) : null].filter(Boolean).join(", ")}
            selected={selecting ? picked.has(item.id) : undefined}
            onPress={() => (selecting ? toggle(item.id) : setOpen(index))}
            onLongPress={() => menu(item)}
          />
        )}
        ListEmptyComponent={
          query.isLoading ? (
            <Row gap={GRID_GAP} style={{ paddingHorizontal: PAD }}>
              <Skeleton w={size} h={size} r={0} />
              <Skeleton w={size} h={size} r={0} />
              <Skeleton w={size} h={size} r={0} />
            </Row>
          ) : isMissingEndpoint(query.error) ? (
            <View style={{ paddingHorizontal: PAD }}>
              <EmptyState title={c.empty} body={c.emptyCouple} />
            </View>
          ) : query.isError ? (
            <QueryError onRetry={() => void query.refetch()} />
          ) : (
            <View style={{ paddingHorizontal: PAD }}>
              <EmptyState title={c.empty} body={c.emptyCouple} />
            </View>
          )
        }
      />
      <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} headers={headers} />
      <Sheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} top={300}>
        <T v="title30">{c.settings}</T>
        {settings ? (
          <Card kind="solid" padding={16} style={{ marginTop: 14 }}>
            <Stack gap={14}>
              <ToggleRow label={c.enabled} hint={c.enabledHint} value={settings.enabled} onChange={(v) => void saveSettings({ enabled: v })} />
              <ToggleRow label={c.review} hint={c.reviewHint} value={settings.moderation === "review"} onChange={(v) => void saveSettings({ moderation: v ? "review" : "auto" })} />
              <ToggleRow label={c.shareWithGuests} hint={c.shareWithGuestsHint} value={settings.share_with_guests} onChange={(v) => void saveSettings({ share_with_guests: v })} />
            </Stack>
          </Card>
        ) : null}
      </Sheet>
    </Screen>
  );
}
