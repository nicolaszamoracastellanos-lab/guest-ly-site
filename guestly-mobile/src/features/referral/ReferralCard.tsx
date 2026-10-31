// Referral share sheet (portal GET /couple/referral). The wedding's own link,
// shared with the system sheet in the couple's language. The row and the card
// only show once the wedding has a code (wave D mints them; until then the
// route answers available: false). No reward copy until the referral terms are
// approved: `reward_line` is shown only when the server sends one.

import React from "react";
import { Pressable, Share, View } from "react-native";
import { fmt, plural } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { T, Icon, Card, Row } from "@/ui";
import { colors } from "@/ui/tokens";
import { HH_COPY } from "@/features/settings/copy";
import { useReferral, type Referral } from "@/features/settings/hooks";

/** Opens the share sheet with the link; false when there is no link yet. */
export function useShareReferral(opts: { enabled?: boolean } = {}): { data: Referral | undefined; share: () => Promise<boolean> } {
  const c = useFeatureCopy(HH_COPY).referral;
  const { data } = useReferral(opts);
  async function share() {
    if (!data?.available || !data.url) return false;
    await Share.share({ message: fmt(c.message, { url: data.url }) }).catch(() => {});
    return true;
  }
  return { data, share };
}

/** One line for the Settings row: the reward line, the count, or the link. */
export function referralLine(data: Referral | undefined, joined: { one: string; other: string }): string | null {
  if (!data?.available) return null;
  if (data.reward_line) return data.reward_line;
  if (typeof data.joined === "number" && data.joined > 0) return plural(data.joined, joined);
  return data.url ? data.url.replace(/^https?:\/\//, "") : null;
}

/** Home card after the wedding: one tap opens the share sheet. */
export function ReferralCard() {
  const c = useFeatureCopy(HH_COPY).referral;
  const { data, share } = useShareReferral();
  if (!data?.available) return null;
  return (
    <Pressable onPress={() => void share()} accessibilityRole="button" accessibilityLabel={`${c.card} ${c.cardSub}`} testID="home-referral" style={({ pressed }) => [{ marginTop: 24 }, pressed && { opacity: 0.85 }]}>
      <Card kind="solid" padding={16} radiusKey="tile">
        <Row gap={14}>
          <Icon name="share" size={22} color={colors.goldLight} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="body16">{c.card}</T>
            <T v="meta13" color={colors.ivory70}>
              {data.reward_line ?? c.cardSub}
            </T>
          </View>
          <Icon name="chev" size={18} color={colors.ivory40} />
        </Row>
      </Card>
    </Pressable>
  );
}
