"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vsla:sidebar:collapsed";

/**
 * Desktop collapse state, persisted to localStorage so it survives reloads.
 * `hydrated` flips true one frame after the stored value is applied -- gate the
 * width transition on it so a persisted-collapsed sidebar doesn't animate open
 * on first paint.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const apply = () => {
      try {
        setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
      } catch {
        // localStorage unavailable (private mode / disabled) -- keep default
      }
    };
    apply();
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore write failures
      }
      return next;
    });
  }, []);

  return { collapsed, toggleCollapsed, hydrated };
}
