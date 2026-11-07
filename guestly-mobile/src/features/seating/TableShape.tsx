// #55 table shapes on screen: one table drawn from the shared geometry
// (TableArtView), a table fitted to a small box (TableMark, the list rows and
// the table screen), and the whole plan with every table where it stands
// (SeatingPlanMap: couple and planner seating, the day saved on the phone).
// The geometry and the words come from ./shapeView.ts (pure, tested).

import React, { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { T } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { fitArt, planLayout, readShape, tableA11y, type Lang, type PlanTableIn, type ShapeFields, type TableArt } from "./shapeView";

const BODY_FILL = colors.ivory09;
const SEAT_TAKEN = colors.ivory70;

/** One table: its top and one dot per chair, the first `seated` chairs filled. */
export function TableArtView({ art, seated, over, dot }: { art: TableArt; seated: number; over?: boolean; dot: number }) {
  const stroke = over ? colors.amber : colors.ivory40;
  return (
    <Svg width={art.w} height={art.h} accessible={false}>
      <Path d={art.body} fill={BODY_FILL} stroke={stroke} strokeWidth={1.2} />
      {art.seats.map((p, i) =>
        i < seated ? (
          <Circle key={i} cx={p.x} cy={p.y} r={dot} fill={over ? colors.amber : SEAT_TAKEN} />
        ) : (
          <Circle key={i} cx={p.x} cy={p.y} r={dot - 0.5} fill="none" stroke={colors.ivory40} strokeWidth={1} />
        ),
      )}
    </Svg>
  );
}

/** A table fitted to a size x size box (a list row's lead, the table screen's figure). Decorative: the row's words name it. */
export function TableMark({ table, capacity, seated, over, size = 40 }: { table: ShapeFields; capacity: number; seated: number; over?: boolean; size?: number }) {
  const small = size < 80;
  const gap = small ? 3 : 9;
  const dot = small ? 2 : 4.5;
  const art = useMemo(() => fitArt({ capacity, ...readShape(table) }, size, size, { gap, dot }), [table, capacity, size, gap, dot]);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessible={false} importantForAccessibility="no-hide-descendants">
      <TableArtView art={art} seated={Math.min(seated, capacity)} over={over} dot={dot} />
    </View>
  );
}

/**
 * The plan: every table where it stands (x and y of the plan), one scale for
 * the whole plan so long tables are longer, turned as set, chairs drawn, the
 * table's number on its top. Each table is one VoiceOver element that names
 * it, its shape and its seats. Height is three quarters of the width.
 */
export function SeatingPlanMap({ tables, lang, testID }: { tables: readonly (PlanTableIn & { over?: boolean })[]; lang: Lang; testID?: string }) {
  const [w, setW] = useState(0);
  const h = Math.round(w * 0.75);
  const laid = useMemo(() => (w > 0 ? planLayout(tables, w, h) : []), [tables, w, h]);
  const overById = useMemo(() => new Map(tables.map((t) => [t.id, !!t.over])), [tables]);
  return (
    <View style={[styles.plan, { height: w ? h : undefined, aspectRatio: w ? undefined : 4 / 3 }]} onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))} testID={testID}>
      {laid.map((t) => {
        const over = overById.get(t.id) ?? false;
        return (
          <View
            key={t.id}
            style={{ position: "absolute", left: t.left, top: t.top, width: t.art.w, height: t.art.h }}
            accessible
            accessibilityLabel={tableA11y(lang, { label: t.label, shape: t.drawn.shape, capacity: t.capacity, seated: t.seated, over })}
          >
            <TableArtView art={t.art} seated={Math.min(t.seated ?? 0, t.capacity)} over={over} dot={2.6} />
            <View pointerEvents="none" style={[styles.markBox, { left: t.art.label.x - 40, top: t.art.label.y - 12 }]}>
              <View style={t.art.plate ? styles.plate : null}>
                <T v="meta13" color={colors.ivory} numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.mark}>
                  {t.mark}
                </T>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  plan: {
    width: "100%",
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ivory14,
    backgroundColor: colors.glassSolidFill,
    overflow: "hidden",
  },
  markBox: { position: "absolute", width: 80, height: 24, alignItems: "center", justifyContent: "center" },
  mark: { fontVariant: ["tabular-nums"], textAlign: "center" },
  // On a U's bar, a serpentine's band or a thin top the mark sits on a small plate in the plan's own night.
  plate: { backgroundColor: colors.night, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.ivory40, paddingHorizontal: 4 },
});
