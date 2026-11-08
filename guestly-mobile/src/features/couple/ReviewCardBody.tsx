// #20 Review ask on Home: the portal's one line, the five ratings (words, not
// stars) and "Not now". A rating opens this person's feedback page (a one-time
// no-login link) in the in-app browser with that rating picked; "Not now"
// hides the card for this person with Undo. When the browser closes, Apple's
// rating sheet may be asked for once (./storeReview.ts). Rules and words:
// ./reviewCard.ts.

import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { post, isMissingEndpoint } from "@/lib/api";
import { failedText } from "@/features/shared/requests";
import { Chip, T, toast, toastError } from "@/ui";
import { colors } from "@/ui/tokens";
import { RATINGS, REVIEW_COPY, readLinkUrl, withRating, type Rating, type ReviewCard } from "./reviewCard";
import { maybeAskStoreReview } from "./storeReview";

export function ReviewCardBody({ card, weddingDate, onHide, onShow }: { card: ReviewCard; weddingDate: string | null | undefined; onHide: () => void; onShow: () => void }) {
  const { lang } = useLang();
  const r = REVIEW_COPY[lang];
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["couple-home"] });

  async function open(n: Rating | null) {
    if (busy) return;
    setBusy(true);
    try {
      const url = readLinkUrl(await post<{ url: string }>(card.link, {}));
      if (!url) throw new Error("no_url");
      await WebBrowser.openBrowserAsync(withRating(url, n));
      // Sent or not, the card's state is the server's: Home asks again.
      refresh();
      await maybeAskStoreReview(weddingDate);
    } catch (err) {
      if (isMissingEndpoint(err)) {
        // The flag went off since Home loaded: the card goes, quietly.
        onHide();
        refresh();
      } else {
        toastError(failedText(r.openFailed, err, lang));
      }
    } finally {
      setBusy(false);
    }
  }

  async function notNow() {
    onHide();
    try {
      await post(card.dismiss, { dismissed: true });
      toast(r.dismissed, {
        undo: () => {
          onShow();
          post(card.dismiss, { dismissed: false })
            .then(refresh)
            .catch((err) => {
              onHide();
              toastError(failedText(r.hideFailed, err, lang));
            });
        },
      });
    } catch (err) {
      onShow();
      if (isMissingEndpoint(err)) return refresh();
      toastError(failedText(r.hideFailed, err, lang));
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <T v="body15" color={colors.ivory70}>
        {r.body}
      </T>
      <View style={styles.chips}>
        {RATINGS.map((n) => (
          <Chip key={n} label={r.ratings[n]} hint={r.give} onPress={() => void open(n)} disabled={busy} testID={`home-review-rate-${n}`} />
        ))}
      </View>
      <Pressable onPress={() => void notNow()} accessibilityRole="button" hitSlop={4} style={({ pressed }) => [styles.notNow, pressed && { opacity: 0.7 }]} testID="home-review-not-now">
        <T v="meta13" color={colors.ivory70}>
          {r.notNow}
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  notNow: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
});
