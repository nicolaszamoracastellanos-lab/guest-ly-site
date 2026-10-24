// The planner's portfolio (P3): one row per wedding with its days, a progress
// bar for RSVPs and a health dot. Large (and medium with the nearest two).

import { HStack, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { containerBackground, font, foregroundStyle, lineLimit, minimumScaleFactor, padding, tint, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type WeddingRow = {
  names: string;
  /** "43 days" */
  days: string;
  /** 0..1 of seats answered; -1 when guests are not shared. */
  ratio: number;
  /** "153 / 266 · 2 open" */
  line: string;
  health: "ok" | "watch" | "urgent";
  url: string;
};
export type WeddingsProps = { title: string; rows: WeddingRow[]; empty: string; url: string };

const Weddings = (props: WeddingsProps, env: WidgetEnvironment) => {
  "widget";
  const gold = "#e2c892";
  const ivory = "#f7f3ec";
  const dim = "#f7f3ecb8";
  const bg = { type: "linearGradient" as const, colors: ["#16213a", "#080b10"], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } };
  const dot = { ok: "#34d399", watch: "#f3c66b", urgent: "#f0a2a2" } as const;
  const max = env.widgetFamily === "systemLarge" ? 4 : 2;
  const rows = props.rows.slice(0, max);
  return (
    <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 2 }), containerBackground(bg, "widget"), widgetURL(props.url)]}>
      <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(gold)]}>{props.title}</Text>
      {rows.length ? (
        rows.map((r, i) => (
          <VStack key={i} alignment="leading" spacing={3}>
            <HStack spacing={6}>
              <Text modifiers={[font({ size: 8 }), foregroundStyle(dot[r.health])]}>●</Text>
              <Text modifiers={[font({ size: 16, weight: "semibold", design: "serif" }), foregroundStyle(ivory), lineLimit(1), minimumScaleFactor(0.7)]}>{r.names}</Text>
              <Spacer />
              <Text modifiers={[font({ size: 13 }), foregroundStyle(gold), lineLimit(1)]}>{r.days}</Text>
            </HStack>
            {r.ratio >= 0 ? <ProgressView value={r.ratio} modifiers={[tint("#34d399")]} /> : null}
            <Text modifiers={[font({ size: 11 }), foregroundStyle(dim), lineLimit(1)]}>{r.line}</Text>
          </VStack>
        ))
      ) : (
        <Text modifiers={[font({ size: 14 }), foregroundStyle(dim)]}>{props.empty}</Text>
      )}
      <Spacer />
    </VStack>
  );
};

export default createWidget<WeddingsProps>("GuestlyWeddings", Weddings, { title: "Guest-ly", rows: [], empty: "", url: "guestly://" });
