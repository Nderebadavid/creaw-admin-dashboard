"use client";
import { useEffect, useRef, useState } from "react";

type Loaded<T> = { success: boolean; message: string; data: T | null };

/**
 * Options a dialog needs, fetched once the first time it opens instead of with the page,
 * so a page does not read lists nobody opens. A failed load is retried on the next open.
 */
export function useLoadedOptions<T>(open: boolean, load: () => Promise<Loaded<T>>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });
  useEffect(() => {
    if (!open || data !== null) return;
    let active = true;
    loader
      .current()
      .then((result) => {
        if (!active) return;
        if (result.success && result.data) {
          setData(result.data);
          setError("");
        } else setError(result.message || "Could not load the options.");
      })
      .catch(() => {
        if (active) setError("Could not load the options.");
      });
    return () => {
      active = false;
    };
  }, [open, data]);
  // Loading until the first answer; a failure is retried the next time the dialog opens.
  return { data, error, loading: open && data === null && error === "" };
}
