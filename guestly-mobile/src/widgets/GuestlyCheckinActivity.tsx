// Live Activity: door check-in. "142 / 180", with the last name checked in.

import { HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { activityBackgroundTint, font, foregroundStyle, lineLimit, padding, tint } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

export type CheckinActivityProps = {
  title: string;
  arrived: number;
  total: number;
  /** "Whitney Adler · table 5", or "". */
  last: string;
};

const CheckinActivity = (props: CheckinActivityProps, env: LiveActivityEnvironment) => {
  "widget";
  const gold = "#e2c892";
  const ivory = "#f7f3ec";
  const dim = "#f7f3ecb8";
  const ratio = props.total > 0 ? Math.min(1, props.arrived / props.total) : 0;
  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 14 }), activityBackgroundTint("#0d1117")]}>
        <HStack spacing={8}>
          <Image systemName="qrcode" size={13} color={gold} />
          <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(gold)]}>{props.title}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 24, weight: "semibold", design: "serif" }), foregroundStyle(ivory)]}>
            {props.arrived} / {props.total}
          </Text>
        </HStack>
        <ProgressView value={ratio} modifiers={[tint("#34d399")]} />
        {props.last ? <Text modifiers={[font({ size: 12 }), foregroundStyle(dim), lineLimit(1)]}>{props.last}</Text> : null}
      </VStack>
    ),
    compactLeading: <Image systemName="qrcode" size={12} color={gold} />,
    compactTrailing: <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(gold)]}>{props.arrived}</Text>,
    minimal: <Image systemName="qrcode" size={12} color={gold} />,
    expandedLeading: <Text modifiers={[font({ size: 11, weight: "medium" }), foregroundStyle(gold)]}>{props.title}</Text>,
    expandedTrailing: (
      <Text modifiers={[font({ size: 20, weight: "semibold", design: "serif" }), foregroundStyle(ivory)]}>
        {props.arrived} / {props.total}
      </Text>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={4}>
        <ProgressView value={ratio} modifiers={[tint("#34d399")]} />
        {props.last ? <Text modifiers={[font({ size: 12 }), foregroundStyle(dim), lineLimit(1)]}>{props.last}</Text> : null}
      </VStack>
    ),
  };
};

export default createLiveActivity<CheckinActivityProps>("GuestlyCheckinActivity", CheckinActivity);
