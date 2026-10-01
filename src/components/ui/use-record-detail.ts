"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Loaded<T> = { success: boolean; message: string; data: T | null };

/**
 * A record's detail (its files, history, child rows…), fetched when its drawer opens
 * instead of riding along with every row of the register. `reload` refetches after an
 * edit. While a different record loads, the previous record's detail is never shown.
 */
export function useRecordDetail<T>(id: number | null, load: (id: number) => Promise<Loaded<T>>) {
  const [state, setState] = useState<{ id: number; data: T | null; error: string } | null>(null);
  const [version, setVersion] = useState(0);
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });
  useEffect(() => {
    if (id === null) return;
    let active = true;
    loader
      .current(id)
      .then((result) => {
        if (!active) return;
        setState({
          id,
          data: result.success ? result.data : null,
          error: result.success ? "" : result.message,
        });
      })
      .catch(() => {
        if (active) setState({ id, data: null, error: "Could not load this record." });
      });
    return () => {
      active = false;
    };
  }, [id, version]);
  const current = state && state.id === id ? state : null;
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return {
    data: current?.data ?? null,
    error: current?.error ?? "",
    loading: id !== null && current === null,
    reload,
  };
}
