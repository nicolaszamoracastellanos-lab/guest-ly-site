// Keyboard primitives for build 12 (v1.2 Ola 2, plan item 21; audit K3, K4,
// K6, K15, K19). Built on react-native-keyboard-controller (SDK 57 pin 1.21.9),
// whose KeyboardProvider wraps the app in the root layout.
//
// - FormToolbar: "Anterior / Siguiente / Listo" ("Prev / Next / Done") bar over
//   the keyboard. Screen (keyboard form mode) and form Sheets mount it; screens
//   never mount it themselves.
// - DockedAction: the screen's main action. Above the tab bar (or the home
//   indicator) at rest, right above the keyboard and its toolbar while typing,
//   moving with the keyboard frame by frame (interactive dismiss included).
// - ChatArea / ChatList / ChatComposer / Composer: a conversation whose last
//   message stays in view and whose composer rides the keyboard; the composer
//   grows to 5 lines, sends with an arrow up, and the keyboard stays up after
//   sending.
// - useKeepFocusedVisible: for a plain ScrollView inside a container that the
//   keyboard lifts (the Sheet): scrolls the focused field into view once the
//   keyboard settles or focus moves. KeyboardAwareScrollView assumes a scroll
//   view that does not move, so it over-scrolls inside a lifted sheet.
//
// Everything here works without the native module (web QA rig): the library's
// bindings fall back to plain views there.

import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { makeMutable, runOnJS, type SharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyboardChatScrollView,
  KeyboardStickyView,
  KeyboardToolbar,
  KEYBOARD_BORDER_RADIUS,
  useKeyboardHandler,
  type KeyboardChatScrollViewProps,
} from "react-native-keyboard-controller";
import { useCopy } from "@/i18n";
import { Icon, type IconName } from "./Icon";
import { colors, fonts, COLUMN, HIT_TARGET, space } from "./tokens";
import { useBottomClearance, useTabBarTop } from "./chrome";
import { useDockLift } from "./Toast";

// ------------------------------------------------------------------ sizes

/** Height of the library's toolbar (KEYBOARD_TOOLBAR_HEIGHT, not exported). */
const TOOLBAR_HEIGHT = 42;
/** Room the form toolbar takes above the keyboard. On iOS 26 and later the
 *  keyboard has rounded corners and the toolbar floats 11 pt above it. Docked
 *  actions, sheet footers and toasts sit this much higher while it shows. */
export const TOOLBAR_SPACE = TOOLBAR_HEIGHT + (KEYBOARD_BORDER_RADIUS > 0 ? 11 : 0);
/** Gap between a docked surface at rest and the floating tab bar under it. */
const DOCK_GAP_OVER_TAB_BAR = 4;
/** Composer text metrics: 17 pt Jost on a 22 pt line, up to 5 lines. */
const COMPOSER_LINE = 22;
const COMPOSER_PAD_V = 12;

// ------------------------------------------------------------------ scope

/** Set by a form Screen (`keyboard` / `keyboard="form"`) and by form Sheets.
 *  Inside it, inputs leave the "Done" to the form toolbar instead of adding
 *  their own iOS accessory bar (wave 1, K6). */
export const KeyboardScope = createContext<{ form: boolean } | null>(null);
export const FORM_SCOPE = { form: true } as const;

/** True inside a form Screen or form Sheet (the toolbar shows there). */
export function useInFormScope(): boolean {
  return !!useContext(KeyboardScope)?.form;
}

/** The focused native text field, or null. react-native-web's TextInputState
 *  has no currentlyFocusedInput (only currentlyFocusedField), so the web QA
 *  rig skips it instead of throwing. */
export function focusedTextInput(): ReturnType<typeof TextInput.State.currentlyFocusedInput> | null {
  if (Platform.OS === "web") return null;
  const state = TextInput.State as Partial<typeof TextInput.State>;
  return state.currentlyFocusedInput?.() ?? null;
}

// ------------------------------------------------------------------ toolbar

type ToolbarButton = NonNullable<React.ComponentProps<typeof KeyboardToolbar.Prev>["button"]>;
type ToolbarButtonProps = Parameters<ToolbarButton>[0];
type BarKind = "prev" | "next" | "done";

const TOOLBAR_DARK = {
  primary: colors.goldLight,
  disabled: "rgba(247,243,236,0.35)",
  background: colors.keyboardBar,
  ripple: "#c9a96e44",
};
/** The app is dark only (dark keyboards everywhere), so one theme for both. */
const TOOLBAR_THEME = { light: TOOLBAR_DARK, dark: TOOLBAR_DARK };

function BarButton({ kind, disabled, onPress, testID }: { kind: BarKind; disabled?: boolean; onPress: (e: GestureResponderEvent) => void; testID?: string }) {
  const c = useCopy().common;
  const label = kind === "prev" ? c.prev : kind === "next" ? c.next : c.done;
  const hint = kind === "prev" ? c.kbPrevHint : kind === "next" ? c.kbNextHint : c.kbDoneHint;
  const color = disabled ? TOOLBAR_DARK.disabled : kind === "done" ? colors.goldLight : colors.ivory70;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 2, bottom: 2 }}
      style={({ pressed }) => [styles.barButton, kind === "done" && styles.barDone, pressed && { opacity: 0.6 }]}
    >
      {kind === "done" ? null : <Icon name={kind === "prev" ? "up" : "down"} size={20} color={color} />}
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.1}
        style={{ fontFamily: kind === "done" ? fonts.bodySemibold : fonts.body, fontSize: 15, color }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// The library passes its own English labels to `button`; these ignore them
// and speak the app's language.
const PrevButton: ToolbarButton = (p: ToolbarButtonProps) => <BarButton kind="prev" disabled={p.disabled} onPress={p.onPress} testID={p.testID} />;
const NextButton: ToolbarButton = (p: ToolbarButtonProps) => <BarButton kind="next" disabled={p.disabled} onPress={p.onPress} testID={p.testID} />;
const DoneButton: ToolbarButton = (p: ToolbarButtonProps) => <BarButton kind="done" disabled={p.disabled} onPress={p.onPress} testID={p.testID} />;

/** The bar over the keyboard in forms: Prev / Next move between the fields of
 *  the same form (bounded by `FormGroup`), Done closes the keyboard (numeric
 *  keyboards have no Return key, K6). Absolutely placed at the bottom of its
 *  parent, which must reach the bottom of the window (a Screen root, a Sheet's
 *  modal root). Mounted by Screen and Sheet; screens do not mount it. */
export function FormToolbar({ arrows = true }: { arrows?: boolean }) {
  return (
    <KeyboardToolbar theme={TOOLBAR_THEME} opacity="FF">
      {arrows ? <KeyboardToolbar.Prev button={PrevButton} /> : null}
      {arrows ? <KeyboardToolbar.Next button={NextButton} /> : null}
      <KeyboardToolbar.Done button={DoneButton} />
    </KeyboardToolbar>
  );
}

/** Bounds Prev / Next to the fields inside it, so they never jump into
 *  another screen that stays mounted in the tabs. Screen and Sheet wrap their
 *  form content in it. */
export const FormGroup = KeyboardToolbar.Group;

// ------------------------------------------------------------------ docked action

/** Where a docked surface rests: above the floating tab bar inside the tabs,
 *  else right on the home indicator strip (the strip under it is filled). */
function useDockRest(): number {
  const insets = useSafeAreaInsets();
  const { tabBar } = useBottomClearance();
  const tabTop = useTabBarTop();
  return tabBar ? tabTop + DOCK_GAP_OVER_TAB_BAR : insets.bottom;
}

/**
 * The screen's main action, docked at the bottom (RSVP send, sign in, new
 * request...). Pass it to Screen's `dock` prop, which places it and pads the
 * content; mount it yourself only at the root of a screen that does not use
 * Screen (its parent must reach the bottom of the window).
 *
 * At rest it sits above the floating tab bar, or on the home indicator strip
 * outside the tabs. While the keyboard is open it rides right above it (and
 * above the form toolbar when `toolbar`), frame by frame.
 */
export function DockedAction({ children, toolbar = false, onHeight, style }: { children: ReactNode; toolbar?: boolean; onHeight?: (h: number) => void; style?: StyleProp<ViewStyle> }) {
  const rest = useDockRest();
  const [height, setHeight] = useState(0);
  const lifted = toolbar ? TOOLBAR_SPACE : 0;
  useDockLift(height ? { rest: height + DOCK_GAP_OVER_TAB_BAR, open: height + lifted } : null);
  const onLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h === height) return;
    setHeight(h);
    onHeight?.(h);
  };
  return (
    <KeyboardStickyView pointerEvents="box-none" style={styles.dock} offset={{ closed: -rest, opened: -lifted }}>
      <View style={styles.dockSurface} onLayout={onLayout}>
        <LinearGradient pointerEvents="none" colors={["rgba(13,17,23,0)", colors.night]} style={styles.dockFade} />
        <View style={[styles.column, styles.dockInner, style]}>{children}</View>
      </View>
      {/* Fills the gap under it at rest (tab bar strip, home indicator), so
          content never shows between the action and the bottom edge. Behind
          the keyboard while typing. */}
      <View pointerEvents="none" style={[styles.dockStrip, { height: rest }]} />
    </KeyboardStickyView>
  );
}

// ------------------------------------------------------------------ chat

type ChatContextValue = {
  /** Distance from the bottom of the window to the composer at rest. */
  rest: number;
  /** Composer height plus `rest`: the list's bottom padding at rest. */
  extra: SharedValue<number>;
  setComposerHeight: (h: number) => void;
};

const FALLBACK_EXTRA = makeMutable(0);
const ChatContext = createContext<ChatContextValue>({ rest: 0, extra: FALLBACK_EXTRA, setComposerHeight: () => {} });

/**
 * The frame of a chat screen: holds the list and the composer and keeps them
 * in step. Screen does this for you with `keyboard="chat"` (no bottom padding,
 * content reaching the bottom of the window):
 *
 *   <Screen scroll={false} padded={false} keyboard="chat" header={<TopBar ... />}>
 *     <ChatList ref={list}>{bubbles}</ChatList>
 *     <ChatComposer value={draft} onChangeText={setDraft} onSend={send} accessory={chips} />
 *   </Screen>
 */
export function ChatArea({ children }: { children: ReactNode }) {
  const rest = useDockRest();
  const [extra] = useState(() => makeMutable(0));
  const [composer, setComposerHeight] = useState(0);
  useEffect(() => {
    extra.set(composer + rest);
  }, [extra, composer, rest]);
  const value = useMemo(() => ({ rest, extra, setComposerHeight }), [rest, extra]);
  return (
    <ChatContext.Provider value={value}>
      <View style={styles.fill}>{children}</View>
    </ChatContext.Provider>
  );
}

export type ChatListHandle = {
  /** Scroll to the newest message. */
  scrollToEnd: (animated?: boolean) => void;
  /** True while the newest message is in view. */
  isAtEnd: () => boolean;
};

type ChatListProps = Omit<KeyboardChatScrollViewProps, "offset" | "extraContentPadding" | "inverted"> & {
  children?: ReactNode;
  /** Keep following new messages while the person is at the end. Default on. */
  follow?: boolean;
};

/**
 * The conversation. Lives inside a ChatArea (or a `keyboard="chat"` Screen).
 * Opens on the newest message, follows new ones while the person reads the
 * end, and lifts with the keyboard so the last message stays right above the
 * composer (K3). A drag down puts the keyboard away (interactive).
 */
export const ChatList = forwardRef<ChatListHandle, ChatListProps>(function ChatList({ children, follow = true, contentContainerStyle, onEndVisible, onContentSizeChange, style, ...rest }, ref) {
  const chat = useContext(ChatContext);
  const scroll = useRef<React.ComponentRef<typeof KeyboardChatScrollView>>(null);
  const atEnd = useRef(true);
  const opened = useRef(false);
  const openedAt = useRef(0);
  const toEnd = useCallback((animated = true) => {
    scroll.current?.scrollToEnd({ animated });
  }, []);
  useImperativeHandle(ref, () => ({ scrollToEnd: toEnd, isAtEnd: () => atEnd.current }), [toEnd]);
  // Screens fold their header and chips while typing (M6, M10), which moves
  // the list under the lift. Someone who was reading the end when the
  // keyboard started up lands on the end once it is up (checked on the sims:
  // without this the newest message sat under the composer).
  useEffect(() => {
    let wasAtEnd = true;
    const willShow = Keyboard.addListener("keyboardWillShow", () => {
      wasAtEnd = atEnd.current;
    });
    const didShow = Keyboard.addListener("keyboardDidShow", () => {
      if (wasAtEnd) toEnd(true);
    });
    // The composer is measured after the list's first layout: once it is,
    // land on the end again (its height becomes the list's bottom padding).
    const settle = setTimeout(() => {
      if (atEnd.current) toEnd(false);
    }, 400);
    return () => {
      clearTimeout(settle);
      willShow.remove();
      didShow.remove();
    };
  }, [toEnd]);
  const handleEndVisible = useCallback(
    (visible: boolean) => {
      atEnd.current = visible;
      onEndVisible?.(visible);
    },
    [onEndVisible]
  );
  return (
    <KeyboardChatScrollView
      ref={scroll}
      offset={chat.rest}
      extraContentPadding={chat.extra}
      keyboardLiftBehavior="always"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={[styles.fill, style]}
      contentContainerStyle={[styles.chatContent, contentContainerStyle]}
      onEndVisible={handleEndVisible}
      onContentSizeChange={(w, h) => {
        onContentSizeChange?.(w, h);
        if (h <= 0) return;
        // Opens on the newest message; afterwards follows only while at the end.
        // For the first moments every size change lands on the end too: the
        // composer's height (bottom padding) and late rows arrive after the
        // first layout, and the thread used to open a message short of the end.
        if (!opened.current) {
          opened.current = true;
          openedAt.current = Date.now();
          atEnd.current = true;
          toEnd(false);
          return;
        }
        if (Date.now() - openedAt.current < 1500) {
          toEnd(false);
          return;
        }
        if (follow && atEnd.current) toEnd(true);
      }}
      {...rest}
    >
      {children}
    </KeyboardChatScrollView>
  );
});

export type ComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** Runs on the send button and on Return. Clear `value` yourself; the
   *  keyboard stays up so the next message can follow. */
  onSend: () => void;
  /** Default "Write a message" / "Escribe un mensaje". */
  placeholder?: string;
  /** Spoken name of the send button. Default "Send" / "Enviar". */
  sendLabel?: string;
  /** A spinner in the send button; sending is blocked meanwhile. */
  busy?: boolean;
  /** Override when the send button is on. Default: there is text. */
  canSend?: boolean;
  editable?: boolean;
  /** Grows up to this many lines, then scrolls inside. Default 5. */
  maxLines?: number;
  /** Return sends (default). False: Return adds a line. */
  submitOnReturn?: boolean;
  /** Send button icon. Default the arrow up. */
  sendIcon?: IconName;
  inputRef?: React.Ref<TextInput>;
  autoFocus?: boolean;
  testID?: string;
  sendTestID?: string;
};

/** The one message box: grows with the text up to 5 lines, gold arrow-up send
 *  button that lights up when there is something to send. Used by
 *  ChatComposer; usable alone in any docked surface. */
export function Composer({ value, onChangeText, onSend, placeholder, sendLabel, busy, canSend, editable = true, maxLines = 5, submitOnReturn = true, sendIcon = "arrow-up", inputRef, autoFocus, testID, sendTestID }: ComposerProps) {
  const c = useCopy().common;
  const on = !busy && editable && (canSend ?? value.trim().length > 0);
  const submit = () => {
    if (!on) return;
    onSend();
  };
  const maxHeight = maxLines * COMPOSER_LINE + COMPOSER_PAD_V * 2;
  return (
    <View style={[styles.composer, !editable && { opacity: 0.6 }]}>
      <TextInput
        ref={inputRef}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? c.composerPlaceholder}
        accessibilityLabel={placeholder ?? c.composerPlaceholder}
        placeholderTextColor={colors.ivory55}
        selectionColor={colors.goldLight}
        keyboardAppearance="dark"
        maxFontSizeMultiplier={1.3}
        multiline
        scrollEnabled
        editable={editable}
        autoFocus={autoFocus}
        returnKeyType={submitOnReturn ? "send" : "default"}
        submitBehavior={submitOnReturn ? "submit" : "newline"}
        onSubmitEditing={submitOnReturn ? submit : undefined}
        style={[styles.composerInput, { maxHeight }]}
      />
      <Pressable
        testID={sendTestID}
        accessibilityRole="button"
        accessibilityLabel={sendLabel ?? c.send}
        accessibilityState={{ disabled: !on, busy: !!busy }}
        disabled={!on}
        onPress={submit}
        style={({ pressed }) => [styles.sendHit, pressed && on && { opacity: 0.8 }]}
      >
        <View style={[styles.sendDisc, on ? styles.sendOn : null]}>
          {busy ? <ActivityIndicator size="small" color={colors.ivory} /> : <Icon name={sendIcon} size={20} color={on ? colors.night : colors.ivory55} strokeWidth={2} />}
        </View>
      </Pressable>
    </View>
  );
}

type ChatComposerProps = Partial<ComposerProps> & {
  /** Above the box (quick question chips, a hint). Hide it while typing with
   *  `useKeyboardOpen()` if it only matters before typing. */
  accessory?: ReactNode;
  /** Under the box (a secondary button, the AI notice). */
  below?: ReactNode;
  /** Replaces the Composer (a read-only note, a WhatsApp button...). */
  children?: ReactNode;
};

/**
 * The bottom of a chat screen: docked above the tab bar (or the home
 * indicator) at rest and right on top of the keyboard while typing, moving
 * with it frame by frame, interactive dismiss included. Its height feeds the
 * list, so the last message is never under it, also while the box grows.
 */
export function ChatComposer({ accessory, below, children, ...composer }: ChatComposerProps) {
  const chat = useContext(ChatContext);
  const [height, setHeight] = useState(0);
  useDockLift(height ? { rest: height, open: height } : null);
  const onLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h === height) return;
    setHeight(h);
    chat.setComposerHeight(h);
  };
  const box =
    children ??
    (composer.value !== undefined && composer.onChangeText && composer.onSend ? (
      <Composer {...(composer as ComposerProps)} />
    ) : null);
  return (
    <KeyboardStickyView pointerEvents="box-none" style={styles.dock} offset={{ closed: -chat.rest, opened: 0 }}>
      <View style={styles.composerSurface} onLayout={onLayout}>
        <LinearGradient pointerEvents="none" colors={["rgba(13,17,23,0)", colors.night]} style={styles.dockFade} />
        <View style={[styles.column, styles.composerInner]}>
          {accessory}
          {box}
          {below}
        </View>
      </View>
      <View pointerEvents="none" style={[styles.dockStrip, { height: chat.rest }]} />
    </KeyboardStickyView>
  );
}

// ------------------------------------------------------------------ lifted scroll

/**
 * Keeps the focused field visible in a plain ScrollView whose container the
 * keyboard lifts (Sheet): once the keyboard settles, and each time focus moves
 * to another field, the field is scrolled into the visible part with `gap`
 * points around it. Put `scrollRef`, `onScroll` (with scrollEventThrottle 16),
 * `onLayout` and `onContentSizeChange` on the ScrollView and `contentRef` on a
 * View that wraps all of its content.
 */
export function useKeepFocusedVisible({ gap = 16, enabled = true }: { gap?: number; enabled?: boolean } = {}) {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  const contentHeight = useRef(0);
  const check = useCallback(() => {
    if (!enabled) return;
    const input = focusedTextInput();
    const content = contentRef.current;
    if (!input || !content) return;
    // A frame later: the lifted container has its final size by then.
    requestAnimationFrame(() => {
      input.measureLayout(
        content,
        (_x, y, _w, h) => {
          // Not a field of this scroll view: leave it alone.
          if (y < 0 || y > contentHeight.current) return;
          const top = y - gap;
          const bottom = y + h + gap;
          if (bottom > offset.current + viewport.current) scrollRef.current?.scrollTo({ y: Math.max(0, bottom - viewport.current), animated: true });
          else if (top < offset.current) scrollRef.current?.scrollTo({ y: Math.max(0, top), animated: true });
        },
        () => {}
      );
    });
  }, [enabled, gap]);
  useKeyboardHandler(
    {
      onEnd: (e) => {
        "worklet";
        if (e.height > 0) runOnJS(check)();
      },
    },
    [check]
  );
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    viewport.current = e.nativeEvent.layout.height;
  }, []);
  const onContentSizeChange = useCallback((_w: number, h: number) => {
    contentHeight.current = h;
  }, []);
  return { scrollRef, contentRef, onScroll, onLayout, onContentSizeChange };
}

// ------------------------------------------------------------------ styles

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: COLUMN,
  barButton: { minHeight: TOOLBAR_HEIGHT, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10 },
  barDone: { paddingHorizontal: 16 },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0 },
  dockSurface: { backgroundColor: colors.night },
  dockFade: { position: "absolute", left: 0, right: 0, bottom: "100%", height: 16 },
  dockInner: { paddingHorizontal: space.screen, paddingTop: 12, paddingBottom: 12, gap: 10 },
  dockStrip: { position: "absolute", left: 0, right: 0, top: "100%", backgroundColor: colors.night },
  chatContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 10 },
  composerSurface: { backgroundColor: colors.night },
  composerInner: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 8 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(247,243,236,0.24)",
    backgroundColor: colors.glassSolidFill,
    paddingLeft: 16,
    paddingRight: 2,
  },
  composerInput: {
    flex: 1,
    color: colors.ivory,
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: COMPOSER_LINE,
    paddingTop: COMPOSER_PAD_V,
    paddingBottom: COMPOSER_PAD_V,
    minHeight: COMPOSER_LINE + COMPOSER_PAD_V * 2,
    textAlignVertical: "top",
  },
  sendHit: { width: HIT_TARGET, height: HIT_TARGET, marginBottom: 1, alignItems: "center", justifyContent: "center" },
  sendDisc: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.ivory14 },
  sendOn: { backgroundColor: colors.gold },
});
