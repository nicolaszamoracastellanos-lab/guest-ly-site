// "Preview the day" on the day-of screens, demo weddings only (previewClock.ts).
// A glass button opens a sheet of the wedding day's moments; picking one runs
// the live view at that moment, moving in real time, with a banner that says
// it is a preview and ends it. App Review and the D2 rehearsal use it to see
// Now / Next, minutes left and Mark done on a day that is not the wedding.

import React, { useSyncExternalStore } from "react";
import { View } from "react-native";
import { fmt, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { API_BASE } from "@/lib/api";
import { registerScopedReset } from "@/lib/scope";
import { useUserSession } from "@/lib/session";
import { clockLabel } from "@/features/guest/format";
import { Banner, Button, Hairline, ListRow, Sheet, T, Icon } from "@/ui";
import { colors } from "@/ui/tokens";
import { DAYOF_COPY } from "./copy";
import { wallClockAt, type LiveBlockInput } from "./live";
import { endPreview, previewActive, previewAllowed, previewMoments, previewVersion, startPreview, subscribePreview } from "./previewClock";

// A preview never outlives the person or the wedding it was started on.
registerScopedReset(endPreview);

type Lang = "en" | "es";
const timeAt = (ms: number, tz: string, lang: Lang) => clockLabel(wallClockAt(ms, tz).minutes, null, lang);

/** True on a demo wedding (or a dev build against a local portal). */
export function usePreviewAllowed(): boolean {
  const tenant = useUserSession()?.me.tenant ?? null;
  return previewAllowed(tenant, { dev: __DEV__, apiBase: API_BASE });
}

/** Whether a preview runs on this wedding now (re-renders when it starts or ends). */
export function usePreviewActive(slug: string | null | undefined): boolean {
  useSyncExternalStore(subscribePreview, previewVersion, previewVersion);
  return previewActive(slug);
}

export function PreviewDayControl<B extends LiveBlockInput & { title?: string | null }>({ slug, blocks, timeZone, day }: { slug: string | null | undefined; blocks: readonly B[]; timeZone: string; day: string | null | undefined }) {
  const c = useFeatureCopy(DAYOF_COPY);
  const { lang } = useLang();
  const allowed = usePreviewAllowed();
  const active = usePreviewActive(slug);
  const [open, setOpen] = React.useState(false);
  if (!allowed || active || !slug || !day) return null;
  const { before, moments } = previewMoments(blocks, timeZone, day);
  if (!moments.length) return null;
  const pick = (atMs: number) => {
    startPreview(slug, atMs);
    setOpen(false);
  };
  return (
    <>
      <Button label={c.previewOpen} icon="clock" kind="glass" small onPress={() => setOpen(true)} style={{ marginTop: 14 }} testID="dayof-preview-open" />
      <Sheet visible={open} onClose={() => setOpen(false)} top={120}>
        <T v="title26">{c.previewTitle}</T>
        <T v="body15" color={colors.ivory70} style={{ marginTop: 8, marginBottom: 12 }}>
          {c.previewIntro}
        </T>
        <Hairline />
        {before !== null ? (
          <ListRow leading={<Icon name="clock" size={20} color={colors.ivory55} />} title={c.previewBefore} sub={timeAt(before, timeZone, lang)} onPress={() => pick(before)} testID="dayof-preview-before" />
        ) : null}
        {moments.map((m, i, arr) => (
          <ListRow
            key={m.id}
            leading={<Icon name="clock" size={20} color={colors.ivory55} />}
            title={m.title}
            sub={timeAt(m.atMs, timeZone, lang)}
            onPress={() => pick(m.atMs)}
            last={i === arr.length - 1}
            testID={`dayof-preview-${i}`}
          />
        ))}
      </Sheet>
    </>
  );
}

export function PreviewBanner({ slug, now, timeZone, onEnd }: { slug: string | null | undefined; now: number; timeZone: string; onEnd?: () => void }) {
  const c = useFeatureCopy(DAYOF_COPY);
  const { lang } = useLang();
  const active = usePreviewActive(slug);
  if (!active) return null;
  return (
    <View style={{ marginTop: 14 }} testID="dayof-preview-banner">
      <Banner
        kind="neutral"
        icon="clock"
        title={fmt(c.previewBanner, { time: timeAt(now, timeZone, lang) })}
        body={c.previewBannerBody}
        action={
          <Button
            label={c.previewExit}
            kind="text"
            small
            full={false}
            haptic={false}
            onPress={() => {
              endPreview();
              onEnd?.();
            }}
            testID="dayof-preview-end"
          />
        }
      />
    </View>
  );
}
