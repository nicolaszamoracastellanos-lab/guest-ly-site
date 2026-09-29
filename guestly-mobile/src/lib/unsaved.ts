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

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Alert } from "react-native";
import { useNavigation } from "expo-router";
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

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !active });
    if (!active) return undefined;
    bypass.current = false;
    return navigation.addListener("beforeRemove", (e) => {
      if (bypass.current) return;
      const type = e.data.action.type;
      if (type !== "GO_BACK" && type !== "POP") return;
      e.preventDefault();
      ask(() => navigation.dispatch(e.data.action));
    });
  }, [active, navigation, ask]);

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
