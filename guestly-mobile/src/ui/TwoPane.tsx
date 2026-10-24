// TwoPane: a list and its detail side by side when the window can hold both,
// one pane otherwise. The ROUTE never changes between poses: a detail route
// ([id]) renders the list on the left and its own detail on the right when
// there is room, and the detail alone when there is not. Folding or unfolding
// the Duo therefore keeps the same record on screen (Apple Group Lab: a
// display change is a size-class change, the process and the scene stay).
//
// Rules (iphone-duo-v2-oct23/05, section 4):
// - list width 300 (regular) or 320 (wide), 1 pt separator;
// - the selection stays highlighted in the list (the list rows do that);
// - nothing interactive sits on the fold: in the "book" pose the separator
//   widens to the fold channel and each pane keeps its own margin;
// - each pane scrolls on its own and owns its own toolbar.

import React, { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useLayout } from "./layout";
import { colors } from "./tokens";

/** Width of the channel left free over the fold in the book pose. Replaced by
 *  the real division region once the guestly-duo module reports it (T1.5). */
export const FOLD_CHANNEL_FALLBACK = 48;

export function TwoPane({
  list,
  detail,
  placeholder,
  foldWidth,
  style,
}: {
  list: ReactNode;
  /** The selected record's detail, or null/undefined when nothing is selected. */
  detail?: ReactNode;
  /** Shown on the right while nothing is selected (two panes only). */
  placeholder?: ReactNode;
  /** Width of the fold channel, when the module knows it. */
  foldWidth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { twoPane, listWidth, pose } = useLayout();
  if (!twoPane) return <View style={[styles.single, style]}>{detail ?? list}</View>;
  const book = pose === "book";
  const gap = book ? foldWidth ?? FOLD_CHANNEL_FALLBACK : 1;
  return (
    <View style={[styles.row, style]}>
      <View style={book ? styles.half : { width: listWidth }}>{list}</View>
      <View style={[styles.sep, { width: gap }, book && styles.fold]} accessible={false} importantForAccessibility="no" pointerEvents="none" />
      <View style={book ? styles.half : styles.detail}>{detail ?? placeholder ?? null}</View>
    </View>
  );
}

/** The right pane while nothing is selected. */
export function TwoPanePlaceholder({ children }: { children: ReactNode }) {
  return <View style={styles.placeholder}>{children}</View>;
}

const styles = StyleSheet.create({
  single: { flex: 1 },
  row: { flex: 1, flexDirection: "row" },
  half: { flex: 1, minWidth: 0 },
  detail: { flex: 1, minWidth: 0 },
  sep: { backgroundColor: colors.ivory14 },
  fold: { backgroundColor: "rgba(0,0,0,0.35)" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
});
