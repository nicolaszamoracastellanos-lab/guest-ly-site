// K21: the app's one open gate (lib/appOpenCore.ts), fed by AppState: every
// return to the foreground is an open, everything else a refetch.

import { AppState, type AppStateStatus } from "react-native";
import { get } from "@/lib/api";
import { createOpenGate } from "./appOpenCore";

export const openGate = createOpenGate();

let last: AppStateStatus | string | null | undefined = AppState.currentState;
AppState.addEventListener("change", (next) => {
  if (next === "active" && last !== "active") openGate.markOpen();
  last = next;
});

/** GET /guest/home: the open travels with the first fetch after a launch or a
 *  return to the foreground; a failed one hands it to the next. */
export async function fetchGuestHome<T>(): Promise<T> {
  const path = openGate.homePath();
  try {
    return await get<T>(path);
  } catch (err) {
    if (path.indexOf("seen=0") < 0) openGate.restore();
    throw err;
  }
}
