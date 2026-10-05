"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const EVENT = "pending-changed";

/** Call after creating, completing or discarding a pending expense. */
export const notifyPendingChanged = () => window.dispatchEvent(new Event(EVENT));

// Number of pending expenses, refreshed on navigation and on notifyPendingChanged()
export function usePendingCount() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/pending");
    if (res.ok) setCount((await res.json()).length);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    window.addEventListener(EVENT, refresh);
    return () => window.removeEventListener(EVENT, refresh);
  }, [refresh]);

  return count;
}
