"use client";
import { Button } from "@/components/ui/button";
export type PageSize = 10 | 25 | 50 | 100;
export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: PageSize;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}) {
  const pages = Math.max(1, Math.ceil(totalItems / pageSize));
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-4 py-4 text-sm"
    >
      <p aria-live="polite">
        {totalItems === 0
          ? "0 records"
          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalItems)} of ${totalItems} records`}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          Rows per page
          <select
            value={pageSize}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value) as PageSize);
              onPageChange(1);
            }}
            className="rounded-lg border bg-white p-2"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span>
          Page {page} of {pages}
        </span>
        <Button
          variant="outline"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
