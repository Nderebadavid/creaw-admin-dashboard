"use client";
import { useEffect, useRef, useState } from "react";
import { listParticipantsAction } from "../actions";
import type { ParticipantPage, ParticipantQuery } from "../api";

/**
 * Server-paginated participant list. Filter changes reset to page 1; search
 * input is debounced so typing doesn't send a request per keystroke.
 */
export function useParticipantList(initial: ParticipantPage) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState<ParticipantQuery>({ page: 1, pageSize: 25 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const firstRender = useRef(true);

  useEffect(() => {
    // The server already rendered page 1; only refetch after the user changes something.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let active = true;
    const timer = setTimeout(
      async () => {
        const response = await listParticipantsAction(query);
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

  const update = (patch: Partial<ParticipantQuery>, resetPage = true) => {
    setLoading(true);
    setQuery((current) => ({ ...current, ...patch, ...(resetPage ? { page: 1 } : {}) }));
  };

  async function refresh() {
    setLoading(true);
    setError("");
    const response = await listParticipantsAction(query);
    if (response.success && response.data) setData(response.data);
    else setError(response.message);
    setLoading(false);
  }

  return { data, query, loading, error, filter: update, refresh };
}
