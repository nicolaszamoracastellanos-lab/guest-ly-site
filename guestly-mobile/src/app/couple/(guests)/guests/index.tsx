// Guests tab root. On a window with room for two panes (iPhone Duo inner
// display, outer display in landscape) the list sits on the left and the
// selected guest's card on the right; otherwise the list alone. The record is
// selected with ?sel= and never pushes a screen in two panes.

import React, { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { useCopy } from "@/i18n";
import { GuestsList } from "@/features/guests/GuestsList";
import { GuestDetail } from "@/features/guests/GuestDetail";
import { MasterDetail } from "@/ui/MasterDetail";
import { T, Icon } from "@/ui";
import { colors } from "@/ui/tokens";

export default function GuestsIndex() {
  const { sel } = useLocalSearchParams<{ sel?: string }>();
  const copy = useCopy();
  const listHref = useCallback((s?: string) => (s ? { pathname: "/couple/guests", params: { sel: s } } : "/couple/guests") as never, []);
  const detailHref = useCallback((id: string) => ({ pathname: "/couple/guests/[id]", params: { id } }) as never, []);
  return (
    <MasterDetail
      detailRoute={false}
      selected={sel ?? null}
      list={<GuestsList />}
      renderDetail={(id) => <GuestDetail id={id} />}
      listHref={listHref}
      detailHref={detailHref}
      placeholder={<><Icon name="guests" size={34} color={colors.goldLight} /><T v="body15" color={colors.ivory70} style={{ textAlign: "center" }}>{copy.guests.pickOne}</T></>}
    />
  );
}
