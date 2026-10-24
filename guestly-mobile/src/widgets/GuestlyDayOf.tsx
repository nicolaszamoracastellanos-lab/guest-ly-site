// Wedding-day "Now / Next" (Día B): planner, couple and guest. Medium and Lock
// Screen rectangular. The same data feeds the Live Activity.

import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { containerBackground, font, foregroundStyle, lineLimit, minimumScaleFactor, padding, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type DayOfProps = {
  nowLabel: string;
  nextLabel: string;
  now: string;
  nowTime: string;
  nowPlace: string;
  next: string;
  nextTime: string;
  /** Shown instead of Now when it is not the wedding day. */
  idle: string;
  url: string;
};

const DayOf = (props: DayOfProps, env: WidgetEnvironment) => {
  "widget";
  const gold = "#e2c892";
  const ivory = "#f7f3ec";
  const dim = "#f7f3ecb8";
  const bg = { type: "linearGradient" as const, colors: ["#16213a", "#080b10"], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } };
  const idle = !props.now && !props.next;

  if (env.widgetFamily === "accessoryRectangular") {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL(props.url)]}>
        {idle ? (
          <Text modifiers={[font({ size: 12 }), lineLimit(2)]}>{props.idle}</Text>
        ) : (
          <>
            <Text modifiers={[font({ size: 14, weight: "bold" }), lineLimit(1)]}>
              {props.nowTime} {props.now}
            </Text>
            <Text modifiers={[font({ size: 11 }), lineLimit(1)]}>
              {props.nextLabel}: {props.nextTime} {props.next}
            </Text>
          </>
        )}
      </VStack>
    );
  }
  return (
    <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 2 }), containerBackground(bg, "widget"), widgetURL(props.url)]}>
      {idle ? (
        <Text modifiers={[font({ size: 16, design: "serif" }), foregroundStyle(ivory)]}>{props.idle}</Text>
      ) : (
        <>
          <Text modifiers={[font({ size: 11, weight: "medium" }), foregroundStyle(gold)]}>{props.nowLabel}</Text>
          <HStack alignment="lastTextBaseline" spacing={8}>
            <Text modifiers={[font({ size: 30, weight: "semibold", design: "serif" }), foregroundStyle(ivory), lineLimit(1), minimumScaleFactor(0.6)]}>{props.now}</Text>
            <Spacer />
            <Text modifiers={[font({ size: 18, design: "serif" }), foregroundStyle(gold)]}>{props.nowTime}</Text>
          </HStack>
          {props.nowPlace ? <Text modifiers={[font({ size: 12 }), foregroundStyle(dim), lineLimit(1)]}>{props.nowPlace}</Text> : null}
          <Spacer />
          <HStack spacing={8}>
            <Text modifiers={[font({ size: 11, weight: "medium" }), foregroundStyle(dim)]}>{props.nextLabel}</Text>
            <Text modifiers={[font({ size: 14 }), foregroundStyle(ivory), lineLimit(1)]}>{props.next}</Text>
            <Spacer />
            <Text modifiers={[font({ size: 14 }), foregroundStyle(gold)]}>{props.nextTime}</Text>
          </HStack>
        </>
      )}
    </VStack>
  );
};

export default createWidget<DayOfProps>("GuestlyDayOf", DayOf, { nowLabel: "", nextLabel: "", now: "", nowTime: "", nowPlace: "", next: "", nextTime: "", idle: "Guest-ly", url: "guestly://" });
