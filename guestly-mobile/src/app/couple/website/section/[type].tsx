// One section's editor. The route param is a section type, or "custom"
// (the couple's free-form sections) or "details" (search title, description,
// hashtag). Edits autosave through useConfigDraft.

import React, { useState } from "react";
import { View, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLang } from "@/i18n";
import { ApiFailure } from "@/lib/api";
import { useFeatureCopy } from "@/i18n/feature";
import { Screen, TopBar, BigTitle, Card, T, Button, Stack, Skeleton, SectionLabel, Segmented, Row, Hairline, Banner } from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "@/features/website/copy";
import { useConfigDraft, updateSection, imageUri, pickAndUpload, slugId, type Section, type SectionType, type WebsiteConfig, type Bilingual, type TravelItem, type PartyMember, type RegistryItem, type EventOverride } from "@/features/website/hooks";
import { BiField, TextField, PhotoField, RowControls, SwitchRow, move } from "@/features/website/fields";

const EMPTY: Bilingual = { en: null, es: null };

export default function SectionEditor() {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();
  const { surface, isLoading, draft, update, state, error, rememberSigned } = useConfigDraft();
  const signed = surface?.signed;
  const isSection = type !== "custom" && type !== "details";
  const section = draft?.sections.find((s) => s.type === type) ?? null;
  const title = type === "custom" ? c.custom : type === "details" ? c.details : c.section[type as SectionType] ?? "";

  const status = state === "saving" ? c.saving : state === "saved" ? c.saved : "";

  function setSec<TType extends SectionType>(t: TType, fn: (s: Extract<Section, { type: TType }>) => Extract<Section, { type: TType }>) {
    update((cfg) => updateSection(cfg, t, fn));
  }

  function onPhoto(path: string | null, url?: string) {
    if (path && url) rememberSigned(path, url);
  }

  return (
    <Screen header={<TopBar onBack={() => router.back()} title={title} right={<T v="meta13" color={state === "error" ? colors.red : state === "saved" ? colors.green : colors.ivory40}>{status}</T>} />} bottomInset={60} keyboard>
      <BigTitle title={title} size={36} />
      {isLoading && !draft ? (
        <Stack gap={10} style={{ marginTop: 20 }}>
          <Skeleton h={120} r={18} />
          <Skeleton h={120} r={18} />
        </Stack>
      ) : null}
      {error ? (
        <View style={{ marginTop: 14 }}>
          <Banner icon="warning" title={error[lang]} kind="red" />
        </View>
      ) : null}
      {draft ? (
        <Stack gap={16} style={{ marginTop: 20 }}>
          {isSection && section && section.type !== "hero" ? (
            <Card kind="solid" padding={14}>
              <SwitchRow label={c.fields.enabled} value={section.enabled} onChange={(v) => update((cfg) => ({ ...cfg, sections: cfg.sections.map((s) => (s.type === section.type ? { ...s, enabled: v } : s)) }))} />
            </Card>
          ) : null}

          {section?.type === "hero" ? (
            <Card kind="solid" padding={16}>
              <Stack gap={16}>
                <PhotoField label={c.fields.photo} path={section.image_url} uri={imageUri(section.image_url, signed)} height={200} onChange={(p, u) => { onPhoto(p, u); setSec("hero", (s) => ({ ...s, image_url: p })); }} />
                <BiField label={c.fields.names} value={section.names_display} placeholder={{ en: surface?.inherited.names ?? "", es: surface?.inherited.names ?? "" }} onChange={(v) => setSec("hero", (s) => ({ ...s, names_display: v }))} />
                <BiField label={c.fields.tagline} value={section.tagline} onChange={(v) => setSec("hero", (s) => ({ ...s, tagline: v }))} />
                <SwitchRow label={c.fields.showDate} value={section.show_date} onChange={(v) => setSec("hero", (s) => ({ ...s, show_date: v }))} />
                <SwitchRow label={c.fields.showCity} value={section.show_city} onChange={(v) => setSec("hero", (s) => ({ ...s, show_city: v }))} />
              </Stack>
            </Card>
          ) : null}

          {section?.type === "countdown" ? (
            <Card kind="solid" padding={16}>
              <BiField label={c.fields.heading} value={section.heading} onChange={(v) => setSec("countdown", (s) => ({ ...s, heading: v }))} />
            </Card>
          ) : null}

          {section?.type === "story" ? (
            <Card kind="solid" padding={16}>
              <Stack gap={16}>
                <BiField label={c.fields.heading} value={section.heading} onChange={(v) => setSec("story", (s) => ({ ...s, heading: v }))} />
                <BiField label={c.fields.body} value={section.body} multiline onChange={(v) => setSec("story", (s) => ({ ...s, body: v }))} />
                <PhotoField label={c.fields.accentPhoto} path={section.accent_image_url} uri={imageUri(section.accent_image_url, signed)} onChange={(p, u) => { onPhoto(p, u); setSec("story", (s) => ({ ...s, accent_image_url: p })); }} />
              </Stack>
            </Card>
          ) : null}

          {section?.type === "gallery" ? (
            <GalleryEditor section={section} signed={signed} onChange={(fn) => setSec("gallery", fn)} onSigned={rememberSigned} />
          ) : null}

          {section?.type === "video" ? (
            <Card kind="solid" padding={16}>
              <Stack gap={16}>
                <BiField label={c.fields.heading} value={section.heading} onChange={(v) => setSec("video", (s) => ({ ...s, heading: v }))} />
                <TextField label={c.fields.videoUrl} value={section.url} hint={c.fields.videoHint} keyboardType="url" placeholder="https://youtu.be/..." onChange={(v) => setSec("video", (s) => ({ ...s, url: v }))} />
              </Stack>
            </Card>
          ) : null}

          {section?.type === "schedule" ? (
            <Stack gap={12}>
              <Card kind="solid" padding={16}>
                <Stack gap={16}>
                  <BiField label={c.fields.heading} value={section.heading} onChange={(v) => setSec("schedule", (s) => ({ ...s, heading: v }))} />
                  <SwitchRow label={c.fields.showPrivate} value={section.show_private_events} onChange={(v) => setSec("schedule", (s) => ({ ...s, show_private_events: v }))} />
                </Stack>
              </Card>
              <SectionLabel>{c.fields.events}</SectionLabel>
              {(surface?.inherited.events ?? []).map((ev) => {
                const o: EventOverride = section.event_overrides[ev.id] ?? { hidden: false, note: EMPTY, title: EMPTY, description: EMPTY, image_url: null };
                const set = (patch: Partial<EventOverride>) => setSec("schedule", (s) => ({ ...s, event_overrides: { ...s.event_overrides, [ev.id]: { ...o, ...patch } } }));
                return (
                  <Card key={ev.id} kind="solid" padding={16}>
                    <Stack gap={12}>
                      <View>
                        <T v="body16">{ev.name}</T>
                        <T v="meta13" color={colors.ivory55}>
                          {ev.meta}
                        </T>
                      </View>
                      <SwitchRow label={c.fields.hidden} value={o.hidden} onChange={(v) => set({ hidden: v })} />
                      <BiField label={c.fields.overrideTitle} value={o.title} placeholder={{ en: ev.name, es: ev.name }} onChange={(v) => set({ title: v })} />
                      <BiField label={c.fields.note} value={o.note} multiline onChange={(v) => set({ note: v })} />
                      <PhotoField label={c.fields.photo} path={o.image_url} uri={imageUri(o.image_url, signed)} height={120} onChange={(p, u) => { onPhoto(p, u); set({ image_url: p }); }} />
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          ) : null}

          {section?.type === "travel" ? (
            <TravelEditor section={section} onChange={(fn) => setSec("travel", fn)} />
          ) : null}

          {section?.type === "registry" ? (
            <RegistryEditor draft={draft} section={section} signed={signed} update={update} onChange={(fn) => setSec("registry", fn)} onSigned={rememberSigned} />
          ) : null}

          {section?.type === "party" ? (
            <PartyEditor section={section} signed={signed} onChange={(fn) => setSec("party", fn)} onSigned={rememberSigned} />
          ) : null}

          {section?.type === "faq" ? (
            <Stack gap={12}>
              <Card kind="solid" padding={16}>
                <Stack gap={16}>
                  <BiField label={c.fields.heading} value={section.heading} onChange={(v) => setSec("faq", (s) => ({ ...s, heading: v }))} />
                  <SwitchRow label={c.fields.hideFacts} value={section.hide_facts_items} onChange={(v) => setSec("faq", (s) => ({ ...s, hide_facts_items: v }))} />
                </Stack>
              </Card>
              {surface?.inherited.faq.length ? (
                <Card kind="glass" padding={14}>
                  <SectionLabel color={colors.goldLight}>{c.inherited}</SectionLabel>
                  {surface.inherited.faq.map((qa, i) => (
                    <T key={i} v="meta13" color={colors.ivory70} style={{ marginTop: 6 }}>
                      {qa.question}
                    </T>
                  ))}
                </Card>
              ) : null}
              <SectionLabel>{c.fields.faqItems}</SectionLabel>
              {section.extra_items.map((item, i) => (
                <Card key={i} kind="solid" padding={16}>
                  <Stack gap={12}>
                    <BiField label={c.fields.question} value={item.q} onChange={(v) => setSec("faq", (s) => ({ ...s, extra_items: s.extra_items.map((x, j) => (j === i ? { ...x, q: v } : x)) }))} />
                    <BiField label={c.fields.answer} value={item.a} multiline onChange={(v) => setSec("faq", (s) => ({ ...s, extra_items: s.extra_items.map((x, j) => (j === i ? { ...x, a: v } : x)) }))} />
                    <RowControls onUp={i > 0 ? () => setSec("faq", (s) => ({ ...s, extra_items: move(s.extra_items, i, i - 1) })) : undefined} onDown={i < section.extra_items.length - 1 ? () => setSec("faq", (s) => ({ ...s, extra_items: move(s.extra_items, i, i + 1) })) : undefined} onRemove={() => setSec("faq", (s) => ({ ...s, extra_items: s.extra_items.filter((_, j) => j !== i) }))} />
                  </Stack>
                </Card>
              ))}
              <Button label={c.fields.addFaq} kind="glass" icon="plus" onPress={() => setSec("faq", (s) => ({ ...s, extra_items: [...s.extra_items, { q: EMPTY, a: EMPTY }] }))} disabled={section.extra_items.length >= 12} />
            </Stack>
          ) : null}

          {section?.type === "rsvp" ? (
            <Card kind="solid" padding={16}>
              <Stack gap={16}>
                <BiField label={c.fields.heading} value={section.heading} onChange={(v) => setSec("rsvp", (s) => ({ ...s, heading: v }))} />
                <BiField label={c.fields.body} value={section.body} multiline onChange={(v) => setSec("rsvp", (s) => ({ ...s, body: v }))} />
                <T v="meta13" color={colors.ivory55}>
                  {c.fields.questionsNote}
                </T>
              </Stack>
            </Card>
          ) : null}

          {section?.type === "chat" ? (
            <Stack gap={12}>
              <Card kind="solid" padding={16}>
                <Stack gap={16}>
                  <BiField label={c.fields.heading} value={section.heading} onChange={(v) => setSec("chat", (s) => ({ ...s, heading: v }))} />
                  <BiField label={c.fields.body} value={section.body} multiline onChange={(v) => setSec("chat", (s) => ({ ...s, body: v }))} />
                </Stack>
              </Card>
              <Card kind="solid" padding={16}>
                <Stack gap={14}>
                  <SwitchRow label={c.fields.whatsapp} value={draft.chat.whatsapp.enabled} onChange={(v) => update((cfg) => ({ ...cfg, chat: { ...cfg.chat, whatsapp: { ...cfg.chat.whatsapp, enabled: v } } }))} />
                  <TextField label={c.fields.whatsappNumber} value={draft.chat.whatsapp.number} keyboardType="phone-pad" placeholder="59171234567" onChange={(v) => update((cfg) => ({ ...cfg, chat: { ...cfg.chat, whatsapp: { ...cfg.chat.whatsapp, number: v } } }))} />
                  <BiField label={c.fields.prefill} value={{ en: draft.chat.whatsapp.prefill_en, es: draft.chat.whatsapp.prefill_es }} onChange={(v) => update((cfg) => ({ ...cfg, chat: { ...cfg.chat, whatsapp: { ...cfg.chat.whatsapp, prefill_en: v.en, prefill_es: v.es } } }))} />
                </Stack>
              </Card>
              <Card kind="solid" padding={16}>
                <Stack gap={14}>
                  <SwitchRow label={c.fields.planner} value={draft.chat.planner.enabled} onChange={(v) => update((cfg) => ({ ...cfg, chat: { ...cfg.chat, planner: { ...cfg.chat.planner, enabled: v } } }))} />
                  <TextField label={c.fields.plannerName} value={draft.chat.planner.name} onChange={(v) => update((cfg) => ({ ...cfg, chat: { ...cfg.chat, planner: { ...cfg.chat.planner, name: v } } }))} />
                  <TextField label={c.fields.whatsappNumber} value={draft.chat.planner.number} keyboardType="phone-pad" onChange={(v) => update((cfg) => ({ ...cfg, chat: { ...cfg.chat, planner: { ...cfg.chat.planner, number: v } } }))} />
                  <BiField label={c.fields.prefill} value={{ en: draft.chat.planner.prefill_en, es: draft.chat.planner.prefill_es }} onChange={(v) => update((cfg) => ({ ...cfg, chat: { ...cfg.chat, planner: { ...cfg.chat.planner, prefill_en: v.en, prefill_es: v.es } } }))} />
                </Stack>
              </Card>
            </Stack>
          ) : null}

          {type === "custom" ? (
            <Stack gap={12}>
              <T v="meta13" color={colors.ivory55}>
                {c.customHint}
              </T>
              {draft.custom_sections.map((cs, i) => (
                <Card key={cs.id} kind="solid" padding={16}>
                  <Stack gap={12}>
                    <BiField label={c.fields.customHeading} value={cs.heading} onChange={(v) => update((cfg) => ({ ...cfg, custom_sections: cfg.custom_sections.map((x, j) => (j === i ? { ...x, heading: v } : x)) }))} />
                    <BiField label={c.fields.body} value={cs.body} multiline onChange={(v) => update((cfg) => ({ ...cfg, custom_sections: cfg.custom_sections.map((x, j) => (j === i ? { ...x, body: v } : x)) }))} />
                    <PhotoField label={c.fields.photo} path={cs.photo_url} uri={imageUri(cs.photo_url, signed)} height={120} onChange={(p, u) => { onPhoto(p, u); update((cfg) => ({ ...cfg, custom_sections: cfg.custom_sections.map((x, j) => (j === i ? { ...x, photo_url: p } : x)) })); }} />
                    <RowControls onUp={i > 0 ? () => update((cfg) => ({ ...cfg, custom_sections: move(cfg.custom_sections, i, i - 1) })) : undefined} onDown={i < draft.custom_sections.length - 1 ? () => update((cfg) => ({ ...cfg, custom_sections: move(cfg.custom_sections, i, i + 1) })) : undefined} onRemove={() => update((cfg) => ({ ...cfg, custom_sections: cfg.custom_sections.filter((_, j) => j !== i) }))} />
                  </Stack>
                </Card>
              ))}
              <Button label={c.fields.addCustom} kind="glass" icon="plus" disabled={draft.custom_sections.length >= 6} onPress={() => update((cfg) => ({ ...cfg, custom_sections: [...cfg.custom_sections, { id: slugId("custom"), heading: EMPTY, body: EMPTY, photo_url: null }] }))} />
            </Stack>
          ) : null}

          {type === "details" ? (
            <Card kind="solid" padding={16}>
              <Stack gap={16}>
                <TextField label={c.fields.seoTitle} value={draft.seo.title} onChange={(v) => update((cfg) => ({ ...cfg, seo: { ...cfg.seo, title: v } }))} />
                <BiField label={c.fields.seoDescription} value={draft.seo.description} multiline onChange={(v) => update((cfg) => ({ ...cfg, seo: { ...cfg.seo, description: v } }))} />
                <PhotoField label={c.fields.photo} path={draft.seo.og_image_url} uri={imageUri(draft.seo.og_image_url, signed)} height={120} onChange={(p, u) => { onPhoto(p, u); update((cfg) => ({ ...cfg, seo: { ...cfg.seo, og_image_url: p } })); }} />
                <TextField label={c.fields.hashtag} value={draft.footer_hashtag} placeholder="#CamilaYAndres2027" onChange={(v) => update((cfg) => ({ ...cfg, footer_hashtag: v }))} />
              </Stack>
            </Card>
          ) : null}
        </Stack>
      ) : null}
    </Screen>
  );
}

function GalleryEditor({ section, signed, onChange, onSigned }: { section: Extract<Section, { type: "gallery" }>; signed?: Record<string, string>; onChange: (fn: (s: Extract<Section, { type: "gallery" }>) => Extract<Section, { type: "gallery" }>) => void; onSigned: (p: string, u: string) => void }) {
  const c = useFeatureCopy(COPY);
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    try {
      const picked = await pickAndUpload({ allowsMultipleSelection: true });
      if (picked?.length) {
        picked.forEach((p) => onSigned(p.path, p.url));
        onChange((s) => ({ ...s, images: [...s.images, ...picked.map((p) => ({ url: p.path, caption: EMPTY }))].slice(0, 30) }));
      }
    } catch (err) {
      Alert.alert(c.fields.images, err instanceof ApiFailure ? err.messages[lang] : c.errors.pickFailed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack gap={12}>
      <Card kind="solid" padding={16}>
        <BiField label={c.fields.heading} value={section.heading} onChange={(v) => onChange((s) => ({ ...s, heading: v }))} />
      </Card>
      <SectionLabel>{c.fields.images}</SectionLabel>
      {section.images.map((img, i) => (
        <Card key={`${img.url}-${i}`} kind="solid" padding={12}>
          <Stack gap={10}>
            <PhotoField label={`${i + 1}`} path={img.url} uri={imageUri(img.url, signed)} height={140} onChange={(p, u) => { if (p && u) onSigned(p, u); onChange((s) => ({ ...s, images: p ? s.images.map((x, j) => (j === i ? { ...x, url: p } : x)) : s.images.filter((_, j) => j !== i) })); }} />
            <BiField label={c.fields.caption} value={img.caption} onChange={(v) => onChange((s) => ({ ...s, images: s.images.map((x, j) => (j === i ? { ...x, caption: v } : x)) }))} />
            <RowControls onUp={i > 0 ? () => onChange((s) => ({ ...s, images: move(s.images, i, i - 1) })) : undefined} onDown={i < section.images.length - 1 ? () => onChange((s) => ({ ...s, images: move(s.images, i, i + 1) })) : undefined} onRemove={() => onChange((s) => ({ ...s, images: s.images.filter((_, j) => j !== i) }))} />
          </Stack>
        </Card>
      ))}
      <Button label={c.fields.addImages} kind="glass" icon="photo" onPress={() => void add()} loading={busy} disabled={section.images.length >= 30} />
    </Stack>
  );
}

function TravelEditor({ section, onChange }: { section: Extract<Section, { type: "travel" }>; onChange: (fn: (s: Extract<Section, { type: "travel" }>) => Extract<Section, { type: "travel" }>) => void }) {
  const c = useFeatureCopy(COPY);
  const setItem = (i: number, patch: Partial<TravelItem>) => onChange((s) => ({ ...s, items: s.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  return (
    <Stack gap={12}>
      <Card kind="solid" padding={16}>
        <BiField label={c.fields.heading} value={section.heading} onChange={(v) => onChange((s) => ({ ...s, heading: v }))} />
      </Card>
      <SectionLabel>{c.fields.items}</SectionLabel>
      {section.items.map((it, i) => (
        <Card key={it.id} kind="solid" padding={16}>
          <Stack gap={12}>
            <Segmented<TravelItem["kind"]> value={it.kind} options={[{ value: "hotel", label: c.fields.kinds.hotel }, { value: "venue", label: c.fields.kinds.venue }, { value: "tip", label: c.fields.kinds.tip }]} onChange={(v) => setItem(i, { kind: v })} />
            <BiField label={c.fields.heading} value={it.title} onChange={(v) => setItem(i, { title: v })} />
            <BiField label={c.fields.body} value={it.body} multiline onChange={(v) => setItem(i, { body: v })} />
            <TextField label={c.fields.address} value={it.address} onChange={(v) => setItem(i, { address: v })} />
            <TextField label={c.fields.phone} value={it.phone} keyboardType="phone-pad" onChange={(v) => setItem(i, { phone: v })} />
            <TextField label={c.fields.url} value={it.url} keyboardType="url" placeholder="https://" onChange={(v) => setItem(i, { url: v })} />
            <TextField label={c.fields.mapUrl} value={it.map_url} keyboardType="url" placeholder="https://maps.app.goo.gl/" onChange={(v) => setItem(i, { map_url: v })} />
            <TextField label={c.fields.promo} value={it.promo_code} onChange={(v) => setItem(i, { promo_code: v })} />
            <RowControls onUp={i > 0 ? () => onChange((s) => ({ ...s, items: move(s.items, i, i - 1) })) : undefined} onDown={i < section.items.length - 1 ? () => onChange((s) => ({ ...s, items: move(s.items, i, i + 1) })) : undefined} onRemove={() => onChange((s) => ({ ...s, items: s.items.filter((_, j) => j !== i) }))} />
          </Stack>
        </Card>
      ))}
      <Button label={c.fields.addItem} kind="glass" icon="plus" disabled={section.items.length >= 12} onPress={() => onChange((s) => ({ ...s, items: [...s.items, { id: slugId("item"), kind: "hotel", title: EMPTY, body: EMPTY, url: null, map_url: null, address: null, phone: null, promo_code: null }] }))} />
    </Stack>
  );
}

function RegistryEditor({ draft, section, signed, update, onChange, onSigned }: { draft: WebsiteConfig; section: Extract<Section, { type: "registry" }>; signed?: Record<string, string>; update: (fn: (cfg: WebsiteConfig) => WebsiteConfig) => void; onChange: (fn: (s: Extract<Section, { type: "registry" }>) => Extract<Section, { type: "registry" }>) => void; onSigned: (p: string, u: string) => void }) {
  const c = useFeatureCopy(COPY);
  const reg = draft.registry;
  const setReg = (patch: Partial<WebsiteConfig["registry"]>) => update((cfg) => ({ ...cfg, registry: { ...cfg.registry, ...patch } }));
  const setItem = (i: number, patch: Partial<RegistryItem>) => setReg({ items: reg.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <Stack gap={12}>
      <Card kind="solid" padding={16}>
        <Stack gap={16}>
          <BiField label={c.fields.heading} value={section.heading} onChange={(v) => onChange((s) => ({ ...s, heading: v }))} />
          <BiField label={c.fields.body} value={section.note} multiline onChange={(v) => onChange((s) => ({ ...s, note: v }))} />
          <View style={{ gap: 6 }}>
            <T v="label11" color={colors.ivory55}>
              {c.fields.registryMode}
            </T>
            <Segmented<WebsiteConfig["registry"]["mode"]> value={reg.mode} options={[{ value: "external", label: c.fields.registryModes.external }, { value: "page", label: c.fields.registryModes.page }, { value: "hidden", label: c.fields.registryModes.hidden }]} onChange={(v) => setReg({ mode: v })} />
          </View>
          {reg.mode === "external" ? <TextField label={c.fields.externalUrl} value={reg.external_url} keyboardType="url" placeholder="https://" onChange={(v) => setReg({ external_url: v })} /> : null}
        </Stack>
      </Card>
      {reg.mode === "page" ? (
        <>
          <SectionLabel>{c.fields.registryItems}</SectionLabel>
          {reg.items.map((it, i) => (
            <Card key={it.id} kind="solid" padding={16}>
              <Stack gap={12}>
                <Segmented<RegistryItem["kind"]> value={it.kind} options={[{ value: "link", label: c.fields.registryKinds.link }, { value: "note", label: c.fields.registryKinds.note }, { value: "image", label: c.fields.registryKinds.image }]} onChange={(v) => setItem(i, { kind: v })} />
                <BiField label={c.fields.heading} value={it.title} onChange={(v) => setItem(i, { title: v })} />
                <BiField label={c.fields.body} value={it.body} multiline onChange={(v) => setItem(i, { body: v })} />
                {it.kind === "link" ? <TextField label={c.fields.url} value={it.url} keyboardType="url" placeholder="https://" onChange={(v) => setItem(i, { url: v })} /> : null}
                {it.kind === "image" ? <PhotoField label={c.fields.photo} path={it.image_url} uri={imageUri(it.image_url, signed)} height={140} onChange={(p, u) => { if (p && u) onSigned(p, u); setItem(i, { image_url: p }); }} /> : null}
                <RowControls onUp={i > 0 ? () => setReg({ items: move(reg.items, i, i - 1).map((x, j) => ({ ...x, sort: j })) }) : undefined} onDown={i < reg.items.length - 1 ? () => setReg({ items: move(reg.items, i, i + 1).map((x, j) => ({ ...x, sort: j })) }) : undefined} onRemove={() => setReg({ items: reg.items.filter((_, j) => j !== i).map((x, j) => ({ ...x, sort: j })) })} />
              </Stack>
            </Card>
          ))}
          <Button label={c.fields.addRegistryItem} kind="glass" icon="plus" disabled={reg.items.length >= 12} onPress={() => setReg({ items: [...reg.items, { id: slugId("reg"), kind: "link", title: EMPTY, body: EMPTY, url: null, image_url: null, sort: reg.items.length }] })} />
        </>
      ) : null}
      <Hairline />
    </Stack>
  );
}

function PartyEditor({ section, signed, onChange, onSigned }: { section: Extract<Section, { type: "party" }>; signed?: Record<string, string>; onChange: (fn: (s: Extract<Section, { type: "party" }>) => Extract<Section, { type: "party" }>) => void; onSigned: (p: string, u: string) => void }) {
  const c = useFeatureCopy(COPY);
  const setMember = (i: number, patch: Partial<PartyMember>) => onChange((s) => ({ ...s, members: s.members.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  return (
    <Stack gap={12}>
      <Card kind="solid" padding={16}>
        <BiField label={c.fields.heading} value={section.heading} onChange={(v) => onChange((s) => ({ ...s, heading: v }))} />
      </Card>
      <SectionLabel>{c.fields.members}</SectionLabel>
      {section.members.map((m, i) => (
        <Card key={m.id} kind="solid" padding={16}>
          <Stack gap={12}>
            <Row gap={14} align="flex-start">
              <View style={{ width: 110 }}>
                <PhotoField label={c.fields.photo} path={m.photo_url} uri={imageUri(m.photo_url, signed)} height={110} onChange={(p, u) => { if (p && u) onSigned(p, u); setMember(i, { photo_url: p }); }} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label={c.fields.name} value={m.name} onChange={(v) => setMember(i, { name: v ?? "" })} />
              </View>
            </Row>
            <BiField label={c.fields.role} value={m.role} onChange={(v) => setMember(i, { role: v })} />
            <BiField label={c.fields.bio} value={m.bio} multiline onChange={(v) => setMember(i, { bio: v })} />
            <RowControls onUp={i > 0 ? () => onChange((s) => ({ ...s, members: move(s.members, i, i - 1) })) : undefined} onDown={i < section.members.length - 1 ? () => onChange((s) => ({ ...s, members: move(s.members, i, i + 1) })) : undefined} onRemove={() => onChange((s) => ({ ...s, members: s.members.filter((_, j) => j !== i) }))} />
          </Stack>
        </Card>
      ))}
      <Button label={c.fields.addMember} kind="glass" icon="plus" disabled={section.members.length >= 16} onPress={() => onChange((s) => ({ ...s, members: [...s.members, { id: slugId("member"), name: "", role: EMPTY, bio: EMPTY, photo_url: null }] }))} />
    </Stack>
  );
}
