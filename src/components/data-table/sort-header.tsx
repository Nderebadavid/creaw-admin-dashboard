import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { nextSort, type SortState } from "./sorting";

/** The `aria-sort` value for a sortable column's header cell. */
export function ariaSort(sort: SortState | undefined, id: string) {
  if (sort?.by !== id) return "none";
  return sort.order === "asc" ? "ascending" : "descending";
}

/** A column header that sorts by its column: ascending, descending, then unsorted. */
export function SortHeader({
  id,
  sort,
  onSortChange,
  children,
}: {
  id: string;
  sort: SortState | undefined;
  onSortChange: (sort: SortState | undefined) => void;
  children: ReactNode;
}) {
  const order = sort?.by === id ? sort.order : undefined;
  const Icon = order === "asc" ? ArrowUp : order === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={() => onSortChange(nextSort(sort, id))}
      className="group -mx-1 inline-flex items-center gap-1 rounded px-1 font-[inherit] hover:text-creaw-ink focus-visible:outline-2 focus-visible:outline-primary"
    >
      {children}
      <Icon
        size={14}
        aria-hidden="true"
        className={order ? "text-primary" : "text-[#C9C0B7] group-hover:text-creaw-faint"}
      />
    </button>
  );
}
