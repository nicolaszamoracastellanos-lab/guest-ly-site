// #37: the couple's side opened the runsheet. POST /couple/runsheet/seen
// {version} while the screen is in focus, once per version (a new version
// while it is open, after an edit, stamps again), never on a refetch in the
// background. A 404 (MW_SEEN off) stops it for this run of the app.

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { isMissingEndpoint, post } from "@/lib/api";
import { shouldStamp } from "./core";

let missing = false;

export function useRunsheetStamp(version: unknown) {
  const [focused, setFocused] = useState(false);
  const last = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        last.current = null; // the next visit is a new open
      };
    }, []),
  );
  useEffect(() => {
    if (!focused || missing || !shouldStamp(version, last.current)) return;
    last.current = version;
    post("/couple/runsheet/seen", { version }).catch((err) => {
      if (isMissingEndpoint(err)) missing = true;
      else last.current = null; // try again on the next focus
    });
  }, [focused, version]);
}
