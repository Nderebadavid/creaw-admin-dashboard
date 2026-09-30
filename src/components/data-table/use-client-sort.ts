"use client";
import { useState } from "react";
import { sortRows, type SortState, type SortValue } from "./sorting";

/**
 * Sorting for a list that is already fully loaded in the browser. Sort before
 * paging: pass `rows` on to `useClientPaging`, and spread `sorting` into the table.
 */
export function useClientSort<T>(
  rows: readonly T[],
  columns: readonly { id: string; sortValue?: (row: T) => SortValue }[]
) {
  const [sort, setSort] = useState<SortState>();
  const column = columns.find((candidate) => candidate.id === sort?.by);
  return {
    rows: sortRows(rows, sort, column?.sortValue),
    sorting: { sort, onSortChange: setSort },
  };
}
