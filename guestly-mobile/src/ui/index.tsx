// Guest-ly component kit. Direction A: night background, ivory type, gold
// accents, glass surfaces, one paper (ivory) card per screen at most.

import React, { type ReactNode } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Image,
  ScrollView,
  type ViewStyle,
  type ImageStyle,
  type StyleProp,
  type TextInputProps,
  Modal,
  Platform,
  type TextStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { T } from "./Text";
import { Icon, type IconName } from "./Icon";
import { colors, radius, space, HIT_TARGET, BUTTON_HEIGHT, TOP_SAFE_MIN, TAB_BAR_HEIGHT, TAB_BAR_BOTTOM, FILL } from "./tokens";

export { T } from "./Text";
export { Icon } from "./Icon";
export type { IconName } from "./Icon";
export { colors, radius, space } from "./tokens";

// ---------------------------------------------------------------- layout

/** Night gradient background with the gold bloom, safe areas handled. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  bottomInset = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + 16,
  header,
  style,
  contentStyle,
  keyboard,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  bottomInset?: number;
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, TOP_SAFE_MIN);
  const inner = (
    <View style={[padded && styles.padded, !scroll && styles.fill, { paddingTop: header ? 0 : top, paddingBottom: bottomInset + insets.bottom }, contentStyle]}>
      {children}
    </View>
  );
  return (
    <View style={[styles.screen, style]}>
      <LinearGradient
        colors={[colors.navy, colors.night, colors.nightDeep]}
        locations={[0, 0.42, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={FILL}
      />
      <LinearGradient
        colors={["rgba(201,169,110,0.13)", "rgba(201,169,110,0)"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.3, y: 0.55 }}
        style={FILL}
      />
      {header ? <View style={{ paddingTop: top }}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={keyboard ? "interactive" : "none"}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{inner}</View>
      )}
    </View>
  );
}

export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, TOP_SAFE_MIN);
}

export function Row({ children, gap = space.md, style, align = "center" }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; align?: ViewStyle["alignItems"] }) {
  return <View style={[{ flexDirection: "row", alignItems: align, gap }, style]}>{children}</View>;
}

export function Stack({ children, gap = space.md, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Spacer({ h = space.lg }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Hairline({ gold = false, style }: { gold?: boolean; style?: StyleProp<ViewStyle> }) {
  if (!gold) return <View style={[{ height: 1, backgroundColor: colors.ivory09 }, style]} />;
  return (
    <LinearGradient
      colors={["rgba(201,169,110,0)", "rgba(201,169,110,0.6)", "rgba(201,169,110,0)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[{ height: 1 }, style]}
    />
  );
}

// ---------------------------------------------------------------- brand

export function Gem({ size = 7, color = colors.gold }: { size?: number; color?: string }) {
  return <View style={{ width: size, height: size, backgroundColor: color, transform: [{ rotate: "45deg" }] }} />;
}

const wordmark = require("../../assets/brand/wordmark-ivory.png");

/** The raster wordmark from the brand files. Never typed text. */
export function Wordmark({ height = 22, style }: { height?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={wordmark} resizeMode="contain" style={[{ height, width: height * 4.15 }, style]} accessibilityLabel="Guest-ly" />;
}

export function SectionLabel({ children, color = colors.ivory55, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    <T v="label11" color={color} style={style}>
      {children}
    </T>
  );
}

// ---------------------------------------------------------------- surfaces

type CardKind = "glass" | "solid" | "paper";

export function Card({ kind = "solid", children, style, padding = 16, radiusKey = "card", blur = false, border }: { kind?: CardKind; children: ReactNode; style?: StyleProp<ViewStyle>; padding?: number; radiusKey?: keyof typeof radius; blur?: boolean; border?: string }) {
  const r = radius[radiusKey];
  if (kind === "paper") {
    return (
      <View style={[styles.paper, { padding, borderRadius: r }, style]}>
        {children}
      </View>
    );
  }
  if (kind === "glass" && blur) {
    return (
      <View style={[{ borderRadius: r, overflow: "hidden", borderWidth: 1, borderColor: border ?? colors.ivory14 }, style]}>
        <BlurView intensity={40} tint="dark" style={FILL} blurMethod="dimezisBlurView" />
        <View style={[{ backgroundColor: colors.glassFill, padding }]}>{children}</View>
      </View>
    );
  }
  return (
    <View
      style={[
        {
          borderRadius: r,
          padding,
          backgroundColor: kind === "glass" ? colors.glassFill : colors.glassSolidFill,
          borderWidth: 1,
          borderColor: border ?? (kind === "glass" ? colors.ivory14 : "rgba(247,243,236,0.12)"),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- controls

type ButtonKind = "primary" | "glass" | "ghost" | "text" | "paper";

export function Button({
  label,
  onPress,
  kind = "primary",
  icon,
  small,
  loading,
  disabled,
  style,
  full = true,
  haptic = true,
}: {
  label: string;
  onPress?: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  small?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
  haptic?: boolean;
}) {
  const h = small ? 48 : BUTTON_HEIGHT;
  const fg = kind === "primary" || kind === "paper" ? colors.night : kind === "text" ? colors.goldLight : colors.ivory;
  const bg =
    kind === "primary" ? colors.gold : kind === "paper" ? colors.cream : kind === "glass" ? colors.glassFill : "transparent";
  const border = kind === "glass" ? colors.ivory14 : kind === "ghost" ? "rgba(247,243,236,0.18)" : kind === "primary" ? colors.gold : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={() => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          minHeight: kind === "text" ? HIT_TARGET : h,
          borderRadius: radius.pill,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          paddingHorizontal: kind === "text" ? 8 : 22,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          alignSelf: full ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={small ? 18 : 20} color={fg} /> : null}
      <T v="button17" color={fg} size={small ? 15 : 17} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

export function IconButton({ name, onPress, badge, style, label }: { name: IconName; onPress?: () => void; badge?: boolean; style?: StyleProp<ViewStyle>; label?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? name}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }, style]}
    >
      <Icon name={name} size={20} />
      {badge ? <View style={styles.badgeDot} /> : null}
    </Pressable>
  );
}

export function TopBar({ title, onBack, right, left }: { title?: string; onBack?: () => void; right?: ReactNode; left?: ReactNode }) {
  return (
    <View style={styles.topBar}>
      <Row gap={12}>
        {onBack ? <IconButton name="back" onPress={onBack} label="Back" /> : left}
        {title ? (
          <T v="body15" color={colors.ivory70}>
            {title}
          </T>
        ) : null}
      </Row>
      <View>{right}</View>
    </View>
  );
}

export function BigTitle({ label, title, sub, size = 42 }: { label?: string; title: string; sub?: string; size?: number }) {
  return (
    <Stack gap={6}>
      {label ? <SectionLabel color={colors.goldLight}>{label}</SectionLabel> : null}
      <T v="title42" size={size}>
        {title}
      </T>
      {sub ? (
        <T v="body15" color={colors.ivory55}>
          {sub}
        </T>
      ) : null}
    </Stack>
  );
}

type BadgeKind = "green" | "amber" | "gold" | "mute" | "red";

export function Badge({ label, kind = "mute", dot }: { label: string; kind?: BadgeKind; dot?: boolean }) {
  const map: Record<BadgeKind, { fg: string; bg: string; border: string }> = {
    green: { fg: colors.greenText, bg: "rgba(5,150,105,0.14)", border: "rgba(52,211,153,0.3)" },
    amber: { fg: colors.amber, bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.3)" },
    gold: { fg: colors.goldLight, bg: "rgba(201,169,110,0.14)", border: "rgba(201,169,110,0.35)" },
    mute: { fg: colors.ivory55, bg: "rgba(247,243,236,0.06)", border: colors.ivory14 },
    red: { fg: colors.red, bg: "rgba(220,38,38,0.14)", border: "rgba(240,162,162,0.3)" },
  };
  const c = map[kind];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      {dot ? <View style={{ width: 7, height: 7, borderRadius: 9, backgroundColor: kind === "green" ? colors.green : c.fg }} /> : null}
      <T v="label11" color={c.fg} style={{ letterSpacing: 1 }}>
        {label}
      </T>
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.8 }]}
    >
      <T v="meta13" color={on ? colors.goldLight : colors.ivory70} style={{ fontFamily: "Jost_500Medium" }}>
        {label}
      </T>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 24 }}>
      {children}
    </ScrollView>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(!value);
      }}
      hitSlop={8}
      style={[styles.toggle, { backgroundColor: value ? colors.gold : colors.ivory14 }]}
    >
      <View style={[styles.knob, { backgroundColor: value ? colors.night : colors.ivory, alignSelf: value ? "flex-end" : "flex-start" }]} />
    </Pressable>
  );
}

export function Segmented<TValue extends string>({ value, options, onChange }: { value: TValue | null; options: { value: TValue; label: string }[]; onChange: (v: TValue) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(o.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: colors.gold }]}
          >
            <T v="meta13" color={on ? colors.night : colors.ivory55} style={{ fontFamily: "Jost_500Medium" }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LangToggle({ value, onChange, dark = true }: { value: "en" | "es"; onChange: (v: "en" | "es") => void; dark?: boolean }) {
  const on = colors.goldLight;
  const off = dark ? colors.ivory40 : colors.muted;
  return (
    <Row gap={14}>
      {(["en", "es"] as const).map((l) => (
        <Pressable key={l} onPress={() => onChange(l)} hitSlop={10} accessibilityRole="button" accessibilityState={{ selected: value === l }}>
          <T v="label11" color={value === l ? on : off} style={{ letterSpacing: 2 }}>
            {l.toUpperCase()}
          </T>
        </Pressable>
      ))}
    </Row>
  );
}

export function Input({ icon, style, right, ...props }: Omit<TextInputProps, "style"> & { icon?: IconName; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.input, style]}>
      {icon ? <Icon name={icon} size={20} color={colors.ivory55} /> : null}
      <TextInput
        placeholderTextColor={colors.ivory55}
        selectionColor={colors.goldLight}
        {...props}
        style={[{ flex: 1, color: colors.ivory, fontFamily: "Jost_400Regular", fontSize: 16, paddingVertical: 12 }, props.multiline && { minHeight: 90, textAlignVertical: "top" }]}
      />
      {right}
    </View>
  );
}

export function Avatar({ initials, size = 40, gem }: { initials?: string; size?: number; gem?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size, backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.goldBorder, alignItems: "center", justifyContent: "center" }}>
      {gem ? <Gem size={Math.round(size * 0.3)} /> : (
        <T v="name24" size={Math.round(size * 0.42)} color={colors.goldLight} style={{ fontFamily: "CormorantGaramond_600SemiBold" }}>
          {initials ?? ""}
        </T>
      )}
    </View>
  );
}

export function ListRow({ leading, title, sub, trailing, onPress, chevron = true, last }: { leading?: ReactNode; title: string; sub?: string | null; trailing?: ReactNode; onPress?: () => void; chevron?: boolean; last?: boolean }) {
  const inner = (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <T v="body16" color={colors.ivory90} numberOfLines={2}>
          {title}
        </T>
        {sub ? (
          <T v="meta13" color={colors.ivory55} numberOfLines={2}>
            {sub}
          </T>
        ) : null}
      </View>
      {trailing}
      {chevron && onPress ? <Icon name="chev" size={18} color={colors.ivory40} /> : null}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {inner}
    </Pressable>
  );
}

export function StatTile({ value, label, color = colors.ivory, kind = "glass", style }: { value: string; label: string; color?: string; kind?: CardKind; style?: StyleProp<ViewStyle> }) {
  return (
    <Card kind={kind} radiusKey="tile" padding={14} style={[{ flex: 1, gap: 4 }, style]}>
      <T v="title34" size={34} color={color}>
        {value}
      </T>
      <T v="meta13" color={colors.ivory55}>
        {label}
      </T>
    </Card>
  );
}

export function ActionTile({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.75 }]}>
      <Icon name={icon} size={20} color={colors.goldLight} />
      <T v="meta13" color={colors.ivory} style={{ fontFamily: "Jost_400Regular" }}>
        {label}
      </T>
    </Pressable>
  );
}

export function Countdown({ days, hours, minutes, labels }: { days: number; hours: number; minutes: number; labels: { days: string; hours: string; min: string } }) {
  const cell = (n: number, l: string) => (
    <Row gap={6} align="baseline" key={l}>
      <T v="display44" size={44}>
        {String(n).padStart(2, "0")}
      </T>
      <T v="meta13" color={colors.ivory55}>
        {l}
      </T>
    </Row>
  );
  const sep = <View style={{ width: 1, height: 30, backgroundColor: "rgba(201,169,110,0.5)" }} />;
  return (
    <Row gap={22} align="flex-end">
      {cell(days, labels.days)}
      {sep}
      {cell(hours, labels.hours)}
      {sep}
      {cell(minutes, labels.min)}
    </Row>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <Stack gap={14} style={{ alignItems: "center", paddingHorizontal: 16, paddingVertical: 24 }}>
      <T v="title30" center>
        {title}
      </T>
      {body ? (
        <T v="body15" color={colors.ivory55} center>
          {body}
        </T>
      ) : null}
      {action}
    </Stack>
  );
}

export function Banner({ icon, title, body, kind = "amber", action }: { icon: IconName; title: string; body?: string; kind?: "amber" | "gold" | "red"; action?: ReactNode }) {
  const border = kind === "amber" ? "rgba(245,158,11,0.35)" : kind === "red" ? "rgba(240,162,162,0.4)" : colors.goldBorder;
  const fg = kind === "amber" ? colors.amber : kind === "red" ? colors.red : colors.goldLight;
  return (
    <Card kind="solid" radiusKey="tile" padding={12} border={border}>
      <Row gap={12} align="flex-start">
        <Icon name={icon} size={22} color={fg} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="body15" color={colors.ivory}>
            {title}
          </T>
          {body ? (
            <T v="meta13" color={colors.ivory55}>
              {body}
            </T>
          ) : null}
        </View>
        {action}
      </Row>
    </Card>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: "center", gap: 10 }}>
      <ActivityIndicator color={colors.goldLight} />
      {label ? (
        <T v="meta13" color={colors.ivory55}>
          {label}
        </T>
      ) : null}
    </View>
  );
}

/** Skeleton block for the loading state (no full-screen spinners). */
export function Skeleton({ w = "100%", h = 16, r = 8, style }: { w?: number | `${number}%`; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: "rgba(247,243,236,0.09)" }, style]} />;
}

/** Bottom sheet with the gold hairline and grabber. */
export function Sheet({ visible, onClose, children, top = 150 }: { visible: boolean; onClose: () => void; children: ReactNode; top?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { top }]}>
        <View style={styles.grabber} />
        <View style={{ flex: 1, paddingBottom: insets.bottom + 16 }}>{children}</View>
      </View>
    </Modal>
  );
}

export function Footer({ version, trademark }: { version: string; trademark: string }) {
  return (
    <T v="meta13" color={colors.ivory40} center style={{ marginTop: 24 }}>
      {version} · {trademark}
    </T>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  fill: { flex: 1 },
  padded: { paddingHorizontal: space.screen },
  paper: { backgroundColor: colors.cream, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.ivory14, alignItems: "center", justifyContent: "center" },
  badgeDot: { position: "absolute", top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  topBar: { height: 40, marginHorizontal: space.xl, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.ivory14, minHeight: 36, justifyContent: "center" },
  chipOn: { borderColor: "rgba(201,169,110,0.5)", backgroundColor: "rgba(201,169,110,0.12)" },
  toggle: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: "center" },
  knob: { width: 20, height: 20, borderRadius: 10 },
  segmented: { flexDirection: "row", borderWidth: 1, borderColor: colors.ivory14, borderRadius: radius.pill, padding: 2 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: "center", minHeight: 36, justifyContent: "center" },
  input: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderRadius: radius.pill, paddingHorizontal: 18, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  actionTile: { flex: 1, height: 64, borderRadius: radius.chip, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.ivory14, alignItems: "center", justifyContent: "center", gap: 5 },
  scrim: { ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, backgroundColor: colors.scrim },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.night, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderTopWidth: 1, borderTopColor: colors.goldBorder, paddingHorizontal: 24 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(247,243,236,0.2)", marginTop: 10, marginBottom: 14 },
});

export const platformIsAndroid = Platform.OS === "android";
