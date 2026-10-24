// RSVP progress for the open wedding. Couple (C2) and planner. Small, medium,
// and Lock Screen rectangular.

import { HStack, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { containerBackground, font, foregroundStyle, lineLimit, minimumScaleFactor, padding, tint, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type RepliesProps = {
  names: string;
  replied: number;
  total: number;
  going: number;
  declined: number;
  pending: number;
  /** "replied" / "respondieron" */
  repliedLabel: string;
  goingLabel: string;
  declinedLabel: string;
  pendingLabel: string;
  /** "Closes in 3 days" / "" */
  deadline: string;
  url: string;
};

const Replies = (props: RepliesProps, env: WidgetEnvironment) => {
  "widget";
  const gold = "#e2c892";
  const ivory = "#f7f3ec";
  const dim = "#f7f3ecb8";
  const bg = { type: "linearGradient" as const, colors: ["#16213a", "#080b10"], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } };
  const family = env.widgetFamily;
  const ratio = props.total > 0 ? Math.min(1, props.replied / props.total) : 0;

  if (family === "accessoryRectangular") {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[widgetURL(props.url)]}>
        <Text modifiers={[font({ size: 13, weight: "semibold" }), lineLimit(1)]}>{props.names}</Text>
        <Text modifiers={[font({ size: 17, weight: "bold" })]}>
          {props.replied} / {props.total} {props.repliedLabel}
        </Text>
        <ProgressView value={ratio} />
      </VStack>
    );
  }

  const small = family === "systemSmall";
  const stat = (n: number, label: string, color: string) => (
    <HStack spacing={6}>
      <Text modifiers={[font({ size: 17, weight: "semibold", design: "serif" }), foregroundStyle(color)]}>{n}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(dim), lineLimit(1)]}>{label}</Text>
    </HStack>
  );
  return (
    <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 2 }), containerBackground(bg, "widget"), widgetURL(props.url)]}>
      <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(gold), lineLimit(1)]}>{props.names}</Text>
      <Spacer />
      {small ? (
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 44, weight: "semibold", design: "serif" }), foregroundStyle(ivory), minimumScaleFactor(0.5), lineLimit(1)]}>{props.replied}</Text>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(dim), lineLimit(2)]}>
            / {props.total} {props.repliedLabel}
          </Text>
        </VStack>
      ) : (
        <HStack alignment="center" spacing={16}>
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ size: 54, weight: "semibold", design: "serif" }), foregroundStyle(ivory), minimumScaleFactor(0.5), lineLimit(1)]}>{props.replied}</Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(dim)]}>
              / {props.total} {props.repliedLabel}
            </Text>
          </VStack>
          <VStack alignment="leading" spacing={3}>
            {stat(props.going, props.goingLabel, "#34d399")}
            {stat(props.declined, props.declinedLabel, "#f0a2a2")}
            {stat(props.pending, props.pendingLabel, "#f3c66b")}
          </VStack>
        </HStack>
      )}
      <ProgressView value={ratio} modifiers={[tint("#34d399")]} />
      {!small && props.deadline ? <Text modifiers={[font({ size: 12 }), foregroundStyle(gold), lineLimit(1)]}>{props.deadline}</Text> : null}
    </VStack>
  );
};

export default createWidget<RepliesProps>("GuestlyReplies", Replies, { names: "Guest-ly", replied: 0, total: 0, going: 0, declined: 0, pending: 0, repliedLabel: "", goingLabel: "", declinedLabel: "", pendingLabel: "", deadline: "", url: "guestly://" });
