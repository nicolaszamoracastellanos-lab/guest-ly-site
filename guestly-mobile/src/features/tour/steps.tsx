// Which steps each tour has, in order. Four to six each; the last one is the
// celebration. The pending couple tour previews the couple tour.

import React, { type ComponentType } from "react";
import { fmt } from "@/i18n";
import type { TourCopy, TourStepCopy } from "./copy";
import type { TourVariant } from "./state";
import type { SceneProps } from "./scenes/kit";
import { GemScene } from "./scenes/Gem";
import { CalendarScene, ConciergeScene, DayOfScene, RsvpScene } from "./scenes/guest";
import { BriefingScene, CheckinScene, CoordinatorScene, MessagesScene, RsvpsScene } from "./scenes/couple";
import { ProposeScene, RequestsScene, TasksScene, WeddingsScene } from "./scenes/planner";

export type TourStep = {
  key: string;
  copy: TourStepCopy;
  Scene: ComponentType<SceneProps>;
  /** The celebration step: its button closes the tour. */
  final?: boolean;
};

export type TourNames = { name?: string | null; couple?: string | null };

function GemAssemble(props: SceneProps) {
  return <GemScene {...props} burst={false} />;
}

/** Fills {name} and {couple}, falling back to the copy written without them. */
function withNames(c: TourStepCopy, names: TourNames): TourStepCopy {
  const name = names.name?.trim() || null;
  const couple = names.couple?.trim() || null;
  return {
    ...c,
    title: c.title.includes("{name}") ? (name ? fmt(c.title, { name }) : c.titleNoName ?? c.title.replace(/,?\s*\{name\}/, "")) : c.title,
    body: c.body.includes("{couple}") ? (couple ? fmt(c.body, { couple }) : c.bodyNoName ?? c.body) : c.body,
  };
}

export function buildSteps(variant: TourVariant, t: TourCopy, names: TourNames): TourStep[] {
  const g = t.steps.guest;
  const c = t.steps.couple;
  const p = t.steps.planner;
  const pend = t.steps.pending;
  switch (variant) {
    case "guest":
      return [
        { key: "rsvp", copy: g.rsvp, Scene: RsvpScene },
        { key: "calendar", copy: g.calendar, Scene: CalendarScene },
        { key: "concierge", copy: g.concierge, Scene: ConciergeScene },
        { key: "dayof", copy: g.dayof, Scene: DayOfScene },
        { key: "ready", copy: withNames(g.ready, names), Scene: GemScene, final: true },
      ];
    case "couple":
      return [
        { key: "briefing", copy: c.briefing, Scene: BriefingScene },
        { key: "rsvps", copy: c.rsvps, Scene: RsvpsScene },
        { key: "messages", copy: c.messages, Scene: MessagesScene },
        { key: "coordinator", copy: c.coordinator, Scene: CoordinatorScene },
        { key: "checkin", copy: c.checkin, Scene: CheckinScene },
        { key: "ready", copy: c.ready, Scene: GemScene, final: true },
      ];
    case "couple-pending":
      return [
        { key: "intro", copy: pend.intro, Scene: GemAssemble },
        { key: "rsvps", copy: c.rsvps, Scene: RsvpsScene },
        { key: "messages", copy: c.messages, Scene: MessagesScene },
        { key: "coordinator", copy: c.coordinator, Scene: CoordinatorScene },
        { key: "checkin", copy: c.checkin, Scene: CheckinScene },
        { key: "ready", copy: pend.ready, Scene: GemScene, final: true },
      ];
    case "planner":
      return [
        { key: "weddings", copy: p.weddings, Scene: WeddingsScene },
        { key: "propose", copy: p.propose, Scene: ProposeScene },
        { key: "requests", copy: p.requests, Scene: RequestsScene },
        { key: "tasks", copy: p.tasks, Scene: TasksScene },
        { key: "ready", copy: p.ready, Scene: GemScene, final: true },
      ];
  }
}

export function ctaFor(variant: TourVariant, t: TourCopy): string {
  return variant === "guest" ? t.cta.guest : variant === "planner" ? t.cta.planner : variant === "couple-pending" ? t.cta.pending : t.cta.couple;
}
