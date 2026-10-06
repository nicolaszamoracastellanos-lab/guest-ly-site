// Which steps each tour has, in order. Build 12: at most three cards, each
// naming a real tab (build 13: the couple's Plan and the planner's Wedding
// cards name the Tools tab); the last card closes the tour (its button is the CTA).
// The pending couple tour previews the couple tour. The planner tour is built
// from the planner's real permissions on the open wedding.

import React, { type ComponentType } from "react";
import { fmt } from "@/i18n";
import type { TourCopy, TourStepCopy } from "./copy";
import type { TourVariant } from "./state";
import type { SceneProps } from "./scenes/kit";
import { GemScene } from "./scenes/Gem";
import { CalendarScene, ConciergeScene, RsvpScene } from "./scenes/guest";
import { BriefingScene, CoordinatorScene, RsvpsScene } from "./scenes/couple";
import { ProposeScene, ToolsScene, WeddingsScene, type TourTool } from "./scenes/planner";

export type TourStep = {
  key: string;
  copy: TourStepCopy;
  Scene: ComponentType<SceneProps>;
  /** The celebration step: its button closes the tour. */
  final?: boolean;
};

export type TourNames = {
  name?: string | null;
  couple?: string | null;
  /** Planner only: which Tools tiles are shared, and whether the task and
   *  Coordinator tools are on. Missing: everything counts as on. */
  planner?: { tools: Record<TourTool, boolean>; tasks: boolean; coordinator: boolean } | null;
};

function GemAssemble(props: SceneProps) {
  return <GemScene {...props} burst={false} />;
}

export function buildSteps(variant: TourVariant, t: TourCopy, names: TourNames, toolLabels?: Record<TourTool, string>): TourStep[] {
  const g = t.steps.guest;
  const c = t.steps.couple;
  const p = t.steps.planner;
  const pend = t.steps.pending;
  switch (variant) {
    case "guest":
      return [
        { key: "rsvp", copy: g.rsvp, Scene: RsvpScene },
        { key: "calendar", copy: g.calendar, Scene: CalendarScene },
        { key: "concierge", copy: g.concierge, Scene: ConciergeScene, final: true },
      ];
    case "couple":
      return [
        { key: "home", copy: c.home, Scene: BriefingScene },
        { key: "guests", copy: c.guests, Scene: RsvpsScene },
        { key: "tools", copy: c.tools, Scene: CoordinatorScene, final: true },
      ];
    case "couple-pending":
      return [
        { key: "intro", copy: pend.intro, Scene: GemAssemble },
        { key: "guests", copy: c.guests, Scene: RsvpsScene },
        { key: "tools", copy: { ...c.tools, tip: undefined }, Scene: CoordinatorScene, final: true },
      ];
    case "planner": {
      const perms = names.planner ?? null;
      const tasks = perms ? perms.tasks : true;
      const coordinator = perms ? perms.coordinator : true;
      const order: TourTool[] = ["budget", "tasks", "seating", "runsheet"];
      const labels = perms && toolLabels ? order.filter((k) => perms.tools[k]).map((k) => toolLabels[k]) : [];
      const tools: TourStepCopy = {
        ...p.tools,
        body: labels.length ? fmt(p.tools.body, { tools: labels.join(", ") }) : p.tools.bodyNoName ?? p.tools.body,
        // The Coordinator line only when that tool is on.
        tip: coordinator ? `${p.coordinator} ${p.tools.tip ?? ""}`.trim() : p.tools.tip,
      };
      const steps: TourStep[] = [{ key: "weddings", copy: p.weddings, Scene: WeddingsScene }];
      if (tasks) steps.push({ key: "propose", copy: p.propose, Scene: ProposeScene });
      steps.push({ key: "tools", copy: tools, Scene: ToolsScene, final: true });
      return steps;
    }
  }
}

export function ctaFor(variant: TourVariant, t: TourCopy): string {
  return variant === "guest" ? t.cta.guest : variant === "planner" ? t.cta.planner : variant === "couple-pending" ? t.cta.pending : t.cta.couple;
}
