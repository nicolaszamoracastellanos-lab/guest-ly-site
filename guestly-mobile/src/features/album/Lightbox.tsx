// Full-screen photo viewer: swipe between photos, the caption and who shared
// it, Close. Opens on the tapped photo.

import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { T, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { ALBUM_COPY } from "./copy";
import type { AlbumPhoto } from "./grid";

export function Lightbox({ photos, index, onClose, headers }: { photos: AlbumPhoto[]; index: number | null; onClose: () => void; headers?: Record<string, string> }) {
  const c = useFeatureCopy(ALBUM_COPY);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [at, setAt] = useState(index ?? 0);
  // State adjusted during render: a new tapped photo resets the position.
  const [openedAt, setOpenedAt] = useState(index);
  if (openedAt !== index) {
    setOpenedAt(index);
    if (index !== null) setAt(index);
  }
  const cur = photos[at];
  return (
    <Modal visible={index !== null} animationType="fade" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <View style={styles.root}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(p) => p.id}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setAt(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <View style={{ width, height }} accessible accessibilityRole="image" accessibilityLabel={item.caption ?? fmt(c.photo, { n: i + 1, total: photos.length })}>
              <Image source={{ uri: item.url_1200, headers, cacheKey: `album-1200-${item.id}` }} recyclingKey={item.id} placeholder={{ uri: item.url_480, headers, cacheKey: `album-480-${item.id}` }} contentFit="contain" style={{ width, height }} />
            </View>
          )}
        />
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={c.close} hitSlop={10} style={[styles.close, { top: insets.top + 8 }]}>
          <Icon name="x" size={24} color={colors.ivory} />
        </Pressable>
        {cur ? (
          <View style={[styles.foot, { paddingBottom: insets.bottom + 16 }]} pointerEvents="none">
            <T v="meta13" color={colors.ivory70}>
              {fmt(c.photo, { n: at + 1, total: photos.length })}
              {cur.guest_name ? ` · ${fmt(c.by, { name: cur.guest_name })}` : ""}
            </T>
            {cur.caption ? <T v="body15">{cur.caption}</T> : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  close: { position: "absolute", right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(13,17,23,0.6)", alignItems: "center", justifyContent: "center" },
  foot: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 16, gap: 4, backgroundColor: "rgba(0,0,0,0.45)" },
});
