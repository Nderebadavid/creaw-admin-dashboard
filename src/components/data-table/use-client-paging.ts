"use client";
import { useState } from "react";
import type { PageSize } from "./pagination";

/**
 * Paging for a list that is already fully loaded and filtered in the browser.
 * Spread `pager` into <Pagination>; call `resetPage` when a filter changes.
 */
export function useClientPaging<T>(rows: readonly T[], initialPageSize: PageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(initialPageSize);
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return {
    pageRows,
    resetPage: () => setPage(1),
    pager: {
      page,
      pageSize,
      totalItems: rows.length,
      onPageChange: setPage,
      onPageSizeChange: (size: PageSize) => {
        setPageSize(size);
        setPage(1);
      },
    },
  };
}
