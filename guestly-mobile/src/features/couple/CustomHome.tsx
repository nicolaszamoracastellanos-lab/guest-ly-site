// The customizable Home (Oct 31 2026): the wedding's saved layout drawn as
// cards, two columns (S cards two to a row, M and L full width, rows end
// flush), each card opening its screen. Edit mode moves (arrows), resizes
// (S, M, L), hides and adds cards, goes back to the suggested layout or
// reopens the quiz. The layout is the wedding's: both partners and the portal
// see the same one. Bodies that already existed on Home (Today, the funnel,
// the setup steps, the activity feed, the recent replies) come in from the
// Home screen as `bodies`; the cards new to Home draw from `cards` and show a
// quiet line with a link when the portal sent no data for them.

import React, { useMemo, useState, type ReactNode } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { T, Row, Stack, Card, Icon, Badge, Button, Chip, Gem, SectionLabel, toastError } from "@/ui";
import type { IconName } from "@/ui/Icon";
import { colors, radius } from "@/ui/tokens";
import type { CoupleHome } from "@/lib/hooks";
import { fullDate, dayMonth } from "@/features/couple/ui";
import { CARD_IDS, rowSpans, markPhaseHandled, type CardId, type CardSize, type HomeCard } from "./homeLayout";
import { moveCard, setCard, showCard } from "./homeEdit";
import { onlyServedKeys, readRoad, roadCardRoute, roadRows, type RoadCard, type RoadItem } from "./road";
import { CARD_ROUTES, rowsOf, useSaveHomeLayout, useResetHomeLayout, type HomeCardsData, type HomeLayoutPayload } from "./homeCards";
import { HOME_COPY, type HomeCopy } from "./homeCopy";
import { readReviewCard, REVIEW_COPY } from "./reviewCard";
import { ReviewCardBody } from "./ReviewCardBody";

export type CardBody = (o: { size: CardSize; half: boolean }) => ReactNode;

type Props = {
  data: CoupleHome;
  layout: HomeLayoutPayload;
  cards: HomeCardsData | null | undefined;
  /** Bodies drawn by the Home screen from its existing pieces. */
  bodies: Partial<Record<CardId, CardBody>>;
  canEdit: boolean;
  onOpenQuiz: () => void;
};

export function CustomHome({ data, layout, cards, bodies, canEdit, onOpenQuiz }: Props) {
  const c = useFeatureCopy(HOME_COPY);
  const { lang } = useLang();
  const router = useRouter();
  const save = useSaveHomeLayout();
  const reset = useResetHomeLayout();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ cards: HomeCard[]; dismissed: string[] } | null>(null);
  const editable = canEdit && layout.canEdit;
  const list = editing && draft ? draft.cards : layout.cards;
  // #6: the road card draws only with its data (MW_ROAD on, the read worked);
  // without it the card stays in the layout (and in edit mode) but not on Home.
  const road = useMemo(() => readRoad(cards?.road), [cards?.road]);
  // #20: the review card draws only with cards.review (MW_REVIEW_ASK on, after
  // the wedding, not sent, not "Not now"); "Not now" hides it here at once and
  // Undo brings it back.
  const review = useMemo(() => readReviewCard(cards?.review), [cards?.review]);
  const [reviewOff, setReviewOff] = useState(false);
  const visible = useMemo(
    () => list.filter((x) => !x.hidden && (editing || ((x.id !== "road" || !!road) && (x.id !== "review" || (!!review && !reviewOff))))),
    [list, editing, road, review, reviewOff],
  );
  const hidden = useMemo(() => list.filter((x) => x.hidden), [list]);
  const rows = rowsOf(visible, rowSpans(visible, 2));

  const startEdit = () => {
    setDraft({ cards: layout.cards.map((x) => ({ ...x })), dismissed: [...layout.dismissed] });
    setEditing(true);
  };
  const finish = async () => {
    if (!draft) return setEditing(false);
    try {
      // The cards as shown (today's phase included) become the saved order,
      // and this phase stops reordering them (the portal's markPhaseHandled).
      // Keys of cards this build was not served (flag off, an older portal)
      // stay out, so the web keeps lifting them (onlyServedKeys).
      await save.mutateAsync({ cards: draft.cards, dismissed: onlyServedKeys(markPhaseHandled(draft.dismissed, layout.answers, layout.phase), layout.served) });
      setEditing(false);
      setDraft(null);
    } catch {
      toastError(c.saveFailed);
    }
  };
  const backToSuggested = async () => {
    try {
      await reset.mutateAsync();
      setEditing(false);
      setDraft(null);
    } catch {
      toastError(c.saveFailed);
    }
  };
  const edit = (fn: (d: { cards: HomeCard[]; dismissed: string[] }) => { cards: HomeCard[]; dismissed: string[] }) => setDraft((d) => (d ? fn(d) : d));

  return (
    <View style={{ marginTop: 20 }}>
      {editable ? (
        editing ? (
          <Stack gap={8} style={{ marginBottom: 12 }}>
            <Row gap={8}>
              <Button label={c.backToSuggested} kind="ghost" small full={false} onPress={() => void backToSuggested()} loading={reset.isPending} testID="home-edit-reset" />
              <Button label={c.changeAnswers} kind="ghost" small full={false} onPress={onOpenQuiz} testID="home-edit-quiz" />
            </Row>
            <Button label={c.done} small onPress={() => void finish()} loading={save.isPending} testID="home-edit-done" />
          </Stack>
        ) : (
          <Row style={{ justifyContent: "flex-end", marginBottom: 8 }}>
            <Pressable onPress={startEdit} accessibilityRole="button" accessibilityLabel={c.edit} testID="home-edit" hitSlop={8} style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}>
              <Icon name="edit" size={16} color={colors.goldLight} />
              <T v="meta13" color={colors.goldLight}>
                {c.edit}
              </T>
            </Pressable>
          </Row>
        )
      ) : null}

      {rows.map((row) => (
        <Row key={row.map((r) => r.item.id).join("-")} gap={10} align="stretch" style={{ marginBottom: 10 }}>
          {row.map(({ item, span }) => {
            const vi = visible.findIndex((v) => v.id === item.id);
            return (
              <View key={item.id} style={{ flex: span, minWidth: 0 }}>
                <CardShell
                  card={item}
                  title={c.cards[item.id]}
                  editing={editing}
                  first={vi === 0}
                  last={vi === visible.length - 1}
                  copy={c}
                  onOpen={() => router.push((item.id === "road" ? roadCardRoute(road) : CARD_ROUTES[item.id]) as never)}
                  hint={item.id === "road" ? road?.nextStep?.linkLabel || undefined : undefined}
                  onMove={(dir) => edit((d) => ({ ...d, cards: moveCard(d.cards, item.id, dir) }))}
                  onSize={(size) => edit((d) => ({ ...d, cards: setCard(d.cards, item.id, { size }) }))}
                  onHide={() => edit((d) => ({ ...d, cards: setCard(d.cards, item.id, { hidden: true }) }))}
                  testID={`home-card-${item.id}`}
                  link={item.id !== "review"}
                >
                  {(bodies[item.id] ?? defaultBody(item.id))({ size: item.size, half: span === 1 })}
                </CardShell>
              </View>
            );
          })}
        </Row>
      ))}

      {editing ? (
        <Card kind="solid" padding={14} radiusKey="tile" style={styles.addBox}>
          <SectionLabel>{c.addCard}</SectionLabel>
          {hidden.length ? (
            <Row gap={8} style={{ flexWrap: "wrap", marginTop: 8 }}>
              {CARD_IDS.filter((id) => hidden.some((h) => h.id === id)).map((id) => (
                <Chip key={id} label={`+ ${c.cards[id]}`} onPress={() => edit((d) => ({ ...d, cards: showCard(d.cards, id) }))} testID={`home-add-${id}`} />
              ))}
            </Row>
          ) : (
            <T v="meta13" color={colors.ivory55} style={{ marginTop: 6 }}>
              {c.allShown}
            </T>
          )}
        </Card>
      ) : null}
    </View>
  );

  /** The cards Home did not have before: drawn from `cards`, a quiet line when there is no data. */
  function defaultBody(id: CardId): CardBody {
    const d = cards ?? {};
    return function cardBody({ size, half }) {
      switch (id) {
        case "countdown": {
          const cd = data.countdown;
          const date = fullDate(data.wedding_date, lang);
          if (!cd) return <Quiet text={c.noDate} />;
          const days = cd.passed ? Math.max(1, Math.abs(cd.days)) : cd.days;
          const label = cd.passed ? c.married(days) : days === 0 ? c.today : c.daysToGo(days);
          return (
            <View>
              <Big n={days === 0 && !cd.passed ? "0" : String(days)} />
              <T v="body15" color={colors.ivory90}>
                {label}
              </T>
              {date && !half ? (
                <T v="meta13" color={colors.ivory55} style={{ marginTop: 2 }}>
                  {date}
                </T>
              ) : null}
            </View>
          );
        }
        case "questions": {
          // Guest threads waiting on the couple (the older home field).
          const waiting = data.needs_you_breakdown?.conversations ?? 0;
          if (!waiting) return <Quiet text={c.noQuestions} />;
          return <NumLine n={waiting} label={c.waitingYou} half={half} />;
        }
        case "tasks":
          // The task list lives on its screen; the card is its door.
          return <Quiet text={c.seeTasks} />;
        case "budget": {
          if (typeof data.budget_percent_paid === "number")
            return (
              <View style={{ gap: 6 }}>
                <Big n={`${Math.round(data.budget_percent_paid)}%`} />
                <Sub text={c.paidWord} />
                <Bar frac={data.budget_percent_paid / 100} color={colors.gold} />
              </View>
            );
          return <Quiet text={c.noBudget} />;
        }
        case "vendors": {
          const v = d.vendors;
          if (!v || !v.total) return <Quiet text={c.noVendors} />;
          return (
            <View style={{ gap: 6 }}>
              {half ? <NumLine n={v.booked} label={c.bookedOf(v.total)} half /> : <Sub text={c.booked(v.booked, v.total)} />}
              {!half && v.toBook.length ? (
                <>
                  <SectionLabel>{c.toBook}</SectionLabel>
                  {v.toBook.slice(0, size === "l" ? 3 : 2).map((it) => (
                    <Line key={it.id} left={it.name} right={it.category} />
                  ))}
                </>
              ) : null}
            </View>
          );
        }
        case "seating": {
          const s = d.seating;
          if (!s || !s.confirmed) return <Quiet text={c.noSeating} />;
          return (
            <View style={{ gap: 6 }}>
              <NumLine n={s.seated} label={c.seated(s.seated, s.confirmed)} half={half} />
              <Bar frac={s.seated / s.confirmed} color={colors.ivory40} />
              {s.tables ? <Sub text={c.tables(s.tables)} /> : null}
            </View>
          );
        }
        case "website": {
          const w = d.website;
          if (!w) return <Quiet text={c.open} />;
          return (
            <View style={{ gap: 6, alignItems: "flex-start" }}>
              <Badge label={w.published ? c.published : c.notPublished} kind={w.published ? "green" : "amber"} />
              {!half && w.updatedAt ? <Sub text={c.updated(dayMonth(w.updatedAt, lang))} /> : null}
            </View>
          );
        }
        case "runsheet": {
          const r = d.runsheet;
          if (!r || !r.blocks.length) return <Quiet text={c.noRunsheet} />;
          return (
            <View style={{ gap: 6 }}>
              {r.blocks.slice(0, half ? 2 : size === "l" ? 8 : 4).map((it) => (
                <Row key={it.id} gap={10} align="flex-start">
                  <T v="meta13" color={colors.ivory55} style={{ minWidth: 64, fontVariant: ["tabular-nums"] }}>
                    {clock(it.startsAt, lang)}
                  </T>
                  <T v="body15" color={colors.ivory90} numberOfLines={2} style={{ flex: 1 }}>
                    {it.location && !half ? `${it.title}, ${it.location}` : it.title}
                  </T>
                </Row>
              ))}
              {r.total > r.blocks.length && !half ? <Sub text={c.more(r.total - r.blocks.length)} /> : null}
            </View>
          );
        }
        case "checkin": {
          const k = d.checkin;
          return (
            <View style={{ gap: 6 }}>
              {k && k.expected ? <NumLine n={k.arrived} label={c.arrived(k.expected)} half={half} /> : null}
              <T v="meta13" color={colors.goldLight}>
                {c.openScanner}
              </T>
            </View>
          );
        }
        case "album": {
          const a = d.album;
          if (!a || !a.enabled) return <Quiet text={c.albumOff} />;
          return (
            <View style={{ gap: 6, alignItems: "flex-start" }}>
              <NumLine n={a.approved} label={c.photos(a.guests)} half={half} />
              {a.pending ? <Badge label={c.pendingPhotos(a.pending)} kind="gold" /> : null}
            </View>
          );
        }
        case "thankyou": {
          const t = d.thankyou;
          if (!t || !t.total) return <Quiet text={c.noThanks} />;
          return (
            <View style={{ gap: 6 }}>
              <NumLine n={t.done} label={c.written(t.total)} half={half} />
              <Bar frac={t.done / t.total} color={colors.gold} />
            </View>
          );
        }
        case "partner": {
          const people = d.partner?.people ?? [];
          if (people.length < 2) return <Quiet text={c.noPartner} />;
          return (
            <View style={{ gap: 6 }}>
              {people.slice(0, 3).map((p) => (
                <Line key={p.userId} left={p.name} right={c.tasksOf(p.openTasks)} />
              ))}
            </View>
          );
        }
        case "road": {
          if (!road) return <Quiet text={c.open} />;
          return <RoadBody road={road} size={size} half={half} copy={c} />;
        }
        case "review": {
          // In edit mode the card's own tools take the taps: the line only.
          if (editing || !review) return <Sub text={REVIEW_COPY[lang].body} />;
          return <ReviewCardBody card={review} weddingDate={data.wedding_date} onHide={() => setReviewOff(true)} onShow={() => setReviewOff(false)} />;
        }
        case "planner": {
          const p = d.planner;
          const n = p?.open ?? data.needs_you_breakdown?.requests ?? 0;
          if (!p && !n) return <Quiet text={c.noPlanner} />;
          return (
            <View style={{ gap: 6 }}>
              <NumLine n={n} label={c.requestsToApprove(n)} half={half} />
              {p?.plannerName ? <Sub text={p.plannerName} /> : null}
            </View>
          );
        }
        default:
          return <Quiet text={c.open} />;
      }
    };
  }
}

function CardShell({
  card,
  title,
  editing,
  first,
  last,
  copy,
  onOpen,
  onMove,
  onSize,
  onHide,
  children,
  testID,
  hint,
  link = true,
}: {
  card: HomeCard;
  title: string;
  editing: boolean;
  first: boolean;
  last: boolean;
  copy: HomeCopy;
  onOpen: () => void;
  onMove: (dir: -1 | 1) => void;
  onSize: (s: CardSize) => void;
  onHide: () => void;
  children: ReactNode;
  testID?: string;
  /** Where the card goes when it is not the card's own screen (the road's Now step). */
  hint?: string;
  /** False for a card whose body holds its own actions (#20 review): no card-wide tap, no chevron. */
  link?: boolean;
}) {
  const body = (
    <Card kind="solid" padding={14} radiusKey="tile" style={[{ flex: 1 }, editing && styles.editingCard]}>
      {editing ? (
        <View style={styles.tools}>
          <Tool icon="up" a11y={copy.up} disabled={first} onPress={() => onMove(-1)} />
          <Tool icon="down" a11y={copy.down} disabled={last} onPress={() => onMove(1)} />
          {(["s", "m", "l"] as CardSize[]).map((s) => (
            <Tool key={s} label={s.toUpperCase()} a11y={copy.size(s.toUpperCase())} on={card.size === s} onPress={() => onSize(s)} />
          ))}
          <View style={{ flex: 1 }} />
          <Tool label={copy.hide} a11y={`${copy.hide} ${title}`} onPress={onHide} />
        </View>
      ) : null}
      <Row style={{ justifyContent: "space-between", marginBottom: 8 }} align="center">
        <T v="body16" numberOfLines={2} style={{ flex: 1, minWidth: 0 }}>
          {title}
        </T>
        {editing || !link ? null : <Icon name="chev" size={16} color={colors.ivory40} />}
      </Row>
      {children}
    </Card>
  );
  // While editing the card is not a link: its own tools take the taps.
  return editing || !link ? (
    <View style={{ flex: 1 }} testID={testID}>
      {body}
    </View>
  ) : (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={hint} testID={testID} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.85 }]}>
      {body}
    </Pressable>
  );
}

/**
 * #6: the milestone line inside its card. Done rows lead with a check, the Now
 * row with the gold diamond (the line's one mark), the rest with a ring. Every
 * state is an icon plus words, never colour alone. The whole card opens the Now
 * step's screen, so nothing inside is a second button.
 */
export function RoadBody({ road, size, half, copy }: { road: RoadCard; size: CardSize; half: boolean; copy: HomeCopy }) {
  const rows = roadRows(road, half ? "s" : size);
  const now = road.items.find((i) => i.id === road.nowId) ?? null;
  return (
    <View style={{ gap: 8 }}>
      <T v="meta13" color={colors.ivory55} style={{ fontVariant: ["tabular-nums"] }}>
        {road.doneText}
      </T>
      {!road.nowId && size !== "l" ? <Sub text={copy.roadAllDone} /> : null}
      {rows.map((it) => (
        <RoadRow key={it.id} item={it} isNow={it.id === road.nowId} isNext={!half && size === "m" && it.id === road.nextId} copy={copy} />
      ))}
      {now && road.nextStep && !half ? (
        <View style={{ gap: 2 }}>
          <T v="body15" color={colors.ivory90}>
            {road.nextStep.text}
          </T>
          {road.nextStep.linkLabel ? (
            // The card is the link; the diamond stays the line's one gold mark.
            <Row gap={4}>
              <T v="meta13" color={colors.ivory70}>
                {road.nextStep.linkLabel}
              </T>
              <Icon name="chev" size={14} color={colors.ivory55} />
            </Row>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function RoadRow({ item, isNow, isNext, copy }: { item: RoadItem; isNow: boolean; isNext: boolean; copy: HomeCopy }) {
  const done = item.state === "done";
  const lead = isNow ? copy.roadNow : isNext ? copy.roadNext : null;
  const a11y = [lead, item.label, done ? copy.roadDoneA11y : isNow ? null : copy.roadNotYetA11y, item.sub, item.overdue ? copy.roadOverdue : null].filter(Boolean).join(", ");
  return (
    <View style={styles.roadRow} accessible accessibilityLabel={a11y}>
      <View style={styles.roadMark}>
        {done ? <Icon name="check" size={16} color={colors.ivory55} /> : isNow ? <Gem size={9} /> : <View style={styles.roadRing} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {lead ? (
          <T v="meta13" color={isNow ? colors.goldLight : colors.ivory55}>
            {lead}
          </T>
        ) : null}
        <T v="body15" color={done ? colors.ivory70 : isNow ? colors.ivory : colors.ivory70}>
          {item.label}
        </T>
        {item.sub ? (
          <T v="meta13" color={colors.ivory55} style={{ fontVariant: ["tabular-nums"] }}>
            {item.sub}
          </T>
        ) : null}
        {item.overdue ? (
          <Row gap={4} style={{ marginTop: 2 }}>
            <Icon name="warning" size={14} color={colors.amber} />
            <T v="meta13" color={colors.amber}>
              {copy.roadOverdue}
            </T>
          </Row>
        ) : null}
      </View>
    </View>
  );
}

function Tool({ label, icon, a11y, onPress, disabled, on }: { label?: string; icon?: IconName; a11y: string; onPress: () => void; disabled?: boolean; on?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ disabled: !!disabled, selected: !!on }} hitSlop={4} style={({ pressed }) => [styles.tool, on && styles.toolOn, disabled && { opacity: 0.35 }, pressed && { opacity: 0.6 }]}>
      {icon ? (
        <Icon name={icon} size={18} color={on ? colors.night : colors.ivory} />
      ) : (
        <T v="meta13" color={on ? colors.night : colors.ivory}>
          {label}
        </T>
      )}
    </Pressable>
  );
}

/** A run-of-show time: "16:00" or an ISO time, in the reader's clock. */
function clock(v: string | null, lang: "en" | "es"): string {
  if (!v) return "";
  const hm = /^(\d{1,2}):(\d{2})/.exec(v);
  const d = hm ? new Date(2000, 0, 1, Number(hm[1]), Number(hm[2])) : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(lang === "es" ? "es-BO" : "en-US", { hour: "numeric", minute: "2-digit" });
}

function Big({ n }: { n: string }) {
  return (
    <T v="title34" style={{ fontVariant: ["lining-nums", "tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit>
      {n}
    </T>
  );
}

function NumLine({ n, label, half }: { n: number; label: string; half: boolean }) {
  return half ? (
    <View>
      <Big n={String(n)} />
      <Sub text={label} />
    </View>
  ) : (
    <Row gap={10} align="baseline">
      <Big n={String(n)} />
      <T v="meta13" color={colors.ivory55} style={{ flex: 1 }} numberOfLines={2}>
        {label}
      </T>
    </Row>
  );
}

function Sub({ text }: { text: string }) {
  return (
    <T v="meta13" color={colors.ivory55} numberOfLines={2}>
      {text}
    </T>
  );
}

function Quiet({ text }: { text: string }) {
  return (
    <T v="meta13" color={colors.ivory55}>
      {text}
    </T>
  );
}

function Line({ left, right }: { left: string; right: string }) {
  return (
    <Row gap={10} style={{ justifyContent: "space-between" }} align="flex-start">
      <T v="body15" color={colors.ivory90} numberOfLines={2} style={{ flex: 1, minWidth: 0 }}>
        {left}
      </T>
      {right ? (
        <T v="meta13" color={colors.ivory55} numberOfLines={1} style={{ flexShrink: 0, maxWidth: "45%", fontVariant: ["tabular-nums"] }}>
          {right}
        </T>
      ) : null}
    </Row>
  );
}

function Bar({ frac, color }: { frac: number; color: string }) {
  const f = Number.isFinite(frac) ? Math.max(0, Math.min(1, frac)) : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${f * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.goldBorder },
  editingCard: { borderStyle: "dashed", borderWidth: 1, borderColor: colors.ivory25 },
  tools: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  tool: { minWidth: 32, minHeight: 32, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.ivory25, alignItems: "center", justifyContent: "center" },
  toolOn: { backgroundColor: colors.ivory, borderColor: colors.ivory },
  addBox: { borderStyle: "dashed", borderWidth: 1, borderColor: colors.ivory25, marginTop: 4 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.ivory09, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
  roadRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  roadMark: { width: 18, minHeight: 20, alignItems: "center", justifyContent: "center", paddingTop: 2 },
  roadRing: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: colors.ivory40 },
});
