// One screen component for the whole site and for each direct entry point
// (hotels, gifts, questions, photos, story). Loading, not-published and
// error states live here so every route stays a one-liner.

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useFeatureCopy } from "@/i18n/feature";
import { useLang } from "@/i18n";
import { ApiFailure } from "@/lib/api";
import { useGuestSession } from "@/lib/session";
import { Screen, TopBar, EmptyState, Button, Skeleton, Stack, BigTitle } from "@/ui";
import { COPY } from "./copy";
import { useGuestSite, type SectionType } from "./hooks";
import { SiteBody } from "./sections";

type Entry = "hotels" | "gifts" | "faq" | "gallery" | "story";

const ENTRY_SECTIONS: Record<Entry, SectionType[]> = {
  hotels: ["travel"],
  gifts: ["registry"],
  faq: ["faq"],
  gallery: ["gallery", "video"],
  story: ["story", "party"],
};

export function SiteScreen({ entry }: { entry?: Entry }) {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const session = useGuestSession();
  const { data, isLoading, error, refetch } = useGuestSite();
  const only = entry ? ENTRY_SECTIONS[entry] : undefined;
  const notPublished = error instanceof ApiFailure && error.code === "not_found";
  const title = entry ? copy.screens[entry] : copy.title;

  // The full site draws its own hero with a back button; entry screens use the TopBar.
  const header = entry || !data?.sections.some((s) => s.type === "hero") ? <TopBar onBack={() => router.back()} title={entry ? title : session?.tenant.couple_names} /> : undefined;

  let content: React.ReactNode;
  if (isLoading && !data) {
    content = (
      <Stack gap={14} style={{ paddingHorizontal: 24, marginTop: 24 }}>
        <Skeleton h={entry ? 120 : 320} r={18} />
        <Skeleton h={90} r={18} />
        <Skeleton h={90} r={18} />
      </Stack>
    );
  } else if (notPublished) {
    content = (
      <View style={{ marginTop: 48 }}>
        <EmptyState title={copy.notPublishedTitle} body={copy.notPublishedBody} action={<Button label={copy.retry} small kind="glass" full={false} onPress={() => refetch()} />} />
      </View>
    );
  } else if (error || !data) {
    const message = error instanceof ApiFailure ? error.messages[lang] : undefined;
    content = (
      <View style={{ marginTop: 48 }}>
        <EmptyState title={copy.errorTitle} body={message} action={<Button label={copy.retry} small kind="glass" full={false} onPress={() => refetch()} />} />
      </View>
    );
  } else {
    const has = only ? data.sections.some((s) => (only as string[]).includes(s.type)) : data.sections.length > 0;
    if (!has && entry) {
      content = (
        <View style={{ marginTop: 48 }}>
          <EmptyState title={title} body={copy.none[entry]} action={<Button label={copy.openFullSite} small kind="glass" full={false} onPress={() => router.push("/guest/site")} />} />
        </View>
      );
    } else {
      content = (
        <View>
          {entry ? <View style={{ paddingHorizontal: 24 }}><BigTitle title={title} sub={data.couple_names} size={38} /></View> : null}
          {!entry && !data.sections.some((s) => s.type === "hero") ? (
            <View style={{ paddingHorizontal: 24 }}>
              <BigTitle title={copy.title} sub={data.couple_names} size={38} />
            </View>
          ) : null}
          <SiteBody site={data} only={only} />
        </View>
      );
    }
  }

  return (
    <Screen padded={false} header={header} bottomInset={40}>
      {content}
    </Screen>
  );
}
