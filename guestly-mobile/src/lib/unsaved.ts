// Unsaved-changes guard for the edit forms (QA Sep 29: leaving a form with
// typed text discarded it without a word). While `dirty`:
//  - back (the TopBar button, the edge swipe, router.back, Android back)
//    asks "Discard your changes?" first;
//  - the native swipe back is paused, since a finished swipe cannot be
//    undone; the back button still works and asks.
// Leaving any other way (signing out, switching weddings, a tab that pops
// its section) is never blocked.
//
//   const leave = useUnsavedGuard(dirty);
//   <TopBar onBack={() => leave(back)} />
//   after a successful save: leave.release(); then navigate.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useNavigation, usePreventRemove } from "expo-router";
import { useCopy } from "@/i18n";

type Leave = ((go: () => void) => void) & { release: () => void };

export function useUnsavedGuard(dirty: boolean): Leave {
  const navigation = useNavigation();
  const c = useCopy().common;
  const bypass = useRef(false);
  const active = dirty;

  const ask = useCallback(
    (onDiscard: () => void) => {
      Alert.alert(c.unsavedTitle, c.unsavedBody, [
        { text: c.keepEditing, style: "cancel" },
        {
          text: c.discard,
          style: "destructive",
          onPress: () => {
            bypass.current = true;
            onDiscard();
          },
        },
      ]);
    },
    [c]
  );

  // Expo Router 58 (React Navigation 8) dropped the "beforeRemove" listener for
  // usePreventRemove: it blocks EVERY removal, hands the blocked action to the
  // callback, and replays it with repeat() once prevention is off. The old rule
  // (only back and pop ask; signing out or switching weddings never does) is kept
  // by replaying every other action at once.
  const [released, setReleased] = useState(false);
  // State adjusted during render: leaving the dirty state arms the guard again.
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setReleased(false);
  }
  usePreventRemove(active && !released, ({ data, repeat }) => {
    const type = data.action.type;
    const proceed = () => {
      setReleased(true);
      repeat();
    };
    if (bypass.current || (type !== "GO_BACK" && type !== "POP")) proceed();
    else ask(proceed);
  });
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !active });
    if (active) bypass.current = false;
  }, [active, navigation]);

  // Screens opened by a cold deep link go "back" by replacing the route,
  // which the listener above does not see: the back button asks here.
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  return useMemo(() => {
    const leave = ((go: () => void) => {
      if (!activeRef.current || bypass.current) go();
      else ask(go);
    }) as Leave;
    leave.release = () => {
      bypass.current = true;
    };
    return leave;
  }, [ask]);
}
