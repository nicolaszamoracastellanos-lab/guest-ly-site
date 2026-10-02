// Vendors inside Budget (build 12, F5). Proveedores is no longer a tool of its
// own: a budget line shows its vendor, and tapping it opens the vendor's
// details and contact. The vendor screens and routes are unchanged
// (/couple/vendors/[id], /planner/vendors/[id]); no vendor data moves.

import React, { useState } from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useFeatureCopy } from "@/i18n/feature";
import { useOnline } from "@/lib/query";
import { can, useUserSession } from "@/lib/session";
import { T, Icon, Badge, Sheet, ListRow, Button, Card, SectionLabel } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { COPY as VCOPY } from "../vendors/copy";
import { useVendors, useVendorsBase, useVendorWrites, type VendorRow } from "../vendors/hooks";
import { statusKind } from "../vendors/screens/List";
import { useCoupleCopy } from "../couple/ui";
import { useAction } from "./ui";

function useOpenVendor() {
  const router = useRouter();
  const base = useVendorsBase();
  return (id: string) => router.push({ pathname: `${base}/[id]` as never, params: { id } as never });
}

/** Which vendor a budget line belongs to. The budget payload carries
 *  `vendor_id` on newer portals; the vendors payload always lists the lines
 *  each vendor is linked to, so it fills the gap (seen on the production
 *  demo: a linked line showed no vendor). A planner without the vendors tool
 *  never calls that endpoint. */
export function useLineVendorOf(): (itemId: string, vendorId: string | null | undefined) => string | null {
  const me = useUserSession()?.me;
  const vendors = useVendors({ enabled: can(me, "vendors") });
  const items = vendors.data?.items;
  return (itemId, vendorId) => vendorId ?? items?.find((i) => i.id === itemId)?.vendor_id ?? null;
}

/** The vendor of a budget line, tappable: name, status, chevron. */
export function VendorChip({ id, fallback }: { id: string; fallback?: string | null }) {
  const v = useFeatureCopy(VCOPY);
  const c = useCoupleCopy();
  const vendors = useVendors();
  const open = useOpenVendor();
  const vendor = vendors.data?.vendors.find((x) => x.id === id) ?? null;
  const name = vendor?.name ?? (fallback || c.budget.vendor);
  return (
    <Pressable onPress={() => open(id)} accessibilityRole="button" accessibilityLabel={`${c.budget.openVendor}: ${name}`} hitSlop={6} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.75 }]}>
      <Icon name="store" size={16} color={colors.goldLight} />
      <T v="meta13" color={colors.goldLight} numberOfLines={1} style={{ flexShrink: 1 }}>
        {name}
      </T>
      {vendor ? (
        <T v="meta13" color={colors.ivory55} numberOfLines={1}>
          · {v.statuses[vendor.status] ?? vendor.status}
        </T>
      ) : null}
      <Icon name="chev" size={14} color={colors.ivory40} />
    </Pressable>
  );
}

/** On a budget line: its linked vendor (opens the details), or, for the
 *  couple, "Link a vendor" (pick one, or create one linked to this line). */
export function LineVendor({ itemId, vendorId, vendorText, canEdit }: { itemId: string; vendorId: string | null | undefined; vendorText: string; canEdit: boolean }) {
  const c = useCoupleCopy();
  const v = useFeatureCopy(VCOPY);
  const router = useRouter();
  const online = useOnline();
  const base = useVendorsBase();
  const couple = !base.startsWith("/planner");
  const vendors = useVendors({ enabled: !!vendorId || (couple && canEdit) });
  const writes = useVendorWrites();
  const { busy, act } = useAction();
  const open = useOpenVendor();
  const [pick, setPick] = useState(false);
  const vendor = vendorId ? (vendors.data?.vendors.find((x) => x.id === vendorId) ?? null) : null;

  if (vendorId) {
    return (
      <View style={{ gap: 6 }}>
        <SectionLabel>{c.budget.vendor}</SectionLabel>
        <Pressable onPress={() => open(vendorId)} accessibilityRole="button" accessibilityLabel={`${c.budget.openVendor}: ${vendor?.name ?? vendorText}`} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
          <Icon name="store" size={22} color={colors.goldLight} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="body16">{vendor?.name ?? (vendorText || c.budget.vendor)}</T>
            {vendor ? (
              <T v="meta13" color={colors.ivory55}>
                {[vendor.contact_name, vendor.phone].filter(Boolean).join(" · ") || v.categories[vendor.category] || ""}
              </T>
            ) : null}
          </View>
          {vendor ? <Badge label={v.statuses[vendor.status] ?? vendor.status} kind={statusKind(vendor.status)} /> : null}
          <Icon name="chev" size={18} color={colors.ivory40} />
        </Pressable>
      </View>
    );
  }
  if (!couple || !canEdit) return null;
  const list: VendorRow[] = vendors.data?.vendors ?? [];
  return (
    <>
      <Pressable onPress={() => setPick(true)} disabled={!online} accessibilityRole="button" style={({ pressed }) => [styles.link, pressed && { opacity: 0.75 }, !online && { opacity: 0.5 }]}>
        <Icon name="store" size={18} color={colors.goldLight} />
        <T v="meta13" color={colors.goldLight}>
          + {c.budget.linkVendor}
        </T>
      </Pressable>
      <Sheet visible={pick} onClose={() => setPick(false)} top={160} scroll={false}>
        <View style={{ flex: 1, gap: 12 }}>
          <T v="title26">{c.budget.linkVendor}</T>
          <ScrollView style={{ flex: 1 }}>
            {list.length ? (
              <Card kind="solid" padding={2} style={{ paddingHorizontal: 16 }}>
                {list.map((x, i) => (
                  <ListRow
                    key={x.id}
                    leading={<Icon name="store" size={20} color={colors.goldLight} />}
                    title={x.name}
                    sub={v.categories[x.category] ?? x.category}
                    trailing={<Badge label={v.statuses[x.status] ?? x.status} kind={statusKind(x.status)} />}
                    chevron={false}
                    onPress={() => void act(() => writes.link(x.id, itemId), () => setPick(false))}
                    last={i === list.length - 1}
                  />
                ))}
              </Card>
            ) : vendors.isLoading ? null : (
              <T v="body15" color={colors.ivory70}>
                {c.budget.noVendors}
              </T>
            )}
          </ScrollView>
          <Button
            label={c.budget.newVendor}
            icon="plus"
            kind="glass"
            loading={busy}
            onPress={() => {
              setPick(false);
              setTimeout(() => router.push({ pathname: "/couple/vendors/new" as never, params: { link: itemId } as never }), 260);
            }}
          />
        </View>
      </Sheet>
    </>
  );
}

/** On the budget summary: the vendors on this budget's lines, then the way to
 *  every vendor (shortlisted ones too). */
export function BudgetVendors({ budgetId }: { budgetId: string }) {
  const c = useCoupleCopy();
  const v = useFeatureCopy(VCOPY);
  const router = useRouter();
  const base = useVendorsBase();
  const vendors = useVendors();
  const open = useOpenVendor();
  const data = vendors.data;
  if (!data || vendors.isError) return null;
  const ids = new Set(data.items.filter((i) => i.budget_id === budgetId && i.vendor_id).map((i) => i.vendor_id!));
  const linked = data.vendors.filter((x) => ids.has(x.id));
  if (!data.vendors.length) return null;
  return (
    <View style={{ marginTop: 22 }}>
      <SectionLabel style={{ marginBottom: 8 }}>{c.budget.linkedVendors}</SectionLabel>
      <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
        {linked.map((x) => {
          const lines = data.items.filter((i) => i.vendor_id === x.id && i.budget_id === budgetId).map((i) => i.title);
          return <ListRow key={x.id} leading={<Icon name="store" size={20} color={colors.goldLight} />} title={x.name} sub={lines.join(", ")} trailing={<Badge label={v.statuses[x.status] ?? x.status} kind={statusKind(x.status)} />} onPress={() => open(x.id)} />;
        })}
        <ListRow leading={<Icon name="list" size={20} color={colors.goldLight} />} title={c.budget.allVendors(data.vendors.length)} sub={c.budget.vendorsSub} onPress={() => router.push(base as never)} last />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 32, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.goldBorder, maxWidth: "100%" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.tile, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: colors.ivory14 },
  link: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-start" },
});
