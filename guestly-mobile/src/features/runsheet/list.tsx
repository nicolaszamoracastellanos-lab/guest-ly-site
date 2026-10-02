// The runsheet day list, shared by the couple (editable) and planner (read-only) screens.
//
// v1.2 (audit B4): tapping a row opens its editor, always. The status is its
// own control at the end of the row: it opens a menu with the three statuses
// (StatusMenu), and a change shows an Undo bar (UndoBar). Before, a tap near
// the middle of a row moved the status along silently, with no way back.

import React, { useEffect } from "react";
import { View, Pressable, AccessibilityInfo, Platform, StyleSheet } from "react-native";
import { useLang, longDate, fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { Card, T, Badge, Stack, SectionLabel, Sheet, Icon, Row, useTabBarTop } from "@/ui";
import { colors, COLUMN } from "@/ui/tokens";
import { COPY } from "./copy";
import { statusKind, STATUS_ORDER, type RunsheetBlock, type RunsheetStatus, type RunsheetSurface } from "./hooks";

export function RunsheetList({
  data,
  canEdit,
  onStatus,
  onOpen,
}: {
  data: RunsheetSurface;
  canEdit: boolean;
  onStatus?: (b: RunsheetBlock) => void;
  onOpen?: (b: RunsheetBlock) => void;
}) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  return (
    <Stack gap={18} style={{ marginTop: 20 }}>
      {data.days.map((d) => (
        <View key={d.day}>
          <SectionLabel color={colors.goldLight}>
            {longDate(d.day, lang)}
          </SectionLabel>
          <Card
            kind="solid"
            padding={2}
            style={{ marginTop: 8, paddingHorizontal: 18 }}
          >
            {[...d.blocks].sort((a, b) => nightOrder(a.starts_at) - nightOrder(b.starts_at)).map((b, i) => (
              <Pressable
                key={b.id}
                onPress={onOpen ? () => onOpen(b) : undefined}
                accessibilityRole={onOpen ? "button" : undefined}
                accessibilityHint={onOpen ? c.openHint : undefined}
                // VoiceOver reads the row as one element, so the status menu
                // is also offered as a named action on it.
                accessibilityActions={canEdit && onStatus ? [{ name: "status", label: c.changeStatus }] : undefined}
                onAccessibilityAction={canEdit && onStatus ? (e) => (e.nativeEvent.actionName === "status" ? onStatus(b) : undefined) : undefined}
                style={{
                  flexDirection: "row",
                  gap: 14,
                  alignItems: "flex-start",
                  minHeight: 56,
                  paddingVertical: 10,
                  borderBottomWidth: i === d.blocks.length - 1 ? 0 : 1,
                  borderBottomColor: colors.ivory09,
                }}
              >
                {/* Wide enough for "09:00" in the display face, and one line always:
                    the time used to break into "09:0 / 0" (Part 9 audit, D-009). */}
                <View style={{ width: 76 }}>
                  <T
                    v="title26"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    color={
                      b.status === "done" ? colors.ivory40 : colors.goldLight
                    }
                  >
                    {b.starts_at}
                  </T>
                  {b.ends_at ? (
                    <T v="meta13" color={colors.ivory40}>
                      {b.ends_at}
                    </T>
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <T
                    v="body16"
                    color={b.status === "done" ? colors.ivory55 : colors.ivory}
                    style={
                      b.status === "done" && {
                        textDecorationLine: "line-through",
                      }
                    }
                  >
                    {b.title}
                  </T>
                  {b.location || b.owner || b.vendor_name ? (
                    <T v="meta13" color={colors.ivory55}>
                      {[b.location, b.owner, b.vendor_name]
                        .filter(Boolean)
                        .join(" · ")}
                    </T>
                  ) : null}
                </View>
                {/* The status is a control of its own at the end of the row
                    (B4): it opens the status menu, never changes on a stray
                    tap. 44 pt target; read-only, it is a plain badge. */}
                {canEdit && onStatus ? (
                  <Pressable
                    onPress={() => onStatus(b)}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.status}: ${c.statuses[b.status]}`}
                    accessibilityHint={c.changeStatus}
                    hitSlop={6}
                    style={({ pressed }) => [styles.statusHit, pressed && { opacity: 0.6 }]}
                  >
                    <Badge label={c.statuses[b.status]} kind={statusKind(b.status)} />
                    <Icon name="down" size={14} color={colors.ivory55} />
                  </Pressable>
                ) : (
                  <View style={styles.statusHit}>
                    <Badge label={c.statuses[b.status]} kind={statusKind(b.status)} />
                  </View>
                )}
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
    </Stack>
  );
}

/** The status menu: the three statuses, the current one checked. Picking one
 *  closes the menu and hands it to `onPick`; the screen saves it and offers
 *  Undo. */
export function StatusMenu({ block, onPick, onClose }: { block: RunsheetBlock | null; onPick: (b: RunsheetBlock, status: RunsheetStatus) => void; onClose: () => void }) {
  const c = useFeatureCopy(COPY);
  return (
    <Sheet visible={!!block} onClose={onClose} top={380}>
      <View style={{ gap: 4 }}>
        <T v="meta13" color={colors.ivory55}>
          {c.status}
        </T>
        <T v="title26" numberOfLines={2}>
          {block?.title ?? ""}
        </T>
        <View style={{ marginTop: 10 }}>
          {STATUS_ORDER.map((s, i) => {
            const on = block?.status === s;
            return (
              <Pressable
                key={s}
                testID={`runsheet-status-${s}`}
                onPress={() => {
                  if (!block) return;
                  if (on) onClose();
                  else onPick(block, s);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={c.statuses[s]}
                style={({ pressed }) => [styles.menuRow, i < STATUS_ORDER.length - 1 && styles.menuRule, pressed && { opacity: 0.6 }]}
              >
                <Row gap={12} style={{ flex: 1 }}>
                  <Badge label={c.statuses[s]} kind={statusKind(s)} />
                </Row>
                {on ? <Icon name="check" size={20} color={colors.goldLight} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Sheet>
  );
}

/** "Ceremony: Done · Undo" floating just above the tab bar after a status
 *  change. It goes away by itself after a few seconds; VoiceOver hears it. */
export function UndoBar({ text, onUndo, onDismiss, ms = 6000 }: { text: string | null; onUndo: () => void; onDismiss: () => void; ms?: number }) {
  const c = useFeatureCopy(COPY);
  const tabTop = useTabBarTop();
  useEffect(() => {
    if (!text) return;
    if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(`${text}. ${c.undo}`);
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [text, ms, onDismiss, c.undo]);
  if (!text) return null;
  return (
    <View pointerEvents="box-none" style={[styles.undoHost, { bottom: tabTop + 12 }]}>
      <View style={[COLUMN, { paddingHorizontal: 16 }]} pointerEvents="box-none">
        <View style={styles.undoBar} accessibilityLiveRegion="polite">
          <T v="body15" style={{ flex: 1 }} numberOfLines={2}>
            {text}
          </T>
          <Pressable onPress={onUndo} accessibilityRole="button" accessibilityLabel={c.undo} hitSlop={6} style={({ pressed }) => [styles.undoBtn, pressed && { opacity: 0.6 }]}>
            <Icon name="undo" size={16} color={colors.goldLight} />
            <T v="body15" color={colors.goldLight}>
              {c.undo}
            </T>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** "{title}: {status}" for the Undo bar. */
export function statusChangedText(c: (typeof COPY)["en"], b: RunsheetBlock, status: RunsheetStatus): string {
  return fmt(c.statusChanged, { title: b.title, status: c.statuses[status] });
}

const styles = StyleSheet.create({
  statusHit: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingLeft: 4 },
  menuRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  menuRule: { borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  undoHost: { position: "absolute", left: 0, right: 0 },
  undoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 16,
    backgroundColor: colors.navySoft,
    borderWidth: 1,
    borderColor: colors.ivory14,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  undoBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
});

/** Minutes since 05:00, so a block at 01:30 sorts after 23:00: the wedding
 *  night runs past midnight and its last song is not the first thing of the day. */
export function nightOrder(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10) || 0);
  const mins = h * 60 + m;
  return mins < 5 * 60 ? mins + 24 * 60 : mins;
}
