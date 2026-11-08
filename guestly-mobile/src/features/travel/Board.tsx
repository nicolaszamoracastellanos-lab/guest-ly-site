// #26 the arrivals and departures board on the phone (couple read only,
// planner with logistics view): Arrivals / Departures, then each day with its
// totals, each window ("14:00 to 15:00", parties, people, transfers), each
// place, and the parties with their time, number and badges (icon and word).
// Wall-clock times as typed. Used by /couple/guests/arrivals and
// /planner/weddings/arrivals; both hide on 404 (flag off).

import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { fmt, longDate, plural, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { Card, EmptyState, Icon, Row, Segmented, Stack, T } from "@/ui";
import { colors, fonts } from "@/ui/tokens";
import { TRAVEL_COPY } from "./copy";
import { boardEmpty, type Arrivals, type Board, type BoardRow } from "./core";

const TNUM = { fontVariant: ["tabular-nums" as const] };

export function ArrivalsBoard({ data, planner = false }: { data: Arrivals; planner?: boolean }) {
  const c = useFeatureCopy(TRAVEL_COPY);
  const [dir, setDir] = useState<"arrivals" | "departures">("arrivals");
  const board = data[dir];
  if (boardEmpty(data.arrivals) && boardEmpty(data.departures)) {
    return (
      <View style={{ marginTop: 24 }}>
        <EmptyState title={c.emptyTitle} body={data.collecting ? c.emptyCollecting : planner ? c.emptyNotCollectingPlanner : c.emptyNotCollecting} />
      </View>
    );
  }
  return (
    <View style={{ marginTop: 16 }}>
      <Segmented
        value={dir}
        options={[
          { value: "arrivals", label: c.tabArrivals },
          { value: "departures", label: c.tabDepartures },
        ]}
        onChange={setDir}
      />
      <BoardView board={board} />
    </View>
  );
}

function BoardView({ board }: { board: Board }) {
  const c = useFeatureCopy(TRAVEL_COPY);
  const { lang } = useLang();
  const totals = `${plural(board.totals.parties, c.parties)} · ${plural(board.totals.people, c.people)}`;
  return (
    <Stack gap={18} style={{ marginTop: 14 }}>
      <T v="meta13" color={colors.ivory55} style={TNUM}>
        {totals}
      </T>
      {board.days.map((d) => (
        <View key={d.date} testID={`board-day-${d.date}`}>
          <T v="title26" accessibilityRole="header">
            {cap(longDate(d.date, lang))}
          </T>
          <T v="meta13" color={colors.ivory55} style={TNUM}>
            {`${plural(d.parties, c.parties)} · ${plural(d.people, c.people)}`}
          </T>
          <Stack gap={10} style={{ marginTop: 10 }}>
            {d.windows.map((w, i) => (
              <Card key={`${w.start ?? "none"}-${i}`} kind="solid" padding={14}>
                <Row gap={8} style={{ flexWrap: "wrap" }}>
                  <Icon name="clock" size={16} color={colors.goldLight} />
                  <T v="body16" style={[{ fontFamily: fonts.bodyMedium }, TNUM]}>
                    {w.start && w.end ? fmt(c.windowRange, { from: w.start, to: w.end }) : c.noTime}
                  </T>
                </Row>
                <T v="meta13" color={colors.ivory55} style={[{ marginTop: 2 }, TNUM]}>
                  {[plural(w.parties, c.parties), plural(w.people, c.people), w.needs_transfer ? fmt(c.needTransfer, { n: w.needs_transfer }) : null].filter(Boolean).join(" · ")}
                </T>
                {w.points.map((p, j) => (
                  <View key={`${p.label ?? ""}-${j}`} style={{ marginTop: 10 }}>
                    <Row gap={6}>
                      <Icon name="pin" size={14} color={colors.ivory55} />
                      <T v="meta13" color={colors.ivory70} style={{ flex: 1 }}>
                        {`${p.label ?? c.noPoint} · ${plural(p.people, c.people)}`}
                      </T>
                    </Row>
                    {p.rows.map((r, k) => (
                      <PartyRow key={r.guest_id} r={r} last={k === p.rows.length - 1} />
                    ))}
                  </View>
                ))}
              </Card>
            ))}
          </Stack>
        </View>
      ))}
      {board.undated.length ? (
        <View>
          <T v="title26" accessibilityRole="header">
            {c.noDate}
          </T>
          <Card kind="solid" padding={14} style={{ marginTop: 10 }}>
            {board.undated.map((r, k) => (
              <PartyRow key={r.guest_id} r={r} last={k === board.undated.length - 1} showPoint />
            ))}
          </Card>
        </View>
      ) : null}
      {board.missing > 0 ? (
        <T v="meta13" color={colors.ivory55}>
          {plural(board.missing, board.direction === "arrival" ? c.missingArrival : c.missingDeparture)}
        </T>
      ) : null}
    </Stack>
  );
}

function PartyRow({ r, last, showPoint }: { r: BoardRow; last: boolean; showPoint?: boolean }) {
  const c = useFeatureCopy(TRAVEL_COPY);
  const meta = [r.time, plural(r.people, c.people), r.ref, showPoint ? r.point : null].filter(Boolean).join(" · ");
  return (
    <View style={[styles.row, !last && styles.rule]} accessible accessibilityLabel={[r.name, meta, r.needs_transfer ? c.needsTransfer : null, r.changed_by_guest ? c.changedByGuest : null].filter(Boolean).join(", ")}>
      <T v="body15" color={colors.ivory}>
        {r.name}
      </T>
      <T v="meta13" color={colors.ivory70} style={TNUM}>
        {meta}
      </T>
      {r.needs_transfer || r.changed_by_guest ? (
        <Row gap={12} style={{ marginTop: 2, flexWrap: "wrap" }}>
          {r.needs_transfer ? (
            <Row gap={4}>
              <Icon name="bus" size={14} color={colors.goldLight} />
              <T v="meta13" color={colors.ivory70}>
                {c.needsTransfer}
              </T>
            </Row>
          ) : null}
          {r.changed_by_guest ? (
            <Row gap={4}>
              <Icon name="replay" size={14} color={colors.amber} />
              <T v="meta13" color={colors.ivory70}>
                {c.changedByGuest}
              </T>
            </Row>
          ) : null}
        </Row>
      ) : null}
    </View>
  );
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const styles = StyleSheet.create({
  row: { paddingVertical: 8, marginLeft: 20 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
});
