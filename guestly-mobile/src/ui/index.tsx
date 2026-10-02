// Guest-ly component kit. Direction A: night background, ivory type, gold
// accents, glass surfaces, one paper (ivory) card per screen at most.

import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Image,
  ScrollView,
  RefreshControl,
  InputAccessoryView,
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
  type NativeScrollEvent,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { Extrapolation, SlideInDown, interpolate, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { KeyboardAvoidingView as KeyboardLiftView, KeyboardAwareScrollView, useKeyboardState } from "react-native-keyboard-controller";
import { useCopy, useLang, longDate } from "@/i18n";
import { T } from "./Text";
import { Icon, type IconName } from "./Icon";
import { colors, fonts, radius, space, HIT_TARGET, BUTTON_HEIGHT, TOP_SAFE_MIN, FILL, COVER, COLUMN, SHEET_MAX_WIDTH, WIDE_BREAKPOINT, MIN_BODY } from "./tokens";
import { useBottomClearance, useTabBarTop } from "./chrome";
import { LockCover } from "./LockCover";
import { useOnline } from "@/lib/query";
import { useNavigation, useRoute } from "expo-router";
import { ChatArea, DockedAction, FormGroup, FormToolbar, FORM_SCOPE, KeyboardScope, TOOLBAR_SPACE, focusedTextInput, useInFormScope, useKeepFocusedVisible } from "./keyboard";
import { ToastHost, useDockLift } from "./Toast";

export { T } from "./Text";
export { renderInlineBold } from "./MarkdownText";
export { Icon } from "./Icon";
export type { IconName } from "./Icon";
export { colors, radius, space, COLUMN } from "./tokens";
export { useBottomClearance, useTabBarTop } from "./chrome";
export { LockCover } from "./LockCover";
export { PhotoHero, focalPosition } from "./PhotoHero";
export type { PhotoHeroProps, PhotoFocal } from "./PhotoHero";
// v1.2 build 12: keyboard primitives (react-native-keyboard-controller) and toasts.
export { ChatArea, ChatList, ChatComposer, Composer, DockedAction, FormToolbar, FormGroup, KeyboardScope, TOOLBAR_SPACE, useInFormScope, useKeepFocusedVisible } from "./keyboard";
/** react-native-keyboard-controller's KeyboardAvoidingView (frame-synced with
 *  the keyboard, interactive dismiss included). For a non-scrolling screen
 *  whose bottom part must stay above the keyboard (search field + results,
 *  K9 to K12): `<KeyboardLiftView behavior="padding" style={{ flex: 1 }}>`. */
export { KeyboardAvoidingView as KeyboardLiftView } from "react-native-keyboard-controller";
export type { ChatListHandle, ComposerProps } from "./keyboard";
export { toast, dismissToast, ToastHost, useDockLift } from "./Toast";
export type { ToastOptions, DockLift } from "./Toast";
export { RoleTabs, GlassTabBar } from "./TabBar";
export type { TabSpec, HiddenRoute } from "./TabBar";

// ---------------------------------------------------------------- layout

/** Night gradient background with the gold bloom, safe areas handled.
 *
 *  Rules owned here (Part 9 audit, Sep 18 2026; v1.2 Oct 2026):
 *  - Bottom: inside the tab layouts a scrolling screen always ends clear of the
 *    floating tab bar. `bottomInset` is only a floor for screens outside the
 *    tabs. Non-scroll screens (lists, chats) pad themselves with
 *    `useBottomClearance()`. The assistant bubble reserves nothing any more: it
 *    floats and the person moves it (I9, I11).
 *  - Keyboard (build 12, react-native-keyboard-controller):
 *    - default: iOS insets the scroll view so the focused field stays above
 *      the keyboard (search fields, a lone note).
 *    - `keyboard` or `keyboard="form"`: a form. The scroll keeps the focused
 *      field AND the docked action (`dock`) visible above the keyboard, and the
 *      keyboard gets the "Prev / Next / Done" bar (FormToolbar), Done included
 *      for number pads.
 *    - `keyboard="chat"`: a conversation. No bottom padding; the content is
 *      wrapped in a ChatArea for <ChatList> and <ChatComposer>.
 *    A KeyboardAvoidingView inside a ScrollView does nothing, so screens must
 *    not add one.
 *  - Dock: `dock={<Button ... />}` docks the screen's main action at the
 *    bottom, above the tab bar at rest and right above the keyboard while
 *    typing; the content is padded so nothing ends under it.
 *  - Width: header and body sit in one centered column (COLUMN), so nothing
 *    stretches on tablets, foldables or a desktop window.
 *  - Top: devices with a notch keep the 54 pt design minimum; a phone with a
 *    plain 20 pt status bar gets the status bar plus 16, not a 54 pt hole. A
 *    screen that opens on a PhotoHero passes `topInset={false}` (the hero
 *    applies the inset once) and `backdrop={false}` (plain night, no seam).
 *  - Data states (S1, S2, S4): with `query`, the screen shows the error state
 *    when it failed with nothing cached, "You are offline" when the phone is
 *    offline with nothing cached (never the empty state), and one connection
 *    banner above cached content. `refresh` adds pull to refresh. */
export function Screen({
  children,
  scroll: scrollProp = true,
  padded = true,
  bottomInset = 0,
  header,
  style,
  contentStyle,
  topInset = true,
  backdrop = true,
  query,
  refresh = false,
  scrollY,
  keyboard,
  dock,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  bottomInset?: number;
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Keyboard behavior (build 12). Omitted: plain (every screen insets for
   *  the keyboard and lets a drag put it away). `true` or "form": a form, with
   *  the keyboard-aware scroll and the Prev / Next / Done bar. "chat": a
   *  conversation (use with `scroll={false}`, then ChatList + ChatComposer). */
  keyboard?: boolean | "form" | "chat";
  /** The screen's main action, docked at the bottom: above the tab bar at
   *  rest, right above the keyboard (and its bar) while typing. */
  dock?: ReactNode;
  /** False for list screens whose list header carries the top inset itself,
   *  and for screens that open on a PhotoHero. */
  topInset?: boolean;
  /** False draws a plain night background instead of the gradient image: for
   *  screens that open on a PhotoHero, whose gradient ends in plain night (I8). */
  backdrop?: boolean;
  /** The screen's main query. While it has failed with nothing cached the
   *  screen shows the shared error state with Retry instead of its content;
   *  offline with nothing cached it shows "You are offline" with Retry (never
   *  a false empty state, never a blank screen); with cached content it shows
   *  one connection banner above it (Part 9 audit D-023; v1.2 S1, S4). */
  query?: QueryLike | null;
  /** Pull to refresh (scrolling screens only). `true` refetches `query`; a
   *  function runs instead (refetch several queries, return a promise). */
  refresh?: boolean | (() => unknown);
  /** For a screen that scrolls its own list (`scroll={false}`): the offset
   *  from `useScrimScroll()`, so the status bar backdrop follows that list. */
  scrollY?: SharedValue<number>;
}) {
  const insets = useSafeAreaInsets();
  const pull = usePullRefresh(typeof refresh === "function" ? refresh : refresh && query ? () => query.refetch() : null);
  const top = useTopInset();
  const { lang } = useLang();
  const { clearance } = useBottomClearance();
  const mode: "plain" | "form" | "chat" = keyboard === "chat" ? "chat" : keyboard ? "form" : "plain";
  const form = mode === "form";
  // A chat brings its own list: never inside the screen's scroll view.
  const scroll = scrollProp && mode !== "chat";
  // Height of the docked action, so the content ends clear of it and the
  // keyboard-aware scroll keeps the focused field above it.
  const [dockHeight, setDockHeight] = useState(0);
  const docked = dock ? dockHeight : 0;
  const bottom = mode === "chat" ? 0 : (scroll ? Math.max(clearance, bottomInset + insets.bottom) : bottomInset + insets.bottom) + docked;
  // Toasts clear the form toolbar while the keyboard is open (the docked
  // action registers its own height).
  useDockLift(form ? { rest: 0, open: TOOLBAR_SPACE } : null);
  const online = useOnline();
  const edgeBack = useEdgeBack();
  const ownY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    ownY.value = e.contentOffset.y;
  });
  const failed = !!query?.isError && query.data === undefined;
  // Offline, a query pauses instead of failing and has no data: that is not
  // "nothing here yet", it is "we cannot look" (S1).
  const offlineEmpty = !!query && !online && !failed && query.data === undefined;
  // One banner per screen (S4): offline, or the last refresh failed, with
  // cached content on screen. Nested StaleBanners stay quiet while it shows.
  const stale = !!query && query.data !== undefined && (!!query.isError || !online);
  const [bannerStore] = useState(createBannerStore);
  const [slotStore] = useState(createBannerStore);
  // A photo screen places the banner under its hero with <ScreenBannerSlot />.
  const slotted = useSyncExternalStore(slotStore.subscribe, slotStore.first, slotStore.first) !== null;
  const latestQuery = useRef(query);
  useEffect(() => {
    latestQuery.current = query;
  });
  const retry = useCallback(() => retryOnline(latestQuery.current), []);
  const scope = React.useMemo(() => ({ screenShows: stale, store: bannerStore, slots: slotStore, retry }), [stale, bannerStore, slotStore, retry]);
  const inner = (
    <View style={[styles.column, padded && styles.padded, !scroll && styles.fill, { paddingTop: header || !topInset ? 0 : top, paddingBottom: bottom }, contentStyle]}>
      {failed ? (
        <View style={[!padded && styles.padded, !topInset && !header && { paddingTop: top }]}>
          <QueryError onRetry={() => void query?.refetch()} message={queryMessage(query, lang)} />
        </View>
      ) : offlineEmpty ? (
        <View style={[!padded && styles.padded, !topInset && !header && { paddingTop: top }]}>
          <OfflineState onRetry={() => retryOnline(query)} />
        </View>
      ) : (
        <>
          {stale && !slotted ? (
            <View style={[{ marginBottom: 12 }, !padded && styles.padded, !topInset && !header && { paddingTop: top }]}>
              <ConnectionBanner onRetry={retry} />
            </View>
          ) : null}
          {mode === "chat" ? <ChatArea>{children}</ChatArea> : children}
        </>
      )}
    </View>
  );
  // A form bounds Prev / Next to its own fields (other tab screens stay mounted).
  const content = form ? <FormGroup style={!scroll ? styles.fill : undefined}>{inner}</FormGroup> : inner;
  const scrollCommon = {
    keyboardShouldPersistTaps: "handled" as const,
    // Every screen: a drag down the content puts the keyboard away (QA Sep 29:
    // fields on screens without `keyboard` could not be left otherwise).
    keyboardDismissMode: "interactive" as const,
    showsVerticalScrollIndicator: false,
    contentInsetAdjustmentBehavior: "never" as const,
    refreshControl: pull.control ?? undefined,
  };
  return (
    <BackSlot.Provider value={edgeBack.slot}>
    <BannerScope.Provider value={scope}>
    <KeyboardScope.Provider value={form ? FORM_SCOPE : null}>
    <View style={[styles.screen, style]}>
      {/* The night backdrop (navy to night to deep night, with the gold wash
          from the top right) as one small baked image, stretched. It used to
          be two full-screen gradient layers per screen: every screen kept in
          the tabs held about 50 MB of drawing (QA Sep 29: 130 MB at launch,
          860 MB after visiting each section once). One decoded bitmap is
          now shared by every screen. Photo screens skip it (plain night). */}
      {backdrop ? <Image source={SCREEN_BACKDROP} style={FILL} resizeMode="stretch" accessible={false} importantForAccessibility="no" /> : null}
      {header ? <View style={[styles.column, { paddingTop: top }]}>{header}</View> : null}
      {scroll && form ? (
        // Forms: the focused field scrolls into the band above the keyboard,
        // its bar and the docked action, frame by frame (K4). The library
        // insets the scroll for the keyboard itself, so no automatic iOS
        // keyboard insets here (they would count the keyboard twice).
        <KeyboardAwareScrollView
          onScroll={onScroll as unknown as React.ComponentProps<typeof KeyboardAwareScrollView>["onScroll"]}
          // +32: the dock's 16 pt fade plus 16 pt of air, so the focused
          // field is never half under the docked action (seen on the sims).
          bottomOffset={docked + TOOLBAR_SPACE + 32}
          {...scrollCommon}
        >
          {content}
        </KeyboardAwareScrollView>
      ) : scroll ? (
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} automaticallyAdjustKeyboardInsets {...scrollCommon}>
          {content}
        </Animated.ScrollView>
      ) : (
        <View style={styles.fill}>{content}</View>
      )}
      {/* A fixed header keeps the content below the status bar on its own. */}
      {header ? null : scroll ? <StatusScrim y={ownY} /> : scrollY ? <StatusScrim y={scrollY} /> : null}
      {edgeBack.strip}
      {dock ? (
        <DockedAction toolbar={form} onHeight={setDockHeight}>
          {dock}
        </DockedAction>
      ) : null}
      {form ? <FormToolbar /> : null}
      <LockCover />
    </View>
    </KeyboardScope.Provider>
    </BannerScope.Provider>
    </BackSlot.Provider>
  );
}

const PULL_REFRESH_MAX_MS = 8000;

/** Pull to refresh for any scroll view or list (S2). Pass the refetch (or a
 *  function that refetches several queries and returns a promise); spread
 *  `control` as the list's `refreshControl`. Null fn: no control. */
export function usePullRefresh(fn: (() => unknown) | null | undefined): { refreshing: boolean; onRefresh: () => void; control: React.ReactElement<React.ComponentProps<typeof RefreshControl>> | null } {
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  const onRefresh = useCallback(() => {
    const run = latest.current;
    if (!run) return;
    // Offline, React Query pauses the refetch and its promise stays pending
    // until the connection is back: ask the system to re-check instead and
    // never leave the spinner hanging (the offline banner already says why).
    if (!onlineManager.isOnline()) {
      retryConnection(run);
      return;
    }
    setRefreshing(true);
    // A refetch that gets paused mid-way (connection lost) settles late too:
    // the spinner stops after PULL_REFRESH_MAX_MS whatever happens.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cap = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, PULL_REFRESH_MAX_MS);
    });
    void Promise.race([Promise.resolve().then(() => run()), cap])
      .catch(() => {})
      .finally(() => {
        if (timer) clearTimeout(timer);
        setRefreshing(false);
      });
  }, []);
  const control = fn ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.goldLight} colors={[colors.gold]} progressBackgroundColor={colors.night} /> : null;
  return { refreshing, onRefresh, control };
}

/** Retry from an offline state: ask the system to re-check the connection,
 *  then run `refetch` (a refetch alone stays paused while the app thinks it
 *  is offline). Use it for the Retry of `OfflineState` on list screens. */
export function retryConnection(refetch: () => unknown) {
  const again = () => void Promise.resolve().then(refetch).catch(() => {});
  if (Platform.OS === "web") return again();
  void NetInfo.refresh()
    .catch(() => null)
    .then(again);
}

function retryOnline(query: QueryLike | null | undefined) {
  retryConnection(() => query?.refetch());
}

/** True when a data screen must not render its content (and above all not its
 *  empty state): the query failed with nothing cached, or the phone is offline
 *  with nothing cached. For screens that draw their own list instead of
 *  passing `query` to Screen (S1). Pair it with `<QueryState query={...} />`. */
export function useQueryBlocked(query: QueryLike | null | undefined): boolean {
  const online = useOnline();
  if (!query || query.data !== undefined) return false;
  return !!query.isError || !online;
}

// One connection banner per screen (S4). Screen owns the scope: while it shows
// its own banner, nested StaleBanners render nothing; otherwise only the first
// nested one mounted shows.
type BannerStore = { subscribe: (l: () => void) => () => void; first: () => string | null; add: (id: string) => void; remove: (id: string) => void };
function createBannerStore(): BannerStore {
  let ids: string[] = [];
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    subscribe: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    first: () => ids[0] ?? null,
    add: (id) => {
      if (ids.includes(id)) return;
      ids = [...ids, id];
      emit();
    },
    remove: (id) => {
      if (!ids.includes(id)) return;
      ids = ids.filter((x) => x !== id);
      emit();
    },
  };
}
const BannerScope = createContext<{ screenShows: boolean; store: BannerStore; slots: BannerStore; retry: () => void } | null>(null);
const NO_STORE: BannerStore = { subscribe: () => () => {}, first: () => null, add: () => {}, remove: () => {} };

/** Where the Screen's connection banner goes on a screen that opens on a
 *  PhotoHero: put it right under the hero. Without a slot the banner sits at
 *  the top of the content. Renders nothing while the connection is fine. */
export function ScreenBannerSlot({ style }: { style?: StyleProp<ViewStyle> }) {
  const scope = useContext(BannerScope);
  const id = useId();
  const slots = scope?.slots ?? NO_STORE;
  useEffect(() => {
    slots.add(id);
    return () => slots.remove(id);
  }, [slots, id]);
  if (!scope?.screenShows) return null;
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <ConnectionBanner onRetry={scope.retry} />
    </View>
  );
}

/** Where a screen's TopBar leaves its back action for the edge swipe. */
const BackSlot = createContext<{ set: (fn: (() => void) | null) => void } | null>(null);

/**
 * iOS edge swipe back where the native one cannot work: the first screen of a
 * section opened from More (tasks, vendors, budget...) is the root of its own
 * stack inside the tabs, and screens declared straight in the tabs have no
 * stack at all, so a swipe from the left edge did nothing (QA Sep 29). On
 * those screens a thin strip on the left edge runs the TopBar's back action
 * on a rightward swipe. Pushed screens keep the native gesture untouched.
 */
function useEdgeBack(): { slot: { set: (fn: (() => void) | null) => void }; strip: ReactNode } {
  const navigation = useNavigation();
  const [back, setBack] = useState<(() => void) | null>(null);
  const slot = React.useMemo(() => ({ set: (fn: (() => void) | null) => setBack(() => fn) }), []);
  const route = useRoute();
  // Pushed onto a stack (not its first screen): the native gesture works there.
  const state = navigation.getState() as { type?: string; routes?: { key: string }[] } | undefined;
  const nativeSwipe = state?.type === "stack" && (state.routes?.findIndex((r) => r.key === route.key) ?? 0) > 0;
  const hasBack = !!back;
  const pan = React.useMemo(() => {
    const run = () => back?.();
    return Gesture.Pan()
      .activeOffsetX(14)
      .failOffsetY([-14, 14])
      .onEnd((e) => {
        if (e.translationX > 64 || e.velocityX > 600) runOnJS(run)();
      });
  }, [back]);
  const strip = Platform.OS === "ios" && hasBack && !nativeSwipe ? (
    <GestureDetector gesture={pan}>
      <View style={styles.edge} />
    </GestureDetector>
  ) : null;
  return { slot, strip };
}

/** Backdrop under the status bar for content scrolled up into it: the clock,
 *  the battery and the Dynamic Island never sit on text (QA Sep 29: guest
 *  Schedule, Day-of, couple Guests). Invisible at rest, it fades in over the
 *  first 16 pt of scroll, the way an iOS bar gains its scroll edge. Glass like
 *  the tab bar, with a hairline. Without an offset (a list screen that has not
 *  passed one) it stays on, which is still better than text under the clock. */
export function StatusScrim({ y }: { y?: SharedValue<number> }) {
  const insets = useSafeAreaInsets();
  const fade = useAnimatedStyle(() => ({ opacity: y ? interpolate(y.value, [0, 16], [0, 1], Extrapolation.CLAMP) : 1 }));
  if (insets.top <= 0) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }, fade]}>
      <BlurView intensity={40} tint="dark" style={FILL} blurMethod="dimezisBlurView" />
      <View style={[COVER, { backgroundColor: "rgba(13,17,23,0.62)" }]} />
      <View style={styles.scrimEdge} />
    </Animated.View>
  );
}

/** For list screens that scroll their own FlatList inside `<Screen scroll={false}>`:
 *  spread `listProps` on the list and pass `scrollY` to the Screen, so the
 *  status bar backdrop follows the list as on a scrolling Screen. FlatList
 *  already reports its offset to JS for windowing, so this costs nothing
 *  extra. (The bubble dock it also drove is gone in v1.2; the props keep
 *  their shape so call sites need no change.) */
export function useScrimScroll(): {
  scrollY: SharedValue<number>;
  listProps: {
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
    scrollEventThrottle: number;
    onContentSizeChange: (w: number, h: number) => void;
    onLayout: (e: LayoutChangeEvent) => void;
  };
} {
  const scrollY = useSharedValue(0);
  const listProps = React.useMemo(
    () => ({
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.set(e.nativeEvent.contentOffset.y);
      },
      scrollEventThrottle: 16,
      onContentSizeChange: (_w: number, _h: number) => {},
      onLayout: (_e: LayoutChangeEvent) => {},
    }),
    [scrollY]
  );
  return { scrollY, listProps };
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

/** @deprecated Build 12: use `<Screen keyboard="chat">` with ChatList and
 *  ChatComposer (src/ui/keyboard.tsx), which follow the keyboard frame by
 *  frame. Kept until the last chat screen moves over.
 *
 *  Root wrapper for the non-scrolling chat screens: the composer at the bottom
 *  rides exactly on top of the keyboard.
 *
 *  KeyboardAvoidingView works from its position inside its parent, not on the
 *  screen. Under a header, and above all inside a modal sheet that starts below
 *  the top of the window, that is off by the distance to the top, and on a
 *  667 pt phone the composer ended up under the keyboard (Part 9 audit, D-032).
 *  This wrapper measures its real place in the window and passes it on. */
export function KeyboardFill({ children, modal = false }: { children: ReactNode; modal?: boolean }) {
  const ref = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const [offset, setOffset] = useState(0);
  // Inside an iOS modal sheet the measure is relative to the sheet, not to the
  // screen: it misses the gap the system leaves above the sheet (status bar or
  // Dynamic Island plus about 10 pt). Without it the composer of the Coordinator
  // sat half under the keyboard on the 667 pt phone.
  const sheetGap = modal && Platform.OS === "ios" ? insets.top + 10 : 0;
  const measure = useCallback(() => ref.current?.measureInWindow((_x, y) => setOffset(Math.max(0, Math.round(y || 0)) + sheetGap)), [sheetGap]);
  useEffect(() => {
    const sub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", measure);
    return () => sub.remove();
  }, [measure]);
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

// Baked from the screen gradient: see Screen. 201 x 437 px, about 350 KB decoded.
const SCREEN_BACKDROP = require("../../assets/brand/screen-backdrop.png");

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
  onPaper,
}: {
  label: string;
  onPress?: () => void;
  kind?: ButtonKind;
  /** A text button on a paper card: ink, never gold on cream (plan c). */
  onPaper?: boolean;
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
  const fg = kind === "primary" || kind === "paper" ? colors.night : kind === "text" ? (onPaper ? colors.ink : colors.goldLight) : colors.ivory;
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
      {/* A call to action never ends in an ellipsis and never shrinks: the
          label wraps at its spaces and the button grows. No
          adjustsFontSizeToFit: iOS sizes it against the text's first layout
          width, which inside a row or next to an icon can be about 0, and
          the label came out near invisible (QA Sep 29, guest drawer, website
          sections, the update screen). ButtonRow gives each button enough
          room for its longest word, and stacks the buttons when it cannot.
          flexShrink lets the text wrap instead of pushing the icon out. */}
      <T v="button17" color={fg} size={small ? 16 : 17} center style={{ flexShrink: 1 }}>
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

/** Room a Button needs so its label never breaks inside a word and never runs
 *  past two lines: the longest word, or half the label, plus the padding and
 *  the icon. An estimate from the label (Jost averages about 0.56 em per
 *  character), scaled with Dynamic Type. */
function buttonBasis(child: ReactNode, fontScale: number): number {
  if (!React.isValidElement(child)) return 0;
  const p = child.props as { label?: unknown; icon?: unknown; loading?: unknown; small?: unknown };
  if (typeof p.label !== "string") return 0;
  const size = 17 * Math.min(Math.max(fontScale, 1), 1.3);
  const em = size * 0.56;
  const words = p.label.trim().split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length)) * em;
  const half = (p.label.trim().length * em) / 2;
  const chrome = (p.small ? 32 : 44) + 2 + (p.icon || p.loading ? (p.small ? 18 : 20) + 8 : 0);
  return Math.ceil(Math.max(longest, half) + chrome);
}

/** Two or three buttons side by side with equal widths and heights, so a label
 *  that wraps to two lines does not leave its neighbour shorter. When the
 *  labels do not fit side by side (long Spanish labels, larger text, a narrow
 *  phone) the row wraps and the buttons stack full width: a label never
 *  shrinks and never breaks inside a word. */
export function ButtonRow({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  const { fontScale } = useWindowDimensions();
  const items = React.Children.toArray(children).filter(Boolean);
  const basis = Math.max(96, ...items.map((c) => buttonBasis(c, fontScale)));
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap }, style]}>
      {items.map((child, i) => (
        <View key={i} style={{ flexGrow: 1, flexShrink: 1, flexBasis: basis, minWidth: 0 }}>
          {child}
        </View>
      ))}
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
  // The screen's edge swipe runs the same back action (see useEdgeBack).
  const slot = useContext(BackSlot);
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });
  const has = !!onBack;
  useEffect(() => {
    if (!slot || !has) return;
    slot.set(() => latest.current?.());
    return () => slot.set(null);
  }, [slot, has]);
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
        <T v="meta13" color={on ? colors.goldLight : colors.ivory70} style={{ fontFamily: fonts.bodyMedium }}>
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
  const { width: windowWidth, fontScale } = useWindowDimensions();
  // Its own width, not the window's: inside a card the control is 40 pt
  // narrower, and the registry's three options were cut to "Link to a…"
  // (QA Sep 29). Until measured, the window column stands in.
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? Math.min(windowWidth, 560) - 2 * space.screen;
  // Side by side only while every label fits its segment in two lines and
  // its longest word fits one line; otherwise a vertical list of full rows.
  const em = 15 * 0.56 * Math.min(Math.max(fontScale, 1), 1.3);
  const textWidth = (width - 4) / Math.max(options.length, 1) - 16;
  const fits = options.every((o) => {
    const longestWord = Math.max(...o.label.split(/\s+/).map((w) => w.length)) * em;
    return longestWord <= textWidth && o.label.length * em <= textWidth * 1.8;
  });
  const vertical = stack ?? !fits;
  return (
    <View
      style={[styles.segmented, vertical && styles.segmentedStack]}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== measured) setMeasured(w);
      }}
    >
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
            <T v="meta13" color={on ? colors.night : colors.ivory55} center style={{ fontFamily: fonts.bodyMedium }}>
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

/** Keyboards with no Return key: they get a Done bar on iOS (K6). */
const NUMERIC_KEYBOARDS = new Set(["number-pad", "decimal-pad", "numeric", "phone-pad", "ascii-capable-number-pad"]);

/** Text field. Dark keyboard (the app is dark only), the same 1.3 text size cap
 *  as the Text component, and a card radius when multiline so a tall field does
 *  not read as a blob.
 *
 *  v1.2:
 *  - A numeric, decimal or phone keyboard has no Return key, so it needs a
 *    "Done" (K6). Inside a form (a `keyboard` Screen, a form Sheet) the form
 *    toolbar gives it, with Prev / Next (build 12). Elsewhere, on iOS, the
 *    field adds its own "Done" accessory bar as in wave 1: it is part of the
 *    keyboard, so the automatic keyboard insets of a plain screen account for
 *    it. `doneBar={false}` turns that bar off; a call site's own
 *    `inputAccessoryViewID` wins.
 *  - A search field (`icon="search"`, or `clearable`) shows a clear button
 *    while it has text (K9 to K12). It empties the field through
 *    `onChangeText("")` and keeps the keyboard up. */
export function Input({
  icon,
  style,
  right,
  ref,
  clearable,
  doneBar = true,
  ...props
}: Omit<TextInputProps, "style"> & {
  icon?: IconName;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
  ref?: React.Ref<TextInput>;
  /** Show the clear button while there is text. Default: on for search fields. */
  clearable?: boolean;
  /** The iOS Done bar on numeric keyboards. Default on. */
  doneBar?: boolean;
}) {
  // Inside a Field the field's visible label names the input for VoiceOver
  // and TalkBack; alone, its placeholder does. A call site's own label wins.
  const field = useContext(FieldContext);
  const c = useCopy().common;
  const inner = useRef<TextInput | null>(null);
  const setRef = useCallback(
    (node: TextInput | null) => {
      inner.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref && typeof ref === "object") (ref as React.RefObject<TextInput | null>).current = node;
    },
    [ref]
  );
  const barId = `done-${useId()}`;
  const inForm = useInFormScope();
  const numeric = !props.multiline && !!props.keyboardType && NUMERIC_KEYBOARDS.has(props.keyboardType);
  const withBar = Platform.OS === "ios" && doneBar && numeric && !inForm && !props.inputAccessoryViewID;
  const canClear = (clearable ?? icon === "search") && props.editable !== false && !!props.value;
  return (
    <View style={[styles.input, props.multiline && styles.inputMultiline, style]}>
      {icon ? <Icon name={icon} size={20} color={colors.ivory55} /> : null}
      <TextInput
        ref={setRef}
        accessibilityLabel={field?.label ?? (typeof props.placeholder === "string" ? props.placeholder : undefined)}
        accessibilityHint={field?.hint ?? undefined}
        placeholderTextColor={colors.ivory55}
        selectionColor={colors.goldLight}
        keyboardAppearance="dark"
        maxFontSizeMultiplier={1.3}
        inputAccessoryViewID={withBar ? barId : undefined}
        {...props}
        style={[{ flex: 1, color: colors.ivory, fontFamily: fonts.body, fontSize: 16, paddingVertical: 12 }, props.multiline && { minHeight: 90, textAlignVertical: "top" }]}
      />
      {canClear ? (
        <Pressable
          testID={props.testID ? `${props.testID}-clear` : undefined}
          accessibilityRole="button"
          accessibilityLabel={c.clearSearch}
          hitSlop={4}
          onPress={() => {
            props.onChangeText?.("");
            inner.current?.focus();
          }}
          style={({ pressed }) => [styles.clearHit, pressed && { opacity: 0.6 }]}
        >
          <Icon name="x-circle" size={20} color={colors.ivory55} />
        </Pressable>
      ) : null}
      {right}
      {withBar ? <KeyboardDoneBar nativeID={barId} onDone={() => inner.current?.blur()} /> : null}
    </View>
  );
}

/** The iOS "Done" bar over a keyboard with no Return key (K6). `Input` adds it
 *  by itself outside forms; a raw TextInput opts in with
 *  `inputAccessoryViewID={id}` and `<KeyboardDoneBar nativeID={id} />` next to
 *  it. Inside a form Screen or form Sheet do not add it: the form toolbar
 *  already has Done. Renders nothing off iOS. */
export function KeyboardDoneBar({ nativeID, onDone }: { nativeID: string; onDone?: () => void }) {
  const c = useCopy().common;
  if (Platform.OS !== "ios") return null;
  return (
    <InputAccessoryView nativeID={nativeID} backgroundColor={colors.keyboardBar}>
      <View style={styles.doneBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={c.done}
          onPress={() => {
            onDone?.();
            Keyboard.dismiss();
          }}
          style={({ pressed }) => [styles.doneHit, pressed && { opacity: 0.6 }]}
        >
          <T v="body15" color={colors.goldLight} style={{ fontFamily: fonts.bodySemibold }}>
            {c.done}
          </T>
        </Pressable>
      </View>
    </InputAccessoryView>
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
const FieldContext = createContext<{ label: string; hint?: string | null } | null>(null);

/** The label of the Field a control sits in (for date pickers and other
 *  controls that name themselves). */
export function useFieldLabel(): string | null {
  return useContext(FieldContext)?.label ?? null;
}

export function Field({ label, hint, children, style }: { label: string; hint?: string | null; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ctx = React.useMemo(() => ({ label, hint }), [label, hint]);
  return (
    <View style={[{ gap: 6 }, style]}>
      {/* Stays readable on its own: a Field can hold chips or a segmented
          control, which do not read the label from the context. */}
      <SectionLabel color={colors.ivory55}>{label}</SectionLabel>
      <FieldContext.Provider value={ctx}>{children}</FieldContext.Provider>
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
        <T v="name24" size={Math.max(MIN_BODY, Math.round(size * 0.42))} color={colors.goldLight} style={{ fontFamily: fonts.displaySemibold }}>
          {initials ?? ""}
        </T>
      )}
    </View>
  );
}

/** `below` puts a badge (or anything) under the title instead of beside it:
 *  a wide status badge in `trailing` squeezed long titles to one word per line
 *  on a 375 pt phone (Part 9 audit, D-012). */
/** A secondary action for the ListRow(s) inside, for rows rendered by a
 *  component that does not take one (e.g. a feature's row). ListRow reads it
 *  when it has no `onLongPress` of its own. */
export const ListRowLongPress = createContext<{ onLongPress: () => void; label: string } | null>(null);

export function ListRow({ leading, title, sub, trailing, below, onPress, onLongPress, longPressLabel, chevron = true, last, testID }: { leading?: ReactNode; title: string; sub?: string | null; trailing?: ReactNode; below?: ReactNode; onPress?: () => void; /** Held press; also offered to VoiceOver and TalkBack as a named action. */ onLongPress?: () => void; longPressLabel?: string; chevron?: boolean; last?: boolean; testID?: string }) {
  const ctx = useContext(ListRowLongPress);
  const held = onLongPress ?? ctx?.onLongPress;
  const heldLabel = longPressLabel ?? ctx?.label;
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
  if (!onPress && !held) return inner;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={held ? () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); held(); } : undefined}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}, ${sub}` : title}
      accessibilityActions={held && heldLabel ? [{ name: "longpress", label: heldLabel }] : undefined}
      onAccessibilityAction={held ? (e) => { if (e.nativeEvent.actionName === "longpress") held(); } : undefined}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      {inner}
    </Pressable>
  );
}

/** One line of a home dashboard's "today's briefing" digest (couple and
 *  planner home both use it). Capped to two lines: Part 9 audit D-010 gave
 *  the assistant bubble a reserved band above the tab bar and made every
 *  scrolling screen keep that band clear at the very end of its content, but
 *  that only protects the end of the scroll. A briefing sentence with no
 *  line cap could grow to four lines on a narrow phone, which pushes the
 *  row below it down into the bubble's fixed on-screen position even before
 *  the person has scrolled at all (found at the 360 px breakpoint, fixer
 *  round 3: the bubble sat on the third row's last line and its chevron).
 *  Two lines matches `ListRow`'s own title cap (D-012) and keeps every
 *  row's height predictable regardless of language or sentence length; the
 *  full sentence is always one tap away on the screen it links to. */
export function BriefingRow({ text, tone, onPress }: { text: string; tone: "risk" | "warn" | "info"; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Row gap={14} align="flex-start" style={styles.briefRow}>
        <View style={{ paddingTop: 8 }}>
          <Gem size={6} color={tone === "info" ? colors.gold : colors.amber} />
        </View>
        <T v="body16" color={colors.ivory90} numberOfLines={2} style={{ flex: 1 }}>
          {text}
        </T>
        <Icon name="chev" size={18} color={colors.ivory40} />
      </Row>
    </Pressable>
  );
}

/** One number and its label. The number shrinks to fit on one line and the
 *  label breaks only between words, so a narrow tile never prints "ATTENDIN G"
 *  or "$5,89 0.00" (Part 9 audit, D-008).
 *
 *  The value forces lining figures (not the display font's default old-style
 *  ones): CormorantGaramond's old-style "1" is a bare ascender, indistinguishable
 *  from a capital I, at any count including exactly 1 (fixer round 2, es-MX
 *  store screenshot 05 showed "I le necesitan" where the value was 1). Lining
 *  figures keep every digit cap-height and legible alone; "43", "26%" and
 *  "181" already read fine either way, so this trades nothing away. */
export function StatTile({ value, label, color = colors.ivory, kind = "glass", style }: { value: string; label: string; color?: string; kind?: CardKind; style?: StyleProp<ViewStyle> }) {
  return (
    <Card kind={kind} radiusKey="tile" padding={12} style={[{ flex: 1, minWidth: 0, gap: 4, alignSelf: "stretch" }, style]}>
      <T v="title34" size={34} color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45} maxFontSizeMultiplier={1.1} style={{ fontVariant: ["lining-nums"] }}>
        {value}
      </T>
      {/* A single word shrinks rather than break mid word. A phrase wraps at its
          spaces at full size, up to three lines, so tiles in one row keep one
          type size (the 80% tile on the insights screen used to print smaller).
          Three tiles share a 327 pt row, so the number follows Dynamic Type only
          to 1.1 and the label not at all (like the tab labels): with larger text
          "Contratados" and "respondido" broke mid word. */}
      <T v="meta13" color={colors.ivory55} numberOfLines={labelLines(label) === 1 ? 1 : 3} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1}>
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
      {/* A one-word label keeps to one line and shrinks to fit: with two lines
          allowed, iOS broke "Vestimenta" mid-word on a 390 pt phone. */}
      <T v="meta13" color={colors.ivory} center numberOfLines={/\s/.test(label.trim()) ? 2 : 1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontFamily: fonts.body }}>
        {label}
      </T>
    </Pressable>
  );
}

export function Countdown({ days, hours, minutes, labels }: { days: number; hours: number; minutes: number; labels: { days: string; hours: string; min: string } }) {
  // Part 9 release walk: with three digit days the row was 335 pt wide on a
  // 375 pt phone, wider than the 327 pt column, and its last figure sat under
  // the assistant bubble at rest. Under 400 pt the figures step down and the
  // gaps tighten, so the whole row ends left of the bubble.
  const { width } = useWindowDimensions();
  const narrow = width < 400;
  const cell = (n: number, l: string) => (
    <Row gap={narrow ? 5 : 6} align="baseline" key={l}>
      <T v="display44" size={narrow ? 36 : 44}>
        {String(n).padStart(2, "0")}
      </T>
      <T v="meta13" color={colors.ivory55}>
        {l}
      </T>
    </Row>
  );
  const sep = <View style={{ width: 1, height: 30, backgroundColor: "rgba(201,169,110,0.5)" }} />;
  return (
    <Row gap={narrow ? 11 : 22} align="flex-end">
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
 *  margin, the content scrolls inside, and the sheet rides above the keyboard
 *  and shrinks if the keyboard leaves less room. No fixed offset can squeeze it
 *  on a 667 pt phone any more (Part 9 audit, H5).
 *
 *  v1.2 (K1, K2):
 *  - Opening a sheet puts the keyboard away first. A sheet that opened over a
 *    keyboard never moved (its keyboard avoidance only hears a keyboard that
 *    opens after it), so a picker's Done sat under the keys and typing still
 *    went to the field behind.
 *  - The sheet never climbs under the status bar: it keeps the top safe area
 *    plus 8 pt free, also while the keyboard squeezes it.
 *  - `footer` is docked at the bottom of the sheet, outside the scroll, so it
 *    rides right on top of the keyboard while a field is focused. Use it for
 *    the form's actions: `footer={<SheetActions onCancel={...} onSave={...} />}`.
 *
 *  Build 12 (react-native-keyboard-controller):
 *  - The sheet rides the keyboard frame by frame (interactive dismiss too).
 *  - A form sheet (`footer` given, or `form`) gets the "Prev / Next / Done"
 *    bar over the keyboard and its footer sits right above that bar.
 *  - The focused field is scrolled into the visible part of the sheet once the
 *    keyboard settles and whenever focus moves to another field.
 *  - Toasts shown while it is open appear inside it, above its footer.
 *
 *  `scroll={false}` is for sheets that bring their own list or scroll view:
 *  they get a definite height (the old `top` offset, but never under 320 pt and
 *  never over the window) so a `flex: 1` child has something to fill.
 *
 *  On wide windows the sheet is a centered 640 pt column. */
export function Sheet({
  visible,
  onClose,
  children,
  top = 150,
  scroll = true,
  footer,
  dismissKeyboard = true,
  form,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  top?: number;
  scroll?: boolean;
  /** Docked under the content and above the keyboard (Cancel / Save). */
  footer?: ReactNode;
  /** Put the keyboard away when the sheet opens. Default on (K1). */
  dismissKeyboard?: boolean;
  /** Prev / Next / Done bar over the keyboard. Default: on when there is a
   *  `footer` (a form sheet). Pass true for a form without footer, false for a
   *  footer sheet whose only field is a search. */
  form?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const copy = useCopy();
  const { height, width } = useWindowDimensions();
  const keyboardOpen = useKeyboardOpen();
  const isForm = form ?? !!footer;
  const kbOpen = useKeyboardState((k) => k.isVisible);
  const kbHeight = useKeyboardState((k) => k.height);
  const { scrollRef: sheetScrollRef, contentRef: sheetContentRef, onScroll: onSheetScroll, onLayout: onSheetLayout, onContentSizeChange: onSheetContentSize } = useKeepFocusedVisible({ gap: 16, enabled: visible && scroll });
  const [footerHeight, setFooterHeight] = useState(0);
  // Never under the clock, the Dynamic Island or the status bar (K2).
  const topGap = Math.max(insets.top, 20) + 8;
  const maxHeight = height - topGap;
  const fixed = Math.min(Math.max(height - top, 320), maxHeight);
  const wide = width >= WIDE_BREAKPOINT;
  // Under the keyboard the home indicator is covered: no room kept for it.
  const bottomPad = keyboardOpen ? 12 : insets.bottom + 16;
  // The field that had the keyboard when the sheet opened, read while the
  // sheet renders (before anything inside it mounts), then blurred. Only that
  // one: a field inside the sheet that focuses itself keeps its keyboard.
  // Starts false so a sheet mounted already open counts as opening too.
  const [wasVisible, setWasVisible] = useState(false);
  const [blurTarget, setBlurTarget] = useState<ReturnType<typeof TextInput.State.currentlyFocusedInput> | null>(null);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setBlurTarget(visible && dismissKeyboard ? focusedTextInput() : null);
  }
  useEffect(() => {
    if (!blurTarget) return;
    // Runs once per opening: the target changes only when `visible` does.
    (TextInput.State as Partial<typeof TextInput.State>).blurTextInput?.(blurTarget);
  }, [blurTarget]);
  // The scrim fades while the sheet itself slides up; dragging the grabber
  // band down dismisses it, as the grabber promises (core review P2-35).
  const drag = useSharedValue(0);
  useEffect(() => {
    if (visible) drag.set(0);
  }, [visible, drag]);
  const pan = Gesture.Pan()
    .activeOffsetY(6)
    .onUpdate((e) => {
      drag.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > 90 || e.velocityY > 900) runOnJS(onClose)();
      else drag.set(withSpring(0, { damping: 20, stiffness: 220 }));
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardScope.Provider value={isForm ? FORM_SCOPE : null}>
        <Pressable testID="sheet-scrim" style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.common.close} />
        {/* The form bar floats over a gap between the lifted sheet and the
            keyboard; fill it with the sheet's night so the screen behind the
            modal never shows through there (seen on the SE). */}
        {isForm && kbOpen ? <View pointerEvents="none" style={[styles.sheetKbFill, { height: kbHeight + TOOLBAR_SPACE + 24 }]} /> : null}
        {/* Lifted by the keyboard frame by frame, plus the form bar's room. */}
        <KeyboardLiftView behavior="padding" keyboardVerticalOffset={isForm ? TOOLBAR_SPACE : 0} pointerEvents="box-none" style={[styles.sheetHost, { paddingTop: topGap }]}>
          <Animated.View entering={SlideInDown.duration(260)} style={[styles.sheet, { maxHeight }, !scroll && { height: fixed }, wide && styles.sheetWide, dragStyle]}>
            <GestureDetector gesture={pan}>
              <View style={styles.grabberBand} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={styles.grabber} />
              </View>
            </GestureDetector>
            {scroll ? (
              <ScrollView
                ref={sheetScrollRef}
                onScroll={onSheetScroll}
                scrollEventThrottle={16}
                onLayout={onSheetLayout}
                onContentSizeChange={onSheetContentSize}
                style={footer ? styles.sheetScroll : undefined}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ paddingBottom: footer ? 12 : bottomPad }}
              >
                <View ref={sheetContentRef} collapsable={false}>
                  {children}
                </View>
              </ScrollView>
            ) : (
              <View style={{ flex: 1, paddingBottom: footer ? 12 : bottomPad }}>{children}</View>
            )}
            {footer ? (
              <View style={[styles.sheetFooter, { paddingBottom: bottomPad }]} onLayout={(e) => setFooterHeight(Math.round(e.nativeEvent.layout.height))}>
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </KeyboardLiftView>
        {isForm ? <FormToolbar /> : null}
        {/* The sheet covers the root's toast host: toasts show in here. */}
        <ToastHost base={footer ? 0 : insets.bottom} lift={{ rest: footerHeight, open: footerHeight + (isForm ? TOOLBAR_SPACE : 0) }} />
        {/* A Modal sits above the root layout's lock cover: it draws its own. */}
        <LockCover />
        </KeyboardScope.Provider>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** The standard actions of a form sheet, for `Sheet footer`: Cancel and the
 *  main action side by side, always visible above the keyboard (K2). */
export function SheetActions({
  onCancel,
  onSave,
  saveLabel,
  cancelLabel,
  saving,
  disabled,
  saveTestID,
}: {
  onCancel: () => void;
  onSave: () => void;
  /** Default "Save" / "Guardar". */
  saveLabel?: string;
  /** Default "Cancel" / "Cancelar". */
  cancelLabel?: string;
  saving?: boolean;
  disabled?: boolean;
  saveTestID?: string;
}) {
  const c = useCopy().common;
  return (
    <ButtonRow>
      <Button label={cancelLabel ?? c.cancel} kind="ghost" onPress={onCancel} haptic={false} />
      <Button label={saveLabel ?? c.save} onPress={onSave} loading={saving} disabled={disabled} testID={saveTestID} />
    </ButtonRow>
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

/** "You are offline" for a screen with nothing cached to show (S1): never the
 *  empty state ("Start with the people...") while the phone has no network. */
export function OfflineState({ onRetry, compact }: { onRetry?: () => void; compact?: boolean }) {
  const c = useCopy().common;
  return (
    <Stack gap={12} style={{ alignItems: "center", paddingHorizontal: 16, paddingVertical: compact ? 16 : 32 }}>
      <Icon name="wifi-off" size={28} color={colors.amber} />
      <T v={compact ? "title26" : "title30"} center>
        {c.offlineTitle}
      </T>
      <T v="body15" color={colors.ivory55} center>
        {c.offlineEmptyBody}
      </T>
      {onRetry ? <Button label={c.retry} kind="glass" small full={false} icon="undo" onPress={onRetry} style={{ alignSelf: "center", marginTop: 4 }} /> : null}
    </Stack>
  );
}

/** The banner itself. */
function ConnectionBanner({ onRetry }: { onRetry?: () => void }) {
  const c = useCopy().common;
  return <Banner icon="wifi-off" title={c.offline} body={c.offlineDetail} action={onRetry ? <IconButton name="undo" label={c.retry} onPress={onRetry} /> : undefined} />;
}

/** Shown above cached content when the last refresh failed or the phone is
 *  offline. One per screen (S4): inside a Screen that already shows its own
 *  banner it renders nothing, and of several inside one Screen only the first
 *  shows. */
export function StaleBanner({ onRetry }: { onRetry?: () => void }) {
  const scope = useContext(BannerScope);
  const id = useId();
  const store = scope?.store ?? NO_STORE;
  useEffect(() => {
    store.add(id);
    return () => store.remove(id);
  }, [store, id]);
  const first = useSyncExternalStore(store.subscribe, store.first, store.first);
  if (scope && (scope.screenShows || (first !== null && first !== id))) return null;
  return <ConnectionBanner onRetry={onRetry} />;
}

/** What a data screen shows instead of its content while a query is in trouble.
 *  Renders nothing when the query is healthy. With cached data it is a banner
 *  above the content (one per screen); with none it is the full error state,
 *  or "You are offline" when the phone is offline. The screen must not render
 *  its empty state under it: check `useQueryBlocked(query)`. */
export function QueryState({ query, message }: { query: { isError: boolean; data: unknown; refetch: () => unknown; isFetching?: boolean }; message?: string | null }) {
  const online = useOnline();
  const retry = () => retryOnline(query);
  if (query.isError && query.data === undefined) return <QueryError onRetry={() => void query.refetch()} message={message} />;
  if (!online && query.data === undefined) return <OfflineState onRetry={retry} />;
  if (query.isError || !online) return <StaleBanner onRetry={retry} />;
  return null;
}

/** Primary actions docked above the floating tab bar, on a fade so list rows do
 *  not show through (Part 9 audit, D-011). The list under it must end with
 *  `dockedListPadding` so its last row scrolls clear. */
export function DockedActions({ children, onHeight }: { children: ReactNode; onHeight?: (h: number) => void }) {
  const tabTop = useTabBarTop();
  const [height, setHeight] = useState(0);
  // Toasts sit above these buttons (they stay behind the keyboard when it opens).
  useDockLift(height ? { rest: height, open: 0 } : null);
  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: tabTop + 12 }]}>
      <LinearGradient pointerEvents="none" colors={["rgba(8,11,16,0)", "rgba(8,11,16,0.94)", colors.nightDeep]} locations={[0, 0.3, 1]} style={COVER} />
      <View
        style={[styles.column, { paddingHorizontal: space.screen, paddingTop: 22, gap: 10 }]}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          setHeight(h);
          onHeight?.(h);
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
  clearHit: { width: HIT_TARGET, height: HIT_TARGET, marginRight: -12, alignItems: "center", justifyContent: "center" },
  doneBar: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", minHeight: HIT_TARGET, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.ivory14 },
  doneHit: { minHeight: HIT_TARGET, minWidth: 64, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sheetHost: { flex: 1, justifyContent: "flex-end" },
  input: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderRadius: radius.pill, paddingHorizontal: 18, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  actionTile: { flex: 1, minHeight: 72, paddingHorizontal: 6, paddingVertical: 10, borderRadius: radius.chip, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.ivory14, alignItems: "center", justifyContent: "center", gap: 5 },
  scrim: { ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, backgroundColor: colors.scrim },
  edge: { position: "absolute", left: 0, top: 0, bottom: 0, width: 16 },
  statusScrim: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  scrimEdge: { position: "absolute", left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.ivory14 },
  sheetWide: { maxWidth: SHEET_MAX_WIDTH, alignSelf: "center", width: "100%", borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.goldBorder },
  sheetKbFill: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.night },
  sheet: { flexShrink: 1, backgroundColor: colors.night, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderTopWidth: 1, borderTopColor: colors.goldBorder, paddingHorizontal: 24 },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetFooter: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.ivory09, marginHorizontal: -24, paddingHorizontal: 24 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(247,243,236,0.2)" },
  grabberBand: { alignSelf: "stretch", paddingTop: 10, paddingBottom: 14, marginHorizontal: -24, alignItems: "center" },
  briefRow: { minHeight: 58, borderBottomWidth: 1, borderBottomColor: colors.ivory09, paddingVertical: 8 },
});

export const platformIsAndroid = Platform.OS === "android";
