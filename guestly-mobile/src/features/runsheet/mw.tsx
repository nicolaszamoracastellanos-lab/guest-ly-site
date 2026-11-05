// The 1.4.0 runsheet pieces shared by the couple and planner screens:
//  #2  LockLine (couple), PlannerLockRow, RequestList and RequestDiff;
//  #9  PlacesSection with Apple Maps and Google Maps buttons (deep links);
//  #40 GlamPanel, the hair and makeup schedule under a block (read only).
// Each renders nothing when its payload key is absent (flag off, or a portal
// below the wave), so the screens stay as they were.

import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { fmt, shortDate, useLang, useCopy } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { openUrlSafe } from "@/features/guest/links";
import { Button, Card, Icon, Row, SectionLabel, Stack, T } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "./copy";
import {
  glamSummary,
  glamWarningParts,
  lockDate,
  mapLinks,
  sortedSlots,
  warnedSlotIds,
  type ChangeRequest,
  type FieldChange,
  type GlamSlot,
  type GlamWarning,
  type RunsheetLock,
  type RunsheetPlace,
} from "./core";

type C = (typeof COPY)["en"];
const TNUM = { fontVariant: ["tabular-nums" as const] };

// ------------------------------------------------------------------ #2

/** "Locked by your planner, Nov 5" with the lock mark (status never by color
 *  alone), the couple's hint, and D28's sentence when this person may not mark. */
export function LockLine({ lock, hint, markSentence }: { lock: RunsheetLock; hint: boolean; markSentence: boolean }) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  if (!lock.locked) return null;
  const date = lockDate(lock.at, lang);
  const line = lock.by_name && date ? fmt(c.lockedBy, { name: lock.by_name, date }) : date ? fmt(c.lockedByPlanner, { date }) : c.lockedNoDate;
  return (
    <Stack gap={4} style={{ marginTop: 12 }}>
      <Row gap={8} align="flex-start">
        <Icon name="lock" size={18} color={colors.ivory70} />
        <T v="body15" color={colors.ivory} style={{ flex: 1 }} testID="runsheet-lock-line">
          {line}
        </T>
      </Row>
      {lock.note ? (
        <T v="meta13" color={colors.ivory55} style={{ marginLeft: 26 }}>
          {lock.note}
        </T>
      ) : null}
      {markSentence ? (
        <T v="meta13" color={colors.ivory55} style={{ marginLeft: 26 }}>
          {c.lockedStatus}
        </T>
      ) : null}
      {hint ? (
        <T v="meta13" color={colors.ivory55} style={{ marginLeft: 26 }}>
          {c.lockedHint}
        </T>
      ) : null}
    </Stack>
  );
}

/** The planner's lock control: the state in words and one button. */
export function PlannerLockRow({ lock, busy, onToggle }: { lock: RunsheetLock; busy: boolean; onToggle: (locked: boolean) => void }) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const date = lockDate(lock.at, lang);
  return (
    <Card kind="solid" padding={14} style={{ marginTop: 14 }}>
      <Row gap={10} align="flex-start">
        <Icon name="lock" size={20} color={lock.locked ? colors.ivory : colors.ivory55} />
        <T v="body15" color={colors.ivory} style={{ flex: 1 }} testID="planner-lock-line">
          {lock.locked ? (date ? fmt(c.plannerLockedLine, { date }) : c.plannerLockedNoDate) : c.openLine}
        </T>
      </Row>
      {lock.can_resolve ? (
        <Button
          label={lock.locked ? c.unlockTimeline : c.lockTimeline}
          kind="glass"
          small
          icon="lock"
          loading={busy}
          onPress={() => onToggle(!lock.locked)}
          style={{ marginTop: 12 }}
          testID="planner-lock-toggle"
        />
      ) : null}
    </Card>
  );
}

function fieldLabel(c: C, field: string): string {
  switch (field) {
    case "day":
      return c.day;
    case "starts_at":
      return c.start;
    case "ends_at":
      return c.end;
    case "title":
      return c.titleField;
    case "detail":
      return c.detail;
    case "location":
      return c.location;
    case "owner":
      return c.owner;
    case "vendor_id":
      return c.vendor;
    case "status":
      return c.status;
    case "place_id":
      return c.place;
    default:
      return field;
  }
}

/** Shows one value the way a person reads it: names for ids, words for statuses. */
export function useChangeValue(names: { vendors?: { id: string; name: string }[]; places?: RunsheetPlace[] }) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  return (field: string, v: string): string => {
    if (!v) return "";
    if (field === "day") return shortDate(v, lang);
    if (field === "vendor_id") return names.vendors?.find((x) => x.id === v)?.name ?? c.vendor;
    if (field === "place_id") return names.places?.find((x) => x.id === v)?.name ?? c.place;
    if (field === "status") return (c.statuses as Record<string, string>)[v] ?? v;
    return v;
  };
}

/** Each changed field: its name, the old value struck through, the new one. */
export function RequestDiff({ changes, show }: { changes: FieldChange[]; show: (field: string, v: string) => string }) {
  const c = useFeatureCopy(COPY);
  if (!changes.length) return null;
  return (
    <Stack gap={8}>
      {changes.map((ch) => {
        const before = show(ch.field, ch.before);
        const after = show(ch.field, ch.after);
        return (
          <View key={ch.field} accessible accessibilityLabel={`${fieldLabel(c, ch.field)}. ${c.before}: ${before || c.emptyValue}. ${c.after}: ${after || c.emptyValue}`}>
            <T v="meta13" color={colors.ivory55}>
              {fieldLabel(c, ch.field)}
            </T>
            {before ? (
              <T v="body15" color={colors.ivory40} style={[{ textDecorationLine: "line-through" }, TNUM]}>
                {before}
              </T>
            ) : null}
            <T v="body15" color={colors.ivory} style={TNUM}>
              {after || c.emptyValue}
            </T>
          </View>
        );
      })}
    </Stack>
  );
}

/** One line per changed field: its name, the old value struck, the new one. */
function CompactDiff({ changes, show }: { changes: FieldChange[]; show: (field: string, v: string) => string }) {
  const c = useFeatureCopy(COPY);
  return (
    <Stack gap={2}>
      {changes.map((ch) => {
        const before = show(ch.field, ch.before);
        const after = show(ch.field, ch.after) || c.emptyValue;
        return (
          <Row key={ch.field} gap={6} style={{ flexWrap: "wrap" }} >
            <T v="meta13" color={colors.ivory55}>
              {fieldLabel(c, ch.field)}
            </T>
            {before ? (
              <T v="meta13" color={colors.ivory40} style={[{ textDecorationLine: "line-through" }, TNUM]} accessibilityLabel={`${c.before}: ${before}`}>
                {before}
              </T>
            ) : null}
            <T v="meta13" color={colors.ivory} style={TNUM} accessibilityLabel={`${c.after}: ${after}`}>
              {after}
            </T>
          </Row>
        );
      })}
    </Stack>
  );
}

/** The open change requests. Couple: Withdraw. Planner (can_resolve): Approve
 *  and Decline, and the stale and deleted-block answers in place. */
export function RequestList({
  requests,
  role,
  busyId,
  stale,
  show,
  onWithdraw,
  onApprove,
  onDecline,
}: {
  requests: ChangeRequest[];
  role: "couple" | "planner" | "viewer";
  busyId?: string | null;
  /** Planner: the request whose block changed (with what is there now) or was deleted. */
  stale?: { id: string; kind: "stale" | "target_gone"; current: FieldChange[] } | null;
  show: (field: string, v: string) => string;
  onWithdraw?: (r: ChangeRequest) => void;
  onApprove?: (r: ChangeRequest, opts?: { applyAnyway?: boolean; asNew?: boolean }) => void;
  onDecline?: (r: ChangeRequest) => void;
}) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  if (!requests.length) return null;
  return (
    <View style={{ marginTop: 20 }} testID="runsheet-requests">
      <SectionLabel>{`${c.requestsTitle} (${requests.length})`}</SectionLabel>
      <Card kind="solid" padding={2} style={{ marginTop: 8, paddingHorizontal: 16 }}>
        {requests.map((r, i) => {
          const s = stale && stale.id === r.id ? stale : null;
          const busy = busyId === r.id;
          return (
            <View key={r.id} style={[styles.reqRow, i < requests.length - 1 && styles.rule]}>
              <T v="meta13" color={colors.ivory55}>
                {[c.kinds[r.kind] ?? c.kinds.other, role === "planner" ? (r.created_by_name ? fmt(c.fromName, { name: r.created_by_name }) : c.fromCouple) : null].filter(Boolean).join(" · ")}
              </T>
              <T v="body16" color={colors.ivory}>
                {r.title}
              </T>
              {r.kind === "remove" && r.base ? (
                <T v="meta13" color={colors.ivory55} style={TNUM}>
                  {[shortDate(r.base.day, lang), r.base.ends_at ? fmt(c.range, { start: r.base.starts_at, end: r.base.ends_at }) : r.base.starts_at].filter(Boolean).join(" · ")}
                </T>
              ) : null}
              {r.kind === "add" && r.proposed ? (
                // A new block reads as one line: day, time, where, who.
                <T v="meta13" color={colors.ivory70} style={TNUM}>
                  {[shortDate(r.proposed.day, lang), r.proposed.ends_at ? fmt(c.range, { start: r.proposed.starts_at, end: r.proposed.ends_at }) : r.proposed.starts_at, r.proposed.location, r.proposed.owner].filter(Boolean).join(" · ")}
                </T>
              ) : r.kind !== "remove" && r.changes.length ? (
                <View style={{ marginTop: 6 }}>
                  <CompactDiff changes={r.changes} show={show} />
                </View>
              ) : null}
              {r.note ? (
                <T v="body15" color={colors.ivory70} style={{ marginTop: 6 }} numberOfLines={3}>
                  {r.note}
                </T>
              ) : null}
              {s ? (
                <Stack gap={6} style={{ marginTop: 10 }}>
                  <Row gap={8} align="flex-start">
                    <Icon name="warning" size={18} color={colors.amber} />
                    <T v="body15" color={colors.ivory} style={{ flex: 1 }}>
                      {s.kind === "stale" ? c.stale : c.targetGone}
                    </T>
                  </Row>
                  {s.kind === "stale" && s.current.length ? (
                    <View style={{ marginLeft: 26 }}>
                      <T v="meta13" color={colors.ivory55}>
                        {c.nowOnRunsheet}
                      </T>
                      {s.current.map((ch) => (
                        <T key={ch.field} v="body15" color={colors.ivory70} style={TNUM}>
                          {`${fieldLabel(c, ch.field)}: ${show(ch.field, ch.before) || c.emptyValue}`}
                        </T>
                      ))}
                    </View>
                  ) : null}
                </Stack>
              ) : null}
              {role === "couple" && onWithdraw ? (
                <Button label={c.withdraw} kind="ghost" small full={false} loading={busy} onPress={() => onWithdraw(r)} style={{ marginTop: 8, alignSelf: "flex-start" }} />
              ) : null}
              {role === "planner" && onApprove && onDecline ? (
                <Row gap={8} style={{ marginTop: 10, flexWrap: "wrap" }}>
                  {s ? (
                    <Button
                      label={s.kind === "stale" ? c.applyAnyway : c.addAsNew}
                      kind="glass"
                      small
                      full={false}
                      loading={busy}
                      onPress={() => onApprove(r, s.kind === "stale" ? { applyAnyway: true } : { asNew: true })}
                    />
                  ) : (
                    <Button label={c.approve} kind="glass" small full={false} loading={busy} onPress={() => onApprove(r)} testID={`approve-${r.id}`} />
                  )}
                  <Button label={c.decline} kind="ghost" small full={false} disabled={busy} onPress={() => onDecline(r)} />
                </Row>
              ) : null}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

/** The muted line under a block with an open request. */
export function RequestWaitingLine({ requests }: { requests: ChangeRequest[] | undefined }) {
  const c = useFeatureCopy(COPY);
  if (!requests?.length) return null;
  const remove = requests.some((r) => r.kind === "remove");
  return (
    <Row gap={6} style={{ marginTop: 4 }}>
      <Icon name="clock" size={14} color={colors.ivory55} />
      <T v="meta13" color={colors.ivory55} style={{ flex: 1 }}>
        {remove ? c.waitingRemove : c.waiting}
      </T>
    </Row>
  );
}

// ------------------------------------------------------------------ #9

/** Apple Maps and Google Maps for one place. Deep links only: the Maps app,
 *  and Google Maps when installed (its web page otherwise). */
export function MapButtons({ place }: { place: Pick<RunsheetPlace, "name" | "address" | "lat" | "lng" | "apple_maps_url" | "google_maps_url"> }) {
  const c = useFeatureCopy(COPY);
  const app = useCopy();
  const links = mapLinks(place);
  if (!links.apple && !links.google) return null;
  return (
    <Row gap={8} style={{ marginTop: 10, flexWrap: "wrap" }}>
      {links.apple ? (
        <Pressable
          onPress={() => openUrlSafe(links.apple, app.common.linkFailed)}
          accessibilityRole="link"
          accessibilityLabel={fmt(c.openIn, { name: place.name, app: c.appleMaps })}
          style={({ pressed }) => [styles.mapBtn, pressed && { opacity: 0.6 }]}
        >
          <Icon name="apple" size={16} color={colors.ivory} />
          <T v="body15">{c.appleMaps}</T>
        </Pressable>
      ) : null}
      {links.google ? (
        <Pressable
          onPress={() => openUrlSafe(links.google, app.common.linkFailed)}
          accessibilityRole="link"
          accessibilityLabel={fmt(c.openIn, { name: place.name, app: c.googleMaps })}
          style={({ pressed }) => [styles.mapBtn, pressed && { opacity: 0.6 }]}
        >
          <Icon name="map" size={16} color={colors.ivory} />
          <T v="body15">{c.googleMaps}</T>
        </Pressable>
      ) : null}
    </Row>
  );
}

/** The places of the day: time, name, kind, address, both map buttons. */
export function PlacesSection({ places, onAdd, onOpen }: { places: RunsheetPlace[]; onAdd?: () => void; onOpen?: (p: RunsheetPlace) => void }) {
  const c = useFeatureCopy(COPY);
  return (
    <View style={{ marginTop: 26 }} testID="runsheet-places">
      <SectionLabel>{c.places}</SectionLabel>
      {places.length ? (
        <Card kind="solid" padding={2} style={{ marginTop: 8, paddingHorizontal: 16 }}>
          {places.map((p, i) => {
            const head = (
              <Row gap={10} align="flex-start">
                <View style={{ flex: 1 }}>
                  <T v="body16" color={colors.ivory}>
                    {p.name}
                  </T>
                  <T v="meta13" color={colors.ivory55} style={TNUM}>
                    {[p.time, c.placeKinds[p.kind] ?? c.placeKinds.other, p.same_place_as_before ? c.samePlace : null].filter(Boolean).join(" · ")}
                  </T>
                  {p.address ? (
                    <T v="body15" color={colors.ivory70} selectable={!onOpen} style={{ marginTop: 2 }}>
                      {p.address}
                    </T>
                  ) : null}
                  {p.note ? (
                    <T v="meta13" color={colors.ivory55} style={{ marginTop: 2 }}>
                      {p.note}
                    </T>
                  ) : null}
                </View>
                {onOpen ? <Icon name="edit" size={18} color={colors.ivory55} /> : null}
              </Row>
            );
            // The map buttons stay their own elements (VoiceOver reaches them);
            // only the name block opens the edit sheet.
            return (
              <View key={p.id} style={[styles.placeRow, i < places.length - 1 && styles.rule]}>
                {onOpen ? (
                  <Pressable onPress={() => onOpen(p)} accessibilityRole="button" accessibilityLabel={`${p.name}. ${c.editPlace}`} style={({ pressed }) => [{ minHeight: 44 }, pressed && { opacity: 0.6 }]}>
                    {head}
                  </Pressable>
                ) : (
                  head
                )}
                <MapButtons place={p} />
              </View>
            );
          })}
        </Card>
      ) : (
        <T v="body15" color={colors.ivory55} style={{ marginTop: 8 }}>
          {c.placesEmpty}
        </T>
      )}
      {onAdd ? <Button label={c.addPlace} kind="ghost" icon="pin" small onPress={onAdd} style={{ marginTop: 10 }} testID="runsheet-add-place" /> : null}
    </View>
  );
}

// ------------------------------------------------------------------ #40

/** The hair and makeup schedule under a block: one summary line, the
 *  warnings (mark and words), then one row per person in time order. */
export function GlamPanel({ slots, warnings }: { slots: GlamSlot[]; warnings: GlamWarning[] | undefined }) {
  const c = useFeatureCopy(COPY);
  const sum = glamSummary(slots);
  const warned = warnedSlotIds(warnings);
  const range = (a: string, b: string) => fmt(c.range, { start: a, end: b });
  const detail = slots.length
    ? [sum.people === 1 ? c.person : fmt(c.people, { n: sum.people }), sum.stylists ? (sum.stylists === 1 ? c.stylist : fmt(c.stylists, { n: sum.stylists })) : null, sum.start && sum.end ? range(sum.start, sum.end) : null]
        .filter(Boolean)
        .join(", ")
    : c.hmuEmpty;
  const summary = fmt(c.hmuSummary, { detail });
  const parts = (warnings ?? []).map((w) => glamWarningParts(w, slots)).filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <View style={styles.glam} testID="runsheet-glam">
      <T v="meta13" color={colors.ivory55} style={TNUM}>
        {summary}
      </T>
      {parts.map((p, i) => (
        <Row key={i} gap={6} align="flex-start" style={{ marginTop: 4 }}>
          <Icon name="warning" size={14} color={colors.amber} />
          <T v="meta13" color={colors.ivory70} style={[{ flex: 1 }, TNUM]}>
            {fmt(p.kind === "overlap" ? c.warnOverlap : p.kind === "after_end" ? c.warnAfterEnd : c.warnTwice, { who: p.who, time: p.at })}
          </T>
        </Row>
      ))}
      {sortedSlots(slots).map((s) => (
        <View key={s.id} style={{ marginTop: 10 }}>
          <Row gap={6}>
            {warned.has(s.id) ? <Icon name="warning" size={12} color={colors.amber} /> : null}
            <T v="meta13" color={colors.ivory70} style={TNUM}>
              {range(s.starts_at, s.ends_at)}
            </T>
          </Row>
          <T v="body15" color={colors.ivory}>
            {s.person}
          </T>
          <T v="meta13" color={colors.ivory55}>
            {[c.services[s.service] ?? c.services.other, s.stylist_name ?? c.noStylist, s.notes || null].filter(Boolean).join(" · ")}
          </T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rule: { borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  reqRow: { paddingVertical: 12 },
  placeRow: { paddingVertical: 12 },
  mapBtn: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: colors.ivory14 },
  glam: { marginLeft: 90, paddingBottom: 12 },
});
