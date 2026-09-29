// Module-level drafts (brain editor, seating plan, website builder) live outside react-query,
// so clearing the query cache does not clear them. Call resetTenantDrafts()
// whenever the signed-in account or the open wedding changes. The couple tab
// layout also calls it when it sees a different wedding than last time.

import { resetBrainDraft } from "@/features/brain/draft";
import { resetSeatingDraft } from "@/features/seating/hooks";
import { resetWebsiteDraft } from "@/features/website/hooks";

let scope: string | null = null;

export function resetTenantDrafts() {
  resetBrainDraft();
  resetSeatingDraft();
  resetWebsiteDraft();
}

/** Resets the drafts when `key` (user id + wedding slug) differs from the
 *  one the drafts were last used with. */
export function enterTenantScope(key: string) {
  if (scope !== null && scope !== key) resetTenantDrafts();
  scope = key;
}
