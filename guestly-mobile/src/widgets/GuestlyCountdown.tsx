// Countdown to the wedding. Couple (C1), planner (next wedding, P4) and guest
// (G1, with their RSVP line). Home screen small and medium, Lock Screen circular,
// rectangular and inline, and StandBy (a pair of small ones, see 03-WIDGETS).
//
// A widget function runs in the widget runtime: only @expo/ui components, no
// hooks, no imports, no top-level constants. The palette lives inside it.

import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { containerBackground, font, foregroundStyle, lineLimit, minimumScaleFactor, padding, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type CountdownProps = {
  /** "Camila & Andrés" */
  names: string;
  /** The number of days, already a string ("43"); "·" before data arrives. */
  days: string;
  /** "days" / "días" (singular handled by the app). */
  unit: string;
  /** "Sat 5 Dec" */
  dateText: string;
  /** An optional third line: the guest's RSVP, "Reply by 1 Aug", the wedding place. */
  line: string;
  /** Deep link opened by a tap. */
  url: string;
};

const Countdown = (props: CountdownProps, env: WidgetEnvironment) => {
  "widget";
  const gold = "#e2c892";
  const ivory = "#f7f3ec";
  const dim = "#f7f3ecb8";
  const night = "#080b10";
  const bg = { type: "linearGradient" as const, colors: ["#16213a", night], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } };
  const family = env.widgetFamily;
  const quiet = !!env.isLuminanceReduced;

  if (family === "accessoryInline") {
    return (
      <Text modifiers={[widgetURL(props.url)]}>
        {props.names} · {props.days} {props.unit}
      </Text>
    );
  }
  if (family === "accessoryCircular") {
    return (
      <VStack spacing={0} modifiers={[widgetURL(props.url)]}>
        <Text modifiers={[font({ size: 22, weight: "bold" }), minimumScaleFactor(0.6), lineLimit(1)]}>{props.days}</Text>
        <Text modifiers={[font({ size: 9, weight: "medium" })]}>{props.unit}</Text>
      </VStack>
    );
  }
  if (family === "accessoryRectangular") {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL(props.url)]}>
        <Text modifiers={[font({ size: 13, weight: "semibold" }), lineLimit(1)]}>{props.names}</Text>
        <Text modifiers={[font({ size: 20, weight: "bold" })]}>
          {props.days} {props.unit}
        </Text>
        <Text modifiers={[font({ size: 11 }), lineLimit(1)]}>{props.line || props.dateText}</Text>
      </VStack>
    );
  }

  const small = family === "systemSmall";
  const numberColor = quiet ? "#8a6d3e" : gold;
  const content = (
    <VStack alignment="leading" spacing={small ? 2 : 4} modifiers={[padding({ all: 2 }), containerBackground(quiet ? "#000000" : bg, "widget"), widgetURL(props.url)]}>
      <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(quiet ? "#8a6d3e" : gold), lineLimit(1)]}>{props.names}</Text>
      <Spacer />
      <HStack alignment="lastTextBaseline" spacing={6}>
        <Text modifiers={[font({ size: small ? 56 : 72, weight: "semibold", design: "serif" }), foregroundStyle(numberColor), minimumScaleFactor(0.5), lineLimit(1)]}>{props.days}</Text>
        <Text modifiers={[font({ size: small ? 15 : 18, weight: "regular", design: "serif" }), foregroundStyle(dim)]}>{props.unit}</Text>
      </HStack>
      <Text modifiers={[font({ size: small ? 12 : 14 }), foregroundStyle(ivory), lineLimit(1)]}>{props.dateText}</Text>
      {!small && props.line ? <Text modifiers={[font({ size: 13 }), foregroundStyle(dim), lineLimit(1)]}>{props.line}</Text> : null}
    </VStack>
  );
  return content;
};

export default createWidget<CountdownProps>("GuestlyCountdown", Countdown, { names: "Guest-ly", days: "·", unit: "", dateText: "", line: "", url: "guestly://" });
