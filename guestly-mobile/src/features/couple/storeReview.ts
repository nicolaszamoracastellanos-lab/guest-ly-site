// #20: Apple's own rating sheet (SKStoreReviewController through
// expo-store-review, already in the 1.4.0 binary since be71a11), asked for at
// most once per install, right after the feedback browser closes. iOS decides
// whether it really shows (about three times a year at most). The rule is
// storeReviewDue in ./reviewCard.ts (pure, tested); never gated on the rating.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { STORE_REVIEW_KEY, localDay, storeReviewDue } from "./reviewCard";

/** True when the sheet was asked for. Never throws. */
export async function maybeAskStoreReview(weddingDate: string | null | undefined): Promise<boolean> {
  try {
    const asked = (await AsyncStorage.getItem(STORE_REVIEW_KEY)) !== null;
    if (asked) return false;
    const [available, hasAction] = await Promise.all([StoreReview.isAvailableAsync(), StoreReview.hasAction()]);
    if (!storeReviewDue({ asked, available, hasAction, weddingDate, today: localDay() })) return false;
    // Marked first: a crash or a second card tap never asks twice.
    await AsyncStorage.setItem(STORE_REVIEW_KEY, new Date().toISOString());
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
