// Native renderers for the couple's wedding site sections. One component per
// section type, all in the app's Direction A language; the gallery viewer is
// a full-screen modal owned by SiteBody so every image on the page opens it.

import React, { useMemo, useState } from "react";
import { View, StyleSheet, Pressable, Linking, Modal, FlatList, useWindowDimensions, ScrollView } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { T, Row, Stack, Card, Button, Badge, Gem, Hairline, Countdown, Avatar, Icon, IconButton, SectionLabel } from "@/ui";
import { colors, FILL, radius } from "@/ui/tokens";
import { COPY } from "./copy";
import type { GuestSite, SiteSection, SectionType } from "./hooks";

type Viewer = { images: { url: string; caption: string | null }[]; index: number } | null;

/* ------------------------------------------------------------------ */
/* Page body                                                            */
/* ------------------------------------------------------------------ */

export function SiteBody({ site, only, hero = true }: { site: GuestSite; only?: SectionType[]; hero?: boolean }) {
  const copy = useFeatureCopy(COPY);
  const [viewer, setViewer] = useState<Viewer>(null);
  const open = (images: { url: string; caption: string | null }[], index: number) => {
    void Haptics.selectionAsync();
    setViewer({ images, index });
  };

  const sections = useMemo(() => site.sections.filter((s) => (only ? (only as string[]).includes(s.type) : true) && (hero || s.type !== "hero")), [site, only, hero]);

  const body: React.ReactNode[] = [];
  let accentIdx = 0;
  let contentCount = 0;
  for (const s of sections) {
    body.push(<SectionView key={sectionKey(s)} section={s} onOpen={open} />);
    if (s.type === "hero" || only) continue;
    contentCount += 1;
    if (contentCount % 2 === 0 && accentIdx < site.accents.length) {
      const a = site.accents[accentIdx++];
      body.push(<Accent key={`accent-${accentIdx}`} url={a.url} onPress={() => open(site.accents.map((x) => ({ url: x.url, caption: x.alt })), accentIdx - 1)} />);
    }
  }

  return (
    <View>
      {body}
      {!only && site.hashtag ? (
        <T v="label11" color={colors.goldLight} center style={{ marginTop: 30, letterSpacing: 2 }}>
          {site.hashtag}
        </T>
      ) : null}
      <GalleryViewer viewer={viewer} onClose={() => setViewer(null)} copy={copy} />
    </View>
  );
}

function sectionKey(s: SiteSection): string {
  return s.type === "custom" ? `custom-${s.id}` : s.type;
}

function SectionView({ section, onOpen }: { section: SiteSection; onOpen: (images: { url: string; caption: string | null }[], index: number) => void }) {
  switch (section.type) {
    case "hero":
      return <Hero s={section} />;
    case "countdown":
      return <CountdownBlock s={section} />;
    case "story":
      return <Story s={section} onOpen={onOpen} />;
    case "party":
      return <Party s={section} onOpen={onOpen} />;
    case "schedule":
      return <Schedule s={section} onOpen={onOpen} />;
    case "travel":
      return <Travel s={section} />;
    case "registry":
      return <Registry s={section} onOpen={onOpen} />;
    case "faq":
      return <Faq s={section} />;
    case "gallery":
      return <Gallery s={section} onOpen={onOpen} />;
    case "video":
      return <Video s={section} />;
    case "chat":
      return <Chat s={section} />;
    case "custom":
      return <Custom s={section} onOpen={onOpen} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                          */
/* ------------------------------------------------------------------ */

function Section({ heading, children, fallback }: { heading: string | null; children: React.ReactNode; fallback: string }) {
  return (
    <View style={styles.section}>
      <Row gap={10} style={{ marginBottom: 14 }}>
        <Gem />
        <T v="title30">{heading ?? fallback}</T>
      </Row>
      {children}
    </View>
  );
}

function Photo({ url, height = 220, onPress, style }: { url: string; height?: number; onPress?: () => void; style?: object }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "imagebutton" : "image"}>
      <View style={[{ height, borderRadius: radius.card, overflow: "hidden", borderWidth: 1, borderColor: colors.ivory09, backgroundColor: colors.navySoft }, style]}>
        <Image source={{ uri: url }} style={FILL} contentFit="cover" transition={250} />
      </View>
    </Pressable>
  );
}

function Accent({ url, onPress }: { url: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="imagebutton">
      <View style={{ height: 240, marginTop: 34, overflow: "hidden" }}>
        <Image source={{ uri: url }} style={FILL} contentFit="cover" transition={250} />
        <LinearGradient colors={["rgba(13,17,23,0.35)", "rgba(13,17,23,0)", "rgba(13,17,23,0.35)"]} style={FILL} />
      </View>
    </Pressable>
  );
}

function openExternal(url: string) {
  void Haptics.selectionAsync();
  void Linking.openURL(url);
}

/* ------------------------------------------------------------------ */
/* Sections                                                             */
/* ------------------------------------------------------------------ */

function Hero({ s }: { s: Extract<SiteSection, { type: "hero" }> }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const top = Math.max(insets.top, 54);
  return (
    <View style={styles.hero}>
      {s.image_url ? <Image source={{ uri: s.image_url }} style={FILL} contentFit="cover" transition={300} /> : null}
      <LinearGradient colors={["rgba(8,11,16,0.55)", "rgba(8,11,16,0.15)", "rgba(13,17,23,0.75)", colors.night]} locations={[0, 0.35, 0.78, 1]} style={FILL} />
      <View style={[styles.heroTop, { top }]}>
        <IconButton name="back" onPress={() => router.back()} />
      </View>
      <View style={styles.heroText}>
        {s.tagline ? (
          <T v="label11" color={colors.goldLight} style={{ letterSpacing: 2.4 }}>
            {s.tagline}
          </T>
        ) : null}
        <T v="display44" style={{ marginTop: 10 }}>
          {s.names}
        </T>
        {s.date_line || s.city ? (
          <T v="body16" color="rgba(247,243,236,0.85)" style={{ marginTop: 10 }}>
            {[s.date_line, s.city].filter(Boolean).join(" · ")}
          </T>
        ) : null}
      </View>
    </View>
  );
}

function CountdownBlock({ s }: { s: Extract<SiteSection, { type: "countdown" }> }) {
  const copy = useFeatureCopy(COPY);
  return (
    <View style={[styles.section, { alignItems: "center" }]}>
      <SectionLabel color={colors.goldLight}>{s.heading ?? copy.sections.countdown}</SectionLabel>
      <View style={{ marginTop: 12 }}>
        {s.past || (s.days === 0 && s.hours === 0 && s.minutes === 0) ? (
          <T v="title30" center>
            {copy.today}
          </T>
        ) : (
          <Countdown days={s.days} hours={s.hours} minutes={s.minutes} labels={copy.countdown} />
        )}
      </View>
    </View>
  );
}

function Story({ s, onOpen }: { s: Extract<SiteSection, { type: "story" }>; onOpen: (images: { url: string; caption: string | null }[], index: number) => void }) {
  const copy = useFeatureCopy(COPY);
  return (
    <Section heading={s.heading} fallback={copy.sections.story}>
      {s.body ? (
        <T v="body16" color={colors.ivory70} style={{ lineHeight: 27 }}>
          {s.body}
        </T>
      ) : null}
      {s.image_url ? <Photo url={s.image_url} height={260} style={{ marginTop: 18 }} onPress={() => onOpen([{ url: s.image_url!, caption: null }], 0)} /> : null}
    </Section>
  );
}

function Party({ s, onOpen }: { s: Extract<SiteSection, { type: "party" }>; onOpen: (images: { url: string; caption: string | null }[], index: number) => void }) {
  const copy = useFeatureCopy(COPY);
  return (
    <Section heading={s.heading} fallback={copy.sections.party}>
      <View style={styles.grid}>
        {s.members.map((m) => (
          <Card key={m.id} kind="solid" padding={16} style={styles.gridCell}>
            <View style={{ alignItems: "center", gap: 8 }}>
              {m.photo_url ? (
                <Pressable onPress={() => onOpen([{ url: m.photo_url!, caption: m.name }], 0)} accessibilityRole="imagebutton">
                  <View style={styles.memberPhoto}>
                    <Image source={{ uri: m.photo_url }} style={FILL} contentFit="cover" transition={250} />
                  </View>
                </Pressable>
              ) : (
                <Avatar initials={initialsOf(m.name)} size={72} />
              )}
              <T v="name24" center style={{ marginTop: 4 }}>
                {m.name}
              </T>
              {m.role ? (
                <T v="label11" color={colors.goldLight} center>
                  {m.role}
                </T>
              ) : null}
              {m.bio ? (
                <T v="meta13" color={colors.ivory70} center>
                  {m.bio}
                </T>
              ) : null}
            </View>
          </Card>
        ))}
      </View>
    </Section>
  );
}

function Schedule({ s, onOpen }: { s: Extract<SiteSection, { type: "schedule" }>; onOpen: (images: { url: string; caption: string | null }[], index: number) => void }) {
  const copy = useFeatureCopy(COPY);
  return (
    <Section heading={s.heading} fallback={copy.sections.schedule}>
      <Stack gap={12}>
        {s.events.map((e) => (
          <Card key={e.id} kind="solid" padding={16}>
            <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="name24">{e.title}</T>
                {e.date || e.time ? (
                  <T v="meta13" color={colors.goldLight}>
                    {[e.date, e.time].filter(Boolean).join(" · ")}
                  </T>
                ) : null}
              </View>
            </Row>
            {e.location ? (
              <T v="meta13" color={colors.ivory55} style={{ marginTop: 6 }}>
                {e.location}
              </T>
            ) : null}
            {e.description ? (
              <T v="body15" color={colors.ivory70} style={{ marginTop: 8 }}>
                {e.description}
              </T>
            ) : null}
            {e.note ? (
              <T v="body15" color={colors.ivory70} style={{ marginTop: 6 }}>
                {e.note}
              </T>
            ) : null}
            {e.dress_code ? (
              <Row gap={8} style={{ marginTop: 8 }}>
                <Icon name="hanger" size={18} color={colors.goldLight} />
                <T v="meta13" color={colors.ivory70} style={{ flex: 1 }}>
                  {e.dress_code}
                </T>
              </Row>
            ) : null}
            {e.image_url ? <Photo url={e.image_url} height={180} style={{ marginTop: 12 }} onPress={() => onOpen([{ url: e.image_url!, caption: e.title }], 0)} /> : null}
            {e.maps_url ? (
              <Row gap={8} style={{ marginTop: 12 }}>
                <Button label={copy.maps} icon="map" small kind="glass" full={false} onPress={() => openExternal(e.maps_url!)} />
              </Row>
            ) : null}
          </Card>
        ))}
      </Stack>
    </Section>
  );
}

function Travel({ s }: { s: Extract<SiteSection, { type: "travel" }> }) {
  const copy = useFeatureCopy(COPY);
  const [copied, setCopied] = useState<string | null>(null);
  const copyCode = async (id: string, code: string) => {
    await Clipboard.setStringAsync(code);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800);
  };
  return (
    <Section heading={s.heading} fallback={copy.sections.travel}>
      <Stack gap={12}>
        {s.items.map((it) => (
          <Card key={it.id} kind="solid" padding={16}>
            <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }} gap={10}>
              <View style={{ flex: 1 }}>
                <T v="name24">{it.title ?? copy.kinds[it.kind]}</T>
              </View>
              <Badge label={copy.kinds[it.kind]} kind={it.kind === "hotel" ? "gold" : "mute"} />
            </Row>
            {it.address ? (
              <T v="meta13" color={colors.ivory55} style={{ marginTop: 6 }}>
                {it.address}
              </T>
            ) : null}
            {it.body ? (
              <T v="body15" color={colors.ivory70} style={{ marginTop: 8, lineHeight: 24 }}>
                {it.body}
              </T>
            ) : null}
            {it.promo_code ? (
              <Pressable onPress={() => copyCode(it.id, it.promo_code!)} accessibilityRole="button" style={{ marginTop: 10 }}>
                <Row gap={8}>
                  <SectionLabel>{copied === it.id ? copy.copied : copy.bookingCode}</SectionLabel>
                  <T v="body16" color={colors.goldLight}>
                    {it.promo_code}
                  </T>
                </Row>
              </Pressable>
            ) : null}
            {it.phone || it.map_url || it.url ? (
              <Row gap={8} style={{ marginTop: 14, flexWrap: "wrap" }}>
                {it.phone ? <Button label={copy.call} icon="phone" small kind="glass" full={false} onPress={() => openExternal(`tel:${it.phone!.replace(/[^\d+]/g, "")}`)} /> : null}
                {it.map_url ? <Button label={copy.maps} icon="map" small kind="glass" full={false} onPress={() => openExternal(it.map_url!)} /> : null}
                {it.url ? <Button label={copy.website} icon="globe" small kind="glass" full={false} onPress={() => openExternal(it.url!)} /> : null}
              </Row>
            ) : null}
          </Card>
        ))}
      </Stack>
    </Section>
  );
}

function Registry({ s, onOpen }: { s: Extract<SiteSection, { type: "registry" }>; onOpen: (images: { url: string; caption: string | null }[], index: number) => void }) {
  const copy = useFeatureCopy(COPY);
  const images = s.items.filter((it) => it.kind === "image" && it.image_url).map((it) => ({ url: it.image_url as string, caption: it.title }));
  return (
    <Section heading={s.heading} fallback={copy.sections.registry}>
      {s.note ? (
        <T v="body16" color={colors.ivory70} style={{ lineHeight: 26 }}>
          {s.note}
        </T>
      ) : null}
      {s.external_url ? <Button label={copy.viewRegistry} icon="star" onPress={() => openExternal(s.external_url!)} style={{ marginTop: 18 }} /> : null}
      {s.links.length ? (
        <Stack gap={8} style={{ marginTop: 14 }}>
          {s.links.map((l, i) => (
            <Button key={`${l.url}-${i}`} label={l.label ?? copy.registryLinkFallback} icon="globe" kind="glass" onPress={() => openExternal(l.url)} />
          ))}
        </Stack>
      ) : null}
      {s.items.length ? (
        <Stack gap={12} style={{ marginTop: 18 }}>
          {s.items.map((it) => {
            if (it.kind === "link" && it.url) {
              return (
                <Card key={it.id} kind="solid" padding={16}>
                  <T v="name24">{it.title ?? copy.registryLinkFallback}</T>
                  {it.body ? (
                    <T v="body15" color={colors.ivory70} style={{ marginTop: 6 }}>
                      {it.body}
                    </T>
                  ) : null}
                  <Button label={copy.viewRegistry} icon="globe" small kind="glass" full={false} onPress={() => openExternal(it.url!)} style={{ marginTop: 12 }} />
                </Card>
              );
            }
            if (it.kind === "image" && it.image_url) {
              const idx = images.findIndex((im) => im.url === it.image_url);
              return (
                <View key={it.id}>
                  {it.title ? (
                    <T v="name24" style={{ marginBottom: 8 }}>
                      {it.title}
                    </T>
                  ) : null}
                  <Photo url={it.image_url} height={300} onPress={() => onOpen(images, Math.max(0, idx))} />
                  {it.body ? (
                    <T v="meta13" color={colors.ivory55} style={{ marginTop: 6 }}>
                      {it.body}
                    </T>
                  ) : null}
                </View>
              );
            }
            if (it.kind === "note" && (it.title || it.body)) {
              return (
                <Card key={it.id} kind="glass" padding={16}>
                  {it.title ? <T v="name24">{it.title}</T> : null}
                  {it.body ? (
                    <T v="body15" color={colors.ivory70} style={{ marginTop: it.title ? 6 : 0, lineHeight: 24 }}>
                      {it.body}
                    </T>
                  ) : null}
                </Card>
              );
            }
            return null;
          })}
        </Stack>
      ) : null}
    </Section>
  );
}

function Faq({ s }: { s: Extract<SiteSection, { type: "faq" }> }) {
  const copy = useFeatureCopy(COPY);
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <Section heading={s.heading} fallback={copy.sections.faq}>
      <Card kind="solid" padding={4} style={{ paddingHorizontal: 16 }}>
        {s.items.map((it, i) => {
          const isOpen = openIdx === i;
          return (
            <View key={`${i}-${it.q.slice(0, 20)}`}>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setOpenIdx(isOpen ? null : i);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                style={{ minHeight: 56, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <T v="body16" style={{ flex: 1 }}>
                  {it.q}
                </T>
                <View style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}>
                  <Icon name="down" size={18} color={colors.goldLight} />
                </View>
              </Pressable>
              {isOpen ? (
                <T v="body15" color={colors.ivory70} style={{ paddingBottom: 16, lineHeight: 24 }}>
                  {it.a}
                </T>
              ) : null}
              {i < s.items.length - 1 ? <Hairline /> : null}
            </View>
          );
        })}
      </Card>
    </Section>
  );
}

function Gallery({ s, onOpen }: { s: Extract<SiteSection, { type: "gallery" }>; onOpen: (images: { url: string; caption: string | null }[], index: number) => void }) {
  const copy = useFeatureCopy(COPY);
  const { width } = useWindowDimensions();
  const gap = 6;
  const cell = Math.floor((width - 24 * 2 - gap * 2) / 3);
  return (
    <Section heading={s.heading} fallback={copy.sections.gallery}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
        {s.images.map((im, i) => (
          <Pressable key={`${im.url}-${i}`} onPress={() => onOpen(s.images, i)} accessibilityRole="imagebutton" accessibilityLabel={im.caption ?? undefined}>
            <View style={{ width: cell, height: cell, borderRadius: 12, overflow: "hidden", backgroundColor: colors.navySoft }}>
              <Image source={{ uri: im.url }} style={FILL} contentFit="cover" transition={200} />
            </View>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

function Video({ s }: { s: Extract<SiteSection, { type: "video" }> }) {
  const copy = useFeatureCopy(COPY);
  const { width } = useWindowDimensions();
  const w = width - 48;
  return (
    <Section heading={s.heading} fallback={copy.sections.video}>
      <View style={{ width: w, height: Math.round((w * 9) / 16), borderRadius: radius.card, overflow: "hidden", backgroundColor: colors.nightDeep, borderWidth: 1, borderColor: colors.ivory09 }}>
        <WebView
          source={{ uri: s.embed_url }}
          style={{ flex: 1, backgroundColor: colors.nightDeep }}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction
          javaScriptEnabled
          originWhitelist={["https://*"]}
        />
      </View>
    </Section>
  );
}

function Chat({ s }: { s: Extract<SiteSection, { type: "chat" }> }) {
  const copy = useFeatureCopy(COPY);
  const router = useRouter();
  return (
    <Section heading={s.heading} fallback={copy.sections.chat}>
      <Card kind="glass" padding={18}>
        {s.body ? (
          <T v="body15" color={colors.ivory70} style={{ marginBottom: 14, lineHeight: 24 }}>
            {s.body}
          </T>
        ) : null}
        <Stack gap={8}>
          <Button label={copy.chatConcierge} icon="sparkle" onPress={() => router.push("/guest/concierge")} />
          {s.whatsapp_url ? <Button label={copy.chatWhatsapp} icon="chat" kind="glass" onPress={() => openExternal(s.whatsapp_url!)} /> : null}
          {s.planner_url ? <Button label={s.planner_name ? `${copy.chatPlanner} · ${s.planner_name}` : copy.chatPlanner} icon="contacts" kind="glass" onPress={() => openExternal(s.planner_url!)} /> : null}
        </Stack>
      </Card>
    </Section>
  );
}

function Custom({ s, onOpen }: { s: Extract<SiteSection, { type: "custom" }>; onOpen: (images: { url: string; caption: string | null }[], index: number) => void }) {
  return (
    <Section heading={s.heading} fallback="">
      {s.body ? (
        <T v="body16" color={colors.ivory70} style={{ lineHeight: 26 }}>
          {s.body}
        </T>
      ) : null}
      {s.image_url ? <Photo url={s.image_url} height={240} style={{ marginTop: 16 }} onPress={() => onOpen([{ url: s.image_url!, caption: s.heading }], 0)} /> : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Full-screen viewer                                                   */
/* ------------------------------------------------------------------ */

function GalleryViewer({ viewer, onClose, copy }: { viewer: Viewer; onClose: () => void; copy: typeof COPY.en }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [openedFor, setOpenedFor] = useState<Viewer>(null);
  if (viewer && viewer !== openedFor) {
    setOpenedFor(viewer);
    setIndex(viewer.index);
  }
  if (!viewer) return null;
  const current = viewer.images[index];
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.nightDeep }}>
        <FlatList
          data={viewer.images}
          horizontal
          pagingEnabled
          initialScrollIndex={viewer.index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(im, i) => `${im.url}-${i}`}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <ScrollView maximumZoomScale={3} minimumZoomScale={1} centerContent contentContainerStyle={{ width, height }} bouncesZoom>
              <Image source={{ uri: item.url }} style={{ width, height }} contentFit="contain" transition={200} />
            </ScrollView>
          )}
        />
        <View style={{ position: "absolute", top: Math.max(insets.top, 24), left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T v="meta13" color={colors.ivory70}>
            {fmt(copy.photoOf, { n: index + 1, total: viewer.images.length })}
          </T>
          <IconButton name="x" onPress={onClose} label={copy.close} />
        </View>
        {current?.caption ? (
          <View style={{ position: "absolute", left: 24, right: 24, bottom: Math.max(insets.bottom, 24) + 8 }}>
            <T v="body15" color={colors.ivory90} center>
              {current.caption}
            </T>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 24, marginTop: 34 },
  hero: { overflow: "hidden", minHeight: 460, justifyContent: "flex-end", paddingBottom: 28 },
  heroTop: { position: "absolute", left: 20 },
  heroText: { paddingHorizontal: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCell: { width: "48%", flexGrow: 1 },
  memberPhoto: { width: 84, height: 84, borderRadius: 42, overflow: "hidden", borderWidth: 1, borderColor: colors.goldBorder },
});
