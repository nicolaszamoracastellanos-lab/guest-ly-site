// Website builder home: status, address, privacy, look, and the ordered
// list of sections with switches. Every change saves through the portal.

import React, { useState } from "react";
import { View, Alert, Pressable, Share } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/i18n";
import { post, ApiFailure } from "@/lib/api";
import { useFeatureCopy } from "@/i18n/feature";
import { Screen, TopBar, BigTitle, Card, T, Badge, Button, ListRow, Row, Stack, Skeleton, SectionLabel, Icon, Input, Sheet, Banner, EmptyState } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/website/copy";
import { useConfigDraft, WEBSITE_KEY, type SectionType, type WebsiteSurface } from "@/features/website/hooks";
import { RowControls, SwitchRow, move } from "@/features/website/fields";

const ICONS: Record<SectionType, "photo" | "clock" | "book" | "star" | "calendar" | "bus" | "coins" | "guests" | "info" | "mail" | "chat" | "globe"> = {
  hero: "photo",
  countdown: "clock",
  story: "book",
  gallery: "star",
  video: "globe",
  schedule: "calendar",
  travel: "bus",
  registry: "coins",
  party: "guests",
  faq: "info",
  rsvp: "mail",
  chat: "chat",
};

export default function WebsiteHome() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const { surface, isLoading, draft, update, state, error } = useConfigDraft();
  const [busy, setBusy] = useState<string | null>(null);
  const [slugOpen, setSlugOpen] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [pwDraft, setPwDraft] = useState("");
  const [copied, setCopied] = useState(false);

  const patch = (fn: (s: WebsiteSurface) => WebsiteSurface) => qc.setQueryData<WebsiteSurface>(WEBSITE_KEY, (old) => (old ? fn(old) : old));

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      Alert.alert(c.title, err instanceof ApiFailure ? err.messages[lang] : "");
    } finally {
      setBusy(null);
    }
  }

  function togglePublish() {
    if (!surface) return;
    const next = !surface.published;
    Alert.alert(next ? c.publish : c.unpublish, next ? c.publishConfirm : c.unpublishConfirm, [
      { text: c.cancel, style: "cancel" },
      {
        text: next ? c.publish : c.unpublish,
        style: next ? "default" : "destructive",
        onPress: () =>
          run("publish", async () => {
            await post(next ? "/couple/website/publish" : "/couple/website/unpublish", {});
            patch((s) => ({ ...s, published: next }));
          }),
      },
    ]);
  }

  async function saveSlug() {
    await run("slug", async () => {
      const r = await post<{ slug: string }>("/couple/website/slug", { slug: slugDraft });
      patch((s) => ({ ...s, site_slug: r.slug, public_url: `https://app.guest-ly.com/${r.slug}` }));
      setSlugOpen(false);
      void qc.invalidateQueries({ queryKey: WEBSITE_KEY });
    });
  }

  async function savePassword() {
    await run("password", async () => {
      await post("/couple/website/password", { password: pwDraft });
      patch((s) => ({ ...s, has_password: true, config: { ...s.config, privacy: { ...s.config.privacy, require_password: true } } }));
      setPwOpen(false);
      setPwDraft("");
    });
  }

  function removePassword() {
    void run("password", async () => {
      await post("/couple/website/password", { password: null });
      patch((s) => ({ ...s, has_password: false, config: { ...s.config, privacy: { ...s.config.privacy, require_password: false } } }));
    });
  }

  function setNoindex(v: boolean) {
    void run("noindex", async () => {
      await post("/couple/website/noindex", { noindex: v });
      patch((s) => ({ ...s, config: { ...s.config, privacy: { ...s.config.privacy, noindex: v } } }));
    });
  }

  async function copyLink() {
    if (!surface) return;
    await Clipboard.setStringAsync(surface.public_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function openPreview() {
    if (!surface) return;
    router.push({ pathname: "/web", params: { url: surface.published ? surface.public_url : surface.preview_url, title: c.preview } });
  }

  const sections = draft?.sections ?? [];
  const movable = sections.filter((s) => s.type !== "hero");

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={c.title} />} bottomInset={40}>
      <BigTitle title={c.title} sub={c.subtitle} size={38} />
      {isLoading && !surface ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={120} r={18} />
          <Skeleton h={200} r={18} />
        </Stack>
      ) : null}
      {!isLoading && !surface ? <EmptyState title={c.pending} /> : null}
      {surface && draft ? (
        <Stack gap={14} style={{ marginTop: 20 }}>
          {error ? <Banner icon="warning" title={error[lang]} kind="red" /> : null}
          <Card kind="glass" blur padding={18}>
            <Row style={{ justifyContent: "space-between" }}>
              <SectionLabel color={colors.goldLight}>{c.address}</SectionLabel>
              <Badge label={surface.published ? c.published : c.draft} kind={surface.published ? "green" : "amber"} dot />
            </Row>
            <Pressable onPress={copyLink} accessibilityRole="button" accessibilityLabel={c.copyLink} style={{ marginTop: 8 }}>
              <T v="name24" numberOfLines={1}>
                {c.addressHint}
                <T v="name24" color={colors.goldLight}>
                  {surface.site_slug}
                </T>
              </T>
            </Pressable>
            <T v="meta13" color={copied ? colors.green : colors.ivory55} style={{ marginTop: 4 }}>
              {copied ? c.copied : surface.public_url}
            </T>
            <Row gap={8} style={{ marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Button label={c.preview} small kind="glass" icon="globe" onPress={openPreview} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={c.share} small kind="glass" icon="share" onPress={() => void Share.share({ message: surface.public_url, url: surface.public_url })} />
              </View>
            </Row>
            <Row gap={8} style={{ marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label={surface.published ? c.unpublish : c.publish} small kind={surface.published ? "ghost" : "primary"} onPress={togglePublish} loading={busy === "publish"} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={c.changeAddress}
                  small
                  kind="ghost"
                  icon="edit"
                  onPress={() => {
                    setSlugDraft(surface.site_slug);
                    setSlugOpen(true);
                  }}
                />
              </View>
            </Row>
          </Card>

          <SectionLabel>{c.theme}</SectionLabel>
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            <ListRow
              leading={<View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: surface.themes.find((t) => t.key === surface.theme)?.bg ?? colors.night, borderWidth: 1, borderColor: colors.ivory25 }} />}
              title={c.themes[surface.theme]}
              sub={c.theme}
              onPress={() => router.push("/couple/website/theme")}
              last
            />
          </Card>

          <SectionLabel>{c.privacy}</SectionLabel>
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            <ListRow
              leading={<Icon name="lock" size={22} color={colors.goldLight} />}
              title={c.password}
              sub={surface.has_password ? c.passwordOn : c.passwordOff}
              trailing={
                surface.has_password ? (
                  <Button label={c.remove} small kind="text" full={false} onPress={removePassword} loading={busy === "password"} />
                ) : (
                  <Button label={c.setPassword} small kind="text" full={false} onPress={() => setPwOpen(true)} />
                )
              }
              chevron={false}
            />
            <View style={{ paddingVertical: 2 }}>
              <SwitchRow label={c.noindex} hint={c.noindexHint} value={draft.privacy.noindex} onChange={setNoindex} />
            </View>
          </Card>

          <Row style={{ justifyContent: "space-between", marginTop: 6 }}>
            <SectionLabel>{c.sections}</SectionLabel>
            <T v="meta13" color={state === "error" ? colors.red : state === "saved" ? colors.green : colors.ivory40}>
              {state === "saving" ? c.saving : state === "saved" ? c.saved : ""}
            </T>
          </Row>
          <T v="meta13" color={colors.ivory55}>
            {c.sectionsHint}
          </T>
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            {sections.map((s, i) => {
              const idx = movable.findIndex((m) => m.type === s.type);
              return (
                <View key={s.type} style={{ borderBottomWidth: i === sections.length - 1 ? 0 : 1, borderBottomColor: colors.ivory09 }}>
                  <ListRow
                    leading={<Icon name={ICONS[s.type]} size={22} color={s.enabled ? colors.goldLight : colors.ivory40} />}
                    title={c.section[s.type]}
                    sub={s.enabled ? c.fields.enabled : c.fields.hidden}
                    onPress={() => router.push({ pathname: "/couple/website/section/[type]", params: { type: s.type } })}
                    last
                  />
                  {s.type !== "hero" ? (
                    <Row style={{ justifyContent: "space-between", paddingBottom: 6, marginTop: -8 }}>
                      <SwitchRow label={c.fields.enabled} value={s.enabled} onChange={(v) => update((cfg) => ({ ...cfg, sections: cfg.sections.map((x) => (x.type === s.type ? { ...x, enabled: v } : x)) }))} />
                      <RowControls
                        onUp={idx > 0 ? () => update((cfg) => ({ ...cfg, sections: [cfg.sections[0], ...move(cfg.sections.slice(1), idx, idx - 1)] })) : undefined}
                        onDown={idx < movable.length - 1 ? () => update((cfg) => ({ ...cfg, sections: [cfg.sections[0], ...move(cfg.sections.slice(1), idx, idx + 1)] })) : undefined}
                        onRemove={() => update((cfg) => ({ ...cfg, sections: cfg.sections.map((x) => (x.type === s.type ? { ...x, enabled: false } : x)) }))}
                      />
                    </Row>
                  ) : null}
                </View>
              );
            })}
          </Card>

          <SectionLabel style={{ marginTop: 6 }}>{c.custom}</SectionLabel>
          <Card kind="solid" padding={2} style={{ paddingHorizontal: 18 }}>
            <ListRow leading={<Icon name="edit" size={22} color={colors.goldLight} />} title={c.custom} sub={`${draft.custom_sections.length} · ${c.customHint}`} onPress={() => router.push({ pathname: "/couple/website/section/[type]", params: { type: "custom" } })} />
            <ListRow leading={<Icon name="search" size={22} color={colors.goldLight} />} title={c.details} sub={c.detailsHint} onPress={() => router.push({ pathname: "/couple/website/section/[type]", params: { type: "details" } })} last />
          </Card>

          <Card kind="glass" padding={16}>
            <SectionLabel color={colors.goldLight}>{c.inherited}</SectionLabel>
            <T v="meta13" color={colors.ivory70} style={{ marginTop: 6 }}>
              {c.inheritedHint}
            </T>
            <T v="body15" style={{ marginTop: 10 }}>
              {surface.inherited.names ?? ""}
              {surface.inherited.date_display ? ` · ${surface.inherited.date_display}` : ""}
              {surface.inherited.city ? ` · ${surface.inherited.city}` : ""}
            </T>
          </Card>
        </Stack>
      ) : null}

      <Sheet visible={slugOpen} onClose={() => setSlugOpen(false)} top={260}>
        <T v="title30">{c.changeAddress}</T>
        <T v="meta13" color={colors.ivory55} style={{ marginTop: 6 }}>
          {c.addressHint}
          {slugDraft}
        </T>
        <Input value={slugDraft} onChangeText={setSlugDraft} placeholder={c.addressPlaceholder} placeholderTextColor={colors.ivory40} autoCapitalize="none" autoCorrect={false} style={{ marginTop: 14 }} />
        <Button label={c.save} onPress={() => void saveSlug()} loading={busy === "slug"} style={{ marginTop: 14 }} />
      </Sheet>
      <Sheet visible={pwOpen} onClose={() => setPwOpen(false)} top={260}>
        <T v="title30">{c.setPassword}</T>
        <Input value={pwDraft} onChangeText={setPwDraft} placeholder={c.newPassword} placeholderTextColor={colors.ivory40} autoCapitalize="none" autoCorrect={false} secureTextEntry style={{ marginTop: 14 }} />
        <Button label={c.save} onPress={() => void savePassword()} loading={busy === "password"} disabled={pwDraft.trim().length < 4} style={{ marginTop: 14 }} />
      </Sheet>
    </Screen>
  );
}
