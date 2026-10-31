// The guest's wedding album: the photos this guest may see (everyone's, or
// only their own when the couple keeps the album private), Add photos docked
// at the bottom, and the upload list with a progress bar per photo, Try again
// and Remove. Uploads go through the persisted queue (../upload), so a photo
// picked with no signal is sent when the connection is back.

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Alert, FlatList, Linking, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQueryClient } from "@tanstack/react-query";
import { fmt, useCopy } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { isMissingEndpoint } from "@/lib/api";
import { useSafeBack } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { useOnline } from "@/lib/query";
import { Screen, TopBar, BigTitle, Button, EmptyState, Skeleton, Stack, T, Row, Card, Icon, QueryError, useBottomClearance } from "@/ui";
import { colors } from "@/ui/tokens";
import { ALBUM_COPY } from "../copy";
import { GUEST_ALBUM_KEY, isAlbumClosed, useGuestAlbum } from "../hooks";
import { queueSummary, type AlbumPhoto, type UploadEntry } from "../grid";
import { clearDone, drainAlbumQueue, getAlbumQueue, openAlbumQueue, pickPhotos, removeUpload, retryUpload, subscribeAlbumQueue } from "../upload";
import { GRID_GAP, PhotoTile, useTile } from "../PhotoGrid";
import { Lightbox } from "../Lightbox";

const PAD = 16;

export function GuestAlbumScreen() {
  const c = useFeatureCopy(ALBUM_COPY);
  const app = useCopy();
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
  const { state } = useSession();
  const scope = state.status === "guest" ? `${state.tenant.slug}.${state.guest.id}` : "none";
  const query = useGuestAlbum();
  const album = query.data?.album;
  const photos = useMemo(() => query.data?.photos ?? [], [query.data]);
  const queue = useSyncExternalStore(subscribeAlbumQueue, getAlbumQueue);
  const sum = queueSummary(queue);
  const { size, columns } = useTile(PAD);
  const { clearance } = useBottomClearance();
  const [open, setOpen] = useState<number | null>(null);

  const refreshAlbum = () => void qc.invalidateQueries({ queryKey: GUEST_ALBUM_KEY });

  useEffect(() => {
    void openAlbumQueue(scope).then(() => drainAlbumQueue(refreshAlbum));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  // Back online: send what waited.
  useEffect(() => {
    if (online) void drainAlbumQueue(refreshAlbum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);
  // A finished batch: the album shows the photos, the list forgets them.
  useEffect(() => {
    if (sum.total > 0 && !sum.active && sum.failed === 0) {
      const t = setTimeout(() => void clearDone(), 1500);
      return () => clearTimeout(t);
    }
  }, [sum.total, sum.active, sum.failed]);

  async function add() {
    const r = await pickPhotos();
    if (r === "no_permission") {
      Alert.alert(c.add, c.noPermission, [
        { text: app.common.cancel, style: "cancel" },
        { text: c.openSettings, onPress: () => void Linking.openSettings().catch(() => {}) },
      ]);
    } else if (r === "added") void drainAlbumQueue(refreshAlbum);
  }

  const closed = isMissingEndpoint(query.error) || isAlbumClosed(query.error) || (!!album && !album.enabled);
  const canUpload = !!album?.upload && !closed;

  const header = (
    <View style={{ paddingHorizontal: PAD, paddingBottom: 12 }}>
      <BigTitle title={c.title} sub={album && !album.see_all ? c.onlyMine : c.guestSub} size={38} />
      {queue.length ? <UploadList queue={queue} done={sum.done} total={sum.total} onRetry={(id) => void retryUpload(id, refreshAlbum)} onRemove={(id) => void removeUpload(id)} /> : null}
    </View>
  );

  const label = (p: AlbumPhoto, i: number) => [fmt(c.photo, { n: i + 1, total: photos.length }), p.mine ? c.mine : null, p.status === "pending" ? c.waiting : null].filter(Boolean).join(", ");

  return (
    <Screen
      scroll={false}
      padded={false}
      contentStyle={{ flex: 1 }}
      header={<TopBar onBack={back} title={c.title} />}
      dock={canUpload ? <Button label={photos.length || queue.length ? c.addMore : c.add} icon="camera" onPress={() => void add()} testID="album-add" /> : undefined}
    >
      <FlatList
        key={columns}
        data={closed ? [] : photos}
        numColumns={columns}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={columns > 1 ? { gap: GRID_GAP, paddingHorizontal: PAD } : undefined}
        contentContainerStyle={{ gap: GRID_GAP, paddingBottom: clearance + 90 }}
        ListHeaderComponent={header}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        renderItem={({ item, index }) => <PhotoTile photo={item} size={size} label={label(item, index)} badge={item.status === "pending" ? c.waiting : item.status === "hidden" ? c.hidden : null} onPress={() => setOpen(index)} />}
        ListEmptyComponent={
          query.isLoading ? (
            <Row gap={GRID_GAP} style={{ paddingHorizontal: PAD }}>
              <Skeleton w={size} h={size} r={0} />
              <Skeleton w={size} h={size} r={0} />
              <Skeleton w={size} h={size} r={0} />
            </Row>
          ) : closed ? (
            <View style={{ paddingHorizontal: PAD }}>
              <EmptyState title={c.closed} />
            </View>
          ) : query.isError ? (
            <QueryError onRetry={() => void query.refetch()} />
          ) : (
            <View style={{ paddingHorizontal: PAD }}>
              <EmptyState title={c.empty} body={canUpload ? c.emptyGuest : undefined} />
            </View>
          )
        }
      />
      <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

function UploadList({ queue, done, total, onRetry, onRemove }: { queue: UploadEntry[]; done: number; total: number; onRetry: (id: string) => void; onRemove: (id: string) => void }) {
  const c = useFeatureCopy(ALBUM_COPY);
  const failed = queue.filter((e) => e.state === "failed");
  const reason = (e: UploadEntry) => (e.error === "too_large" ? c.tooLarge : e.error === "not_image" ? c.notImage : e.error === "offline" ? c.queued : c.uploadFailed);
  return (
    <Card kind="solid" padding={14} style={{ marginTop: 14 }}>
      <T v="meta13" color={colors.ivory70} accessibilityLiveRegion="polite">
        {fmt(c.uploading, { done, total })}
      </T>
      <View style={styles.track}>
        <View style={[styles.bar, { width: `${total ? ((done + queue.filter((e) => e.state === "uploading").reduce((a, e) => a + e.progress, 0)) / total) * 100 : 0}%` }]} />
      </View>
      {failed.length ? (
        <Stack gap={8} style={{ marginTop: 12 }}>
          {failed.map((e) => (
            <Row key={e.client_id} gap={10}>
              <Image source={{ uri: e.uri }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="meta13" color={e.error === "offline" ? colors.ivory70 : colors.amber} numberOfLines={2}>
                  {reason(e)}
                </T>
              </View>
              {e.error === "too_large" || e.error === "not_image" ? null : <Button label={c.retry} kind="text" small full={false} onPress={() => onRetry(e.client_id)} />}
              <Button label={c.remove} kind="text" small full={false} onPress={() => onRemove(e.client_id)} />
            </Row>
          ))}
        </Stack>
      ) : null}
      {failed.length ? (
        <Row gap={6} style={{ marginTop: 6 }}>
          <Icon name="warning" size={14} color={colors.amber} />
          <T v="caption14" color={colors.ivory55}>
            {c.uploadFailed}
          </T>
        </Row>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, borderRadius: 2, backgroundColor: colors.ivory09, marginTop: 8, overflow: "hidden" },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.gold },
  thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: colors.navy },
});
