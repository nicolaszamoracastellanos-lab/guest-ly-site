// Polling screens stop their interval while hidden (tabs stay mounted). When
// the guest comes back, catch up at once instead of waiting a full interval.

import { useEffect, useRef } from "react";

export function useRefetchOnRefocus(focused: boolean, refetch: () => unknown) {
  const wasFocused = useRef(focused);
  useEffect(() => {
    if (focused && !wasFocused.current) void refetch();
    wasFocused.current = focused;
  }, [focused, refetch]);
}
