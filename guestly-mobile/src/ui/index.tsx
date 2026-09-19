// Guest-ly component kit. Direction A: night background, ivory type, gold
// accents, glass surfaces, one paper (ivory) card per screen at most.

import React, { useEffect, useRef, useState, type ReactNode } from "react";
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
  Keyboard,
  KeyboardAvoidingView,
  useWindowDimensions,
  type TextStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useCopy, useLang, longDate } from "@/i18n";
import { T } from "./Text";
import { Icon, type IconName } from "./Icon";
import { colors, radius, space, HIT_TARGET, BUTTON_HEIGHT, TOP_SAFE_MIN, FILL, COLUMN, SHEET_MAX_WIDTH, WIDE_BREAKPOINT } from "./tokens";
import { useBottomClearance, useBubbleLift, useTabBarTop } from "./chrome";

export { T } from "./Text";
export { Icon } from "./Icon";
export type { IconName } from "./Icon";
export { colors, radius, space, COLUMN } from "./tokens";
export { useBottomClearance, useBubbleLift, useTabBarTop } from "./chrome";

// ---------------------------------------------------------------- layout

/** Night gradient background with the gold bloom, safe areas handled.
 *
 *  Rules owned here (Part 9 audit, Sep 18 2026):
 *  - Bottom: inside the tab layouts a scrolling screen always ends clear of the
 *    floating tab bar, and of the assistant bubble where it shows. `bottomInset`
 *    is only a floor for screens outside the tabs. Non-scroll screens (lists,
 *    chats) pad themselves with `useBottomClearance()`.
 *  - Keyboard: `keyboard` lets iOS inset the scroll view so the focused field
 *    stays above the keyboard. A KeyboardAvoidingView inside a ScrollView does
 *    nothing, so screens must not add one.
 *  - Width: header and body sit in one centered column (COLUMN), so nothing
 *    stretches on tablets, foldables or a desktop window.
 *  - Top: devices with a notch keep the 54 pt design minimum; a phone with a
 *    plain 20 pt status bar gets the status bar plus 16, not a 54 pt hole. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  bottomInset = 0,
  header,
  style,
  contentStyle,
  keyboard,
  topInset = true,
  query,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  bottomInset?: number;
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
  /** False for list screens whose list header carries the top inset itself. */
  topInset?: boolean;
  /** The screen's main query. While it has failed with nothing cached the
   *  screen shows the shared error state with Retry instead of its content
   *  (never a false empty state, never a blank screen); with cached content it
   *  shows the offline banner above it (Part 9 audit, D-023). */
  query?: QueryLike | null;
}) {
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const { lang } = useLang();
  const { clearance } = useBottomClearance();
  const bottom = scroll ? Math.max(clearance, bottomInset + insets.bottom) : bottomInset + insets.bottom;
  const failed = !!query?.isError && query.data === undefined;
  const stale = !!query?.isError && query.data !== undefined;
  const inner = (
    <View style={[styles.column, padded && styles.padded, !scroll && styles.fill, { paddingTop: header || !topInset ? 0 : top, paddingBottom: bottom }, contentStyle]}>
      {failed ? (
        <View style={!padded && styles.padded}>
          <QueryError onRetry={() => void query?.refetch()} message={queryMessage(query, lang)} />
        </View>
      ) : (
        <>
          {stale ? (
            <View style={[{ marginBottom: 12 }, !padded && styles.padded]}>
              <StaleBanner onRetry={() => void query?.refetch()} />
            </View>
          ) : null}
          {children}
        </>
      )}
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
      {header ? <View style={[styles.column, { paddingTop: top }]}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={keyboard ? "interactive" : "none"}
          automaticallyAdjustKeyboardInsets
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

/** The part of a react-query result the kit needs. */
export type QueryLike = { isError: boolean; data: unknown; error?: unknown; refetch: () => unknown };

/** The API's own bilingual sentence when the failure carries one. */
function queryMessage(query: QueryLike | null | undefined, lang: "en" | "es"): string | null {
  const e = query?.error as { messages?: { en?: string; es?: string }; status?: number } | null | undefined;
  // A plain 5xx has no useful sentence of its own; the shared copy reads better.
  if (!e?.messages || (e.status ?? 0) >= 500) return null;
  return e.messages[lang] ?? null;
}

/** Top padding under the status bar. Notch and Dynamic Island phones keep the
 *  design minimum; a plain status bar gets a small gap instead of a hole. */
export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  return insets.top >= 40 ? Math.max(insets.top, TOP_SAFE_MIN) : insets.top + 16;
}

/** True while the software keyboard is up. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/** Root wrapper for the non-scrolling chat screens: the composer at the bottom
 *  rides exactly on top of the keyboard.
 *
 *  KeyboardAvoidingView works from its position inside its parent, not on the
 *  screen. Under a header, and above all inside a modal sheet that starts below
 *  the top of the window, that is off by the distance to the top, and on a
 *  667 pt phone the composer ended up under the keyboard (Part 9 audit, D-032).
 *  This wrapper measures its real place in the window and passes it on. */
export function KeyboardFill({ children }: { children: ReactNode }) {
  const ref = useRef<View>(null);
  const [offset, setOffset] = useState(0);
  const measure = () => ref.current?.measureInWindow((_x, y) => setOffset(Math.max(0, Math.round(y || 0))));
  useEffect(() => {
    const sub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", measure);
    return () => sub.remove();
  }, []);
  return (
    <View ref={ref} style={styles.fill} onLayout={measure} collapsable={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill} keyboardVerticalOffset={offset}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
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
  testID,
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
  testID?: string;
}) {
  const h = small ? 48 : BUTTON_HEIGHT;
  const fg = kind === "primary" || kind === "paper" ? colors.night : kind === "text" ? colors.goldLight : colors.ivory;
  const bg =
    kind === "primary" ? colors.gold : kind === "paper" ? colors.cream : kind === "glass" ? colors.glassFill : "transparent";
  const border = kind === "glass" ? colors.ivory14 : kind === "ghost" ? "rgba(247,243,236,0.18)" : kind === "primary" ? colors.gold : "transparent";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          minHeight: kind === "text" ? HIT_TARGET : h,
          borderRadius: kind === "text" ? radius.pill : h / 2,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          paddingHorizontal: kind === "text" ? 8 : small ? 16 : 22,
          paddingVertical: kind === "text" ? 4 : 8,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          alignSelf: full ? "stretch" : "flex-start",
          maxWidth: "100%",
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={small ? 18 : 20} color={fg} /> : null}
      {/* A call to action never ends in an ellipsis: the label shrinks a little
          first (iOS and Android), then wraps to a second line and the button
          grows. flexShrink lets the text wrap inside the row instead of
          pushing the icon out. */}
      <T v="button17" color={fg} size={small ? 15 : 17} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85} center style={{ flexShrink: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}

/** Accessible name for an icon-only control when the screen passes none.
 *  Never the icon's file name (Part 9 audit, D-025). */
function useIconLabel(name: IconName, label?: string): string {
  const c = useCopy().common;
  if (label) return label;
  const map: Partial<Record<IconName, string>> = c.icons;
  return map[name] ?? c.button;
}

/** Two or three buttons side by side with equal heights, so a label that wraps
 *  to two lines does not leave its neighbour shorter. */
export function ButtonRow({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "stretch", gap }, style]}>
      {React.Children.map(children, (child) => (child ? <View style={{ flex: 1, minWidth: 0 }}>{child}</View> : null))}
    </View>
  );
}

/** One line for a single word (it shrinks instead of breaking mid word), two
 *  lines when the label has spaces to break at. */
export function labelLines(label: string): 1 | 2 {
  return /\s/.test(label.trim()) ? 2 : 1;
}

export function IconButton({ name, onPress, badge, style, label, testID }: { name: IconName; onPress?: () => void; badge?: boolean; style?: StyleProp<ViewStyle>; label?: string; testID?: string }) {
  const a11y = useIconLabel(name, label);
  // The pressable is 44 x 44; the 40 pt glass disc is only the visual.
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.iconHit, pressed && { opacity: 0.7 }, style]}
    >
      <View style={styles.iconBtn}>
        <Icon name={name} size={20} />
        {badge ? <View style={styles.badgeDot} /> : null}
      </View>
    </Pressable>
  );
}

export function TopBar({ title, onBack, right, left }: { title?: string; onBack?: () => void; right?: ReactNode; left?: ReactNode }) {
  const copy = useCopy();
  return (
    <View style={styles.topBar}>
      <Row gap={10} style={{ flex: 1, minWidth: 0 }}>
        {onBack ? <IconButton name="back" onPress={onBack} label={copy.common.back} testID="topbar-back" /> : left}
        {title ? (
          <T v="body15" color={colors.ivory70} numberOfLines={1} style={{ flexShrink: 1 }}>
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

export function Chip({ label, on, onPress, testID }: { label: string; on?: boolean; onPress?: () => void; testID?: string }) {
  // 44 pt pressable, 36 pt visual pill centered inside it.
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!on }}
      style={({ pressed }) => [styles.chipHit, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.chip, on && styles.chipOn]}>
        <T v="meta13" color={on ? colors.goldLight : colors.ivory70} style={{ fontFamily: "Jost_500Medium" }}>
          {label}
        </T>
      </View>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 24, alignItems: "center" }}>
      {children}
    </ScrollView>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  // 52 x 44 pressable around the 44 x 26 track.
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(!value);
      }}
      style={styles.toggleHit}
    >
      <View style={[styles.toggle, { backgroundColor: value ? colors.gold : colors.ivory14 }]}>
        <View style={[styles.knob, { backgroundColor: value ? colors.night : colors.ivory, alignSelf: value ? "flex-end" : "flex-start" }]} />
      </View>
    </Pressable>
  );
}

/** A switch with its visible label and optional hint. A Toggle on its own has
 *  no visible name (Part 9 audit, D-025). */
export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row gap={12} style={{ minHeight: HIT_TARGET }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="body16" color={colors.ivory90}>
          {label}
        </T>
        {hint ? (
          <T v="meta13" color={colors.ivory55}>
            {hint}
          </T>
        ) : null}
      </View>
      <Toggle value={value} onChange={onChange} label={label} />
    </Row>
  );
}

/** Segmented control. Segments are 44 pt tall and grow with a wrapped label.
 *  With `stack`, or when a label is long, the options become a vertical list of
 *  full-width rows, because three long Spanish labels do not fit side by side
 *  (Part 9 audit, D-014). */
export function Segmented<TValue extends string>({ value, options, onChange, stack }: { value: TValue | null; options: { value: TValue; label: string }[]; onChange: (v: TValue) => void; stack?: boolean }) {
  const { width } = useWindowDimensions();
  const longest = options.reduce((n, o) => Math.max(n, o.label.length), 0);
  const perSegment = (Math.min(width, 560) - 2 * space.screen) / Math.max(options.length, 1);
  const vertical = stack ?? longest * 7.6 + 20 > perSegment * 1.9;
  return (
    <View style={[styles.segmented, vertical && styles.segmentedStack]}>
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
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            style={[styles.segment, vertical && styles.segmentStack, on && { backgroundColor: colors.gold }]}
          >
            <T v="meta13" color={on ? colors.night : colors.ivory55} center numberOfLines={2} style={{ fontFamily: "Jost_500Medium" }}>
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
  const names = { en: "English", es: "Español" } as const;
  // The 44 pt hit boxes are wider than the two letters; the negative margin
  // keeps the letters aligned with the edge of the content they sit in.
  return (
    <Row gap={0} style={{ marginHorizontal: -13 }}>
      {(["en", "es"] as const).map((l) => (
        <Pressable key={l} testID={`lang-${l}`} onPress={() => onChange(l)} accessibilityRole="button" accessibilityLabel={names[l]} accessibilityState={{ selected: value === l }} style={styles.langHit}>
          <T v="label11" color={value === l ? on : off} style={{ letterSpacing: 2 }}>
            {l.toUpperCase()}
          </T>
        </Pressable>
      ))}
    </Row>
  );
}

/** Text field. Dark keyboard (the app is dark only), the same 1.3 text size cap
 *  as the Text component, and a card radius when multiline so a tall field does
 *  not read as a blob. */
export function Input({ icon, style, right, ...props }: Omit<TextInputProps, "style"> & { icon?: IconName; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.input, props.multiline && styles.inputMultiline, style]}>
      {icon ? <Icon name={icon} size={20} color={colors.ivory55} /> : null}
      <TextInput
        placeholderTextColor={colors.ivory55}
        selectionColor={colors.goldLight}
        keyboardAppearance="dark"
        maxFontSizeMultiplier={1.3}
        {...props}
        style={[{ flex: 1, color: colors.ivory, fontFamily: "Jost_400Regular", fontSize: 16, paddingVertical: 12 }, props.multiline && { minHeight: 90, textAlignVertical: "top" }]}
      />
      {right}
    </View>
  );
}

/** The typed date, read back in words under a YYYY-MM-DD text field, so a slip
 *  of one digit is seen before saving (Part 9 audit, D-021). Renders nothing
 *  until the text is a real calendar day. A native picker needs a new module. */
export function DateEcho({ value, style }: { value: string | null | undefined; style?: StyleProp<TextStyle> }) {
  const { lang } = useLang();
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return (
    <T v="meta13" color={colors.ivory70} style={style}>
      {longDate(value, lang)}
    </T>
  );
}

/** A form field: visible label above the control, optional hint below.
 *  Placeholder-only fields lose their name once something is typed. */
export function Field({ label, hint, children, style }: { label: string; hint?: string | null; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <SectionLabel color={colors.ivory55}>{label}</SectionLabel>
      {children}
      {hint ? (
        <T v="meta13" color={colors.ivory55}>
          {hint}
        </T>
      ) : null}
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

/** `below` puts a badge (or anything) under the title instead of beside it:
 *  a wide status badge in `trailing` squeezed long titles to one word per line
 *  on a 375 pt phone (Part 9 audit, D-012). */
export function ListRow({ leading, title, sub, trailing, below, onPress, chevron = true, last, testID }: { leading?: ReactNode; title: string; sub?: string | null; trailing?: ReactNode; below?: ReactNode; onPress?: () => void; chevron?: boolean; last?: boolean; testID?: string }) {
  const inner = (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      {leading}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T v="body16" color={colors.ivory90} numberOfLines={2}>
          {title}
        </T>
        {sub ? (
          <T v="meta13" color={colors.ivory55} numberOfLines={2}>
            {sub}
          </T>
        ) : null}
        {below ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>{below}</View> : null}
      </View>
      {trailing}
      {chevron && onPress ? <Icon name="chev" size={18} color={colors.ivory40} /> : null}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={sub ? `${title}, ${sub}` : title} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {inner}
    </Pressable>
  );
}

/** One number and its label. The number shrinks to fit on one line and the
 *  label breaks only between words, so a narrow tile never prints "ATTENDIN G"
 *  or "$5,89 0.00" (Part 9 audit, D-008). */
export function StatTile({ value, label, color = colors.ivory, kind = "glass", style }: { value: string; label: string; color?: string; kind?: CardKind; style?: StyleProp<ViewStyle> }) {
  return (
    <Card kind={kind} radiusKey="tile" padding={12} style={[{ flex: 1, minWidth: 0, gap: 4, alignSelf: "stretch" }, style]}>
      <T v="title34" size={34} color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45}>
        {value}
      </T>
      <T v="meta13" color={colors.ivory55} numberOfLines={labelLines(label)} adjustsFontSizeToFit minimumFontScale={0.7}>
        {label}
      </T>
    </Card>
  );
}

/** A row of stat tiles with equal heights. */
export function StatRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "stretch", gap: 8 }, style]}>{children}</View>;
}

export function ActionTile({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.75 }]}>
      <Icon name={icon} size={20} color={colors.goldLight} />
      <T v="meta13" color={colors.ivory} center numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontFamily: "Jost_400Regular" }}>
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

/** Bottom sheet with the gold hairline and grabber.
 *
 *  Default: the height follows the content up to the window minus the top
 *  inset, the content scrolls inside, and the sheet rides above the keyboard
 *  and shrinks if the keyboard leaves less room. No fixed offset can squeeze it
 *  on a 667 pt phone any more (Part 9 audit, H5).
 *
 *  `scroll={false}` is for sheets that bring their own list or scroll view:
 *  they get a definite height (the old `top` offset, but never under 320 pt and
 *  never over the window) so a `flex: 1` child has something to fill.
 *
 *  On wide windows the sheet is a centered 640 pt column. */
export function Sheet({ visible, onClose, children, top = 150, scroll = true }: { visible: boolean; onClose: () => void; children: ReactNode; top?: number; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const copy = useCopy();
  const { height, width } = useWindowDimensions();
  const maxHeight = height - Math.max(insets.top, 20) - 24;
  const fixed = Math.min(Math.max(height - top, 320), maxHeight);
  const wide = width >= WIDE_BREAKPOINT;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable testID="sheet-scrim" style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.common.close} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} pointerEvents="box-none" style={styles.sheetHost}>
        <View style={[styles.sheet, { maxHeight }, !scroll && { height: fixed }, wide && styles.sheetWide]}>
          <View style={styles.grabber} />
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, paddingBottom: insets.bottom + 16 }}>{children}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Error state for a screen whose query failed and has nothing cached to show.
 *  Never an empty state, never a blank screen, never a raw message
 *  (Part 9 audit, D-023). `message` is the API's bilingual sentence when there
 *  is one. */
export function QueryError({ onRetry, message, compact }: { onRetry?: () => void; message?: string | null; compact?: boolean }) {
  const c = useCopy().common;
  return (
    <Stack gap={12} style={{ alignItems: "center", paddingHorizontal: 16, paddingVertical: compact ? 16 : 32 }}>
      <Icon name="warning" size={28} color={colors.amber} />
      <T v={compact ? "title26" : "title30"} center>
        {c.errorTitle}
      </T>
      <T v="body15" color={colors.ivory55} center>
        {message || c.errorBody}
      </T>
      {onRetry ? <Button label={c.retry} kind="glass" small full={false} icon="undo" onPress={onRetry} style={{ alignSelf: "center", marginTop: 4 }} /> : null}
    </Stack>
  );
}

/** Shown above cached content when the last refresh failed. */
export function StaleBanner({ onRetry }: { onRetry?: () => void }) {
  const c = useCopy().common;
  return <Banner icon="wifi-off" title={c.offline} body={c.offlineDetail} action={onRetry ? <IconButton name="undo" label={c.retry} onPress={onRetry} /> : undefined} />;
}

/** What a data screen shows instead of its content while a query is in trouble.
 *  Renders nothing when the query is healthy. With cached data it is a banner
 *  above the content; with none it is the full error state, and the screen
 *  must not render its empty state under it (check `query.isError`). */
export function QueryState({ query, message }: { query: { isError: boolean; data: unknown; refetch: () => unknown; isFetching?: boolean }; message?: string | null }) {
  if (query.isError && query.data === undefined) return <QueryError onRetry={() => void query.refetch()} message={message} />;
  if (query.isError) return <StaleBanner onRetry={() => void query.refetch()} />;
  return null;
}

/** Primary actions docked above the floating tab bar, on a fade so list rows do
 *  not show through (Part 9 audit, D-011). The list under it must end with
 *  `dockedListPadding` so its last row scrolls clear. */
export function DockedActions({ children, onHeight }: { children: ReactNode; onHeight?: (h: number) => void }) {
  const tabTop = useTabBarTop();
  const [h, setH] = useState(0);
  // The bubble rests above the dock while this screen is focused.
  useBubbleLift(h);
  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: tabTop + 12 }]}>
      <LinearGradient pointerEvents="none" colors={["rgba(8,11,16,0)", "rgba(8,11,16,0.94)", colors.nightDeep]} locations={[0, 0.35, 1]} style={FILL} />
      <View style={[styles.column, { paddingHorizontal: space.screen, paddingTop: 22, gap: 10 }]} onLayout={(e) => {
          const next = Math.round(e.nativeEvent.layout.height);
          setH(next);
          onHeight?.(next);
        }}
      >
        {children}
      </View>
    </View>
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
  column: COLUMN,
  iconHit: { width: HIT_TARGET, height: HIT_TARGET, alignItems: "center", justifyContent: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.ivory14, alignItems: "center", justifyContent: "center" },
  badgeDot: { position: "absolute", top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  topBar: { minHeight: HIT_TARGET, marginHorizontal: space.xl - 2, marginBottom: 6, gap: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  chipHit: { minHeight: HIT_TARGET, minWidth: HIT_TARGET, justifyContent: "center" },
  chip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: colors.ivory14, minHeight: 36, alignItems: "center", justifyContent: "center" },
  chipOn: { borderColor: "rgba(201,169,110,0.5)", backgroundColor: "rgba(201,169,110,0.12)" },
  toggleHit: { width: 52, height: HIT_TARGET, alignItems: "center", justifyContent: "center" },
  toggle: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: "center" },
  knob: { width: 20, height: 20, borderRadius: 10 },
  segmented: { flexDirection: "row", borderWidth: 1, borderColor: colors.ivory14, borderRadius: 24, padding: 2 },
  segmentedStack: { flexDirection: "column", borderRadius: radius.card },
  segment: { flex: 1, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 22, alignItems: "center", minHeight: HIT_TARGET, justifyContent: "center" },
  segmentStack: { flex: 0, borderRadius: radius.tile, paddingHorizontal: 14 },
  langHit: { minWidth: HIT_TARGET, minHeight: HIT_TARGET, alignItems: "center", justifyContent: "center" },
  inputMultiline: { borderRadius: radius.card, alignItems: "flex-start", paddingVertical: 4 },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sheetHost: { flex: 1, justifyContent: "flex-end" },
  input: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderRadius: radius.pill, paddingHorizontal: 18, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  actionTile: { flex: 1, minHeight: 72, paddingHorizontal: 6, paddingVertical: 10, borderRadius: radius.chip, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.ivory14, alignItems: "center", justifyContent: "center", gap: 5 },
  scrim: { ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, backgroundColor: colors.scrim },
  sheetWide: { maxWidth: SHEET_MAX_WIDTH, alignSelf: "center", width: "100%", borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.goldBorder },
  sheet: { flexShrink: 1, backgroundColor: colors.night, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderTopWidth: 1, borderTopColor: colors.goldBorder, paddingHorizontal: 24 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(247,243,236,0.2)", marginTop: 10, marginBottom: 14 },
});

export const platformIsAndroid = Platform.OS === "android";
