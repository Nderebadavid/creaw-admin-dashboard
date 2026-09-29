"use client";
import { useEffect, useRef, useState } from "react";
import type { PaginatedData } from "@/types/api";

type ListResult<T> = { success: boolean; message: string; data?: PaginatedData<T> | null };
type BaseQuery = { page?: number; pageSize?: number; search?: string };

/**
 * State for a server-paginated list backed by a Server Action. Filter changes
 * reset to page 1, and a search is debounced so typing doesn't send a request
 * per keystroke. The server renders page 1, so nothing is fetched on mount.
 */
export function usePagedList<T, Q extends BaseQuery>(
  initial: PaginatedData<T>,
  initialQuery: Q,
  load: (query: Q) => Promise<ListResult<T>>
) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState<Q>(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const firstRender = useRef(true);
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let active = true;
    const timer = setTimeout(
      async () => {
        const response = await loader.current(query);
        if (!active) return;
        if (response.success && response.data) {
          setData(response.data);
          setError("");
        } else setError(response.message);
        setLoading(false);
      },
      query.search ? 250 : 0
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  /** Merges a filter change; pass `resetPage: false` for page navigation itself. */
  const filter = (patch: Partial<Q>, resetPage = true) => {
    setLoading(true);
    setQuery((current) => ({ ...current, ...patch, ...(resetPage ? { page: 1 } : {}) }));
  };

  /** Reloads the current page, e.g. after a mutation. */
  async function refresh() {
    setLoading(true);
    setError("");
    const response = await loader.current(query);
    if (response.success && response.data) setData(response.data);
    else setError(response.message);
    setLoading(false);
  }

  return { data, query, loading, error, filter, refresh };
}
