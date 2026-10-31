// "Today" list: planner (P1, across weddings) and couple (reminders). A headline
// number plus up to five lines, each with a small right-aligned note. Medium,
// large, and Lock Screen rectangular.

import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { containerBackground, font, foregroundStyle, lineLimit, minimumScaleFactor, padding, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type TodayLine = { text: string; note: string; urgent: boolean };
export type TodayProps = {
  /** "Today" / "Hoy" */
  title: string;
  /** "3 need you" */
  headline: string;
  /** Shown when there are no lines. */
  empty: string;
  lines: TodayLine[];
  url: string;
};

const Today = (props: TodayProps, env: WidgetEnvironment) => {
  "widget";
  const gold = "#e2c892";
  const ivory = "#f7f3ec";
  const dim = "#f7f3ecb8";
  const bg = { type: "linearGradient" as const, colors: ["#16213a", "#080b10"], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } };
  const family = env.widgetFamily;
  const max = family === "systemLarge" ? 6 : family === "accessoryRectangular" ? 2 : 3;
  const shown = props.lines.slice(0, max);

  if (family === "accessoryRectangular") {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL(props.url)]}>
        <Text modifiers={[font({ size: 14, weight: "bold" }), lineLimit(1)]}>{props.headline}</Text>
        {shown.length ? shown.map((l, i) => <Text key={i} modifiers={[font({ size: 11 }), lineLimit(1)]}>{l.text}</Text>) : <Text modifiers={[font({ size: 11 }), lineLimit(1)]}>{props.empty}</Text>}
      </VStack>
    );
  }
  return (
    <VStack alignment="leading" spacing={5} modifiers={[padding({ all: 2 }), containerBackground(bg, "widget"), widgetURL(props.url)]}>
      <HStack alignment="lastTextBaseline" spacing={8}>
        <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(gold)]}>{props.title}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 15, weight: "semibold", design: "serif" }), foregroundStyle(ivory), lineLimit(1), minimumScaleFactor(0.7)]}>{props.headline}</Text>
      </HStack>
      {shown.length ? (
        shown.map((l, i) => (
          <HStack key={i} spacing={8}>
            <Text modifiers={[font({ size: 14, weight: l.urgent ? "semibold" : "regular" }), foregroundStyle(l.urgent ? "#f0a2a2" : ivory), lineLimit(1)]}>{l.text}</Text>
            <Spacer />
            <Text modifiers={[font({ size: 12 }), foregroundStyle(dim), lineLimit(1)]}>{l.note}</Text>
          </HStack>
        ))
      ) : (
        <Text modifiers={[font({ size: 14 }), foregroundStyle(dim)]}>{props.empty}</Text>
      )}
      <Spacer />
    </VStack>
  );
};

export default createWidget<TodayProps>("GuestlyToday", Today, { title: "Guest-ly", headline: "", empty: "", lines: [], url: "guestly://" });
