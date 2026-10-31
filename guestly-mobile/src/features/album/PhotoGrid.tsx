// The album grid: square tiles, 3 columns on a phone and 5 or 6 on a wide
// window (grid.ts), expo-image with a stable cache key per photo.

import React from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Icon, T } from "@/ui";
import { colors } from "@/ui/tokens";
import { gridColumns, tileSize, type AlbumPhoto } from "./grid";

export const GRID_GAP = 3;

export function useTile(padding: number): { columns: number; size: number } {
  const { width } = useWindowDimensions();
  const columns = gridColumns(width);
  return { columns, size: tileSize(width, columns, GRID_GAP, padding) };
}

export function PhotoTile({
  photo,
  size,
  onPress,
  onLongPress,
  selected,
  badge,
  headers,
  label,
}: {
  photo: AlbumPhoto;
  size: number;
  onPress: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  badge?: string | null;
  headers?: Record<string, string>;
  label: string;
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="imagebutton" accessibilityLabel={label} accessibilityState={selected !== undefined ? { selected } : undefined} style={({ pressed }) => [{ width: size, height: size }, pressed && { opacity: 0.85 }]}>
      <Image source={{ uri: photo.url_480, headers, cacheKey: `album-480-${photo.id}` }} recyclingKey={photo.id} contentFit="cover" transition={120} style={{ width: size, height: size, backgroundColor: colors.navy }} />
      {badge ? (
        <View style={styles.badge}>
          <T v="label11" color={colors.ivory}>
            {badge}
          </T>
        </View>
      ) : null}
      {selected !== undefined ? (
        <View style={[styles.check, selected && styles.checkOn]}>{selected ? <Icon name="check" size={14} color={colors.night} strokeWidth={2.4} /> : null}</View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { position: "absolute", left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(13,17,23,0.72)" },
  check: { position: "absolute", right: 6, top: 6, width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.ivory, backgroundColor: "rgba(13,17,23,0.4)", alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.goldLight, borderColor: colors.goldLight },
});
