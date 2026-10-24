// Live Activity: the wedding day, "Now / Next". On the iPhone Duo the Dynamic
// Island is vertical on both displays: compact = icon over time; expanded =
// leading (now), trailing (time), bottom (next). Lock Screen banner too.
// Apple requires every presentation to be implemented.

import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { activityBackgroundTint, font, foregroundStyle, lineLimit, minimumScaleFactor, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

export type DayOfActivityProps = {
  nowLabel: string;
  nextLabel: string;
  now: string;
  nowTime: string;
  place: string;
  next: string;
  nextTime: string;
};

const DayOfActivity = (props: DayOfActivityProps, env: LiveActivityEnvironment) => {
  "widget";
  const gold = "#e2c892";
  const ivory = "#f7f3ec";
  const dim = "#f7f3ecb8";
  return {
    banner: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 14 }), activityBackgroundTint("#0d1117")]}>
        <HStack spacing={8}>
          <Image systemName="diamond.fill" size={12} color={gold} />
          <Text modifiers={[font({ size: 11, weight: "medium" }), foregroundStyle(gold)]}>{props.nowLabel}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 17, weight: "semibold", design: "serif" }), foregroundStyle(gold)]}>{props.nowTime}</Text>
        </HStack>
        <Text modifiers={[font({ size: 22, weight: "semibold", design: "serif" }), foregroundStyle(ivory), lineLimit(1), minimumScaleFactor(0.7)]}>{props.now}</Text>
        {props.place ? <Text modifiers={[font({ size: 12 }), foregroundStyle(dim), lineLimit(1)]}>{props.place}</Text> : null}
        <HStack spacing={6}>
          <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(dim)]}>{props.nextLabel}</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle(ivory), lineLimit(1)]}>
            {props.nextTime} {props.next}
          </Text>
        </HStack>
      </VStack>
    ),
    compactLeading: <Image systemName="diamond.fill" size={12} color={gold} />,
    compactTrailing: <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(gold)]}>{props.nowTime}</Text>,
    minimal: <Image systemName="diamond.fill" size={12} color={gold} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 11, weight: "medium" }), foregroundStyle(gold)]}>{props.nowLabel}</Text>
        <Text modifiers={[font({ size: 16, weight: "semibold", design: "serif" }), foregroundStyle(ivory), lineLimit(1)]}>{props.now}</Text>
      </VStack>
    ),
    expandedTrailing: <Text modifiers={[font({ size: 20, weight: "semibold", design: "serif" }), foregroundStyle(gold)]}>{props.nowTime}</Text>,
    expandedBottom: (
      <HStack spacing={6}>
        <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(dim)]}>{props.nextLabel}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(ivory), lineLimit(1)]}>
          {props.nextTime} {props.next}
        </Text>
      </HStack>
    ),
  };
};

export default createLiveActivity<DayOfActivityProps>("GuestlyDayOfActivity", DayOfActivity);
