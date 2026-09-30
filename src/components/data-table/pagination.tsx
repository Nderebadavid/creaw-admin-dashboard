"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type PageSize = 10 | 25 | 30 | 50 | 100;

const pageButton =
  "flex size-[34px] items-center justify-center rounded-lg border border-creaw-line-strong bg-white text-creaw-ink-soft disabled:opacity-40";

/** Table footer: rows-per-page on the left, "11–20 of 32" and prev/next on the right. */
export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  hint,
}: {
  page: number;
  pageSize: PageSize;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  /** Short usage note beside the page-size select, e.g. "Click a row to open the record". */
  hint?: string;
}) {
  const pages = Math.max(1, Math.ceil(totalItems / pageSize));
  const first = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13.5px] text-creaw-faint"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex items-center gap-2.5">
          Rows per page
          <select
            value={pageSize}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value) as PageSize);
              onPageChange(1);
            }}
            className="h-[34px] rounded-lg border border-creaw-line-strong bg-white px-2 font-semibold text-creaw-ink-soft"
          >
            {[10, 25, 30, 50, 100].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        {hint && <span className="text-[#A39A92]">{hint}</span>}
      </div>
      <div className="flex items-center gap-2.5">
        <span aria-live="polite" className="tabular-nums">
          {first}–{last} of {totalItems}
        </span>
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={pageButton}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className={pageButton}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
